"use client";

import { useEffect } from "react";
import { useCallDurationTimer } from "./sip/useCallDurationTimer";
import { useSipAudio } from "./sip/useSipAudio";
import { useSipRegistration } from "./sip/useSipRegistration";
import { useSipSession } from "./sip/useSipSession";

export type SipPhoneState =
  | "unregistered"
  | "registering"
  | "idle"
  | "dialing"
  | "ringing_in"
  | "ringing_out"
  | "active"
  | "on_hold"
  | "ending";

export type SipConfig = {
  sipUser: string;
  sipPass: string;
  wssHost: string;
  extension: string;
};

export function useSipPhone(config: SipConfig | null) {
  const registration = useSipRegistration(config, (incomingSession) => {
    session.handleInvite(incomingSession);
  });

  const timer = useCallDurationTimer(registration.state);

  const session = useSipSession({
    uaRef: registration.uaRef,
    setState: registration.setState,
    setCallStartTime: timer.setCallStartTime,
    resetTimer: () => {
      timer.resetTimer();
      audio.resetAudio();
    },
    config,
  });

  const audio = useSipAudio({
    sessionRef: session.sessionRef,
    phoneRef: registration.uaRef,
    setState: registration.setState,
    callActivatedAtRef: session.callActivatedAtRef,
    holdPendingRef: session.holdPendingRef,
    isOnHoldRef: session.isOnHoldRef,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional
  useEffect(() => {
    return () => {
      if (registration.uaRef.current) {
        registration.unregister(session.sessionRef, session.cleanupCall);
      }
    };
  }, [config?.sipUser, config?.sipPass, config?.wssHost]);

  return {
    state: registration.state,
    error: registration.error,
    register: registration.register,
    unregister: () => registration.unregister(session.sessionRef, session.cleanupCall),
    dial: (number: string) => session.actions.dial(number, registration.state),
    answer: () => session.actions.answer(registration.state),
    reject: () => session.actions.reject(registration.state),
    hangup: session.actions.hangup,
    toggleMute: audio.toggleMute,
    toggleHold: () => audio.toggleHold(registration.state),
    isMuted: audio.isMuted,
    isOnHold: audio.isOnHold,
    remoteNumber: session.remoteNumber,
    callDirection: session.callDirection,
    callDuration: timer.callDuration,
    remoteAudioRef: session.remoteAudioRef,
    sessionRef: session.sessionRef,
    sendDtmf: session.sendDtmf,
  };
}
