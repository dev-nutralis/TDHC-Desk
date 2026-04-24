"use client";

import { useEffect, useRef, useState } from "react";
import type { SipPhoneState } from "@/hooks/useSipPhone";

export function useCallDurationTimer(state: SipPhoneState) {
  const [callDuration, setCallDuration] = useState(0);
  const callStartTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function setCallStartTime(time: number | null) {
    callStartTimeRef.current = time;
    if (time !== null) {
      setCallDuration(0);
      intervalRef.current = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - (callStartTimeRef.current ?? Date.now())) / 1000));
      }, 1000);
    }
  }

  function resetTimer() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    callStartTimeRef.current = null;
    setCallDuration(0);
  }

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { callDuration, setCallStartTime, resetTimer };
}
