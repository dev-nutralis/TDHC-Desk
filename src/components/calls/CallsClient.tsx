"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Phone, PhoneIncoming, PhoneMissed, PhoneOff, Clock, Play, Pause, Loader2, RefreshCw, Info, X, RotateCcw } from "lucide-react";
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

type CallWithTranscript = Call & {
  transcript: string | null;
  summary: string | null;
  transcript_status: string | null;
};

interface SummaryData {
  outcome?: string;
  followUps?: string[];
  sentiment?: string;
  topics?: string[];
}

function SentimentBadge({ sentiment }: { sentiment?: string }) {
  const s = (sentiment ?? "").toLowerCase();
  const cfg =
    s === "positive" ? { bg: "#DCFCE7", text: "#14532d" } :
    s === "negative" ? { bg: "#FEE2E2", text: "#991b1b" } :
    { bg: "#F3F4F6", text: "#374151" };
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize" style={{ background: cfg.bg, color: cfg.text }}>
      {sentiment ?? "neutral"}
    </span>
  );
}

function CallDetailModal({ call, onClose }: { call: CallWithTranscript; onClose: () => void }) {
  const [tab, setTab] = useState<"summary" | "transcript">("summary");
  const [data, setData] = useState<CallWithTranscript>(call);
  const [regenerating, setRegenerating] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchCall = useCallback(async () => {
    try {
      const res = await fetch(`/api/calls/${call.id}`);
      if (res.ok) {
        const fresh = await res.json();
        setData(fresh);
        return fresh.transcript_status as string | null;
      }
    } catch { /* ignore */ }
    return null;
  }, [call.id]);

  useEffect(() => {
    fetchCall().then((status) => {
      if (status === "pending" || status === "processing") {
        const poll = () => {
          fetchCall().then((s) => {
            if (s === "pending" || s === "processing") {
              pollRef.current = setTimeout(poll, 3000);
            }
          });
        };
        pollRef.current = setTimeout(poll, 3000);
      }
    });
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, [fetchCall]);

  async function regenerate() {
    setRegenerating(true);
    await fetch(`/api/calls/${call.id}/transcribe`, { method: "POST" });
    setRegenerating(false);
    const status = await fetchCall();
    if (status === "pending" || status === "processing") {
      const poll = () => {
        fetchCall().then((s) => {
          if (s === "pending" || s === "processing") {
            pollRef.current = setTimeout(poll, 3000);
          }
        });
      };
      pollRef.current = setTimeout(poll, 3000);
    }
  }

  const number = call.direction === "inbound" ? call.caller_number : call.callee_number;
  const status = data.transcript_status;
  const isPending = status === "pending" || status === "processing";
  const isFailed = status === "failed";
  const isDone = status === "done";

  let summary: SummaryData | null = null;
  if (isDone && data.summary) {
    try { summary = JSON.parse(data.summary); } catch { /* ignore */ }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-[#E4E7EB]">
          <div>
            <p className="text-sm font-semibold text-[#2F3941]">{number || "Unknown"}</p>
            <p className="text-xs text-[#68717A] mt-0.5">
              {formatDate(call.started_at)}
              {call.duration_sec != null && <> · <Clock size={10} className="inline mb-0.5" /> {formatDuration(call.duration_sec)}</>}
              <span className="ml-2 capitalize">{call.direction} · {call.status}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 ml-4 mt-0.5">
            {call.recording_id && !isPending && (
              <button
                onClick={regenerate}
                disabled={regenerating}
                title="Regenerate transcript"
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium border border-[#D8DCDE] bg-white text-[#2F3941] hover:bg-[#F3F4F6] disabled:opacity-50 transition-colors"
              >
                {regenerating
                  ? <Loader2 size={11} className="animate-spin" />
                  : <RotateCcw size={11} />}
                Regenerate
              </button>
            )}
            <button onClick={onClose} className="text-[#68717A] hover:text-[#2F3941] transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {call.recording_id && (
          <div className="px-5 py-3 border-b border-[#E4E7EB]">
            <RecordingPlayer callId={call.id} />
          </div>
        )}

        {call.recording_id && (
          <>
            <div className="flex border-b border-[#E4E7EB]">
              {(["summary", "transcript"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "px-5 py-2.5 text-sm font-medium transition-colors focus:outline-none capitalize",
                    tab === t
                      ? "border-b-2 border-[#038153] text-[#2F3941] -mb-px"
                      : "text-[#68717A] hover:text-[#2F3941]"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="px-5 py-4 min-h-[120px]">
              {isPending && (
                <div className="flex items-center gap-2 text-sm text-[#68717A]">
                  <Loader2 size={15} className="animate-spin text-[#038153]" />
                  Processing transcript...
                </div>
              )}
              {isFailed && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-red-500">Transcription failed</p>
                  {data.transcript && (
                    <p className="text-xs text-red-400 font-mono break-all">{data.transcript}</p>
                  )}
                </div>
              )}
              {!isPending && !isFailed && !isDone && (
                <p className="text-xs text-[#C2C8CC]">No transcript available</p>
              )}

              {isDone && tab === "summary" && (
                <div className="space-y-3">
                  {summary?.outcome && (
                    <p className="text-sm font-semibold text-[#2F3941]">{summary.outcome}</p>
                  )}
                  {summary?.sentiment && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#68717A]">Sentiment:</span>
                      <SentimentBadge sentiment={summary.sentiment} />
                    </div>
                  )}
                  {summary?.followUps && summary.followUps.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-[#68717A] uppercase tracking-wider mb-1.5">Follow-ups</p>
                      <ul className="space-y-1">
                        {summary.followUps.map((fu, i) => (
                          <li key={i} className="flex gap-2 text-sm text-[#2F3941]">
                            <span className="text-[#038153] shrink-0">•</span>
                            {fu}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {summary?.topics && summary.topics.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {summary.topics.map((topic, i) => (
                        <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-[#F3F4F6] text-[#68717A] border border-[#E4E7EB]">
                          {topic}
                        </span>
                      ))}
                    </div>
                  )}
                  {!summary && (
                    <p className="text-xs text-[#C2C8CC]">No summary available</p>
                  )}
                </div>
              )}

              {isDone && tab === "transcript" && (
                <div className="max-h-[400px] overflow-y-auto rounded-lg bg-[#F8F9F9] border border-[#E4E7EB] p-3">
                  <p className="text-xs font-mono whitespace-pre-wrap text-[#2F3941] leading-relaxed">
                    {data.transcript || "No transcript text"}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

type Props = { initialCalls: CallWithTranscript[] };

export function CallsClient({ initialCalls }: Props) {
  const [calls, setCalls] = useState<CallWithTranscript[]>(initialCalls);
  const [detailCall, setDetailCall] = useState<CallWithTranscript | null>(null);
  const { phone } = useSipPhoneContext();

  const fetchCalls = useCallback(() => {
    fetch("/api/calls")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.calls) setCalls(data.calls); })
      .catch(() => {});
  }, []);

  // Refresh only when state transitions INTO idle (call ended), not on initial mount
  const prevStateRef = useRef(phone?.state);
  useEffect(() => {
    const prev = prevStateRef.current;
    prevStateRef.current = phone?.state;
    const wasInCall = prev === "dialing" || prev === "ringing_in" || prev === "ringing_out" || prev === "active" || prev === "on_hold" || prev === "ending";
    if (wasInCall && phone?.state === "idle") {
      const t = setTimeout(fetchCalls, 1500);
      return () => clearTimeout(t);
    }
  }, [phone?.state, fetchCalls]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {detailCall && <CallDetailModal call={detailCall} onClose={() => setDetailCall(null)} />}
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
                        <button
                          onClick={() => setDetailCall(call)}
                          title="View details"
                          className="w-7 h-7 rounded-md flex items-center justify-center text-[#68717A] hover:text-[#038153] hover:bg-[#EAF7F0] transition-colors shrink-0"
                        >
                          <Info size={14} />
                        </button>
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
