"use client";

import React, { useRef, useEffect } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const SLOT_HEIGHT  = 40;
const HOUR_HEIGHT  = 80;
const TOTAL_SLOTS  = 48;
const TIME_COL_W   = 56;
const GAP          = 2;   // px gap between events and column edges

// ─── Types ────────────────────────────────────────────────────────────────────
export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  color: string;
  completed: boolean;
  user_id: string;
  contact_id: string | null;
  deal_id: string | null;
}

interface LayoutEvent extends CalendarEvent {
  col: number;
  totalCols: number;
  top: number;
  height: number;
}

interface Props {
  days: Date[];
  events: CalendarEvent[];
  onSlotClick: (start: Date, end: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
  today: Date;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate()
  );
}

function eventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
  const dayEnd   = new Date(day); dayEnd.setHours(23, 59, 59, 999);
  return events.filter(ev => {
    const s = new Date(ev.start_at);
    const e = new Date(ev.end_at);
    return s <= dayEnd && e >= dayStart;
  });
}

function formatTime(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  return `${h}:${m === 0 ? "00" : m}`;
}

// Assigns each event a column so overlapping events sit side by side
function layoutEvents(events: CalendarEvent[], dayStart: Date): LayoutEvent[] {
  if (events.length === 0) return [];

  const dayMs = dayStart.getTime();

  // Compute top/height and ms bounds for each event
  const items = events
    .map(ev => {
      const startMs = Math.max(new Date(ev.start_at).getTime(), dayMs);
      const endMs   = Math.min(new Date(ev.end_at).getTime(), dayMs + 24 * 60 * 60 * 1000);
      const startMin = (startMs - dayMs) / 60_000;
      const endMin   = (endMs   - dayMs) / 60_000;
      const top    = (startMin / 30) * SLOT_HEIGHT;
      const height = Math.max(((endMin - startMin) / 30) * SLOT_HEIGHT, SLOT_HEIGHT);
      return { ev, startMs, endMs, top, height };
    })
    .sort((a, b) => a.startMs - b.startMs);

  // Greedy column assignment: pick first column whose last event ended before this one starts
  const colEnds: number[] = [];
  const assigned: { ev: CalendarEvent; col: number; top: number; height: number; startMs: number; endMs: number }[] = [];

  for (const item of items) {
    let col = colEnds.findIndex(end => end <= item.startMs);
    if (col === -1) col = colEnds.length;
    colEnds[col] = item.endMs;
    assigned.push({ ...item, col });
  }

  // For each event, totalCols = max col index among all events that overlap it + 1
  return assigned.map(a => {
    let maxCol = a.col;
    for (const b of assigned) {
      if (a.startMs < b.endMs && a.endMs > b.startMs) {
        if (b.col > maxCol) maxCol = b.col;
      }
    }
    return { ...a.ev, col: a.col, totalCols: maxCol + 1, top: a.top, height: a.height };
  });
}

