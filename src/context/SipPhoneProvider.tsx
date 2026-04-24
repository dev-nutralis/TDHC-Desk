"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { useSipPhone } from "@/hooks/useSipPhone";
import { SipPhoneContext, type SipCredentials } from "./SipPhoneContext";

async function fetchCreds(): Promise<SipCredentials | null> {
  try {
    const r = await fetch("/api/sip-credentials");
    if (!r.ok) return null;
    const data = await r.json();
    return data?.enabled ? (data as SipCredentials) : null;
  } catch {
    return null;
  }
}

export function SipPhoneProvider({ children }: { children: ReactNode }) {
  const [creds, setCreds] = useState<SipCredentials | null>(null);

  // Fetch SIP credentials once on mount.
  // Sign token uses expire_time=0 (infinite) so no re-fetch needed on disconnect.
  useEffect(() => {
    fetchCreds().then((data) => { if (data) setCreds(data); });
  }, []);

  const phone = useSipPhone(
    creds?.enabled
      ? { sipUser: creds.sipUser, sipPass: creds.sipPass, wssHost: creds.wssHost, extension: creds.extension }
      : null
  );

  // Call tracking refs
  const callDbIdRef = useRef<string | null>(null);
  const prevStateRef = useRef(phone.state);

  // Track call state transitions → DB
  useEffect(() => {
    const prevState = prevStateRef.current;
    prevStateRef.current = phone.state;

    const wasIdle = prevState === "idle" || prevState === "unregistered" || prevState === "registering";
    const nowInCall =
      phone.state === "dialing" ||
      phone.state === "ringing_in" ||
      phone.state === "ringing_out" ||
      phone.state === "active";

    // Call started
    if (wasIdle && nowInCall) {
      callDbIdRef.current = null;
      fetch("/api/calls/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          direction: phone.callDirection ?? "outbound",
          remoteNumber: phone.remoteNumber,
        }),
      })
        .then((r) => r.json())
        .then((data) => { if (data.callId) callDbIdRef.current = data.callId; })
        .catch(() => {});
    }

    // Call answered
    if (prevState !== "active" && phone.state === "active" && callDbIdRef.current) {
      fetch("/api/calls/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "answer", callId: callDbIdRef.current }),
      }).catch(() => {});
    }

    // Call ended
    const wasInCall =
      prevState === "dialing" || prevState === "ringing_in" ||
      prevState === "ringing_out" || prevState === "active" || prevState === "on_hold";
    const nowEnded = phone.state === "ending" || phone.state === "idle";

    if (wasInCall && nowEnded && callDbIdRef.current) {
      fetch("/api/calls/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end", callId: callDbIdRef.current }),
      }).catch(() => {});
      callDbIdRef.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone.state]);

  // Send end tracking on page unload
  useEffect(() => {
    function handleBeforeUnload() {
      const callId = callDbIdRef.current;
      if (callId) {
        navigator.sendBeacon(
          "/api/calls/track",
          new Blob([JSON.stringify({ action: "end", callId })], { type: "application/json" }),
        );
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  return (
    <SipPhoneContext.Provider value={{ phone, creds }}>
      {/* Hidden audio element for remote SIP stream */}
      <audio ref={phone.remoteAudioRef} autoPlay />
      {children}
    </SipPhoneContext.Provider>
  );
}
