"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Phone, PhoneIncoming, PhoneMissed, PhoneOff, Clock, Play, Pause, Loader2, RefreshCw } from "lucide-react";
import { DialPad } from "./DialPad";
import type { Call } from "@prisma/client";
import { cn } from "@/lib/utils";
import { useSipPhoneContext } from "@/context/SipPhoneContext";

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

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function RecordingPlayer({ callId }: { callId: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/calls/${callId}/recording`);
      if (!res.ok) {
        console.error("[RecordingPlayer] fetch failed:", res.status, res.statusText);
        throw new Error(`HTTP ${res.status}`);
      }
      const blob = await res.blob();
      console.log("[RecordingPlayer] blob size:", blob.size, "type:", blob.type);
      if (blob.size === 0) throw new Error("Empty blob");

      // Log first 12 bytes to verify RIFF/WAVE header
      const head = await blob.slice(0, 12).arrayBuffer();
      const headBytes = new Uint8Array(head);
      const headStr = Array.from(headBytes).map(b => String.fromCharCode(b)).join("");
      console.log("[RecordingPlayer] header:", headStr, "| canPlay wav:", new Audio().canPlayType("audio/wav"));


      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;

      const a = new Audio();
      audioRef.current = a;

      a.onloadedmetadata = () => setDuration(a.duration);
      a.ontimeupdate = () => setCurrentTime(a.currentTime);
      a.onended = () => { setPlaying(false); setCurrentTime(0); a.currentTime = 0; };
      a.onerror = (e) => console.error("[RecordingPlayer] audio error:", e);

      a.src = url;
      a.load();

      setLoaded(true);
      setLoading(false);

      const playPromise = a.play();
      if (playPromise) {
        playPromise
          .then(() => setPlaying(true))
          .catch((e) => console.error("[RecordingPlayer] play() rejected:", e));
      }
    } catch (e) {
      console.error("[RecordingPlayer] load error:", e);
      setError(true);
      setLoading(false);
    }
  }



  async function togglePlay() {
    if (!loaded) { await load(); return; }
    const a = audioRef.current!;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      await a.play();
      setPlaying(true);
    }
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const a = audioRef.current;
    if (!a || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    a.currentTime = ratio * duration;
    setCurrentTime(a.currentTime);
  }

  if (error) return <span className="text-[10px] text-[#C2C8CC]">No recording</span>;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={togglePlay}
        title={playing ? "Pause" : "Play recording"}
        className="w-7 h-7 rounded-full flex items-center justify-center bg-[#038153] hover:bg-[#026b44] text-white transition-colors shrink-0"
      >
        {loading
          ? <Loader2 size={13} className="animate-spin" />
          : playing
          ? <Pause size={13} />
          : <Play size={13} />}
      </button>

      {loaded && (
        <>
          <div
            className="w-28 h-1.5 bg-[#E4E7EB] rounded-full cursor-pointer relative shrink-0"
            onClick={seek}
          >
            <div
              className="absolute left-0 top-0 h-full bg-[#038153] rounded-full pointer-events-none"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[10px] text-[#68717A] tabular-nums shrink-0">
            {formatTime(currentTime)}&nbsp;/&nbsp;{formatTime(duration)}
          </span>
        </>
      )}
    </div>
  );
}

type Props = { initialCalls: Call[] };

export function CallsClient({ initialCalls }: Props) {
  const [calls, setCalls] = useState<Call[]>(initialCalls);
  const { phone } = useSipPhoneContext();

  const fetchCalls = useCallback(() => {
    fetch("/api/calls")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.calls) setCalls(data.calls); })
      .catch(() => {});
  }, []);

  // Refresh when call ends
  const prevState = phone?.state;
  useEffect(() => {
    if (prevState === "idle") fetchCalls();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prevState]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="h-14 shrink-0 flex items-center justify-between px-6 border-b border-[#E4E7EB] bg-white">
        <h1 className="text-[15px] font-semibold text-[#2F3941]">Calls</h1>
        <button onClick={fetchCalls} className="text-[#68717A] hover:text-[#2F3941] transition-colors" title="Refresh">
          <RefreshCw size={15} />
        </button>
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

            {calls.length === 0 ? (
              <div className="text-center py-16 text-[#C2C8CC]">
                <Phone size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No calls yet</p>
              </div>
            ) : (
              <div className="space-y-1">
                {calls.map((call) => {
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

                      <div className="flex items-center gap-3 shrink-0">
                        {call.recording_id && (
                          <RecordingPlayer callId={call.id} />
                        )}
                        <div className="text-right">
                          <p className="text-xs text-[#68717A]">{formatDate(call.started_at)}</p>
                          {call.duration_sec != null && (
                            <p className="text-xs text-[#2F3941] font-medium flex items-center gap-1 justify-end mt-0.5">
                              <Clock size={10} />
                              {formatDuration(call.duration_sec)}
                            </p>
                          )}
                        </div>
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