function eventStyle(ev: LayoutEvent): React.CSSProperties {
  const pct = (v: number) => `${(v * 100).toFixed(4)}%`;
  const colW = 1 / ev.totalCols;
  return {
    position: "absolute",
    top: ev.top,
    height: ev.height,
    left:  `calc(${pct(ev.col * colW)} + ${GAP}px)`,
    right: `calc(${pct((ev.totalCols - ev.col - 1) * colW)} + ${GAP}px)`,
  };
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── Component ────────────────────────────────────────────────────────────────
export default function TimeGrid({ days, events, onSlotClick, onEventClick, today }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      const now  = new Date();
      const slot = now.getHours() * 2 + (now.getMinutes() >= 30 ? 1 : 0);
      scrollRef.current.scrollTop = Math.max(0, slot * SLOT_HEIGHT - scrollRef.current.clientHeight / 3);
    }
  }, []);

  function handleColumnClick(e: React.MouseEvent, day: Date) {
    const rect     = e.currentTarget.getBoundingClientRect();
    const y        = e.clientY - rect.top;
    const slotIdx  = Math.floor(y / SLOT_HEIGHT);
    const clamped  = Math.max(0, Math.min(47, slotIdx));
    const hours    = Math.floor(clamped / 2);
    const minutes  = (clamped % 2) * 30;
    const start    = new Date(day);
    start.setHours(hours, minutes, 0, 0);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + 30);
    onSlotClick(start, end);
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* ── Day headers ──────────────────────────────────────────────── */}
      <div className="flex shrink-0 bg-white border-b border-[#D8DCDE] z-10 relative">
        <div style={{ width: TIME_COL_W, minWidth: TIME_COL_W }} className="shrink-0" />
        {days.map((day) => {
          const isToday = isSameDay(day, today);
          return (
            <div
              key={day.toISOString()}
              className="flex-1 min-w-0 flex flex-col items-center justify-center py-1 border-l border-[#D8DCDE]"
            >
              <span className="text-[11px] text-[#68717A] leading-none mb-0.5">
                {DAY_NAMES[day.getDay()]}
              </span>
              <span className={[
                "text-[13px] font-semibold leading-none w-6 h-6 flex items-center justify-center rounded-full",
                isToday ? "bg-[#038153] text-white" : "text-[#2F3941]",
              ].join(" ")}>
                {day.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Scrollable body ───────────────────────────────────────────── */}
      <div ref={scrollRef} className="time-body flex-1 min-h-0 overflow-y-auto">
        <div className="flex" style={{ position: "relative" }}>
          {/* ── Time-label column ─────────────────────────────────────── */}
          <div className="shrink-0 relative" style={{ width: TIME_COL_W, height: TOTAL_SLOTS * SLOT_HEIGHT }}>
            {Array.from({ length: 24 }, (_, hour) => (
              <span
                key={hour}
                className="absolute right-2 text-[10px] text-[#68717A] select-none"
                style={{ top: hour * HOUR_HEIGHT, transform: hour === 0 ? "none" : "translateY(-50%)" }}
              >
                {hour}:00
              </span>
            ))}
          </div>

          {/* ── Day columns ───────────────────────────────────────────── */}
          {days.map((day) => {
            const dayStart = new Date(day);
            dayStart.setHours(0, 0, 0, 0);
            const laid = layoutEvents(eventsForDay(events, day), dayStart);

            return (
              <div
                key={day.toISOString()}
                className="flex-1 min-w-0 border-l border-[#D8DCDE] relative cursor-pointer"
                style={{ height: TOTAL_SLOTS * SLOT_HEIGHT }}
                onClick={(e) => handleColumnClick(e, day)}
              >
                {/* Grid lines */}
                {Array.from({ length: TOTAL_SLOTS }, (_, i) => (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      top: i * SLOT_HEIGHT,
                      left: 0, right: 0, height: 1,
                      background: i % 2 === 0 ? "#E5E7EB" : "transparent",
                      borderTop: i % 2 === 0 ? undefined : "1px dashed #D8DCDE",
                    }}
                  />
                ))}

                {/* Events */}
                {laid.map((ev) => {
                  const done           = ev.completed;
                  const hasRoomForDesc = ev.height >= SLOT_HEIGHT * 3 && !!ev.description;

                  return (
                    <div
                      key={ev.id}
                      style={{
                        ...eventStyle(ev),
                        background: done ? "#9CA3AF" : ev.color,
                        opacity: done ? 0.75 : 0.9,
                      }}
                      className="rounded px-2 py-1 cursor-pointer overflow-hidden text-white hover:opacity-100 z-[2] hover:z-10 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                    >
                      <p className="text-[10px] opacity-80 leading-tight">
                        {formatTime(new Date(ev.start_at))} – {formatTime(new Date(ev.end_at))}
                      </p>
                      <p className={`text-[11px] font-semibold leading-tight mt-0.5 truncate${done ? " line-through" : ""}`}>
                        {ev.title}
                      </p>
                      {hasRoomForDesc && (
                        <p className={`text-[10px] opacity-75 leading-tight mt-0.5 truncate${done ? " line-through" : ""}`}>
                          {ev.description}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
