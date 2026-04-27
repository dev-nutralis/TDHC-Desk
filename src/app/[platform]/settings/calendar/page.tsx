"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Loader2, GripVertical } from "lucide-react";

interface TitlePreset {
  id: string;
  label: string;
  sort_order: number;
}

export default function CalendarSettingsPage() {
  const [titles, setTitles]   = useState<TitlePreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState("");
  const [adding, setAdding]   = useState(false);
  const [error, setError]     = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function fetchTitles() {
    setLoading(true);
    try {
      const res = await fetch("/api/calendar/titles");
      setTitles(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchTitles(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim()) return;
    setAdding(true);
    setError("");
    try {
      const res = await fetch("/api/calendar/titles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const created = await res.json();
      setTitles(prev => [...prev.filter(t => t.id !== created.id), created].sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label)));
      setNewLabel("");
      inputRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    setTitles(prev => prev.filter(t => t.id !== id));
    await fetch(`/api/calendar/titles/${id}`, { method: "DELETE" });
  }

  return (
    <div className="p-8 max-w-xl">
      <h1 className="text-lg font-semibold text-[#2F3941] mb-1">Calendar</h1>
      <p className="text-sm text-[#68717A] mb-6">
        Define preset event titles that appear as quick-select options when creating calendar events.
      </p>

      {/* Add form */}
      <form onSubmit={handleAdd} className="flex items-center gap-2 mb-6">
        <input
          ref={inputRef}
          type="text"
          value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          placeholder="e.g. Sales Call, Demo, Follow-up..."
          className="flex-1 h-9 px-3 text-sm rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] placeholder:text-[#C2C8CC] outline-none focus:border-[#038153] focus:ring-2 focus:ring-[#038153]/15 transition-all"
        />
        <button
          type="submit"
          disabled={adding || !newLabel.trim()}
          className="h-9 px-4 rounded-md text-sm font-medium text-white flex items-center gap-1.5 hover:brightness-110 disabled:opacity-50 transition-all"
          style={{ background: "#038153" }}
        >
          {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          Add
        </button>
      </form>

      {error && <p className="text-xs text-[#CC3340] mb-3">{error}</p>}

      {/* List */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[#68717A]">
          <Loader2 size={14} className="animate-spin" /> Loading...
        </div>
      ) : titles.length === 0 ? (
        <div className="text-sm text-[#C2C8CC] py-8 text-center border border-dashed border-[#D8DCDE] rounded-lg">
          No preset titles yet. Add your first one above.
        </div>
      ) : (
        <div className="space-y-1.5">
          {titles.map(t => (
            <div
              key={t.id}
              className="flex items-center gap-2 px-3 py-2.5 bg-white border border-[#D8DCDE] rounded-lg group"
            >
              <GripVertical size={14} className="text-[#C2C8CC] shrink-0" />
              <span className="flex-1 text-sm text-[#2F3941]">{t.label}</span>
              <button
                onClick={() => handleDelete(t.id)}
                className="opacity-0 group-hover:opacity-100 text-[#68717A] hover:text-[#CC3340] transition-all"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
