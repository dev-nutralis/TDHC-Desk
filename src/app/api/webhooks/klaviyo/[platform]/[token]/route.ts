import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Extracts the flat profile object from all known Klaviyo payload formats.
function extractProfile(body: unknown): Record<string, unknown> {
  const b = body as Record<string, unknown>;
  if (b?.data && (b.data as Record<string, unknown>)?.attributes) {
    return (b.data as Record<string, unknown>).attributes as Record<string, unknown>;
  }
  if (b?.profile) {
    return b.profile as Record<string, unknown>;
  }
  return b as Record<string, unknown>;
}

// Reads a single value from a profile using a klaviyo_field key.
// Supports: top-level fields, "properties.xxx" custom properties, and "$xxx" virtual fields.
// Virtual fields are resolved separately via resolveVirtualField().
function readProfileField(
  profile: Record<string, unknown>,
  klaviyoField: string
): string {
  if (klaviyoField.startsWith("properties.")) {
    const prop = klaviyoField.slice("properties.".length);
    const properties = profile.properties as Record<string, unknown> | undefined;
    return String(properties?.[prop] ?? "").trim();
  }
  return String(profile[klaviyoField] ?? "").trim();
}

// Resolves virtual $fields that come from server-side context, not the Klaviyo profile.
function resolveVirtualField(klaviyoField: string, formName: string): string | null {
  if (klaviyoField === "$form_name") return formName;
  return null;
}

// Interpolates a template string like "{$form_name} - {first_name} {last_name}"
// replacing each {key} with its resolved value.
function interpolateTemplate(
  template: string,
  profile: Record<string, unknown>,
  formName: string
): string {
  return template.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const virtual = resolveVirtualField(key.trim(), formName);
    if (virtual !== null) return virtual;
    return readProfileField(profile, key.trim());
  }).trim();
}

// Applies an optional transform to a raw field value.
function applyTransform(value: string, transform: string | undefined): string {
  if (!transform || !value) return value;
  const parts = value.trim().split(/\s+/);
  if (transform === "split_name_first") return parts[0] ?? value;
  if (transform === "split_name_last") return parts.length > 1 ? parts.slice(1).join(" ") : "";
  return value;
}

const STANDARD_FALLBACK_FIELDS = ["email", "first_name", "last_name", "phone_number"] as const;

// POST /api/webhooks/klaviyo/[platform]/[token]
// Public endpoint — no authentication required. The token in the URL acts as the secret.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string; token: string }> }
) {
  try {
    const { platform: platformSlug, token } = await params;

    // 1. Find the KlaviyoForm matching the token and platform slug
    const form = await prisma.klaviyoForm.findFirst({
      where: {
        token,
        platform: { slug: platformSlug },
      },
      include: { platform: true },
    });

    if (!form) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // 2. Parse Klaviyo payload and extract a flat profile
    const body = await req.json();
    console.log("[klaviyo webhook] raw body:", JSON.stringify(body));
    const profile = extractProfile(body);
    console.log("[klaviyo webhook] extracted profile:", JSON.stringify(profile));

    // 3. Resolve mappings
    type Mapping = { klaviyo_field: string; contact_field_key: string; transform?: string; static_value?: string };
    const mappings = (form.mappings as Mapping[]) ?? [];
    const dealMappings = (form.deal_mappings as Mapping[]) ?? [];

    let fieldValues: Record<string, unknown> = {};

    // Email is always read directly from the Klaviyo profile — required for upsert
    const email = readProfileField(profile, "email");
    if (!email) {
      console.log("[klaviyo webhook] no email in profile:", JSON.stringify(profile));
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    if (mappings.length > 0) {
      for (const { klaviyo_field, contact_field_key, transform, static_value } of mappings) {
        const raw = static_value !== undefined && static_value !== ""
          ? static_value
          : klaviyo_field.includes("{")
            ? interpolateTemplate(klaviyo_field, profile, form.name)
            : resolveVirtualField(klaviyo_field, form.name) ?? readProfileField(profile, klaviyo_field);
        const value = applyTransform(raw, transform);
        if (value) fieldValues[contact_field_key] = value;
      }
    } else {
      // Fallback: auto-detect standard fields so existing forms without mappings still work
      for (const key of STANDARD_FALLBACK_FIELDS) {
        const value = String(profile[key] ?? "").trim();
        if (value) {
          fieldValues[key === "phone_number" ? "phone" : key] = value;
        }
      }
    }

    const platform_id = form.platform_id;

    // 4. Find existing contact by email + platform_id
    const existing = await prisma.$queryRawUnsafe<{ id: string; field_values: unknown }[]>(
      `SELECT id, field_values FROM "Contact" WHERE field_values->>'email' = $1 AND platform_id = $2 LIMIT 1`,
      email,
      platform_id
    );

    if (existing.length > 0) {
      // 5a. Update — only overwrite fields that are provided (non-empty)
      const current = (existing[0].field_values ?? {}) as Record<string, unknown>;
      const updated: Record<string, unknown> = { ...current };

      for (const [key, value] of Object.entries(fieldValues)) {
        if (value) {
          updated[key] = value;
        }
      }

      await prisma.contact.update({
        where: { id: existing[0].id },
        data: { field_values: updated as Prisma.InputJsonValue },
      });
    } else {
      // 5b. Create new contact — user_id is required by schema, use the first available user
      const defaultUser = await prisma.user.findFirst();
      if (!defaultUser) {
        return NextResponse.json({ error: "No users in system" }, { status: 500 });
      }

      await prisma.contact.create({
        data: {
          field_values: fieldValues as Prisma.InputJsonValue,
          platform_id,
          user_id: defaultUser.id,
        },
      });
    }

    // 6. Optionally create a deal
    if (form.create_deal) {
      // Find the contact we just created/updated
      const contact = await prisma.$queryRawUnsafe<{ id: string; user_id: string }[]>(
        `SELECT id, user_id FROM "Contact" WHERE field_values->>'email' = $1 AND platform_id = $2 LIMIT 1`,
        email,
        platform_id
      );

      // Also check by emails key (Klaviyo stores under mapped key)
      const contactRow = contact[0] ?? (await prisma.$queryRawUnsafe<{ id: string; user_id: string }[]>(
        `SELECT id, user_id FROM "Contact" WHERE platform_id = $1 ORDER BY created_at DESC LIMIT 1`,
        platform_id
      ))[0];

      if (contactRow) {
        const dealFieldValues: Record<string, unknown> = {};
        for (const { klaviyo_field, contact_field_key, transform, static_value } of dealMappings) {
          const raw = static_value !== undefined && static_value !== ""
            ? static_value
            : klaviyo_field.includes("{")
              ? interpolateTemplate(klaviyo_field, profile, form.name)
              : resolveVirtualField(klaviyo_field, form.name) ?? readProfileField(profile, klaviyo_field);
          const value = applyTransform(raw, transform);
          if (value) dealFieldValues[contact_field_key] = value;
        }

        await prisma.deal.create({
          data: {
            contact_id: contactRow.id,
            user_id: contactRow.user_id,
            platform_id,
            field_values: dealFieldValues as Prisma.InputJsonValue,
          },
        });
      }
    }

    // 7. Return success
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/webhooks/klaviyo]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
