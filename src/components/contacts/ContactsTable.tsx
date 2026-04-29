"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { createPortal } from "react-dom";
import { Search, Plus, Loader2, Contact2, MoreHorizontal, Trash2, UserCircle2, Star, Settings, Pencil, SlidersHorizontal, X } from "lucide-react";
import ContactFilterPanel, { FilterCondition, chipLabel } from "./ContactFilterPanel";
import ContactModal from "./ContactModal";
import ContactDeleteDialog from "./ContactDeleteDialog";

// ── Types ─────────────────────────────────────────────────────────────────────

type FieldValues = Record<string, unknown>;

interface Contact {
  id: string;
  field_values: FieldValues | null;
  source_id: string | null;
  attribute_ids: string | null;
  user_id: string;
  created_at: string;
  user: { id: string; name: string };
}

interface ContactsResponse { contacts: Contact[]; total: number; page: number; pages: number; }

interface ContactFieldOption {
  id: string;
  label: string;
  value: string;
  sort_order: number;
}

interface ContactField {
  id: string;
  label: string;
  field_key: string;
  field_type: "text" | "multi_phone" | "multi_email" | "date" | "datetime" | "boolean" | "radio" | "select" | "conditional_select" | "source_flow" | "source_select";
  sort_order: number;
  is_required: boolean;
  is_active: boolean;
  is_filterable: boolean;
  config: Record<string, unknown> | null;
  options: ContactFieldOption[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function contactDisplayName(fv: FieldValues | null): string {
  const first = (fv?.first_name as string | undefined) ?? "";
  const last = (fv?.last_name as string | undefined) ?? "";
  return [first, last].filter(Boolean).join(" ") || "—";
}


function formatFieldValue(field: ContactField, fv: FieldValues | null): React.ReactNode {
  const empty = <span className="text-[#C2C8CC]">—</span>;
  if (!fv) return empty;
  const val = fv[field.field_key];

  switch (field.field_type) {
    case "text": {
      const str = val != null ? String(val) : "";
      return str ? <span className="max-w-[160px] truncate block">{str}</span> : empty;
    }

    case "multi_phone": {
      const phoneArr = Array.isArray(val)
        ? (val as { number: string }[])
        : typeof val === "string" && val
          ? [{ number: val }]
          : [];
      if (phoneArr.length === 0) return empty;
      if (phoneArr.length === 1) {
        return phoneArr[0]?.number ? (
          <span className="max-w-[160px] truncate block">{phoneArr[0].number}</span>
        ) : empty;
      }
      return <span>{phoneArr.length} numbers</span>;
    }

    case "multi_email": {
      const emailArr = Array.isArray(val)
        ? (val as { address: string; is_main: boolean }[])
        : typeof val === "string" && val
          ? [{ address: val, is_main: false }]
          : [];
      if (emailArr.length === 0) return empty;
      const main = emailArr.find((e) => e.is_main) ?? emailArr[0];
      return main?.address ? (
        <span className="max-w-[160px] truncate block">{main.address}</span>
      ) : empty;
    }

    case "date": {
      if (!val) return empty;
      try {
        const formatted = new Date(String(val)).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
        return <span className="whitespace-nowrap">{formatted}</span>;
      } catch {
        return empty;
      }
    }

    case "datetime": {
      if (!val) return empty;
      try {
        const formatted = new Date(String(val)).toLocaleString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        return <span className="whitespace-nowrap">{formatted}</span>;
      } catch {
        return empty;
      }
    }

    case "source_flow": {
      if (!val || typeof val !== "object") return empty;
      const sfVal = val as { source?: string; groups?: Record<string, string> };
      if (!sfVal.source) return empty;
      try {
        const cfg = JSON.parse((field.config as unknown as string) ?? "{}");
        const sources = cfg.sources ?? [];
        const src = sources.find((s: { value: string; label: string }) => s.value === sfVal.source);
        const srcLabel = src?.label ?? sfVal.source;
        const groupLabels: string[] = [];
        if (src && sfVal.groups) {
          for (const grp of src.groups ?? []) {
            const selected = sfVal.groups[grp.id];
            if (selected) {
              const item = grp.items?.find((it: { value: string; label: string }) => it.value === selected);
              if (item) groupLabels.push(item.label);
            }
          }
        }
        return (
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium w-fit" style={{ background: "#EAF7F0", color: "#038153" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[#038153]" />
              {srcLabel}
            </span>
            {groupLabels.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {groupLabels.map((gl, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded border border-[#D8DCDE] text-[#68717A] bg-[#F8F9F9]">{gl}</span>
                ))}
              </div>
            )}
          </div>
        );
      } catch {
        return <span className="text-xs text-[#2F3941]">{sfVal.source}</span>;
      }
    }

    case "boolean": {
      if (val === "true" || val === true) {
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#EAF7F0] text-[#038153]">
            Yes
          </span>
        );
      }
      if (val === "false" || val === false) {
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#F3F4F6] text-[#68717A]">
            No
          </span>
        );
      }
      return empty;
    }

    case "radio":
    case "select":
    case "conditional_select": {
      if (!val) return empty;
      const str = String(val);
      const matched = field.options.find((o) => o.value === str);
      const display = matched?.label ?? str;
      return display ? <span className="max-w-[160px] truncate block">{display}</span> : empty;
    }

    default:
      return empty;
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InlineTextInput({
  value,
  onSave,
  onCancel,
}: {
  value: string;
  onSave: (v: string) => void;
  onCancel: () => void;
}) {
  const [val, setVal] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  return (
    <input
      ref={ref}
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={() => onSave(val)}
      onKeyDown={e => {
        if (e.key === "Enter") onSave(val);
        if (e.key === "Escape") onCancel();
      }}
      className="h-7 px-1.5 text-sm rounded border border-[#038153] ring-2 ring-[#038153]/20 outline-none w-full bg-white text-[#2F3941]"
    />
  );
}

// ── Multi-value editor types ───────────────────────────────────────────────────

interface PhoneEntry { number: string; note: string; }
interface EmailEntry { address: string; is_main: boolean; note: string; }

// ── Source Flow types ─────────────────────────────────────────────────────────

interface SFItem   { id: string; label: string; value: string; }
interface SFGroup  { id: string; name: string; items: SFItem[]; }
interface SFSource { id: string; label: string; value: string; groups: SFGroup[]; }
interface SFValue  { source: string; groups: Record<string, string>; }

// ── SourceFlowEditor (inline popover) ────────────────────────────────────────

function SourceFlowEditor({
  field,
  initial,
  onSave,
}: {
  field: ContactField;
  initial: unknown;
  onSave: (v: SFValue) => void;
}) {
  let sources: SFSource[] = [];
  try { sources = JSON.parse((field.config as unknown as string) ?? "{}").sources ?? []; } catch { /* */ }

  const initVal = (initial as SFValue) ?? { source: "", groups: {} };
  const [val, setVal] = useState<SFValue>(initVal);

  const selectedSource = sources.find(s => s.value === val.source) ?? null;

  const setSource = (sourceVal: string) => setVal({ source: sourceVal, groups: {} });
  const setGroup  = (groupId: string, itemVal: string) =>
    setVal(prev => ({ ...prev, groups: { ...prev.groups, [groupId]: itemVal } }));

  const selectCls = "h-8 px-2.5 text-sm rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] outline-none focus:border-[#038153] focus:ring-2 focus:ring-[#038153]/15 transition-all w-full appearance-none";

  return (
    <div className="space-y-2.5">
      <select value={val.source} onChange={e => setSource(e.target.value)} className={selectCls}>
        <option value="">— Select source —</option>
        {sources.map(s => <option key={s.id} value={s.value}>{s.label}</option>)}
      </select>

      {selectedSource?.groups.filter(g => g.items.length > 0).map(grp => (
        <div key={grp.id} className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[#68717A]">{grp.name}</span>
          <select
            value={val.groups[grp.id] ?? ""}
            onChange={e => setGroup(grp.id, e.target.value)}
            className={selectCls}
          >
            <option value="">— Select {grp.name} —</option>
            {grp.items.map(it => <option key={it.id} value={it.value}>{it.label}</option>)}
          </select>
        </div>
      ))}

      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={() => onSave(val)}
          className="h-7 px-3 text-xs font-medium rounded-md text-white"
          style={{ background: "#038153" }}
        >
          Done
        </button>
      </div>
    </div>
  );
}

// ── CellPopover ───────────────────────────────────────────────────────────────

function CellPopover({
  anchor,
  onClose,
  children,
}: {
  anchor: DOMRect;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const style: React.CSSProperties = {
    position: "fixed",
    top: anchor.bottom + 6,
    left: anchor.left,
    zIndex: 9999,
    minWidth: 320,
    maxWidth: 420,
  };
  // Flip up if near bottom of viewport
  const openUp = typeof window !== "undefined" && window.innerHeight - anchor.bottom < 300;
  if (openUp) {
    style.top = undefined;
    style.bottom = window.innerHeight - anchor.top + 6;
  }

  if (typeof window === "undefined") return null;
  return createPortal(
    <>
      <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={onClose} />
      <div
        style={style}
        className="bg-white rounded-xl border border-[#D8DCDE] shadow-2xl p-4 space-y-3"
      >
        {children}
      </div>
    </>,
    document.body
  );
}

// ── MultiPhoneEditor ──────────────────────────────────────────────────────────

function MultiPhoneEditor({
  initial,
  onSave,
}: {
  initial: PhoneEntry[];
  onSave: (v: PhoneEntry[]) => void;
}) {
  const [entries, setEntries] = useState<PhoneEntry[]>(initial.length ? initial : [{ number: "", note: "" }]);
  const update = (idx: number, key: keyof PhoneEntry, val: string) =>
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [key]: val } : e));
  const inputCls = "h-8 px-2.5 text-sm rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] placeholder:text-[#C2C8CC] outline-none focus:border-[#038153] focus:ring-2 focus:ring-[#038153]/15 transition-all";
  return (
    <div className="space-y-2">
      {entries.map((e, idx) => (
        <div key={idx} className="flex gap-2 items-start">
          <div className="flex flex-col gap-1 flex-1">
            <input value={e.number} onChange={ev => update(idx, "number", ev.target.value)} placeholder="Number" className={`w-full ${inputCls}`} />
            <input value={e.note} onChange={ev => update(idx, "note", ev.target.value)} placeholder="Note (optional)" className={`w-full ${inputCls}`} />
          </div>
          <button type="button" onClick={() => setEntries(prev => prev.filter((_, i) => i !== idx))}
            className="mt-1 w-7 h-7 flex items-center justify-center rounded-md text-[#CC3340] hover:bg-[#FFF0F1] transition-colors shrink-0">
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <div className="flex items-center justify-between pt-1">
        <button type="button" onClick={() => setEntries(prev => [...prev, { number: "", note: "" }])}
          className="flex items-center gap-1 text-xs font-medium" style={{ color: "#038153" }}>
          <Plus size={12} /> Add Phone
        </button>
        <button type="button" onClick={() => onSave(entries.filter(e => e.number.trim()))}
          className="h-7 px-3 text-xs font-medium rounded-md text-white" style={{ background: "#038153" }}>
          Done
        </button>
      </div>
    </div>
  );
}

// ── MultiEmailEditor ──────────────────────────────────────────────────────────

function MultiEmailEditor({
  initial,
  onSave,
}: {
  initial: EmailEntry[];
  onSave: (v: EmailEntry[]) => void;
}) {
  const [entries, setEntries] = useState<EmailEntry[]>(initial.length ? initial : [{ address: "", is_main: true, note: "" }]);
  const update = (idx: number, key: keyof EmailEntry, val: string | boolean) =>
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [key]: val } : e));
  const setMain = (idx: number) =>
    setEntries(prev => prev.map((e, i) => ({ ...e, is_main: i === idx })));
  const inputCls = "h-8 px-2.5 text-sm rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] placeholder:text-[#C2C8CC] outline-none focus:border-[#038153] focus:ring-2 focus:ring-[#038153]/15 transition-all";
  return (
    <div className="space-y-2">
      {entries.map((e, idx) => (
        <div key={idx} className="flex gap-2 items-start">
          <div className="flex flex-col gap-1 flex-1">
            <input value={e.address} onChange={ev => update(idx, "address", ev.target.value)} placeholder="email@example.com" type="email" className={`w-full ${inputCls}`} />
            <input value={e.note} onChange={ev => update(idx, "note", ev.target.value)} placeholder="Note (optional)" className={`w-full ${inputCls}`} />
          </div>
          <div className="flex flex-col gap-1 items-center mt-0.5 shrink-0">
            {e.is_main ? (
              <span className="flex items-center gap-0.5 px-2 h-6 rounded-full text-[10px] font-semibold" style={{ background: "#E6F4EF", color: "#038153" }}>
                <Star size={9} fill="#038153" /> Main
              </span>
            ) : (
              <button type="button" onClick={() => setMain(idx)}
                className="flex items-center gap-0.5 px-2 h-6 rounded-full text-[10px] font-medium border border-[#D8DCDE] text-[#68717A] hover:border-[#038153] hover:text-[#038153] transition-colors">
                <Star size={9} /> Set Main
              </button>
            )}
            <button type="button" onClick={() => setEntries(prev => prev.filter((_, i) => i !== idx))}
              className="w-7 h-7 flex items-center justify-center rounded-md text-[#CC3340] hover:bg-[#FFF0F1] transition-colors">
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between pt-1">
        <button type="button" onClick={() => setEntries(prev => [...prev, { address: "", is_main: prev.length === 0, note: "" }])}
          className="flex items-center gap-1 text-xs font-medium" style={{ color: "#038153" }}>
          <Plus size={12} /> Add Email
        </button>
        <button type="button" onClick={() => onSave(entries.filter(e => e.address.trim()))}
          className="h-7 px-3 text-xs font-medium rounded-md text-white" style={{ background: "#038153" }}>
          Done
        </button>
      </div>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  return (
    <span
      className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold text-white shrink-0"
      style={{ background: "#1D6FA4" }}
    >
      {initials}
    </span>
  );
}

function RowMenu({
  onDelete,
}: {
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, openUp: false });
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      const openUp = window.innerHeight - rect.bottom < 160;
      setCoords({ top: openUp ? rect.top : rect.bottom, left: rect.right - 160, openUp });
    }
    setOpen((o) => !o);
  };

  const dropdown = open ? (
    <div
      style={{
        position: "fixed",
        top: coords.openUp ? undefined : coords.top + 4,
        bottom: coords.openUp ? window.innerHeight - coords.top + 4 : undefined,
        left: coords.left,
        zIndex: 9999,
      }}
      className="w-40 bg-white rounded-lg border border-[#D8DCDE] shadow-lg overflow-hidden py-1"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => { setOpen(false); onDelete(); }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#CC3340] hover:bg-[#FFF0F1] transition-colors text-left"
      >
        <Trash2 size={13} />
        Delete
      </button>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="w-7 h-7 rounded-md flex items-center justify-center text-[#68717A] hover:bg-[#F3F4F6] hover:text-[#2F3941] transition-colors"
      >
        <MoreHorizontal size={15} />
      </button>
      {typeof window !== "undefined" && createPortal(dropdown, document.body)}
    </>
  );
}

// ── Name edit popover ─────────────────────────────────────────────────────────

function NameEditPopover({
  anchor,
  firstName,
  lastName,
  onSave,
  onClose,
}: {
  anchor: DOMRect;
  firstName: string;
  lastName: string;
  onSave: (first: string, last: string) => Promise<void>;
  onClose: () => void;
}) {
  const [first, setFirst] = useState(firstName);
  const [last,  setLast]  = useState(lastName);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => { firstRef.current?.focus(); }, []);

  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [onClose]);

