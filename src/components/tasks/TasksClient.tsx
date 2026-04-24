"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckSquare, Plus, Loader2, Clock, CheckCircle2,
  AlertCircle, Pencil, Trash2, Check,
} from "lucide-react";
import Link from "next/link";
import EventModal from "@/components/calendar/EventModal";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "today" | "overdue" | "completed";

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
  user?: { id: string; name: string } | null;
}

interface Props {
  defaultUserId: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function contactName(fv: Record<string, unknown> | null | undefined): string {
  if (!fv) return "";
  const first = (fv.first_name as string) ?? "";
  const last  = (fv.last_name  as string) ?? "";
  return [first, last].filter(Boolean).join(" ");
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const day   = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year  = d.getFullYear();
  const hh    = String(d.getHours()).padStart(2, "0");
  const mm    = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hh}:${mm}`;
}

function getYear(iso: string): number {
  return new Date(iso).getFullYear();
}

// Group tasks by year
function groupByYear(tasks: CalendarEvent[]): { year: number; tasks: CalendarEvent[] }[] {
  const map = new Map<number, CalendarEvent[]>();
  for (const t of tasks) {
    const y = getYear(t.start_at);
    if (!map.has(y)) map.set(y, []);
    map.get(y)!.push(t);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([year, tasks]) => ({ year, tasks }));
}

// ── Confirm Dialog ────────────────────────────────────────────────────────────

function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
  loading,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4"
        style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.18)" }}>
        <p className="text-sm text-[#2F3941] mb-5">{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} disabled={loading}
            className="h-8 px-4 text-sm font-medium rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] hover:bg-[#F3F4F6] disabled:opacity-50 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="h-8 px-4 text-sm font-medium rounded-md text-white flex items-center gap-1.5 disabled:opacity-50 transition-colors"
            style={{ background: "#CC3340" }}>
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tabs config ───────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "today",     label: "Today",    icon: Clock       },
  { id: "overdue",   label: "Overdue",  icon: AlertCircle },
  { id: "completed", label: "Completed", icon: CheckCircle2 },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function TasksClient({ defaultUserId }: Props) {
  const [tab,      setTab]      = useState<Tab>("today");
  const [tasks,    setTasks]    = useState<CalendarEvent[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Modal state
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  // Confirm delete
  const [confirmIds,   setConfirmIds]   = useState<string[] | null>(null);
  const [deleting,     setDeleting]     = useState(false);

  // Bulk action loading
  const [bulkLoading,  setBulkLoading]  = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setSelected(new Set());
    try {
      const res  = await fetch(`/api/tasks?tab=${tab}`);
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // ── Selection ───────────────────────────────────────────────────────────────

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === tasks.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(tasks.map(t => t.id)));
    }
  };

  // ── Mark completed ──────────────────────────────────────────────────────────

  const markCompleted = async (ids: string[], completed: boolean) => {
    setBulkLoading(true);
    await Promise.all(ids.map(id =>
      fetch(`/api/calendar/events/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      })
    ));
    setBulkLoading(false);
    fetchTasks();
  };

  // ── Delete ──────────────────────────────────────────────────────────────────

  const deleteIds = async (ids: string[]) => {
    setDeleting(true);
    await Promise.all(ids.map(id =>
      fetch(`/api/calendar/events/${id}`, { method: "DELETE" })
    ));
    setDeleting(false);
    setConfirmIds(null);
    fetchTasks();
  };

  // ── Modal ───────────────────────────────────────────────────────────────────

  const handleModalSave = () => {
    setModalOpen(false);
    fetchTasks();
  };

  const handleModalDelete = (id: string) => {
    setModalOpen(false);
    fetchTasks();
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const groups = groupByYear(tasks);
  const allSelected = tasks.length > 0 && selected.size === tasks.length;
  const someSelected = selected.size > 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <header className="h-14 bg-white border-b border-[#D8DCDE] flex items-center px-6 gap-4 shrink-0 shadow-sm">
        <span className="font-medium text-[#2F3941]">Tasks</span>
        <div className="flex-1" />
        <button
          onClick={() => { setEditingEvent(null); setModalOpen(true); }}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-sm font-medium text-white hover:brightness-110 transition-all"
          style={{ background: "#038153" }}
        >
          <Plus size={14} strokeWidth={2.5} /> Add Task
        </button>
      </header>

      {/* Tab bar */}
      <div className="flex items-center border-b border-[#D8DCDE] bg-white shrink-0 px-6">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === id
                ? "border-[#038153] text-[#038153]"
                : "border-transparent text-[#68717A] hover:text-[#2F3941]"
            }`}
          >
            <Icon size={13} strokeWidth={1.8} />
            {label}
          </button>
        ))}
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="flex items-center gap-3 px-6 py-2 bg-[#EAF7F0] border-b border-[#B7E5D0] shrink-0">
          <span className="text-sm font-medium text-[#038153]">{selected.size} selected</span>
          <div className="flex-1" />
          {tab !== "completed" && (
            <button
              onClick={() => markCompleted(Array.from(selected), true)}
              disabled={bulkLoading}
              className="flex items-center gap-1.5 h-7 px-3 text-xs font-medium rounded-md border border-[#B7E5D0] bg-white text-[#038153] hover:bg-[#EAF7F0] disabled:opacity-50 transition-colors"
            >
              {bulkLoading ? <Loader2 size={12} className="animate-spin" /> : <CheckSquare size={12} />}
              Mark as completed
            </button>
          )}
          {tab === "completed" && (
            <button
              onClick={() => markCompleted(Array.from(selected), false)}
              disabled={bulkLoading}
              className="flex items-center gap-1.5 h-7 px-3 text-xs font-medium rounded-md border border-[#D8DCDE] bg-white text-[#68717A] hover:bg-[#F3F4F6] disabled:opacity-50 transition-colors"
            >
              {bulkLoading ? <Loader2 size={12} className="animate-spin" /> : <CheckSquare size={12} />}
              Mark as incomplete
            </button>
          )}
          <button
            onClick={() => setConfirmIds(Array.from(selected))}
            disabled={bulkLoading}
            className="flex items-center gap-1.5 h-7 px-3 text-xs font-medium rounded-md border border-[#FECDD3] bg-white text-[#CC3340] hover:bg-[#FFF0F1] disabled:opacity-50 transition-colors"
          >
            <Trash2 size={12} /> Delete
          </button>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto bg-white">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 size={20} className="animate-spin text-[#68717A]" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-[#68717A]">
            <CheckCircle2 size={32} strokeWidth={1.2} />
            <p className="text-sm font-medium">
              {tab === "today"     ? "No tasks for today"   :
               tab === "overdue"   ? "No overdue tasks"      :
               "No completed tasks"}
            </p>
          </div>
        ) : (
          <>
            {/* Select-all header */}
            <div className="flex items-center gap-3 px-6 py-2 border-b border-[#F3F4F6] bg-[#F8F9F9]">
              <button
                onClick={toggleAll}
                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                  allSelected ? "bg-[#038153] border-[#038153]" : "border-[#D8DCDE] bg-white hover:border-[#038153]"
                }`}
              >
                {allSelected && <Check size={10} className="text-white" strokeWidth={3} />}
              </button>
              <span className="text-xs text-[#68717A] font-medium">
                {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
              </span>
            </div>

            {/* Grouped by year */}
            {groups.map(({ year, tasks: groupTasks }) => (
              <div key={year}>
                <div className="px-6 py-1.5 bg-[#F8F9F9] border-b border-[#F3F4F6]">
                  <span className="text-[11px] font-semibold text-[#68717A] uppercase tracking-wider">{year}</span>
                </div>
                {groupTasks.map((task, idx) => {
                  const isSelected = selected.has(task.id);
                  const cName = contactName(task.contact?.field_values);
                  const isLast = idx === groupTasks.length - 1;

                  return (
                    <div
                      key={task.id}
                      className={`group flex items-center gap-3 px-6 py-3 transition-colors hover:bg-[#F8F9F9] ${
                        !isLast ? "border-b border-[#F3F4F6]" : ""
                      } ${isSelected ? "bg-[#F6FDF9]" : ""}`}
                    >
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleOne(task.id)}
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          isSelected ? "bg-[#038153] border-[#038153]" : "border-[#D8DCDE] bg-white hover:border-[#038153]"
                        }`}
                      >
                        {isSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                      </button>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {task.contact_id ? (
                          <Link
                            href={`/contacts/${task.contact_id}`}
                            className={`text-sm font-medium truncate block hover:underline ${task.completed ? "line-through text-[#68717A]" : "text-[#2F3941] hover:text-[#038153]"}`}
                          >
                            {task.title}
                          </Link>
                        ) : (
                          <p className={`text-sm font-medium truncate ${task.completed ? "line-through text-[#68717A]" : "text-[#2F3941]"}`}>
                            {task.title}
                          </p>
                        )}
                        {cName && (
                          <p className="text-xs text-[#68717A] mt-0.5">
                            <span className="truncate">{cName}</span>
                          </p>
                        )}
                      </div>

                      {/* Date/time */}
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-[#68717A] whitespace-nowrap">
                          {task.user?.name ?? ""}
                          {task.user?.name ? " · " : ""}
                          <span className={tab === "overdue" ? "text-[#CC3340] font-medium" : ""}>
                            {fmtDateTime(task.start_at)}
                          </span>
                        </p>
                      </div>

                      {/* Row actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Mark as completed — always visible */}
                        <button
                          onClick={() => markCompleted([task.id], !task.completed)}
                          className={`h-7 px-2.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
                            task.completed
                              ? "border-[#D8DCDE] text-[#68717A] hover:bg-[#F3F4F6]"
                              : "border-[#B7E5D0] text-[#038153] hover:bg-[#EAF7F0]"
                          }`}
                        >
                          {task.completed ? "Mark as incomplete" : "Mark as completed"}
                        </button>

                        {/* Edit + Delete — visible on hover */}
                        <button
                          onClick={() => { setEditingEvent(task); setModalOpen(true); }}
                          title="Edit task"
                          className="w-7 h-7 flex items-center justify-center rounded-md text-[#68717A] hover:text-[#2F3941] hover:bg-[#F3F4F6] transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setConfirmIds([task.id])}
                          title="Delete task"
                          className="w-7 h-7 flex items-center justify-center rounded-md text-[#68717A] hover:text-[#CC3340] hover:bg-[#FFF0F1] transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </>
        )}
      </div>

      {/* EventModal — reused from Calendar */}
      <EventModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        event={editingEvent}
        defaultUserId={defaultUserId}
        onSave={handleModalSave}
        onDelete={handleModalDelete}
      />

      {/* Confirm delete dialog */}
      {confirmIds && (
        <ConfirmDialog
          message={
            confirmIds.length === 1
              ? "Are you sure you want to delete this task? This action cannot be undone."
              : `Are you sure you want to delete ${confirmIds.length} tasks? This action cannot be undone.`
          }
          loading={deleting}
          onConfirm={() => deleteIds(confirmIds)}
          onCancel={() => setConfirmIds(null)}
        />
      )}
    </div>
  );
}
