"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, Trash2, Search, Check, Plus, Briefcase, AlertTriangle, CheckCircle2, Circle } from "lucide-react";
import DealModal from "@/components/deals/DealModal";

// ── Types ─────────────────────────────────────────────────────────────────────

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

interface ContactResult {
  id: string;
  field_values: Record<string, unknown> | null;
}

interface DealResult {
  id: string;
  field_values: Record<string, unknown> | null;
  contact_id: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  initialStart?: Date;
  initialEnd?: Date;
  event?: CalendarEvent | null;
  defaultUserId: string;
  onSave: (event: CalendarEvent) => void;
  onDelete?: (id: string) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const COLOR_SWATCHES = [
  { hex: "#038153", label: "Green" },
  { hex: "#1D6FA4", label: "Blue" },
  { hex: "#CC3340", label: "Red" },
  { hex: "#F5A623", label: "Amber" },
  { hex: "#9B59B6", label: "Purple" },
] as const;

const DEFAULT_COLOR = "#038153";

const inputCls =
  "h-9 w-full px-3 text-sm rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] placeholder:text-[#C2C8CC] outline-none focus:border-[#038153] focus:ring-2 focus:ring-[#038153]/15 transition-all";

const labelCls = "block text-xs font-medium text-[#68717A] mb-1";

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDatetimeLocal(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getContactName(fv: Record<string, unknown> | null): string {
  if (!fv) return "Unknown";
  const first = (fv.first_name as string) ?? "";
  const last  = (fv.last_name  as string) ?? "";
  return [first, last].filter(Boolean).join(" ") || "Unknown";
}

function getDealName(fv: Record<string, unknown> | null): string {
  if (!fv) return "Untitled Deal";
  const nameVal = (fv.deal_name ?? fv.name) as string | undefined;
  if (nameVal?.trim()) return nameVal.trim();
  for (const val of Object.values(fv)) {
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  return "Untitled Deal";
}

// ── Contact Search ────────────────────────────────────────────────────────────

function ContactSearch({
  contactId,
  contactName,
  onSelect,
  onClear,
}: {
  contactId: string | null;
  contactName: string;
  onSelect: (id: string, name: string, fv: Record<string, unknown> | null) => void;
  onClear: () => void;
}) {
  const [query, setQuery]     = useState(contactName);
  const [results, setResults] = useState<ContactResult[]>([]);
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef           = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef            = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(contactName); }, [contactName]);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const search = useCallback((q: string) => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    setLoading(true);
    fetch(`/api/contacts?search=${encodeURIComponent(q)}&limit=5`)
      .then(r => r.json())
      .then((data: ContactResult[] | { contacts: ContactResult[] }) => {
        const list = Array.isArray(data) ? data : (data as { contacts: ContactResult[] }).contacts ?? [];
        setResults(list);
        setOpen(list.length > 0);
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (contactId) onClear();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  const handleSelect = (c: ContactResult) => {
    const name = getContactName(c.field_values);
    setQuery(name);
    setOpen(false);
    setResults([]);
    onSelect(c.id, name, c.field_values);
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setOpen(false);
    onClear();
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative flex items-center">
        <Search size={13} className="absolute left-3 text-[#68717A] pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          placeholder="Search contact..."
          className={`${inputCls} pl-8 pr-8`}
        />
        {loading && <Loader2 size={13} className="absolute right-3 animate-spin text-[#68717A] pointer-events-none" />}
        {!loading && (contactId || query) && (
          <button type="button" onClick={handleClear} className="absolute right-2.5 text-[#68717A] hover:text-[#2F3941] transition-colors" tabIndex={-1}>
            <X size={13} />
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white border border-[#D8DCDE] rounded-md shadow-lg overflow-hidden">
          {results.map(c => (
            <button key={c.id} type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => handleSelect(c)}
              className="w-full text-left px-3 py-2 text-sm text-[#2F3941] hover:bg-[#F3F4F6] transition-colors">
              {getContactName(c.field_values)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Deal Picker ───────────────────────────────────────────────────────────────

function DealPicker({
  contactId,
  contactName,
  selectedDealId,
  defaultUserId,
  onSelect,
  onClear,
  onDealCreated,
}: {
  contactId: string;
  contactName: string;
  selectedDealId: string | null;
  defaultUserId: string;
  onSelect: (dealId: string, dealName: string) => void;
  onClear: () => void;
  onDealCreated: (deal: DealResult) => void;
}) {
  const [deals, setDeals]           = useState<DealResult[]>([]);
  const [loading, setLoading]       = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const fetchDeals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/deals?contact_id=${contactId}&limit=100`);
      const data = await res.json();
      setDeals(Array.isArray(data.deals) ? data.deals : []);
    } catch {
      setDeals([]);
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  const handleDealSave = async (formData: { contact_id: string; field_values: Record<string, unknown>; user_id: string }) => {
    const res = await fetch("/api/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    if (!res.ok) throw new Error((await res.json()).error || "Failed to create deal");
    const newDeal: DealResult = await res.json();
    setDeals(prev => [newDeal, ...prev]);
    onDealCreated(newDeal);
    setCreateOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-[#68717A]">
        <Loader2 size={12} className="animate-spin" /> Loading deals...
      </div>
    );
  }

  return (
    <>
      <div className="space-y-1.5">
        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-0.5">
          {/* No deal option */}
          <div onClick={onClear} className="flex items-center gap-2.5 px-3 py-2 rounded-md border border-transparent cursor-pointer hover:bg-[#F8F9F9] transition-colors">
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${!selectedDealId ? "border-[#038153] bg-[#038153]" : "border-[#D8DCDE]"}`}>
              {!selectedDealId && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
            <span className="text-sm text-[#68717A] italic">No deal</span>
          </div>
          {/* Existing deals */}
          {deals.map(deal => {
            const name = getDealName(deal.field_values);
            const selected = selectedDealId === deal.id;
            return (
              <div
                key={deal.id}
                onClick={() => selected ? onClear() : onSelect(deal.id, name)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md border cursor-pointer transition-colors ${selected ? "border-[#038153] bg-[#EAF7F0]" : "border-[#D8DCDE] hover:bg-[#F8F9F9]"}`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${selected ? "border-[#038153] bg-[#038153]" : "border-[#D8DCDE]"}`}>
                  {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <Briefcase size={13} className={selected ? "text-[#038153]" : "text-[#68717A]"} />
                <span className={`text-sm truncate ${selected ? "text-[#038153] font-medium" : "text-[#2F3941]"}`}>{name}</span>
              </div>
            );
          })}
        </div>

        {/* No deals message + create button */}
        {deals.length === 0 && (
          <div className="px-3 py-2 rounded-md bg-[#F8F9F9] border border-dashed border-[#D8DCDE] text-xs text-[#68717A]">
            {contactName} has no deals yet.
          </div>
        )}

        {/* Create deal button */}
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 text-xs font-medium text-[#1D6FA4] hover:text-[#155a87] px-1 py-1 transition-colors"
        >
          <Plus size={12} /> Create deal for {contactName}
        </button>
      </div>

      {/* DealModal nested */}
      <DealModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultUserId={defaultUserId}
        prefillContactId={contactId}
        onSave={handleDealSave}
      />
    </>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────

export default function EventModal({
  open,
  onClose,
  initialStart,
  initialEnd,
  event,
  defaultUserId,
  onSave,
  onDelete,
}: Props) {
  const isEdit = !!event;

  const [title,          setTitle]          = useState("");
  const [titleOpen,      setTitleOpen]      = useState(false);
  const [titlePresets,   setTitlePresets]   = useState<{ id: string; label: string }[]>([]);
  const [description,    setDescription]    = useState("");
  const [startAt,        setStartAt]        = useState("");
  const [endAt,          setEndAt]          = useState("");
  const [color,          setColor]          = useState(DEFAULT_COLOR);
  const [completed,      setCompleted]      = useState(false);
  const [contactId,      setContactId]      = useState<string | null>(null);
  const [contactName,    setContactName]    = useState("");
  const [dealId,         setDealId]         = useState<string | null>(null);
  const titleWrapRef = useRef<HTMLDivElement>(null);
  const [saving,           setSaving]           = useState(false);
  const [deleting,         setDeleting]         = useState(false);
  const [error,            setError]            = useState("");
  const [conflicts,        setConflicts]        = useState<CalendarEvent[]>([]);
  const [expandedConflict, setExpandedConflict] = useState<string | null>(null);

  const titleRef = useRef<HTMLInputElement>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (!open) return;
    setError("");
    if (event) {
      setTitle(event.title);
      setDescription(event.description ?? "");
      setStartAt(toDatetimeLocal(event.start_at));
      setEndAt(toDatetimeLocal(event.end_at));
      setColor(event.color || DEFAULT_COLOR);
      setCompleted(event.completed ?? false);
      setContactId(event.contact_id);
      setContactName(event.contact ? getContactName(event.contact.field_values) : "");
      setDealId(event.deal_id);
    } else {
      setTitle("");
      setDescription("");
      setStartAt(initialStart ? toDatetimeLocal(initialStart) : toDatetimeLocal(new Date()));
      setEndAt(initialEnd ? toDatetimeLocal(initialEnd) : toDatetimeLocal(new Date(Date.now() + 30 * 60 * 1000)));
      setColor(DEFAULT_COLOR);
      setCompleted(false);
      setContactId(null);
      setContactName("");
      setDealId(null);
    }
    setTimeout(() => titleRef.current?.focus(), 60);
  }, [open, event, initialStart, initialEnd]);

  // Load title presets once
  useEffect(() => {
    fetch("/api/calendar/titles").then(r => r.json()).then(setTitlePresets).catch(() => {});
  }, []);

  // Close title dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (titleWrapRef.current && !titleWrapRef.current.contains(e.target as Node)) setTitleOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Fetch events for the selected day and find overlaps
  useEffect(() => {
    if (!startAt || !endAt) { setConflicts([]); return; }
    const s = new Date(startAt);
    const e = new Date(endAt);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) { setConflicts([]); return; }

    const dayStart = new Date(s); dayStart.setHours(0, 0, 0, 0);
    const dayEnd   = new Date(s); dayEnd.setHours(23, 59, 59, 999);

    fetch(`/api/calendar/events?start=${dayStart.toISOString()}&end=${dayEnd.toISOString()}`)
      .then(r => r.json())
      .then((evs: CalendarEvent[]) => {
        const overlapping = evs.filter(ev => {
          if (ev.id === event?.id) return false;
          if (ev.completed) return false; // completed events don't block slots
          const evS = new Date(ev.start_at).getTime();
          const evE = new Date(ev.end_at).getTime();
          return s.getTime() < evE && e.getTime() > evS;
        });
        setConflicts(overlapping);
      })
      .catch(() => setConflicts([]));
  }, [startAt, endAt, event?.id]);

  // Set end = start + N minutes
  const applyDuration = (minutes: number) => {
    if (!startAt) return;
    const s = new Date(startAt);
    if (isNaN(s.getTime())) return;
    setEndAt(toDatetimeLocal(new Date(s.getTime() + minutes * 60 * 1000)));
  };

  const handleContactSelect = (id: string, name: string) => {
    setContactId(id);
    setContactName(name);
    setDealId(null); // reset deal when contact changes
  };

  const handleContactClear = () => {
    setContactId(null);
    setContactName("");
    setDealId(null);
  };

  const handleDealSelect = (id: string, name: string) => {
    setDealId(id);
    // Auto-fill title from deal name if title is empty
    if (!title.trim()) setTitle(name);
  };

  const handleDealCreated = (deal: DealResult) => {
    const name = getDealName(deal.field_values);
    setDealId(deal.id);
    if (!title.trim()) setTitle(name);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactId) { setError("Please select a contact."); return; }
    if (!title.trim()) { setError("Event title is required."); titleRef.current?.focus(); return; }
    if (!startAt) { setError("Start date/time is required."); return; }
    if (!endAt) { setError("End date/time is required."); return; }
    if (new Date(endAt) < new Date(startAt)) { setError("End must be after start."); return; }
    if (new Date(endAt).getTime() - new Date(startAt).getTime() > 3 * 60 * 60 * 1000) {
      setError("Event cannot be longer than 3 hours."); return;
    }

    setSaving(true);
    setError("");
    try {
      const body = {
        title: title.trim(),
        description: description.trim() || null,
        start_at: new Date(startAt).toISOString(),
        end_at: new Date(endAt).toISOString(),
        all_day: false,
        color,
        completed,
        contact_id: contactId,
        deal_id: dealId,
        ...(isEdit ? {} : { user_id: defaultUserId }),
      };
      const url = isEdit ? `/api/calendar/events/${event.id}` : "/api/calendar/events";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error((payload as { error?: string }).error ?? `Request failed (${res.status})`);
      }
      onSave(await res.json());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/calendar/events/${event.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      onDelete?.(event.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setDeleting(false);
    }
  };

  if (!open || typeof window === "undefined") return null;

  const content = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)" }}
        onClick={e => e.stopPropagation()}
      >
        <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#D8DCDE]">
            <h2 className="text-[15px] font-semibold text-[#2F3941]">
              {isEdit ? "Edit Event" : "New Event"}
            </h2>
            <button type="button" onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-md text-[#68717A] hover:bg-[#F3F4F6] transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4 flex-1 overflow-y-auto">

            {/* Contact — mandatory */}
            <div>
              <label className={labelCls}>
                Contact <span className="text-[#CC3340]">*</span>
              </label>
              <ContactSearch
                contactId={contactId}
                contactName={contactName}
                onSelect={handleContactSelect}
                onClear={handleContactClear}
              />
            </div>

            {/* Deal — optional, shown after contact selected */}
            {contactId && (
              <div>
                <label className={labelCls}>Deal <span className="text-[#68717A] font-normal">(optional)</span></label>
                <DealPicker
                  contactId={contactId}
                  contactName={contactName}
                  selectedDealId={dealId}
                  defaultUserId={defaultUserId}
                  onSelect={handleDealSelect}
                  onClear={() => setDealId(null)}
                  onDealCreated={handleDealCreated}
                />
              </div>
            )}

            {/* Title — combo with presets */}
            <div>
              <label className={labelCls}>
                Title <span className="text-[#CC3340]">*</span>
              </label>
              <div ref={titleWrapRef} className="relative">
                <input
                  ref={titleRef}
                  type="text"
                  value={title}
                  onChange={e => { setTitle(e.target.value); setTitleOpen(true); }}
                  onFocus={() => setTitleOpen(true)}
                  placeholder="Select or type a title..."
                  className={inputCls}
                />
                {titleOpen && (
                  <div className="absolute z-50 top-full mt-1 w-full bg-white border border-[#D8DCDE] rounded-md shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                    {titlePresets
                      .filter(p => p.label.toLowerCase().includes(title.toLowerCase()))
                      .map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => { setTitle(p.label); setTitleOpen(false); }}
                          className="w-full text-left px-3 py-2 text-sm text-[#2F3941] hover:bg-[#F3F4F6] transition-colors"
                        >
                          {p.label}
                        </button>
                      ))}
                    {title.trim() && !titlePresets.some(p => p.label.toLowerCase() === title.trim().toLowerCase()) && (
                      <button
                        type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={async () => {
                          setTitleOpen(false);
                          try {
                            const res = await fetch("/api/calendar/titles", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ label: title.trim() }),
                            });
                            if (res.ok) {
                              const saved = await res.json();
                              setTitlePresets(prev => [...prev.filter(p => p.id !== saved.id), saved]);
                            }
                          } catch { /* silently ignore */ }
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-[#038153] font-medium hover:bg-[#EAF7F0] border-t border-[#D8DCDE] transition-colors"
                      >
                        + Save &quot;{title.trim()}&quot; as preset
                      </button>
                    )}
                    {titlePresets.filter(p => p.label.toLowerCase().includes(title.toLowerCase())).length === 0 && !title.trim() && (
                      <div className="px-3 py-2 text-xs text-[#C2C8CC]">No presets yet — type to add one</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Start / End */}
            <div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Start <span className="text-[#CC3340]">*</span></label>
                  <input type="datetime-local" value={startAt} required className={inputCls}
                    onChange={e => {
                      setStartAt(e.target.value);
                      if (endAt && e.target.value && new Date(endAt) < new Date(e.target.value)) {
                        setEndAt(toDatetimeLocal(new Date(new Date(e.target.value).getTime() + 30 * 60 * 1000)));
                      }
                    }}
                  />
                </div>
                <div>
                  <label className={labelCls}>End <span className="text-[#CC3340]">*</span></label>
                  <input type="datetime-local" value={endAt} min={startAt} required className={inputCls}
                    onChange={e => setEndAt(e.target.value)}
                  />
                </div>
              </div>

              {/* Quick duration buttons */}
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-[11px] text-[#68717A] mr-0.5">Duration:</span>
                {[10, 15, 20, 30].map(min => (
                  <button
                    key={min}
                    type="button"
                    onClick={() => applyDuration(min)}
                    className="h-6 px-2.5 text-[11px] font-medium rounded-md border border-[#D8DCDE] text-[#68717A] hover:border-[#038153] hover:text-[#038153] hover:bg-[#EAF7F0] transition-colors"
                  >
                    {min} min
                  </button>
                ))}
              </div>

              {/* Conflict warning */}
              {conflicts.length > 0 && (
                <div className="mt-2 rounded-md border border-[#FDE68A] bg-[#FFFBEB] overflow-hidden">
                  <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[#FDE68A]">
                    <AlertTriangle size={13} className="text-[#D97706] shrink-0" />
                    <span className="text-xs font-semibold text-[#92400E]">
                      Time conflict — this slot is already booked
                    </span>
                  </div>
                  {conflicts.map(c => {
                    const cs  = new Date(c.start_at);
                    const ce  = new Date(c.end_at);
                    const fmt = (d: Date) => `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
                    const isOpen = expandedConflict === c.id;
                    const cName = c.contact ? getContactName(c.contact.field_values) : null;

                    return (
                      <div key={c.id}>
                        <button
                          type="button"
                          onClick={() => setExpandedConflict(isOpen ? null : c.id)}
                          className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[#FEF3C7] transition-colors"
                        >
                          <span className="text-xs text-[#92400E]">
                            <span className="font-semibold">"{c.title}"</span>
                            {" — "}{fmt(cs)} – {fmt(ce)}
                          </span>
                          <span className="text-[10px] text-[#D97706] underline shrink-0 ml-2">
                            {isOpen ? "Hide" : "View details"}
                          </span>
                        </button>

                        {isOpen && (
                          <div className="px-3 pb-3 pt-1 border-t border-[#FDE68A] bg-[#FEF3C7]/50 space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ background: c.color }}
                              />
                              <span className="text-xs font-semibold text-[#2F3941]">{c.title}</span>
                            </div>
                            <p className="text-xs text-[#68717A]">
                              🕐 {fmt(cs)} – {fmt(ce)},{" "}
                              {cs.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                            </p>
                            {cName && (
                              <p className="text-xs text-[#68717A]">👤 {cName}</p>
                            )}
                            {c.description && (
                              <p className="text-xs text-[#68717A] whitespace-pre-wrap">{c.description}</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <label className={labelCls}>Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Add a description..." rows={3}
                className="w-full px-3 py-2 text-sm rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] placeholder:text-[#C2C8CC] outline-none focus:border-[#038153] focus:ring-2 focus:ring-[#038153]/15 transition-all resize-none"
              />
            </div>

            {/* Color */}
            <div>
              <label className={labelCls}>Color</label>
              <div className="flex items-center gap-2">
                {COLOR_SWATCHES.map(swatch => {
                  const selected = color === swatch.hex;
                  return (
                    <button key={swatch.hex} type="button" title={swatch.label} onClick={() => setColor(swatch.hex)}
                      className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
                      style={{ backgroundColor: swatch.hex, boxShadow: selected ? `0 0 0 2px white, 0 0 0 4px ${swatch.hex}` : "none" }}>
                      {selected && <Check size={13} className="text-white" strokeWidth={3} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Completed toggle */}
            <button
              type="button"
              onClick={() => setCompleted(v => !v)}
              className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-md border transition-colors ${
                completed
                  ? "border-[#038153] bg-[#EAF7F0] text-[#038153]"
                  : "border-[#D8DCDE] bg-white text-[#68717A] hover:bg-[#F8F9F9]"
              }`}
            >
              {completed
                ? <CheckCircle2 size={16} className="shrink-0" />
                : <Circle size={16} className="shrink-0" />}
              <span className="text-sm font-medium">
                {completed ? "Completed" : "Mark as completed"}
              </span>
            </button>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-md bg-[#FFF0F1] border border-[#FECDD3]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#CC3340] shrink-0" />
                <p className="text-xs text-[#CC3340]">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-[#D8DCDE] bg-[#F8F9F9]">
            <div>
              {isEdit && (
                <button type="button" onClick={handleDelete} disabled={deleting || saving}
                  className="h-8 px-3 text-sm font-medium rounded-md border border-[#FECDD3] text-[#CC3340] bg-white hover:bg-[#FFF0F1] flex items-center gap-1.5 disabled:opacity-60 transition-colors">
                  {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  Delete
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose} disabled={saving || deleting}
                className="h-8 px-4 text-sm font-medium rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] hover:bg-[#F3F4F6] disabled:opacity-60 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={saving || deleting || conflicts.length > 0}
                title={conflicts.length > 0 ? "Resolve time conflict before saving" : undefined}
                className="h-8 px-4 text-sm font-medium rounded-md text-white flex items-center gap-1.5 hover:brightness-110 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                style={{ background: conflicts.length > 0 ? "#9CA3AF" : "#038153" }}>
                {saving && <Loader2 size={13} className="animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