  const handleSave = async () => {
    setSaving(true);
    await onSave(first.trim(), last.trim());
    setSaving(false);
    onClose();
  };

  const openUp = typeof window !== "undefined" && window.innerHeight - anchor.bottom < 160;
  const style: React.CSSProperties = {
    position: "fixed",
    left: anchor.left,
    width: 220,
    zIndex: 9999,
    ...(openUp
      ? { bottom: window.innerHeight - anchor.top + 4 }
      : { top: anchor.bottom + 4 }),
  };

  return createPortal(
    <div ref={ref} style={style}
      className="bg-white rounded-xl border border-[#D8DCDE] shadow-2xl p-3 flex flex-col gap-2">
      <input
        ref={firstRef}
        value={first}
        onChange={e => setFirst(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onClose(); }}
        placeholder="First name"
        className="h-8 px-2.5 text-sm rounded-md border border-[#D8DCDE] text-[#2F3941] placeholder-[#C2C8CC] focus:outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153] transition-colors"
      />
      <input
        value={last}
        onChange={e => setLast(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onClose(); }}
        placeholder="Last name"
        className="h-8 px-2.5 text-sm rounded-md border border-[#D8DCDE] text-[#2F3941] placeholder-[#C2C8CC] focus:outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153] transition-colors"
      />
      <div className="flex justify-end gap-1.5 pt-0.5">
        <button onClick={onClose} type="button"
          className="h-7 px-3 text-xs font-medium rounded-md border border-[#D8DCDE] text-[#68717A] hover:bg-[#F3F4F6] transition-colors">
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving} type="button"
          className="h-7 px-3 text-xs font-medium rounded-md text-white flex items-center gap-1 disabled:opacity-50 hover:brightness-110 transition-all"
          style={{ background: "#038153" }}>
          {saving ? <Loader2 size={11} className="animate-spin" /> : null}
          Save
        </button>
      </div>
    </div>,
    document.body
  );
}

