<?php
/**
 * Klaviyo ↔ Elementor Forms Integration
 *
 * Listens for Elementor Pro form submissions and syncs contacts to
 * Klaviyo. Profile data is written first (upsert), then the contact
 * is subscribed to the appropriate lists.
 *
 * Profile upsert uses a two-step pattern required by the Klaviyo API:
 *   1. POST /api/profiles/  — attempt to create the profile.
 *      On a 409 Conflict the existing profile ID is extracted from
 *      the error response and a PATCH is issued instead.
 *   2. POST /api/profile-subscription-bulk-create-jobs/
 *      — record marketing consent and attach the profile to the lists.
 *
 * After Klaviyo sync the profile is also sent directly to the CRM
 * webhook so that form_name and other properties arrive immediately
 * without depending on Klaviyo's async webhook forwarding.
 *
 * Debug output is attached to the Elementor AJAX response under the
 * "klaviyo_debug" key and is visible in the browser DevTools Network tab.
 *
 * Supported forms:
 *   - contact_form  → lists: TTa9zB, XjU3C4  | label: "Kontakt forma"
 *   - prijava_bp    → lists: TTa9zB, XhhMrb  | label: "Prijava na besplatni tečaj"
 *   - prijava_sp    → lists: TTa9zB, TTHxfw  | label: "Prijava na tečaj"
 *
 * @package KlaviyoElementor
 */

if ( ! defined( 'ABSPATH' ) ) {
    return;
}

final class Klaviyo_Elementor_Integration {

    const API_KEY      = 'pk_TwsTGF_d7b84008c1dd41bd6298f50a2e65feb93e';
    const API_REVISION = '2024-10-15';
    const API_BASE     = 'https://a.klaviyo.com/api';
    const HTTP_TIMEOUT = 8;
    const MAX_PROPERTY_LENGTH = 5000;

    // Per-form CRM webhook URLs — each Elementor form routes to its own
    // CRM integration so the correct Klaviyo source attribute is set automatically.
    // Keys must match the "Form Name" set in the Elementor widget settings.
    private static function get_crm_webhook_map() {
        return array(
            'contact_form' => 'https://tdhc-desk.vercel.app/api/webhooks/klaviyo/evalley/19c61312-ab3d-4188-99a2-43e9dee6c733',
            'prijava_bp'   => 'https://tdhc-desk.vercel.app/api/webhooks/klaviyo/evalley/9433a62e-6ca6-4ebf-8030-e49c6cb0288e',
            'prijava_sp'   => 'https://tdhc-desk.vercel.app/api/webhooks/klaviyo/evalley/1661059a-7db5-4b57-9836-86f6bbe4d889',
        );
    }

    private static function get_form_map() {
        return array(
            'contact_form' => array( 'TTa9zB', 'XjU3C4' ),
            'prijava_bp'   => array( 'TTa9zB', 'XhhMrb' ),
            'prijava_sp'   => array( 'TTa9zB', 'TTHxfw' ),
        );
    }

    /**
     * Maps internal Elementor form names to human-readable labels.
     *
     * These labels are stored as the "form_name" property on the
     * Klaviyo profile so that CRM webhooks and flows can identify
     * which form the contact submitted without exposing internal
     * Elementor form identifiers.
     *
     * @return array<string, string>
     */
    private static function get_form_labels() {
        return array(
            'contact_form' => 'Kontakt forma',
            'prijava_bp'   => 'Prijava na besplatni tečaj',
            'prijava_sp'   => 'Prijava na tečaj',
        );
    }

    public static function init() {
        add_action(
            'elementor_pro/forms/new_record',
            array( __CLASS__, 'handle_submission' ),
            20,
            2
        );
    }

