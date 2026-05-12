"use client";

import { useEffect, useRef, useState } from "react";
import type { PhoneOperator, Session } from "ys-webrtc-sdk-core";
import type { SipConfig, SipPhoneState } from "@/hooks/useSipPhone";
import { sipError, sipLog, sipWarn } from "./sipLogger";

type OnInviteCallback = (session: Session) => void;

// Stored on globalThis so HMR module reloads don't reset state while the SDK's
// internal logger singleton (which lives outside React's module graph) stays alive.
// Without this, HMR would reset singletons to null and trigger a second
// init() call, causing "Log has been initialized" from ys-webrtc-sdk-core.
const _g = globalThis as typeof globalThis & {
  __sipPhone: PhoneOperator | null;
  __sipDestroy: (() => void) | null;
  __sipInitKey: string | null;
  __sipInitializing: boolean;
};
if (!("__sipPhone" in _g)) _g.__sipPhone = null;
if (!("__sipDestroy" in _g)) _g.__sipDestroy = null;
if (!("__sipInitKey" in _g)) _g.__sipInitKey = null;
if (!("__sipInitializing" in _g)) _g.__sipInitializing = false;

function sdkDestroy() {
  if (_g.__sipDestroy) {
    try { _g.__sipDestroy(); } catch {}
    _g.__sipDestroy = null;
  }
  _g.__sipPhone = null;
  _g.__sipInitKey = null;
}

export function useSipRegistration(config: SipConfig | null, onInvite: OnInviteCallback) {
  const [state, setState] = useState<SipPhoneState>("unregistered");
  const [error, setError] = useState<string | null>(null);

  const uaRef = useRef<PhoneOperator | null>(_g.__sipPhone);

  async function register() {
    if (!config) return;

    const key = `${config.sipUser}@${config.wssHost}`;

    // Already registered with same credentials — nothing to do
    if (_g.__sipInitKey === key && _g.__sipPhone) {
      sipLog("Already registered, reusing existing PhoneOperator");
      uaRef.current = _g.__sipPhone;
      setState("idle");
      return;
    }

    // Another registration is in flight — skip
    if (_g.__sipInitializing) {
      sipLog("Init already in progress, skipping duplicate register()");
      return;
    }

    // Tear down any existing instance
    sdkDestroy();

    sipLog(`Registering user=${config.sipUser} pbx=${config.wssHost} passLen=${config.sipPass?.length ?? 0}`);
    _g.__sipInitializing = true;
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

      _g.__sipPhone = phone;
      _g.__sipDestroy = destroy;
      _g.__sipInitKey = key;
      _g.__sipInitializing = false;
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
      _g.__sipInitializing = false;
      if (!_g.__sipPhone) sdkDestroy();
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
      if (_g.__sipPhone && sessionRef.current) {
        const callId = sessionRef.current.status.callId;
        if (callId) _g.__sipPhone.hangup(callId);
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
      if (_g.__sipInitKey !== key || !_g.__sipPhone) {
        register();
      } else {
        uaRef.current = _g.__sipPhone;
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