// ── Main table component ──────────────────────────────────────────────────────

const EXCLUDED_FIELD_KEYS = new Set(["first_name", "last_name"]);

export default function ContactsTable({ defaultUserId }: { defaultUserId: string }) {
  const router = useRouter();
  const params = useParams();
  const platform = (params?.platform as string) ?? "";
  const [data, setData] = useState<ContactsResponse | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteContact, setDeleteContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [fields, setFields] = useState<ContactField[]>([]);
  const [editingCell, setEditingCell] = useState<{ contactId: string; fieldKey: string } | null>(null);
  const [popover, setPopover] = useState<{
    contactId: string;
    fieldKey: string;
    fieldType: string;
    anchor: DOMRect;
  } | null>(null);
  const [nameEdit, setNameEdit] = useState<{ contactId: string; anchor: DOMRect } | null>(null);
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [filterAnchor, setFilterAnchor] = useState<DOMRect | null>(null);
  const filtersJson = useMemo(() => JSON.stringify(filters), [filters]);
  const [fieldsLoading, setFieldsLoading] = useState(true);
  const COL_WIDTHS_KEY = "contacts_col_widths";
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem(COL_WIDTHS_KEY) ?? "{}"); } catch { return {}; }
  });
  const [resizeLineX, setResizeLineX] = useState<number | null>(null);
  const resizingRef = useRef<{ key: string; startX: number; startW: number } | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const startResize = useCallback((e: React.MouseEvent, colKey: string, defaultW: number) => {
    e.preventDefault();
    e.stopPropagation();
    const startW = colWidths[colKey] ?? defaultW;
    resizingRef.current = { key: colKey, startX: e.clientX, startW };
    setResizeLineX(e.clientX);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      const r = resizingRef.current;
      if (!r) return;
      const newW = Math.max(60, r.startW + (ev.clientX - r.startX));
      setResizeLineX(r.startX - r.startW + newW);
      setColWidths(prev => ({ ...prev, [r.key]: newW }));
    };
    const onUp = () => {
      resizingRef.current = null;
      setResizeLineX(null);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      setColWidths(prev => {
        try { localStorage.setItem(COL_WIDTHS_KEY, JSON.stringify(prev)); } catch { /* */ }
        return prev;
      });
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [colWidths]);

  // Fetch active contact fields on mount
  useEffect(() => {
    fetch("/api/contact-fields?active=true")
      .then((res) => res.ok ? res.json() : [])
      .then((json) => {
        const list: ContactField[] = Array.isArray(json) ? json : (json.fields ?? []);
        setFields(list.filter((f) => !EXCLUDED_FIELD_KEYS.has(f.field_key)));
      })
      .catch((err) => console.error("Failed to load contact fields:", err))
      .finally(() => setFieldsLoading(false));
  }, []);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (search) params.set("search", search);
      const noValueOps = new Set(["is_empty", "not_empty", "is_true", "is_false"]);
      const parsed: FilterCondition[] = JSON.parse(filtersJson);
      const active = parsed.filter(f => {
        if (noValueOps.has(f.operator)) return true;
        if (f.operator === "range") return !!(f.value?.trim() || f.value2?.trim());
        return f.value.trim() !== "";
      });
      if (active.length > 0) params.set("filters", JSON.stringify(active));
      const res = await fetch(`/api/contacts?${params}`);
      if (!res.ok) {
        console.error("Contacts API error:", res.status, await res.text());
        setLoading(false);
        return;
      }
      setData(await res.json());
    } catch (err) {
      console.error("fetchContacts error:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, filtersJson]);

  useEffect(() => {
    const t = setTimeout(fetchContacts, 250);
    return () => clearTimeout(t);
  }, [fetchContacts]);

  const saveField = useCallback(async (contactId: string, fieldKey: string, value: unknown) => {
    setEditingCell(null);
    // Optimistic local update
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        contacts: prev.contacts.map(c => {
          if (c.id !== contactId) return c;
          return { ...c, field_values: { ...(c.field_values ?? {}), [fieldKey]: value } };
        }),
      };
    });
    // Persist — send full field_values so API doesn't lose other fields
    const contact = data?.contacts.find(c => c.id === contactId);
    if (!contact) return;
    await fetch(`/api/contacts/${contactId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        field_values: { ...(contact.field_values ?? {}), [fieldKey]: value },
        source_id: contact.source_id,
        attribute_ids: contact.attribute_ids ? JSON.parse(contact.attribute_ids) : null,
        user_id: contact.user_id,
      }),
    });
  }, [data]);

  const saveNameFields = useCallback(async (contactId: string, firstName: string, lastName: string) => {
    const contact = data?.contacts.find(c => c.id === contactId);
    if (!contact) return;
    const newFv = { ...(contact.field_values ?? {}), first_name: firstName, last_name: lastName };
    setData(prev => {
      if (!prev) return prev;
      return { ...prev, contacts: prev.contacts.map(c => c.id !== contactId ? c : { ...c, field_values: newFv }) };
    });
    await fetch(`/api/contacts/${contactId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        field_values: newFv,
        source_id: contact.source_id,
        attribute_ids: contact.attribute_ids ? JSON.parse(contact.attribute_ids) : null,
        user_id: contact.user_id,
      }),
    });
  }, [data]);

  const handleSave = async (formData: {
    field_values: FieldValues;
    source_id: string | null;
    attribute_ids: string[] | null;
    user_id: string;
    created_at?: string;
  }) => {
    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    if (!res.ok) throw new Error((await res.json()).error || "Failed");
    setPage(1);
    fetchContacts();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    fetchContacts();
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  // Name + dynamic fields + Owner + Created + Actions
  const totalCols = fields.length + 4;

  const thClass = "text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#68717A] whitespace-nowrap relative select-none";

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#68717A]" />
            <input
              type="text"
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 pr-3 h-8 text-sm rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] placeholder:text-[#68717A] outline-none focus:border-[#038153] focus:ring-2 focus:ring-[#038153]/15 transition-all w-64"
            />
          </div>

          {/* Filter button */}
          <button
            onClick={e => setFilterAnchor(filterAnchor ? null : (e.currentTarget as HTMLElement).getBoundingClientRect())}
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-sm font-medium border transition-all ${
              filters.length > 0
                ? "bg-[#EAF7F0] border-[#038153] text-[#038153]"
                : "bg-white border-[#D8DCDE] text-[#68717A] hover:border-[#038153] hover:text-[#038153]"
            }`}
          >
            <SlidersHorizontal size={13} />
            Filter
            {filters.length > 0 && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold bg-[#038153] text-white ml-0.5">
                {filters.length}
              </span>
            )}
          </button>

          <div className="flex-1" />
          {data && (
            <span className="text-sm text-[#68717A]">
              {data.total} {data.total === 1 ? "contact" : "contacts"}
            </span>
          )}
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-sm font-medium text-white hover:brightness-110 active:scale-95 transition-all"
            style={{ background: "#038153" }}
          >
            <Plus size={14} strokeWidth={2.5} /> Add Contact
          </button>
        </div>

        {/* Active filter chips */}
        {filters.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {filters.map(f => (
              <span key={f.id} className="inline-flex items-center gap-1 h-6 pl-2.5 pr-1 rounded-full text-xs font-medium bg-[#EAF7F0] text-[#038153] border border-[#B8E4D0]">
                {chipLabel(f)}
                <button
                  type="button"
                  onClick={() => setFilters(prev => prev.filter(x => x.id !== f.id))}
                  className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-[#038153] hover:text-white transition-colors ml-0.5"
                >
                  <X size={9} />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={() => setFilters([])}
              className="text-xs text-[#68717A] hover:text-[#CC3340] transition-colors"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Resize indicator line */}
      {resizeLineX !== null && typeof window !== "undefined" && createPortal(
        <div style={{
          position: "fixed",
          top: tableContainerRef.current?.getBoundingClientRect().top ?? 0,
          height: tableContainerRef.current?.getBoundingClientRect().height ?? "100vh",
          left: resizeLineX,
          width: 2,
          background: "#038153",
          opacity: 0.7,
          pointerEvents: "none",
          zIndex: 9999,
        }} />,
        document.body
      )}

      {/* Table */}
      <div ref={tableContainerRef} className="bg-white rounded-lg border border-[#D8DCDE] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="text-sm" style={{ tableLayout: "fixed", width: "max-content", minWidth: "100%" }}>
            <colgroup>
              <col style={{ width: colWidths["__name__"] ?? 200 }} />
              {fieldsLoading && <col style={{ width: 160 }} />}
              {!fieldsLoading && fields.length === 0 && <col style={{ width: 200 }} />}
              {!fieldsLoading && fields.map(f => (
                <col key={f.id} style={{ width: colWidths[f.id] ?? 160 }} />
              ))}
              <col style={{ width: colWidths["__owner__"] ?? 160 }} />
              <col style={{ width: colWidths["__created__"] ?? 120 }} />
              <col style={{ width: 48 }} />
            </colgroup>
            <thead>
              <tr className="border-b border-[#D8DCDE] bg-[#F8F9F9]">
                {/* Name — always first */}
                <th className={thClass}>
                  Name
                  <div onMouseDown={e => startResize(e, "__name__", 200)}
                    className="absolute top-0 bottom-0 w-[9px] cursor-col-resize z-10 flex items-center justify-center"
                    style={{ right: -4 }}>
                    <div className="w-px h-full bg-[#D8DCDE] hover:bg-[#038153] transition-colors" />
                  </div>
                </th>

                {/* Dynamic columns */}
                {fieldsLoading && (
                  <th className={thClass}>
                    <span className="inline-block w-20 h-3 rounded bg-[#E8EBED] animate-pulse" />
                  </th>
                )}
                {!fieldsLoading && fields.length === 0 && (
                  <th className={thClass}>
                    <span className="inline-flex items-center gap-1 text-[#C2C8CC] font-normal normal-case tracking-normal">
                      <Settings size={11} />
                      Add fields in Settings
                    </span>
                  </th>
                )}
                {!fieldsLoading && fields.map((field) => (
                  <th key={field.id} className={thClass}>
                    {field.label}
                    <div onMouseDown={e => startResize(e, field.id, 160)}
                      className="absolute top-0 bottom-0 w-[9px] cursor-col-resize z-10 flex items-center justify-center"
                      style={{ right: -4 }}>
                      <div className="w-px h-full bg-[#D8DCDE] hover:bg-[#038153] transition-colors" />
                    </div>
                  </th>
                ))}

                {/* Fixed trailing columns */}
                <th className={thClass}>
                  Owner
                  <div onMouseDown={e => startResize(e, "__owner__", 160)}
                    className="absolute top-0 bottom-0 w-[9px] cursor-col-resize z-10 flex items-center justify-center"
                    style={{ right: -4 }}>
                    <div className="w-px h-full bg-[#D8DCDE] hover:bg-[#038153] transition-colors" />
                  </div>
                </th>
                <th className={thClass}>
                  Created
                  <div onMouseDown={e => startResize(e, "__created__", 120)}
                    className="absolute top-0 bottom-0 w-[9px] cursor-col-resize z-10 flex items-center justify-center"
                    style={{ right: -4 }}>
                    <div className="w-px h-full bg-[#D8DCDE] hover:bg-[#038153] transition-colors" />
                  </div>
                </th>
                <th style={{ width: 48 }} />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={totalCols} className="h-48 text-center">
                    <Loader2 size={18} className="animate-spin mx-auto text-[#68717A]" />
                  </td>
                </tr>
              )}
              {!loading && data?.contacts.length === 0 && (
                <tr>
                  <td colSpan={totalCols} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-2 text-[#68717A]">
                      <Contact2 size={32} strokeWidth={1.2} />
                      <p className="text-sm font-medium">
                        {search ? `No results for "${search}"` : "No contacts yet"}
                      </p>
                      {!search && <p className="text-xs">Add your first contact to get started</p>}
                    </div>
                  </td>
                </tr>
              )}
              {!loading && data?.contacts.map((contact) => {
                const fv = contact.field_values;
                const isBlacklisted = fv?.blacklisted === "true" || fv?.blacklisted === true;

                return (
                  <tr
                    key={contact.id}
                    onClick={() => router.push(`/${platform}/contacts/${contact.id}`)}
                    className="group border-b border-[#D8DCDE] last:border-0 hover:bg-[#F8F9F9] transition-colors cursor-pointer"
                  >
                    {/* Name — click navigates to detail page; pencil opens profile for editing */}
                    <td className="px-4 py-4" style={{ minWidth: 180 }}>
                      <div className="flex items-center gap-2.5 group/name">
                        <div className="w-8 h-8 rounded-full bg-[#F3F4F6] border border-[#D8DCDE] flex items-center justify-center shrink-0">
                          <UserCircle2 size={17} className="text-[#C2C8CC]" strokeWidth={1.5} />
                        </div>
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="font-medium text-[#2F3941] leading-snug truncate">
                            {(fv?.first_name as string) || <span className="text-[#C2C8CC] font-normal text-xs">First name</span>}
                          </span>
                          <span className="text-xs text-[#68717A] truncate">
                            {(fv?.last_name as string) || <span className="text-[#C2C8CC]">Last name</span>}
                          </span>
                          {isBlacklisted && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FFF0F1] text-[#CC3340] font-medium">Blacklisted</span>
                          )}
                        </div>
                        <button
                          type="button"
                          title="Edit name"
                          onClick={e => { e.stopPropagation(); setNameEdit({ contactId: contact.id, anchor: (e.currentTarget as HTMLElement).getBoundingClientRect() }); }}
                          className="opacity-0 group-hover/name:opacity-100 w-6 h-6 flex items-center justify-center rounded text-[#68717A] hover:text-[#038153] hover:bg-[#EAF7F0] transition-all shrink-0 ml-1"
                        >
                          <Pencil size={12} />
                        </button>
                      </div>
                    </td>

                    {/* Dynamic field columns — inline editable */}
                    {fields.map((field) => {
                      const isEditing = editingCell?.contactId === contact.id && editingCell.fieldKey === field.field_key;
                      const isPopover = popover?.contactId === contact.id && popover.fieldKey === field.field_key;
                      const val = fv?.[field.field_key];

                      // boolean: single click toggle
                      if (field.field_type === "boolean") {
                        return (
                          <td key={field.id} className="px-4 py-4 text-sm cursor-pointer select-none"
                            onClick={e => { e.stopPropagation(); saveField(contact.id, field.field_key, val === "true" || val === true ? "false" : "true"); }}>
                            {formatFieldValue(field, fv)}
                          </td>
                        );
                      }

                      // text / date / datetime: inline input
                      if (field.field_type === "text" || field.field_type === "date" || field.field_type === "datetime") {
                        return (
                          <td key={field.id} className="px-4 py-4 text-sm" onClick={e => e.stopPropagation()}>
                            {isEditing ? (
                              <InlineTextInput
                                value={(val as string) ?? ""}
                                onSave={v => saveField(contact.id, field.field_key, v)}
                                onCancel={() => setEditingCell(null)}
                              />
                            ) : (
                              <span
                                className="cursor-text hover:bg-[#F3F4F6] rounded px-1 -mx-1 block truncate max-w-[160px]"
                                onClick={() => setEditingCell({ contactId: contact.id, fieldKey: field.field_key })}
                              >
                                {formatFieldValue(field, fv)}
                              </span>
                            )}
                          </td>
                        );
                      }

                      // radio / select / conditional_select: inline select
                      if (field.field_type === "radio" || field.field_type === "select" || field.field_type === "conditional_select") {
                        return (
                          <td key={field.id} className="px-4 py-4 text-sm" onClick={e => e.stopPropagation()}>
                            {isEditing ? (
                              <select
                                autoFocus
                                value={(val as string) ?? ""}
                                onChange={e => saveField(contact.id, field.field_key, e.target.value)}
                                onBlur={() => setEditingCell(null)}
                                className="h-7 px-1.5 text-sm rounded border border-[#038153] ring-2 ring-[#038153]/20 outline-none bg-white text-[#2F3941] w-full"
                              >
                                <option value="">— Select —</option>
                                {field.options.map(o => <option key={o.id} value={o.value}>{o.label}</option>)}
                              </select>
                            ) : (
                              <span
                                className="cursor-pointer hover:bg-[#F3F4F6] rounded px-1 -mx-1 block truncate max-w-[160px]"
                                onClick={() => setEditingCell({ contactId: contact.id, fieldKey: field.field_key })}
                              >
                                {formatFieldValue(field, fv)}
                              </span>
                            )}
                          </td>
                        );
                      }

                      // multi_phone: popover editor
                      if (field.field_type === "multi_phone") {
                        return (
                          <td key={field.id} className="px-4 py-4 text-sm relative" onClick={e => e.stopPropagation()}>
                            <span
                              className="cursor-pointer hover:bg-[#F3F4F6] rounded px-1 -mx-1 block truncate max-w-[160px]"
                              onClick={e => setPopover({ contactId: contact.id, fieldKey: field.field_key, fieldType: "multi_phone", anchor: (e.currentTarget as HTMLElement).getBoundingClientRect() })}
                            >
                              {formatFieldValue(field, fv)}
                            </span>
                            {isPopover && (
                              <CellPopover anchor={popover!.anchor} onClose={() => setPopover(null)}>
                                <p className="text-xs font-semibold text-[#68717A] uppercase tracking-wide mb-2">{field.label}</p>
                                <MultiPhoneEditor
                                  initial={(val as PhoneEntry[]) ?? []}
                                  onSave={v => { saveField(contact.id, field.field_key, v); setPopover(null); }}
                                />
                              </CellPopover>
                            )}
                          </td>
                        );
                      }

                      // multi_email: popover editor
                      if (field.field_type === "multi_email") {
                        return (
                          <td key={field.id} className="px-4 py-4 text-sm relative" onClick={e => e.stopPropagation()}>
                            <span
                              className="cursor-pointer hover:bg-[#F3F4F6] rounded px-1 -mx-1 block truncate max-w-[160px]"
                              onClick={e => setPopover({ contactId: contact.id, fieldKey: field.field_key, fieldType: "multi_email", anchor: (e.currentTarget as HTMLElement).getBoundingClientRect() })}
                            >
                              {formatFieldValue(field, fv)}
                            </span>
                            {isPopover && (
                              <CellPopover anchor={popover!.anchor} onClose={() => setPopover(null)}>
                                <p className="text-xs font-semibold text-[#68717A] uppercase tracking-wide mb-2">{field.label}</p>
                                <MultiEmailEditor
                                  initial={(val as EmailEntry[]) ?? []}
                                  onSave={v => { saveField(contact.id, field.field_key, v); setPopover(null); }}
                                />
                              </CellPopover>
                            )}
                          </td>
                        );
                      }

                      // source_flow: popover editor
                      if (field.field_type === "source_flow") {
                        return (
                          <td key={field.id} className="px-4 py-4 text-sm relative" onClick={e => e.stopPropagation()}>
                            <span
                              className="cursor-pointer hover:bg-[#F3F4F6] rounded px-1 -mx-1 block min-w-[80px]"
                              onClick={e => setPopover({ contactId: contact.id, fieldKey: field.field_key, fieldType: "source_flow", anchor: (e.currentTarget as HTMLElement).getBoundingClientRect() })}
                            >
                              {formatFieldValue(field, fv)}
                            </span>
                            {isPopover && (
                              <CellPopover anchor={popover!.anchor} onClose={() => setPopover(null)}>
                                <p className="text-xs font-semibold text-[#68717A] uppercase tracking-wide mb-2">{field.label}</p>
                                <SourceFlowEditor
                                  field={field}
                                  initial={val}
                                  onSave={v => { saveField(contact.id, field.field_key, v); setPopover(null); }}
                                />
                              </CellPopover>
                            )}
                          </td>
                        );
                      }

                      // Generic fallback — any future field type renders as a text input
                      return (
                        <td key={field.id} className="px-4 py-4 text-sm" onClick={e => e.stopPropagation()}>
                          {isEditing ? (
                            <InlineTextInput
                              value={val != null ? String(val) : ""}
                              onSave={v => saveField(contact.id, field.field_key, v)}
                              onCancel={() => setEditingCell(null)}
                            />
                          ) : (
                            <span
                              className="cursor-text hover:bg-[#F3F4F6] rounded px-1 -mx-1 block truncate max-w-[160px]"
                              onClick={() => setEditingCell({ contactId: contact.id, fieldKey: field.field_key })}
                            >
                              {formatFieldValue(field, fv)}
                            </span>
                          )}
                        </td>
                      );
                    })}

                    {/* Owner */}
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-2">
                        <Avatar name={contact.user?.name ?? "?"} />
                        <span className="text-[#2F3941] text-sm">{contact.user?.name ?? "—"}</span>
                      </span>
                    </td>

                    {/* Created */}
                    <td className="px-4 py-4 text-[#68717A] text-sm whitespace-nowrap">
                      {fmt(contact.created_at)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <RowMenu
                          onDelete={() => setDeleteContact(contact)}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {data && data.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#D8DCDE] bg-[#F8F9F9]">
            <span className="text-xs text-[#68717A]">
              Page {page} of {data.pages} · {data.total} total
            </span>
            <div className="flex gap-1.5">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="h-7 px-3 text-xs font-medium rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] hover:bg-[#F3F4F6] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                disabled={page === data.pages}
                onClick={() => setPage((p) => p + 1)}
                className="h-7 px-3 text-xs font-medium rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] hover:bg-[#F3F4F6] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {filterAnchor && (
        <ContactFilterPanel
          anchor={filterAnchor}
          fields={fields.filter(f => f.is_filterable !== false)}
          filters={filters}
          onChange={f => { setFilters(f); setPage(1); }}
          onClose={() => setFilterAnchor(null)}
        />
      )}

      {nameEdit && (() => {
        const c = data?.contacts.find(ct => ct.id === nameEdit.contactId);
        return (
          <NameEditPopover
            anchor={nameEdit.anchor}
            firstName={(c?.field_values?.first_name as string) ?? ""}
            lastName={(c?.field_values?.last_name as string) ?? ""}
            onSave={(first, last) => saveNameFields(nameEdit.contactId, first, last)}
            onClose={() => setNameEdit(null)}
          />
        );
      })()}

      <ContactModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        contact={null}
        defaultUserId={defaultUserId}
      />
      <ContactDeleteDialog
        open={!!deleteContact}
        contact={deleteContact ? {
          id: deleteContact.id,
          first_name: (deleteContact.field_values?.first_name as string | undefined) ?? null,
          last_name: (deleteContact.field_values?.last_name as string | undefined) ?? null,
        } : null}
        onClose={() => setDeleteContact(null)}
        onConfirm={() => {
          if (deleteContact) handleDelete(deleteContact.id);
          setDeleteContact(null);
        }}
      />
    </div>
  );
}