    public static function handle_submission( $record, $handler ) {

        if ( ! self::is_api_key_configured() ) {
            self::add_debug( $handler, 'error', 'API key not configured.' );
            return;
        }

        if ( ! is_object( $record ) || ! method_exists( $record, 'get_form_settings' ) ) {
            return;
        }

        $form_name = (string) $record->get_form_settings( 'form_name' );
        $form_map  = self::get_form_map();

        if ( ! isset( $form_map[ $form_name ] ) ) {
            return;
        }

        $list_ids = $form_map[ $form_name ];
        $fields   = self::extract_fields( $record );
        $built    = self::build_profile_data( $form_name, $fields );

        if ( empty( $built['email'] ) ) {
            self::add_debug( $handler, 'error', 'Missing or invalid email.', array(
                'form_name'      => $form_name,
                'raw_fields'     => $fields,
                'all_field_keys' => array_keys( $fields ),
            ) );
            return;
        }

        // Step 1: write full profile attributes to Klaviyo.
        $profile_result = self::upsert_profile( $built['email'], $built['profile_attributes'] );

        // Step 2: subscribe the contact to all target lists.
        $subscribe_results = array();
        $subscribe_ok      = true;

        foreach ( $list_ids as $list_id ) {
            $result                        = self::subscribe_to_list( $list_id, $built['email'], $built['phone_number'] );
            $subscribe_results[ $list_id ] = $result;
            if ( ! $result['ok'] ) {
                $subscribe_ok = false;
            }
        }

        // Step 3: send directly to the per-form CRM webhook.
        // Each form routes to a dedicated CRM integration that carries the
        // correct Klaviyo source attribute — no async Klaviyo forwarding needed.
        $crm_result = self::send_to_crm( $form_name, $built );

        $overall_ok = $profile_result['ok'] && $subscribe_ok;

        self::add_debug(
            $handler,
            $overall_ok ? 'success' : 'error',
            $overall_ok ? 'Profile upserted and subscribed.' : 'One or more Klaviyo calls failed.',
            array(
                'form_name'        => $form_name,
                'form_label'       => $built['form_label'],
                'list_ids'         => $list_ids,
                'email'            => $built['email'],
                'phone_normalized' => $built['phone_number'],
                'raw_fields'       => $fields,
                'all_field_keys'   => array_keys( $fields ),
                'profile_step'     => $profile_result,
                'subscribe_steps'  => $subscribe_results,
                'crm_step'         => $crm_result,
            )
        );
    }

    private static function extract_fields( $record ) {
        $output = array();

        if ( ! method_exists( $record, 'get' ) ) {
            return $output;
        }

        $raw = $record->get( 'fields' );
        if ( ! is_array( $raw ) ) {
            return $output;
        }

        foreach ( $raw as $id => $field ) {
            $output[ (string) $id ] = isset( $field['value'] ) ? (string) $field['value'] : '';
        }

        return $output;
    }

    private static function build_profile_data( $form_name, array $fields ) {

        $email = self::sanitize_email_field( $fields, 'email' );

        if ( '' === $email ) {
            return array(
                'email'              => '',
                'phone_number'       => '',
                'form_label'         => '',
                'profile_attributes' => array(),
            );
        }

        $phone_e164 = self::normalize_phone_number(
            self::sanitize_text_field( $fields, 'phone' )
        );

        $attributes = array(
            'email' => $email,
        );

        $first_name = self::sanitize_text_field( $fields, 'name' );
        if ( '' !== $first_name ) {
            $attributes['first_name'] = $first_name;
        }

        if ( '' !== $phone_e164 ) {
            $attributes['phone_number'] = $phone_e164;
        }

        // Resolve the human-readable label for this form.
        // Falls back to the raw form_name if no label is defined.
        $labels     = self::get_form_labels();
        $form_label = isset( $labels[ $form_name ] ) ? $labels[ $form_name ] : $form_name;

        // Always store the human-readable form label as a Klaviyo
        // profile property so CRM webhooks and flows can filter by
        // which form the contact originally submitted.
        $properties = array(
            'form_name' => $form_label,
        );

        switch ( $form_name ) {

            case 'contact_form':
                $poruka = self::sanitize_text_field( $fields, 'text_area', self::MAX_PROPERTY_LENGTH );
                if ( '' !== $poruka ) {
                    $properties['poruka'] = $poruka;
                }
                break;

            case 'prijava_bp':
                $cas = self::sanitize_text_field( $fields, 'cas_kontakta' );
                if ( '' !== $cas ) {
                    $properties['cas_kontakta'] = $cas;
                }
                break;

            case 'prijava_sp':
                $cas = self::sanitize_text_field( $fields, 'cas_kontakta' );
                if ( '' !== $cas ) {
                    $properties['cas_kontakta'] = $cas;
                }

                $kod = self::sanitize_text_field( $fields, 'koda_popust' );
                if ( '' !== $kod ) {
                    $properties['kod_za_popust'] = $kod;
                }
                break;
        }

        $attributes['properties'] = $properties;

        return array(
            'email'              => $email,
            'phone_number'       => $phone_e164,
            'form_label'         => $form_label,
            'profile_attributes' => $attributes,
        );
    }

