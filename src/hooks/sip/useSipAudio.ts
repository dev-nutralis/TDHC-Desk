"use client";

import { useState } from "react";
import type { PhoneOperator, Session } from "ys-webrtc-sdk-core";
import type { SipPhoneState } from "@/hooks/useSipPhone";

type AudioDeps = {
  sessionRef: React.RefObject<Session | null>;
  phoneRef: React.RefObject<PhoneOperator | null>;
  setState: React.Dispatch<React.SetStateAction<SipPhoneState>>;
  callActivatedAtRef: React.RefObject<number | null>;
  holdPendingRef: React.RefObject<boolean>;
  isOnHoldRef: React.RefObject<boolean>;
};

export function useSipAudio(deps: AudioDeps) {
  const { sessionRef, phoneRef, setState, holdPendingRef, isOnHoldRef } = deps;
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);

  function toggleMute() {
    const session = sessionRef.current;
    const phone = phoneRef.current;
    if (!session || !phone) return;

    const callId = session.status.callId;
    holdPendingRef.current = true;
    if (isMuted) {
      phone.unmute(callId);
    } else {
      phone.mute(callId);
    }
    setIsMuted(!isMuted);
  }

  function toggleHold(state: SipPhoneState) {
    const session = sessionRef.current;
    const phone = phoneRef.current;
    if (!session || !phone || (state !== "active" && state !== "on_hold")) return;

    const callId = session.status.callId;
    const newHold = !isOnHold;
    holdPendingRef.current = true;
    isOnHoldRef.current = newHold;
    if (newHold) {
      phone.hold(callId);
    } else {
      phone.unhold(callId);
    }
    setIsOnHold(newHold);
    setState(newHold ? "on_hold" : "active");
  }

  function resetAudio() {
    setIsMuted(false);
    setIsOnHold(false);
    isOnHoldRef.current = false;
  }

  return { isMuted, isOnHold, toggleMute, toggleHold, resetAudio };
}
