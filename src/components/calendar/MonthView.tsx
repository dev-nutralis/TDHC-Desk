"use client";

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
}

interface Props {
  currentDate: Date;
  events: CalendarEvent[];
  today: Date;
  onDayClick: (date: Date, hour?: number) => void;
  onEventClick: (event: CalendarEvent) => void;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatTime(d: Date) {
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function eventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(23, 59, 59, 999);
  return events.filter((ev) => {
    const s = new Date(ev.start_at);
    const e = new Date(ev.end_at);
    return s <= dayEnd && e >= dayStart;
  });
}

function getMonthGridDays(date: Date): Date[] {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Start: Monday on or before first day
  const startDate = new Date(firstDay);
  const startDow = startDate.getDay(); // 0=Sun, 1=Mon...
  const daysBack = startDow === 0 ? 6 : startDow - 1;
  startDate.setDate(startDate.getDate() - daysBack);

  // End: Sunday on or after last day
  const endDate = new Date(lastDay);
  const endDow = endDate.getDay();
  const daysForward = endDow === 0 ? 0 : 7 - endDow;
  endDate.setDate(endDate.getDate() + daysForward);

  // Build array of all days
  const days: Date[] = [];
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export default function MonthView({
  currentDate,
  events,
  today,
  onDayClick,
  onEventClick,
}: Props) {
  const days = getMonthGridDays(currentDate);
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  const currentMonth = currentDate.getMonth();

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-[#D8DCDE]">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div
            key={d}
            className="text-center text-[10px] font-semibold uppercase tracking-wider text-[#68717A] py-2"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 flex-1" style={{ minHeight: "100px" }}>
            {week.map((day, di) => {
              const isToday = isSameDay(day, today);
              const isCurrentMonth = day.getMonth() === currentMonth;
              const dayEvents = eventsForDay(events, day);
              const visibleEvents = dayEvents.slice(0, 3);
              const hiddenCount = dayEvents.length - 3;
              return (
                <div
                  key={di}
                  className={`min-w-0 overflow-hidden border-b border-r border-[#D8DCDE] p-1.5 cursor-pointer transition-colors${di === 6 ? " border-r-0" : ""} ${isToday ? "bg-[#EAF7F0]" : "hover:bg-[#F8F9F9]"}`}
                  onClick={() => onDayClick(day)}
                >
                  {/* Day number */}
                  <div className="mb-1">
                    {isToday ? (
                      <span
                        className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white"
                        style={{ background: "#038153" }}
                      >
                        {day.getDate()}
                      </span>
                    ) : (
                      <span
                        className={`text-sm font-medium ${
                          isCurrentMonth ? "text-[#2F3941]" : "text-[#C2C8CC]"
                        }`}
                      >
                        {day.getDate()}
                      </span>
                    )}
                  </div>

                  {/* Events */}
                  {visibleEvents.map((ev) => (
                    <div
                      key={ev.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(ev);
                      }}
                      className="text-white text-[10px] font-medium px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-90 mb-0.5"
                      style={{ background: ev.completed ? "#9CA3AF" : ev.color, opacity: ev.completed ? 0.8 : 1 }}
                    >
                      {ev.completed ? "✓ " : ""}
                      <span className={ev.completed ? "line-through opacity-75" : ""}>
                        {!ev.all_day && formatTime(new Date(ev.start_at)) + " "}
                        {ev.title}
                      </span>
                    </div>
                  ))}

                  {hiddenCount > 0 && (
                    <p className="text-[10px] text-[#68717A] px-1">
                      +{hiddenCount} more
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