    /**
     * Sends profile data directly to the per-form CRM webhook.
     *
     * Each Elementor form maps to a dedicated CRM integration that carries
     * the correct Klaviyo source + attribute automatically.
     */
    private static function send_to_crm( $form_name, array $built ) {
        $map = self::get_crm_webhook_map();
        $url = isset( $map[ $form_name ] ) ? $map[ $form_name ] : '';

        if ( '' === $url ) {
            return array( 'ok' => false, 'message' => 'No CRM webhook URL for form: ' . $form_name );
        }

        $payload = array(
            'data' => array(
                'type'       => 'profile',
                'attributes' => $built['profile_attributes'],
            ),
        );

        $args = array(
            'method'      => 'POST',
            'timeout'     => self::HTTP_TIMEOUT,
            'redirection' => 0,
            'blocking'    => true,
            'headers'     => array(
                'Content-Type' => 'application/json',
                'Accept'       => 'application/json',
            ),
            'body'        => wp_json_encode( $payload ),
        );

        $response = wp_remote_request( $url, $args );

        if ( is_wp_error( $response ) ) {
            return array( 'ok' => false, 'message' => $response->get_error_message() );
        }

        $code = (int) wp_remote_retrieve_response_code( $response );
        $body = json_decode( (string) wp_remote_retrieve_body( $response ), true );

        return array(
            'ok'      => $code >= 200 && $code < 300,
            'code'    => $code,
            'body'    => $body,
        );
    }

    private static function upsert_profile( $email, array $attributes ) {

        $payload = array(
            'data' => array(
                'type'       => 'profile',
                'attributes' => $attributes,
            ),
        );

        $response = self::request( 'POST', '/profiles/', $payload );

        if ( 201 === $response['code'] ) {
            return array(
                'ok'      => true,
                'code'    => $response['code'],
                'message' => 'Profile created.',
                'body'    => $response['body'],
            );
        }

        if ( 409 === $response['code'] ) {
            $existing_id = self::extract_duplicate_profile_id( $response['body'] );

            if ( '' === $existing_id ) {
                return array(
                    'ok'      => false,
                    'code'    => $response['code'],
                    'message' => 'Conflict but no existing profile ID found in response.',
                    'body'    => $response['body'],
                );
            }

            $patch_payload = array(
                'data' => array(
                    'type'       => 'profile',
                    'id'         => $existing_id,
                    'attributes' => $attributes,
                ),
            );

            $patch = self::request( 'PATCH', '/profiles/' . rawurlencode( $existing_id ) . '/', $patch_payload );

            if ( 200 === $patch['code'] ) {
                return array(
                    'ok'      => true,
                    'code'    => $patch['code'],
                    'message' => 'Profile updated.',
                    'body'    => $patch['body'],
                );
            }

            return array(
                'ok'      => false,
                'code'    => $patch['code'],
                'message' => 'Profile update (PATCH) failed.',
                'body'    => $patch['body'],
            );
        }

        return array(
            'ok'      => false,
            'code'    => $response['code'],
            'message' => 'Profile create failed.',
            'body'    => $response['body'],
        );
    }

    private static function subscribe_to_list( $list_id, $email, $phone_number ) {

        $sub_attributes = array( 'email' => $email );

        if ( '' !== $phone_number ) {
            $sub_attributes['phone_number'] = $phone_number;
        }

        $payload = array(
            'data' => array(
                'type'       => 'profile-subscription-bulk-create-job',
                'attributes' => array(
                    'profiles' => array(
                        'data' => array(
                            array(
                                'type'       => 'profile',
                                'attributes' => $sub_attributes,
                            ),
                        ),
                    ),
                    'historical_import' => false,
                ),
                'relationships' => array(
                    'list' => array(
                        'data' => array(
                            'type' => 'list',
                            'id'   => $list_id,
                        ),
                    ),
                ),
            ),
        );

        $response = self::request( 'POST', '/profile-subscription-bulk-create-jobs/', $payload );

        if ( 202 === $response['code'] ) {
            return array(
                'ok'      => true,
                'code'    => $response['code'],
                'message' => 'Subscription queued.',
                'body'    => $response['body'],
            );
        }

        return array(
            'ok'      => false,
            'code'    => $response['code'],
            'message' => 'Subscription request failed.',
            'body'    => $response['body'],
        );
    }

