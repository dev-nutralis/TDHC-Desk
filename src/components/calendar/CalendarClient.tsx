"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight, Plus, Loader2 } from "lucide-react";
import TimeGrid from "./TimeGrid";
import MonthView from "./MonthView";
import EventModal from "./EventModal";

interface CalendarEvent {
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
  contact?: { id: string; field_values: Record<string, unknown> | null } | null;
  deal?: { id: string; field_values: Record<string, unknown> | null } | null;
}

interface Props {
  defaultUserId: string;
}

function getDateRange(
  view: "month" | "week" | "day",
  date: Date
): { start: Date; end: Date } {
  if (view === "day") {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (view === "week") {
    const start = new Date(date);
    const dow = start.getDay(); // 0=Sun
    const daysBack = dow === 0 ? 6 : dow - 1; // Monday start
    start.setDate(start.getDate() - daysBack);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  // month
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
    23,
    59,
    59
  );
  return { start, end };
}

export default function CalendarClient({ defaultUserId }: Props) {
  const [view, setView] = useState<"month" | "week" | "day">("week");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const today = useMemo(() => new Date(), []);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStart, setModalStart] = useState<Date | undefined>();
  const [modalEnd, setModalEnd] = useState<Date | undefined>();
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange(view, currentDate);
      const res = await fetch(
        `/api/calendar/events?start=${start.toISOString()}&end=${end.toISOString()}`
      );
      const data = await res.json();
      setEvents(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [view, currentDate]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  function navigate(dir: -1 | 1) {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (view === "day") d.setDate(d.getDate() + dir);
      else if (view === "week") d.setDate(d.getDate() + dir * 7);
      else d.setMonth(d.getMonth() + dir);
      return d;
    });
  }

  function goToday() {
    setCurrentDate(new Date());
  }

  function getLabel(): string {
    if (view === "month") {
      return currentDate.toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric",
      });
    }
    if (view === "week") {
      const { start, end } = getDateRange("week", currentDate);
      const opts: Intl.DateTimeFormatOptions = {
        day: "2-digit",
        month: "short",
      };
      return `${start.toLocaleDateString("en-GB", opts)} – ${end.toLocaleDateString("en-GB", opts)}, ${end.getFullYear()}`;
    }
    return currentDate.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }

  function getWeekDays(): Date[] {
    const { start } = getDateRange("week", currentDate);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }

  function handleSlotClick(start: Date, end: Date) {
    setEditingEvent(null);
    setModalStart(start);
    setModalEnd(end);
    setModalOpen(true);
  }

  function handleEventClick(event: CalendarEvent) {
    setEditingEvent(event);
    setModalStart(undefined);
    setModalEnd(undefined);
    setModalOpen(true);
  }

  function handleModalSave(saved: CalendarEvent) {
    setEvents((prev) => {
      const exists = prev.find((e) => e.id === saved.id);
      return exists
        ? prev.map((e) => (e.id === saved.id ? saved : e))
        : [...prev, saved];
    });
    setModalOpen(false);
  }

  function handleModalDelete(id: string) {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setModalOpen(false);
  }

  function handleDayClick(date: Date) {
    setCurrentDate(date);
    setView("day");
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <header className="h-14 bg-white border-b border-[#D8DCDE] flex items-center px-6 gap-4 shrink-0 shadow-sm">
        <span className="font-medium text-[#2F3941]">Calendar</span>
        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={() => navigate(-1)}
            className="w-7 h-7 flex items-center justify-center rounded-md text-[#68717A] hover:bg-[#F3F4F6] transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={goToday}
            className="h-7 px-3 text-xs font-medium rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] hover:bg-[#F3F4F6] transition-colors mx-1"
          >
            Today
          </button>
          <button
            onClick={() => navigate(1)}
            className="w-7 h-7 flex items-center justify-center rounded-md text-[#68717A] hover:bg-[#F3F4F6] transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <span className="text-sm font-medium text-[#2F3941] flex-1">
          {getLabel()}
        </span>
        {loading && (
          <Loader2 size={14} className="animate-spin text-[#68717A]" />
        )}
        {/* View switcher */}
        <div className="flex items-center rounded-lg border border-[#D8DCDE] overflow-hidden bg-white">
          {(["day", "week", "month"] as const).map((v) => {
            const isActive = view === v;
            return (
              <button
                key={v}
                onClick={() => setView(v)}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "#F3F4F6";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "";
                  }
                }}
                className="h-8 px-4 text-xs font-medium transition-colors capitalize"
                style={
                  isActive
                    ? { background: "#038153", color: "#fff" }
                    : { color: "#2F3941" }
                }
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            );
          })}
        </div>
        {/* Add event button */}
        <button
          onClick={() => {
            setEditingEvent(null);
            setModalStart(new Date());
            const e = new Date();
            e.setMinutes(e.getMinutes() + 30);
            setModalEnd(e);
            setModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-sm font-medium text-white hover:brightness-110 transition-all"
          style={{ background: "#038153" }}
        >
          <Plus size={14} strokeWidth={2.5} /> Add Event
        </button>
      </header>

      {/* Calendar body */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-white">
        {view === "month" && (
          <MonthView
            currentDate={currentDate}
            events={events}
            today={today}
            onDayClick={handleDayClick}
            onEventClick={handleEventClick}
          />
        )}
        {(view === "week" || view === "day") && (
          <TimeGrid
            days={view === "week" ? getWeekDays() : [currentDate]}
            events={events}
            today={today}
            onSlotClick={handleSlotClick}
            onEventClick={handleEventClick}
          />
        )}
      </div>

      {/* Event modal */}
      <EventModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialStart={modalStart}
        initialEnd={modalEnd}
        event={editingEvent}
        defaultUserId={defaultUserId}
        onSave={handleModalSave}
        onDelete={handleModalDelete}
      />
    </div>
  );
}
