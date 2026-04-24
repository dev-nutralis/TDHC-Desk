"use client";

import React, { createContext, useContext } from "react";
import type { SipPhoneState } from "@/hooks/useSipPhone";

export type SipCredentials = {
  enabled: boolean;
  extension: string;
  sipUser: string;
  sipPass: string;
  wssHost: string;
};

export type SipPhoneContextType = {
  phone: {
    state: SipPhoneState;
    error: string | null;
    dial: (number: string) => void;
    answer: () => void;
    reject: () => void;
    hangup: () => void;
    toggleMute: () => void;
    toggleHold: () => void;
    isMuted: boolean;
    isOnHold: boolean;
    remoteNumber: string;
    callDirection: "inbound" | "outbound" | null;
    callDuration: number;
    remoteAudioRef: React.RefObject<HTMLAudioElement | null>;
    sendDtmf: (tone: string) => void;
  } | null;
  creds: SipCredentials | null;
};

export const SipPhoneContext = createContext<SipPhoneContextType>({
  phone: null,
  creds: null,
});

export function useSipPhoneContext() {
  return useContext(SipPhoneContext);
}
