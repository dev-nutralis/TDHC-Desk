"use client";

import { MicOff, Phone, PhoneOff, PauseCircle } from "lucide-react";
import { useSipPhoneContext } from "@/context/SipPhoneContext";
import { cn } from "@/lib/utils";

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function ActiveCallBar() {
  const { phone } = useSipPhoneContext();

  const isVisible =
    phone &&
    (phone.state === "dialing" ||
      phone.state === "ringing_in" ||
      phone.state === "ringing_out" ||
      phone.state === "active" ||
      phone.state === "on_hold");

  if (!isVisible) return null;

  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between gap-3 px-5 py-3",
      "bg-[#1a2e25] border-t border-white/10 shadow-2xl",
    )}>
      {/* Left: status + number */}
      <div className="flex items-center gap-3 min-w-0">
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
          phone.state === "active" ? "bg-green-500" :
          phone.state === "ringing_in" ? "bg-purple-500 animate-pulse" :
          phone.state === "on_hold" ? "bg-orange-500" :
          "bg-blue-500 animate-pulse"
        )}>
          <Phone size={14} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-white text-sm font-semibold truncate">{phone.remoteNumber || "Unknown"}</p>
          <p className="text-white/60 text-xs">
            {phone.state === "dialing" && "Dialing..."}
            {phone.state === "ringing_out" && "Calling..."}
            {phone.state === "ringing_in" && "Incoming call"}
            {phone.state === "active" && formatDuration(phone.callDuration)}
            {phone.state === "on_hold" && "On hold"}
          </p>
        </div>
      </div>

      {/* Right: action buttons */}
      <div className="flex items-center gap-2 shrink-0">
        {phone.state === "ringing_in" && (
          <button
            onClick={() => phone.answer()}
            className="px-4 py-1.5 rounded-full bg-green-500 hover:bg-green-600 text-white text-sm font-medium transition-colors"
          >
            Answer
          </button>
        )}

        {(phone.state === "active" || phone.state === "on_hold") && (
          <>
            {phone.isMuted && (
              <div className="flex items-center gap-1 text-orange-400 text-xs">
                <MicOff size={14} /> <span>Muted</span>
              </div>
            )}
            {phone.isOnHold && (
              <div className="flex items-center gap-1 text-blue-400 text-xs">
                <PauseCircle size={14} /> <span>Hold</span>
              </div>
            )}
          </>
        )}

        <button
          onClick={() => phone.hangup()}
          className="px-4 py-1.5 rounded-full bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors flex items-center gap-1.5"
        >
          <PhoneOff size={14} />
          <span>End</span>
        </button>
      </div>
    </div>
  );
}
