"use client";

import { useState } from "react";
import { Delete, Phone, PhoneOff, MicOff, Mic, PauseCircle, PlayCircle } from "lucide-react";
import { useSipPhoneContext } from "@/context/SipPhoneContext";
import { cn } from "@/lib/utils";

const KEYS = [
  ["1", ""], ["2", "ABC"], ["3", "DEF"],
  ["4", "GHI"], ["5", "JKL"], ["6", "MNO"],
  ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"],
  ["*", ""], ["0", "+"], ["#", ""],
];

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function StatusBadge({ state, remoteNumber, callDuration }: {
  state: string;
  remoteNumber: string;
  callDuration: number;
}) {
  const label =
    state === "unregistered" ? "Not connected" :
    state === "registering"  ? "Connecting..." :
    state === "idle"         ? "Ready" :
    state === "dialing"      ? "Dialing..." :
    state === "ringing_out"  ? `Calling ${remoteNumber}...` :
    state === "ringing_in"   ? `Incoming: ${remoteNumber}` :
    state === "active"       ? `${remoteNumber} · ${formatDuration(callDuration)}` :
    state === "on_hold"      ? `On hold · ${remoteNumber}` : state;

  return (
    <div className={cn(
      "text-center text-xs font-medium py-1 px-4 rounded-full self-center",
      state === "unregistered" && "bg-red-100 text-red-600",
      state === "registering"  && "bg-yellow-100 text-yellow-700",
      state === "idle"         && "bg-green-100 text-green-700",
      (state === "dialing" || state === "ringing_out") && "bg-blue-100 text-blue-700",
      state === "ringing_in"   && "bg-purple-100 text-purple-700",
      (state === "active" || state === "on_hold") && "bg-green-100 text-green-700",
    )}>
      {label}
    </div>
  );
}

export function DialPad() {
  const { phone } = useSipPhoneContext();
  const [number, setNumber] = useState("");

  const state = phone?.state ?? "unregistered";
  const isIdle    = state === "idle";
  const isActive  = state === "active" || state === "on_hold";
  const isRinging = state === "ringing_in";
  const isInCall  = isActive || isRinging || state === "dialing" || state === "ringing_out";

  function handleKey(digit: string) {
    if (isActive)       phone?.sendDtmf(digit);
    else if (!isInCall) setNumber(prev => prev + digit);
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Status */}
      <div className="flex justify-center">
        {phone ? (
          <StatusBadge
            state={state}
            remoteNumber={phone.remoteNumber}
            callDuration={phone.callDuration}
          />
        ) : (
          <span className="text-xs text-[#68717A]">SIP not configured — Settings → SIP</span>
        )}
      </div>

      {/* Number display */}
      <div className="flex items-center gap-2 bg-white border border-[#E4E7EB] rounded-xl px-4 py-3">
        <input
          type="tel"
          value={isActive ? (phone?.remoteNumber ?? "") : number}
          onChange={e => { if (!isInCall) setNumber(e.target.value); }}
          onKeyDown={e => { if (e.key === "Enter" && isIdle && number.trim()) phone?.dial(number.trim()); }}
          placeholder="Enter number..."
          readOnly={isInCall}
          className="flex-1 text-xl font-mono tracking-widest outline-none text-[#2F3941] bg-transparent min-w-0"
        />
        {!isInCall && number && (
          <button
            onClick={() => setNumber(prev => prev.slice(0, -1))}
            className="shrink-0 text-[#68717A] hover:text-[#2F3941] transition-colors p-1"
          >
            <Delete size={16} />
          </button>
        )}
      </div>

      {/* Keypad grid */}
      <div className="grid grid-cols-3 gap-2">
        {KEYS.map(([digit, sub]) => (
          <button
            key={digit}
            onClick={() => handleKey(digit)}
            className="flex flex-col items-center justify-center py-3 rounded-xl bg-white border border-[#E4E7EB] hover:bg-[#F3F4F6] active:scale-95 transition-all select-none"
          >
            <span className="text-base font-semibold text-[#2F3941] leading-none">{digit}</span>
            {sub && <span className="text-[9px] text-[#68717A] tracking-widest mt-0.5">{sub}</span>}
          </button>
        ))}
      </div>

      {/* Call controls */}
      <div className="flex items-center justify-center gap-3 pt-1">
        {isActive && (
          <>
            <button
              onClick={() => phone?.toggleMute()}
              title={phone?.isMuted ? "Unmute" : "Mute"}
              className={cn(
                "w-11 h-11 rounded-full flex items-center justify-center border transition-colors",
                phone?.isMuted
                  ? "bg-orange-100 border-orange-300 text-orange-600"
                  : "bg-white border-[#E4E7EB] text-[#68717A] hover:bg-[#F3F4F6]"
              )}
            >
              {phone?.isMuted ? <MicOff size={16} /> : <Mic size={16} />}
            </button>

            <button
              onClick={() => phone?.toggleHold()}
              title={phone?.isOnHold ? "Resume" : "Hold"}
              className={cn(
                "w-11 h-11 rounded-full flex items-center justify-center border transition-colors",
                phone?.isOnHold
                  ? "bg-blue-100 border-blue-300 text-blue-600"
                  : "bg-white border-[#E4E7EB] text-[#68717A] hover:bg-[#F3F4F6]"
              )}
            >
              {phone?.isOnHold ? <PlayCircle size={16} /> : <PauseCircle size={16} />}
            </button>
          </>
        )}

        {isRinging && (
          <button
            onClick={() => phone?.answer()}
            title="Answer"
            className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center text-white transition-colors shadow-md"
          >
            <Phone size={20} />
          </button>
        )}

        {isInCall ? (
          <button
            onClick={() => phone?.hangup()}
            title="Hang up"
            className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-colors shadow-md"
          >
            <PhoneOff size={20} />
          </button>
        ) : (
          <button
            onClick={() => isIdle && number.trim() && phone?.dial(number.trim())}
            disabled={!isIdle || !number.trim()}
            title="Call"
            className="w-14 h-14 rounded-full bg-[#038153] hover:bg-[#026b44] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors shadow-md"
          >
            <Phone size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