    private static function extract_duplicate_profile_id( $body ) {
        if ( ! is_array( $body ) || empty( $body['errors'] ) ) {
            return '';
        }

        foreach ( $body['errors'] as $error ) {
            if ( isset( $error['meta']['duplicate_profile_id'] ) ) {
                return (string) $error['meta']['duplicate_profile_id'];
            }
        }

        return '';
    }

    private static function request( $method, $path, array $payload ) {

        $args = array(
            'method'      => $method,
            'timeout'     => self::HTTP_TIMEOUT,
            'redirection' => 0,
            'blocking'    => true,
            'headers'     => array(
                'Authorization' => 'Klaviyo-API-Key ' . self::API_KEY,
                'Content-Type'  => 'application/json',
                'Accept'        => 'application/json',
                'revision'      => self::API_REVISION,
            ),
            'body'        => wp_json_encode( $payload ),
        );

        $response = wp_remote_request( self::API_BASE . $path, $args );

        if ( is_wp_error( $response ) ) {
            return array(
                'code' => 0,
                'body' => array( 'wp_error' => $response->get_error_message() ),
            );
        }

        $code     = (int) wp_remote_retrieve_response_code( $response );
        $raw_body = (string) wp_remote_retrieve_body( $response );
        $body     = json_decode( $raw_body, true );

        return array(
            'code' => $code,
            'body' => null !== $body ? $body : $raw_body,
        );
    }

    private static function sanitize_email_field( array $fields, $key ) {
        if ( ! isset( $fields[ $key ] ) ) {
            return '';
        }
        $email = sanitize_email( trim( $fields[ $key ] ) );
        return is_email( $email ) ? $email : '';
    }

    private static function sanitize_text_field( array $fields, $key, $max_length = null ) {
        if ( ! isset( $fields[ $key ] ) ) {
            return '';
        }
        $value = sanitize_text_field( $fields[ $key ] );
        if ( null !== $max_length && strlen( $value ) > $max_length ) {
            $value = function_exists( 'mb_substr' )
                ? mb_substr( $value, 0, $max_length )
                : substr( $value, 0, $max_length );
        }
        return $value;
    }

    private static function normalize_phone_number( $raw ) {
        if ( ! is_string( $raw ) ) {
            return '';
        }
        $raw = trim( $raw );
        if ( '' === $raw ) {
            return '';
        }
        $has_plus = ( '+' === substr( $raw, 0, 1 ) );
        $digits   = preg_replace( '/\D+/', '', $raw );
        if ( '' === $digits ) {
            return '';
        }
        if ( $has_plus ) {
            $e164 = '+' . $digits;
        } elseif ( 0 === strpos( $digits, '00' ) ) {
            $e164 = '+' . substr( $digits, 2 );
        } elseif ( 0 === strpos( $digits, '386' ) ) {
            $e164 = '+' . $digits;
        } elseif ( 0 === strpos( $digits, '0' ) ) {
            $e164 = '+386' . substr( $digits, 1 );
        } else {
            $e164 = '+386' . $digits;
        }
        $digit_count = strlen( preg_replace( '/\D+/', '', $e164 ) );
        if ( $digit_count < 8 || $digit_count > 15 ) {
            return '';
        }
        return $e164;
    }

    private static function add_debug( $handler, $status, $message, array $context = array() ) {
        if ( ! is_object( $handler ) || ! method_exists( $handler, 'add_response_data' ) ) {
            return;
        }
        $payload = array_merge(
            array(
                'status'    => $status,
                'message'   => $message,
                'timestamp' => gmdate( 'c' ),
            ),
            $context
        );
        $handler->add_response_data( true, array( 'klaviyo_debug' => $payload ) );
    }

    private static function is_api_key_configured() {
        $key = self::API_KEY;
        return is_string( $key ) && strlen( $key ) > 10 && strpos( $key, 'pk_' ) === 0;
    }
}

Klaviyo_Elementor_Integration::init();
