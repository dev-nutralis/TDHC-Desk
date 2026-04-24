"use client";

import { Phone, PhoneIncoming, PhoneMissed, PhoneOff, Clock } from "lucide-react";
import { DialPad } from "./DialPad";
import type { Call } from "@prisma/client";
import { cn } from "@/lib/utils";

function formatDuration(sec: number | null): string {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function CallStatusIcon({ status, direction }: { status: string; direction: string }) {
  if (status === "missed") return <PhoneMissed size={14} className="text-red-500" />;
  if (status === "completed" && direction === "inbound") return <PhoneIncoming size={14} className="text-green-500" />;
  if (status === "completed") return <Phone size={14} className="text-green-500" />;
  if (status === "failed") return <PhoneOff size={14} className="text-red-400" />;
  return <Phone size={14} className="text-[#68717A]" />;
}

type Props = { initialCalls: Call[] };

export function CallsClient({ initialCalls }: Props) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="h-14 shrink-0 flex items-center px-6 border-b border-[#E4E7EB] bg-white">
        <h1 className="text-[15px] font-semibold text-[#2F3941]">Calls</h1>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: DialPad */}
        <div className="w-[380px] shrink-0 border-r border-[#E4E7EB] bg-white overflow-y-auto">
          <div className="p-8">
            <DialPad />
          </div>
        </div>

        {/* Right: Call history */}
        <div className="flex-1 overflow-y-auto bg-[#F3F4F6]">
          <div className="p-6">
            <h2 className="text-[13px] font-semibold text-[#68717A] uppercase tracking-wider mb-4">
              Recent Calls
            </h2>

            {initialCalls.length === 0 ? (
              <div className="text-center py-16 text-[#C2C8CC]">
                <Phone size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No calls yet</p>
              </div>
            ) : (
              <div className="space-y-1">
                {initialCalls.map((call) => {
                  const number = call.direction === "inbound" ? call.caller_number : call.callee_number;
                  return (
                    <div
                      key={call.id}
                      className="flex items-center gap-3 bg-white rounded-lg px-4 py-3 border border-[#E4E7EB]"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#F3F4F6] flex items-center justify-center shrink-0">
                        <CallStatusIcon status={call.status} direction={call.direction} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm font-medium truncate",
                          call.status === "missed" ? "text-red-600" : "text-[#2F3941]"
                        )}>
                          {number || "Unknown"}
                        </p>
                        <p className="text-xs text-[#68717A] capitalize">{call.direction} · {call.status}</p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-xs text-[#68717A]">{formatDate(call.started_at)}</p>
                        {call.duration_sec != null && (
                          <p className="text-xs text-[#2F3941] font-medium flex items-center gap-1 justify-end mt-0.5">
                            <Clock size={10} />
                            {formatDuration(call.duration_sec)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
