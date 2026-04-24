"use client";

import { useEffect, useRef, useState } from "react";
import type { PhoneOperator, Session } from "ys-webrtc-sdk-core";
import type { SipConfig, SipPhoneState } from "@/hooks/useSipPhone";
import { sipError, sipLog, sipWarn } from "./sipLogger";

type OnInviteCallback = (session: Session) => void;

// Module-level singleton — survives React StrictMode double-mount in dev.
// Only one PhoneOperator instance exists at a time per page load.
let _phone: PhoneOperator | null = null;
let _destroy: (() => void) | null = null;
let _initKey: string | null = null; // tracks which config is currently registered
let _initializing = false;

function sdkDestroy() {
  if (_destroy) {
    try { _destroy(); } catch {}
    _destroy = null;
  }
  _phone = null;
  _initKey = null;
}

export function useSipRegistration(config: SipConfig | null, onInvite: OnInviteCallback) {
  const [state, setState] = useState<SipPhoneState>("unregistered");
  const [error, setError] = useState<string | null>(null);

  // uaRef exposes the current PhoneOperator to the rest of the hooks
  const uaRef = useRef<PhoneOperator | null>(_phone);

  // Keep uaRef in sync when module-level phone changes
  function syncUaRef() {
    uaRef.current = _phone;
  }

  async function register() {
    if (!config) return;

    const key = `${config.sipUser}@${config.wssHost}`;

    // Already registered with same credentials — nothing to do
    if (_initKey === key && _phone) {
      sipLog("Already registered, reusing existing PhoneOperator");
      uaRef.current = _phone;
      setState("idle");
      return;
    }

    // Another registration is in flight — skip
    if (_initializing) {
      sipLog("Init already in progress, skipping duplicate register()");
      return;
    }

    // Tear down any existing instance
    sdkDestroy();

    sipLog(`Registering user=${config.sipUser} pbx=${config.wssHost} passLen=${config.sipPass?.length ?? 0}`);
    _initializing = true;
    setState("registering");
    setError(null);

    try {
      const { init } = await import("ys-webrtc-sdk-core");

      const { phone, destroy } = await init({
        username: config.sipUser,
        secret: config.sipPass,
        pbxURL: config.wssHost,
        enableLog: false,
      });

      _phone = phone;
      _destroy = destroy;
      _initKey = key;
      _initializing = false;
      uaRef.current = phone;

      phone.on("registered", () => {
        sipLog("Registered");
        setState("idle");
        setError(null);
      });

      phone.on("registrationFailed", () => {
        sipWarn("Registration failed");
        setState("unregistered");
        setError("Registration failed");
      });

      phone.on("disconnected", () => {
        sipError("Transport disconnected");
        setState("unregistered");
      });

      phone.on("incoming", (data: { callId: string; session: Session }) => {
        const session = data?.session ?? (data as unknown as Session);
        sipLog("Incoming call", { number: session.status?.number });
        onInvite(session);
      });

      phone.start();
      sipLog("PhoneOperator started");
    } catch (err) {
      _initializing = false;
      // Only destroy if we didn't get a valid phone instance back
      if (!_phone) sdkDestroy();
      sipError("Registration error", JSON.stringify(err), err);
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null
          ? JSON.stringify(err)
          : "Registration failed";
      setError(msg);
      setState("unregistered");
    }
  }

  async function unregister(
    sessionRef: React.RefObject<Session | null>,
    cleanupCall: () => void,
  ) {
    try {
      if (_phone && sessionRef.current) {
        const callId = sessionRef.current.status.callId;
        if (callId) _phone.hangup(callId);
      }
    } catch {}
    sdkDestroy();
    uaRef.current = null;
    cleanupCall();
    setState("unregistered");
  }

  // Register when config becomes available (once)
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional
  useEffect(() => {
    if (config) {
      const key = `${config.sipUser}@${config.wssHost}`;
      if (_initKey !== key || !_phone) {
        register();
      } else {
        // Already registered — sync state
        uaRef.current = _phone;
        setState("idle");
      }
    }
    return () => {
      // No teardown on unmount in dev StrictMode — keep the singleton alive
    };
  }, [config?.sipUser, config?.sipPass, config?.wssHost]);

  // Re-register when tab becomes visible after disconnect
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && config && state === "unregistered") {
        sipLog("Tab visible, re-registering...");
        register();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [config, state]);

  return { state, setState, error, setError, uaRef, register, unregister };
}
