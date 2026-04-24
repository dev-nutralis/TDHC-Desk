"use client";

import { useRef, useState } from "react";
import type { PhoneOperator, Session } from "ys-webrtc-sdk-core";
import type { SipConfig, SipPhoneState } from "@/hooks/useSipPhone";
import { sipError, sipLog, sipWarn } from "./sipLogger";

type SessionDeps = {
  uaRef: React.RefObject<PhoneOperator | null>;
  setState: React.Dispatch<React.SetStateAction<SipPhoneState>>;
  setCallStartTime: (time: number | null) => void;
  resetTimer: () => void;
  config: SipConfig | null;
};

export function useSipSession(deps: SessionDeps) {
  const { uaRef, setState, setCallStartTime, resetTimer } = deps;

  const [remoteNumber, setRemoteNumber] = useState<string>("");
  const [callDirection, setCallDirection] = useState<"inbound" | "outbound" | null>(null);

  const sessionRef = useRef<Session | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const callActivatedAtRef = useRef<number | null>(null);
  const CONCURRENT_WINDOW_MS = 2000;
  const isOnHoldRef = useRef(false);
  const holdPendingRef = useRef(false);
  // Pending flag so handleInvite recognises the PBX callback as outbound agent leg
  const outboundPendingRef = useRef(false);

  function buildAnswerPcConfig(): RTCConfiguration {
    const raw = deps.config?.wssHost;
    if (!raw) return {};
    let host = "";
    try { host = new URL(raw).hostname; } catch {
      host = raw.replace(/^[a-z]+:\/\//i, "").split("/")[0].split(":")[0];
    }
    if (!host) return {};
    return { iceServers: [{ urls: `stun:${host}:11009` }] };
  }

  function attachRemoteAudio(session: Session) {
    if (!remoteAudioRef.current) {
      sipWarn("No audio element for remote audio");
      return;
    }

    function wireTrackEndedListeners(stream: MediaStream) {
      stream.getTracks().forEach((track) => {
        track.addEventListener("ended", () => {
          sipLog("Remote audio track ended");
          if (sessionRef.current === session && !holdPendingRef.current && !isOnHoldRef.current) {
            cleanupCall();
          }
        });
      });
    }

    const stream = session.remoteStream;
    if (stream && stream.getTracks().length > 0) {
      remoteAudioRef.current.srcObject = stream;
      remoteAudioRef.current.play().catch(async (err) => {
        if ((err as DOMException)?.name === "AbortError") return;
        sipError("Audio play error (retrying muted)", err);
        if (remoteAudioRef.current) {
          remoteAudioRef.current.muted = true;
          try {
            await remoteAudioRef.current.play();
            remoteAudioRef.current.muted = false;
          } catch (err2) { sipError("Audio play muted fallback failed", err2); }
        }
      });
      wireTrackEndedListeners(stream);
    }

    session.on("updateRemoteStream", async (updatedStream: unknown) => {
      const s = updatedStream instanceof MediaStream ? updatedStream : session.remoteStream;
      if (remoteAudioRef.current && s) {
        remoteAudioRef.current.srcObject = s;
        await remoteAudioRef.current.play().catch(async (err) => {
          if ((err as DOMException)?.name === "AbortError") return;
          if (remoteAudioRef.current) {
            remoteAudioRef.current.muted = true;
            try { await remoteAudioRef.current.play(); remoteAudioRef.current.muted = false; } catch {}
          }
        });
        if (s) wireTrackEndedListeners(s);
      } else if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
      }
    });
  }

  function cleanupCall() {
    sipLog("Call cleanup");
    sessionRef.current = null;
    callActivatedAtRef.current = null;
    isOnHoldRef.current = false;
    outboundPendingRef.current = false;
    setState((prev) => (prev === "unregistered" ? "unregistered" : "idle"));
    setRemoteNumber("");
    setCallDirection(null);
    resetTimer();
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
  }

  function wireRtcFallbacks(session: Session, attempt = 0) {
    const rtc = session.RTCSession;
    if (!rtc) {
      if (attempt < 10) setTimeout(() => wireRtcFallbacks(session, attempt + 1), 300);
      return;
    }

    rtc.on("ended", () => { sipLog("RTCSession ended"); cleanupCall(); });
    rtc.on("failed", () => { sipLog("RTCSession failed"); cleanupCall(); });

    function wirePcMonitor() {
      const pc = (rtc as any).connection as RTCPeerConnection | null;
      if (!pc) return;
      pc.addEventListener("connectionstatechange", () => {
        sipLog(`RTCPeerConnection state: ${pc.connectionState}`);
        if (pc.connectionState === "closed" && sessionRef.current === session) {
          sipLog("RTCPeerConnection closed — cleaning up");
          cleanupCall();
        }
      });
    }
    wirePcMonitor();
    session.on("peerconnection", () => wirePcMonitor());

    rtc.on("confirmed", () => {
      if (sessionRef.current !== session) return;
      wirePcMonitor();
      if (holdPendingRef.current) {
        attachRemoteAudio(session);
        return;
      }
      if (callActivatedAtRef.current !== null) {
        attachRemoteAudio(session);
        return;
      }
      const now = Date.now();
      callActivatedAtRef.current = now;
      setState("active");
      setCallStartTime(now);
      attachRemoteAudio(session);
    });
  }

  function setupSessionListeners(session: Session, direction: "inbound" | "outbound") {
    sessionRef.current = session;
    callActivatedAtRef.current = null;
    setCallDirection(direction);

    const phone = uaRef.current;
    function onDeleteSession(data: any) {
      const deletedCallId = data?.callId ?? (typeof data === "string" ? data : null);
      if (deletedCallId && session.status?.callId === deletedCallId && sessionRef.current === session) {
        sipLog("deleteSession event — cleaning up");
        (phone as any)?.off("deleteSession", onDeleteSession);
        cleanupCall();
      }
    }
    if (phone) (phone as any).on("deleteSession", onDeleteSession);

    session.on("statusChange", () => {
      const callStatus = session.status?.callStatus;
      sipLog(`Session status=${callStatus}`);

      if (callStatus === "calling") {
        setState("ringing_out");
      } else if (callStatus === "ringing") {
        setState(direction === "inbound" ? "ringing_in" : "ringing_out");
      } else if (callStatus === "talking") {
        if (sessionRef.current !== session) return;
        if (holdPendingRef.current) {
          holdPendingRef.current = false;
          callActivatedAtRef.current = Date.now();
          attachRemoteAudio(session);
          return;
        }
        const now = Date.now();
        if (callActivatedAtRef.current !== null) {
          if (now - callActivatedAtRef.current > CONCURRENT_WINDOW_MS) {
            sipLog("statusChange talking re-fired after window — terminating call");
            cleanupCall();
          }
          return;
        }
        callActivatedAtRef.current = now;
        setState("active");
        setCallStartTime(now);
        attachRemoteAudio(session);
      } else if (callStatus === "connecting") {
        // Do NOT treat "connecting" as hangup — Yeastar fires this during PSTN bridge
        // setup (while dialing the remote party). Hangup is detected via RTCPeerConnection
        // "closed" state and session.on("ended") instead.
        if (holdPendingRef.current) {
          holdPendingRef.current = false;
          callActivatedAtRef.current = Date.now();
          attachRemoteAudio(session);
        }
      }
    });

    session.on("ended", () => { sipLog("Session ended"); cleanupCall(); });
    session.on("failed", () => { sipLog("Session failed"); cleanupCall(); });

    wireRtcFallbacks(session);
  }

  function handleInvite(session: Session) {
    const from = session.status?.number ?? "";

    if (sessionRef.current !== null) {
      sipLog("Ignoring incoming invite — session already active");
      return;
    }

    sipLog(`handleInvite: from="${from}"`);

    // Yeastar 2-stage outbound: PBX calls the agent back after dial() is invoked
    if (outboundPendingRef.current) {
      sipLog("Outbound PBX callback — auto-answering agent leg");
      outboundPendingRef.current = false;
      setupSessionListeners(session, "outbound");
      try {
        (session.RTCSession as any)?.answer({
          mediaConstraints: { audio: true, video: false },
          pcConfig: buildAnswerPcConfig(),
        });
      } catch (err) { sipError("Auto-answer error", err); }
      return;
    }

    // Inbound call
    setRemoteNumber(from);
    setState("ringing_in");
    setupSessionListeners(session, "inbound");
  }

  async function dial(number: string, state: SipPhoneState) {
    const phone = uaRef.current;
    if (!phone || state !== "idle") return;

    const prefix = process.env.NEXT_PUBLIC_YEASTAR_OUTBOUND_PREFIX ?? "9";
    const dialNumber = `${prefix}${number.replace(/\D+/g, "")}`;
    sipLog(`Dialing ${dialNumber}`);
    setRemoteNumber(number);
    setState("dialing");
    outboundPendingRef.current = true;

    function onStartSession(data: { callId: string; session: Session }) {
      const newSession = data?.session ?? (data as unknown as Session);
      (phone as any).off("startSession", onStartSession);
      outboundPendingRef.current = false;
      if (sessionRef.current !== null) return;
      setupSessionListeners(newSession, "outbound");
    }
    phone.on("startSession", onStartSession);

    try {
      const result = await phone.call(dialNumber);
      if (result.code !== 0 && result.message !== "SUCCESS") {
        sipError("Dial failed", result.message);
        (phone as any).off("startSession", onStartSession);
        outboundPendingRef.current = false;
        cleanupCall();
      }
    } catch (err) {
      sipError("Dial error", err);
      (phone as any).off("startSession", onStartSession);
      outboundPendingRef.current = false;
      cleanupCall();
    }
  }

  async function answer(state: SipPhoneState) {
    const session = sessionRef.current;
    if (!session || state !== "ringing_in") return;
    const rtc = session.RTCSession;
    if (!rtc) { sipError("No RTCSession available"); return; }
    try {
      (rtc as any).answer({
        mediaConstraints: { audio: true, video: false },
        pcConfig: buildAnswerPcConfig(),
      });
    } catch (err) { sipError("RTCSession.answer error", err); }
  }

  async function reject(state: SipPhoneState) {
    const session = sessionRef.current;
    if (!session || state !== "ringing_in") return;
    try { (session.RTCSession as any)?.terminate({ status_code: 486, reason_phrase: "Busy Here" }); } catch {}
    cleanupCall();
  }

  async function hangup() {
    const session = sessionRef.current;
    if (session) {
      sipLog("Hanging up active session");
      try { (session.RTCSession as any)?.terminate(); } catch {}
      try { session.hangup(); } catch {}
    } else {
      sipLog("Hangup with no session — clearing stuck state");
    }
    // Always clean up regardless of session (handles stuck dialing/ringing state)
    cleanupCall();
  }

  function sendDtmf(tone: string) {
    sessionRef.current?.dtmf(tone);
  }

  return {
    remoteNumber,
    callDirection,
    sessionRef,
    remoteAudioRef,
    callActivatedAtRef,
    holdPendingRef,
    isOnHoldRef,
    cleanupCall,
    handleInvite,
    sendDtmf,
    actions: { dial, answer, reject, hangup },
  };
}
