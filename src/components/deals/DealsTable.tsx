"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Search, Plus, Loader2, Briefcase, MoreHorizontal, Trash2, UserCircle2, Check, X, Link2, Pencil, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import DealModal from "./DealModal";
import DealDeleteDialog from "./DealDeleteDialog";
import ContactFilterPanel, { FilterCondition, chipLabel } from "@/components/contacts/ContactFilterPanel";

const DEALS_BUILTIN = [
  { id: "__added_on__", label: "Added On", field_key: "__added_on__", field_type: "date", options: [] as { id: string; label: string; value: string }[] },
];

// ── Types ─────────────────────────────────────────────────────────────────────

type FieldValues = Record<string, unknown>;

interface DealFieldOption { id: string; label: string; value: string; }
interface DealField {
  id: string; label: string; field_key: string; field_type: string;
  is_active: boolean; is_filterable: boolean; config: string | null; options: DealFieldOption[];
  source_module: string | null; source_field_id: string | null;
}

interface ContactInfo { id: string; field_values: FieldValues | null; }

interface Deal {
  id: string;
  contact_id: string;
  contact: ContactInfo;
  field_values: FieldValues | null;
  user_id: string;
  user: { id: string; name: string };
  created_at: string;
}

interface DealsResponse { deals: Deal[]; total: number; page: number; pages: number; }

// ── Helpers ───────────────────────────────────────────────────────────────────

function contactName(fv: FieldValues | null): string {
  const first = (fv?.first_name as string) ?? "";
  const last  = (fv?.last_name  as string) ?? "";
  return [first, last].filter(Boolean).join(" ") || "—";
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  return <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold text-white shrink-0" style={{ background: "#038153" }}>{initials}</span>;
}

// ── Cell display ──────────────────────────────────────────────────────────────

function CellValue({ field, fv }: { field: DealField; fv: FieldValues | null }) {
  const raw = fv?.[field.field_key];
  const empty = <span className="text-[#C2C8CC]">—</span>;
  if (raw === undefined || raw === null || raw === "") return empty;

  switch (field.field_type) {
    case "text":
      return <span className="text-[#2F3941] truncate block" title={raw as string}>{raw as string}</span>;

    case "textarea":
      return <span className="text-[#2F3941] text-xs line-clamp-2">{raw as string}</span>;

    case "date":
      return <span className="text-[#2F3941] text-xs whitespace-nowrap">{new Date(raw as string).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>;

    case "datetime":
      return <span className="text-[#2F3941] text-xs whitespace-nowrap">{new Date(raw as string).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>;

    case "boolean":
      return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${raw === true || raw === "true" ? "bg-[#EAF7F0] text-[#038153]" : "bg-[#F3F4F6] text-[#68717A]"}`}>{raw === true || raw === "true" ? "Yes" : "No"}</span>;

    case "radio":
    case "select": {
      const opt = field.options.find(o => o.value === raw);
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#F3F4F6] text-[#2F3941]">{opt?.label ?? (raw as string)}</span>;
    }

    case "source_flow": {
      if (!raw || typeof raw !== "object") return empty;
      const sfVal = raw as { source?: string; groups?: Record<string, string> };
      if (!sfVal.source) return empty;
      try {
        const cfg = JSON.parse((field.config as unknown as string) ?? "{}");
        const sources = cfg.sources ?? [];
        const src = sources.find((s: { value: string; label: string; groups?: { id: string; items?: { value: string; label: string }[] }[] }) => s.value === sfVal.source);
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

    default:
      return <span className="text-[#2F3941] text-xs">{String(raw)}</span>;
  }
}

// ── Cell popover ──────────────────────────────────────────────────────────────

function CellPopover({ anchor, onClose, children }: { anchor: DOMRect; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const down = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const key  = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [onClose]);

  const openUp = typeof window !== "undefined" && window.innerHeight - anchor.bottom < 260;
  return createPortal(
    <div ref={ref} style={{ position: "fixed", top: openUp ? undefined : anchor.bottom + 4, bottom: openUp ? window.innerHeight - anchor.top + 4 : undefined, left: Math.min(anchor.left, (typeof window !== "undefined" ? window.innerWidth : 1200) - 280), minWidth: Math.max(anchor.width, 220), zIndex: 9998 }}
      className="bg-white rounded-lg border border-[#D8DCDE] shadow-lg overflow-hidden">
      {children}
    </div>,
    document.body
  );
}

// ── Source Flow types ─────────────────────────────────────────────────────────

interface SFItem   { id: string; label: string; value: string; }
interface SFGroup  { id: string; name: string; items: SFItem[]; }
interface SFSource { id: string; label: string; value: string; groups: SFGroup[]; }
interface SFValue  { source: string; groups: Record<string, string>; }

function SourceFlowEditor({ field, raw, onSave }: { field: DealField; raw: unknown; onSave: (v: SFValue) => Promise<void> }) {
  let sources: SFSource[] = [];
  try { sources = JSON.parse(field.config ?? "{}").sources ?? []; } catch { /**/ }

  const initVal: SFValue = (raw && typeof raw === "object" && "source" in (raw as object))
    ? raw as SFValue
    : { source: "", groups: {} };
  const [val, setVal] = useState<SFValue>(initVal);
  const [saving, setSaving] = useState(false);

  const selectedSource = sources.find(s => s.value === val.source) ?? null;
  const setSource = (v: string) => setVal({ source: v, groups: {} });
  const setGroup  = (groupId: string, itemVal: string) => setVal(prev => ({ ...prev, groups: { ...prev.groups, [groupId]: itemVal } }));

  const selectCls = "h-8 px-2.5 text-sm rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] outline-none focus:border-[#038153] focus:ring-2 focus:ring-[#038153]/15 transition-all w-full";

  return (
    <div className="p-3 space-y-2.5" style={{ minWidth: 260 }}>
      <select value={val.source} onChange={e => setSource(e.target.value)} className={selectCls}>
        <option value="">— Select source —</option>
        {sources.map(s => <option key={s.id} value={s.value}>{s.label}</option>)}
      </select>
      {selectedSource?.groups.filter(g => g.items.length > 0).map(grp => (
        <div key={grp.id} className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[#68717A]">{grp.name}</span>
          <select value={val.groups[grp.id] ?? ""} onChange={e => setGroup(grp.id, e.target.value)} className={selectCls}>
            <option value="">— Select {grp.name} —</option>
            {grp.items.map(it => <option key={it.id} value={it.value}>{it.label}</option>)}
          </select>
        </div>
      ))}
      <div className="flex justify-end pt-1">
        <button type="button" disabled={saving || !val.source}
          onClick={async () => { setSaving(true); await onSave(val); setSaving(false); }}
          className="h-7 px-3 text-xs font-medium rounded-md text-white hover:brightness-110 disabled:opacity-50 flex items-center gap-1"
          style={{ background: "#038153" }}>
          {saving ? <Loader2 size={11} className="animate-spin" /> : "Done"}
        </button>
      </div>
    </div>
  );
}

// ── Inline editors ────────────────────────────────────────────────────────────

function TextEditor({ raw, multiline, onSave, onClose }: { raw: unknown; multiline?: boolean; onSave: (v: unknown) => Promise<void>; onClose: () => void }) {
  const [val, setVal] = useState(raw != null ? String(raw) : "");
  const [saving, setSaving] = useState(false);
  const save = async () => { setSaving(true); await onSave(val || null); setSaving(false); };
  return (
    <div className="p-3 flex flex-col gap-2.5">
      {multiline
        ? <textarea autoFocus rows={4} className="w-full px-3 py-2 text-sm rounded-md border border-[#D8DCDE] focus:border-[#038153] focus:outline-none focus:ring-2 focus:ring-[#038153]/15 resize-none" value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === "Escape") onClose(); }} />
        : <input autoFocus className="w-full h-8 px-3 text-sm rounded-md border border-[#D8DCDE] focus:border-[#038153] focus:outline-none focus:ring-2 focus:ring-[#038153]/15" value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") onClose(); }} />
      }
      <div className="flex justify-end gap-1.5">
        <button onClick={onClose} className="h-7 px-3 text-xs font-medium rounded-md border border-[#D8DCDE] text-[#2F3941] hover:bg-[#F3F4F6]">Cancel</button>
        <button onClick={save} disabled={saving} className="h-7 px-3 text-xs font-medium rounded-md text-white hover:brightness-110 disabled:opacity-50 flex items-center gap-1" style={{ background: "#038153" }}>
          {saving ? <Loader2 size={11} className="animate-spin" /> : "Save"}
        </button>
      </div>
    </div>
  );
}

function DateEditor({ raw, fieldType, onSave, onClose }: { raw: unknown; fieldType: string; onSave: (v: unknown) => Promise<void>; onClose: () => void }) {
  const isDatetime = fieldType === "datetime";
  const toInputVal = (v: unknown) => { if (!v) return ""; try { return isDatetime ? new Date(v as string).toISOString().slice(0, 16) : new Date(v as string).toISOString().slice(0, 10); } catch { return ""; } };
  const [val, setVal] = useState(toInputVal(raw));
  const [saving, setSaving] = useState(false);
  const save = async () => { setSaving(true); await onSave(val ? (isDatetime ? new Date(val).toISOString() : val) : null); setSaving(false); };
  return (
    <div className="p-3 flex flex-col gap-2.5">
      <input autoFocus type={isDatetime ? "datetime-local" : "date"} className="w-full h-8 px-3 text-sm rounded-md border border-[#D8DCDE] focus:border-[#038153] focus:outline-none focus:ring-2 focus:ring-[#038153]/15" value={val} onChange={e => setVal(e.target.value)} />
      <div className="flex justify-end gap-1.5">
        <button onClick={onClose} className="h-7 px-3 text-xs font-medium rounded-md border border-[#D8DCDE] text-[#2F3941] hover:bg-[#F3F4F6]">Cancel</button>
        <button onClick={save} disabled={saving} className="h-7 px-3 text-xs font-medium rounded-md text-white hover:brightness-110 disabled:opacity-50 flex items-center gap-1" style={{ background: "#038153" }}>
          {saving ? <Loader2 size={11} className="animate-spin" /> : "Save"}
        </button>
      </div>
    </div>
  );
}

function OptionsEditor({ field, raw, onSave }: { field: DealField; raw: unknown; onSave: (v: unknown) => Promise<void> }) {
  const [saving, setSaving] = useState<string | null>(null);
  const pick = async (val: string | null) => { setSaving(val ?? "__clear__"); await onSave(val); setSaving(null); };
  return (
    <div className="py-1" style={{ maxHeight: 260, overflowY: "auto" }}>
      {raw !== undefined && raw !== null && raw !== "" && (
        <button onClick={() => pick(null)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#68717A] hover:bg-[#F8F9F9] text-left"><X size={11} /> Clear</button>
      )}
      {field.options.map(opt => (
        <button key={opt.id} onClick={() => pick(opt.value)} disabled={saving !== null}
          className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${raw === opt.value ? "bg-[#EAF7F0] text-[#038153] font-medium" : "text-[#2F3941] hover:bg-[#F8F9F9]"}`}>
          {saving === opt.value ? <Loader2 size={11} className="animate-spin shrink-0" /> : <span className="w-3 shrink-0">{raw === opt.value && <Check size={11} />}</span>}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Editable cell ─────────────────────────────────────────────────────────────

function EditableCell({ field, deal, onSave }: { field: DealField; deal: Deal; onSave: (fieldKey: string, value: unknown) => Promise<void> }) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [toggling, setToggling] = useState(false);
  const cellRef = useRef<HTMLDivElement>(null);
  const raw = deal.field_values?.[field.field_key];

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (field.field_type === "boolean") {
      setToggling(true);
      await onSave(field.field_key, !(raw === true || raw === "true"));
      setToggling(false);
      return;
    }
    setAnchor(cellRef.current?.getBoundingClientRect() ?? null);
  };

  const save = async (value: unknown) => { await onSave(field.field_key, value); setAnchor(null); };

  const renderEditor = () => {
    switch (field.field_type) {
      case "text":     return <TextEditor raw={raw} onSave={save} onClose={() => setAnchor(null)} />;
      case "textarea": return <TextEditor raw={raw} multiline onSave={save} onClose={() => setAnchor(null)} />;
      case "date":
      case "datetime": return <DateEditor raw={raw} fieldType={field.field_type} onSave={save} onClose={() => setAnchor(null)} />;
      case "select":
      case "radio":    return <OptionsEditor field={field} raw={raw} onSave={save} />;
      case "source_flow": return <SourceFlowEditor field={field} raw={raw} onSave={async v => { await save(v); }} />;
      default:         return <TextEditor raw={raw} onSave={save} onClose={() => setAnchor(null)} />;
    }
  };

  return (
    <>
      <div ref={cellRef} onClick={handleClick} className="cursor-pointer hover:bg-[#EAF7F0] rounded px-1 -mx-1 transition-colors min-h-[22px] flex items-center">
        {toggling ? <Loader2 size={12} className="animate-spin text-[#68717A]" /> : <CellValue field={field} fv={deal.field_values} />}
      </div>
      {anchor && <CellPopover anchor={anchor} onClose={() => setAnchor(null)}>{renderEditor()}</CellPopover>}
    </>
  );
}

// ── Deal name cell — link to profile + pencil to edit ────────────────────────

function DealNameCell({ field, deal, onSave }: { field: DealField; deal: Deal; onSave: (fieldKey: string, value: unknown) => Promise<void> }) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const cellRef = useRef<HTMLDivElement>(null);
  const raw  = deal.field_values?.[field.field_key];
  const name = (raw as string)?.trim() || "—";

  const openEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAnchor(cellRef.current?.getBoundingClientRect() ?? null);
  };

  const save = async (value: unknown) => { await onSave(field.field_key, value); setAnchor(null); };

  return (
    <>
      <div ref={cellRef} className="group/name flex items-center gap-1 min-w-0">
        <Link
          href={`/deals/${deal.id}`}
          onClick={e => e.stopPropagation()}
          className="text-sm font-medium text-[#2F3941] hover:text-[#038153] hover:underline truncate transition-colors"
        >
          {name}
        </Link>
        <button
          onClick={openEdit}
          title="Edit deal name"
          className="opacity-0 group-hover/name:opacity-100 w-5 h-5 flex items-center justify-center rounded text-[#68717A] hover:text-[#2F3941] hover:bg-[#F3F4F6] transition-all shrink-0"
        >
          <Pencil size={11} />
        </button>
      </div>
      {anchor && <CellPopover anchor={anchor} onClose={() => setAnchor(null)}>
        <TextEditor raw={raw} onSave={save} onClose={() => setAnchor(null)} />
      </CellPopover>}
    </>
  );
}

// ── Row menu ──────────────────────────────────────────────────────────────────

function RowMenu({ onDelete }: { onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, openUp: false });
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) { const openUp = window.innerHeight - rect.bottom < 80; setCoords({ top: openUp ? rect.top : rect.bottom, left: rect.right - 140, openUp }); }
    setOpen(o => !o);
  };

  const dropdown = open ? (
    <div style={{ position: "fixed", top: coords.openUp ? undefined : coords.top + 4, bottom: coords.openUp ? window.innerHeight - coords.top + 4 : undefined, left: coords.left, zIndex: 9999 }}
      className="w-36 bg-white rounded-lg border border-[#D8DCDE] shadow-lg overflow-hidden py-1" onMouseDown={e => e.stopPropagation()}>
      <button onClick={() => { setOpen(false); onDelete(); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#CC3340] hover:bg-[#FFF0F1] transition-colors text-left">
        <Trash2 size={13} /> Delete
      </button>
    </div>
  ) : null;

  return (
    <>
      <button ref={btnRef} onClick={handleToggle} className="w-7 h-7 rounded-md flex items-center justify-center text-[#68717A] hover:bg-[#F3F4F6] hover:text-[#2F3941] transition-colors">
        <MoreHorizontal size={15} />
      </button>
      {typeof window !== "undefined" && createPortal(dropdown, document.body)}
    </>
  );
}

// ── Resize helpers ────────────────────────────────────────────────────────────

interface ResizingState { key: string; startX: number; startW: number; }

function loadColWidths(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem("deals_col_widths") ?? "{}"); } catch { return {}; }
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DealsTable({ defaultUserId }: { defaultUserId: string }) {
  const router = useRouter();
  const [data, setData]           = useState<DealsResponse | null>(null);
  const [fields, setFields]       = useState<DealField[]>([]);
  const [fieldsLoading, setFl]    = useState(true);
  const [search, setSearch]       = useState("");
  const [page, setPage]           = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDeal, setDeleteDeal] = useState<Deal | null>(null);
  const [loading, setLoading]     = useState(true);

  const [filters, setFilters]       = useState<FilterCondition[]>([]);
  const [filterAnchor, setFilterAnchor] = useState<DOMRect | null>(null);
  const filtersJson = useMemo(() => JSON.stringify(filters), [filters]);

  const [colWidths, setColWidths]   = useState<Record<string, number>>({});
  const [resizeLineX, setResizeLineX] = useState<number | null>(null);
  const resizingRef        = useRef<ResizingState | null>(null);
  const tableContainerRef  = useRef<HTMLDivElement>(null);

  useEffect(() => { setColWidths(loadColWidths()); }, []);

  const startResize = useCallback((e: React.MouseEvent, key: string, defaultW: number) => {
    e.preventDefault(); e.stopPropagation();
    const startW = colWidths[key] ?? defaultW;
    resizingRef.current = { key, startX: e.clientX, startW };
    setResizeLineX(e.clientX);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      const r = resizingRef.current; if (!r) return;
      const newW = Math.max(60, r.startW + (ev.clientX - r.startX));
      setColWidths(prev => ({ ...prev, [r.key]: newW }));
      setResizeLineX(ev.clientX);
    };
    const onUp = () => {
      resizingRef.current = null; setResizeLineX(null);
      document.body.style.cursor = ""; document.body.style.userSelect = "";
      setColWidths(prev => { try { localStorage.setItem("deals_col_widths", JSON.stringify(prev)); } catch { /**/ } return prev; });
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [colWidths]);

  useEffect(() => {
    fetch("/api/deal-fields?active=true")
      .then(r => r.json()).then((f: DealField[]) => setFields(Array.isArray(f) ? f : [])).catch(() => {}).finally(() => setFl(false));
  }, []);

  const fetchDeals = useCallback(async () => {
    setLoading(true);
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
    const res = await fetch(`/api/deals?${params}`);
    setData(await res.json());
    setLoading(false);
  }, [page, search, filtersJson]);

  useEffect(() => { const t = setTimeout(fetchDeals, 250); return () => clearTimeout(t); }, [fetchDeals]);

  const saveCell = useCallback(async (deal: Deal, fieldKey: string, value: unknown) => {
    setData(prev => {
      if (!prev) return prev;
      return { ...prev, deals: prev.deals.map(d => d.id === deal.id ? { ...d, field_values: { ...(d.field_values ?? {}), [fieldKey]: value } } : d) };
    });
    await fetch(`/api/deals/${deal.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field_values: { ...(deal.field_values ?? {}), [fieldKey]: value } }),
    });
  }, []);

  const handleDelete = async (id: string) => { await fetch(`/api/deals/${id}`, { method: "DELETE" }); fetchDeals(); };

  const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  const totalCols = fields.length + 4; // contact + fields + owner + created + actions
  const isReady = !fieldsLoading;
  const thClass = "text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#68717A] whitespace-nowrap relative select-none";

  const sepDiv = (key: string, defaultW: number) => (
    <div onMouseDown={e => startResize(e, key, defaultW)} className="absolute top-0 bottom-0 w-[9px] cursor-col-resize z-10 flex items-center justify-center" style={{ right: -4 }}>
      <div className="w-px h-full bg-[#D8DCDE] hover:bg-[#038153] transition-colors" />
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Resize line */}
      {resizeLineX !== null && typeof window !== "undefined" && createPortal(
        <div style={{ position: "fixed", top: tableContainerRef.current?.getBoundingClientRect().top ?? 0, height: tableContainerRef.current?.getBoundingClientRect().height ?? "100vh", left: resizeLineX, width: 2, background: "#038153", opacity: 0.7, pointerEvents: "none", zIndex: 9999 }} />,
        document.body
      )}

      {/* Toolbar */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#68717A]" />
            <input type="text" placeholder="Search deals..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 pr-3 h-8 text-sm rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] placeholder:text-[#68717A] outline-none focus:border-[#038153] focus:ring-2 focus:ring-[#038153]/15 transition-all w-64" />
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
          {data && <span className="text-sm text-[#68717A]">{data.total} {data.total === 1 ? "deal" : "deals"}</span>}
          <button onClick={() => setModalOpen(true)} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-sm font-medium text-white hover:brightness-110 active:scale-95 transition-all" style={{ background: "#038153" }}>
            <Plus size={14} strokeWidth={2.5} /> Add Deal
          </button>
        </div>

        {/* Active filter chips */}
        {filters.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {filters.map(f => (
              <span key={f.id} className="inline-flex items-center gap-1 h-6 pl-2.5 pr-1 rounded-full text-xs font-medium bg-[#EAF7F0] text-[#038153] border border-[#B8E4D0]">
                {chipLabel(f)}
                <button type="button" onClick={() => setFilters(prev => prev.filter(x => x.id !== f.id))}
                  className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-[#038153] hover:text-white transition-colors ml-0.5">
                  <X size={9} />
                </button>
              </span>
            ))}
            <button type="button" onClick={() => setFilters([])} className="text-xs text-[#68717A] hover:text-[#CC3340] transition-colors">
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      {(isReady) && (
        <div ref={tableContainerRef} className="bg-white rounded-lg border border-[#D8DCDE] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="text-sm" style={{ tableLayout: "fixed", width: "max-content", minWidth: "100%" }}>
              <colgroup>
                <col style={{ width: colWidths["__contact__"] ?? 200 }} />
                {fields.map(f => <col key={f.id} style={{ width: colWidths[f.id] ?? 160 }} />)}
                <col style={{ width: colWidths["__owner__"] ?? 160 }} />
                <col style={{ width: colWidths["__created__"] ?? 120 }} />
                <col style={{ width: 48 }} />
              </colgroup>
              <thead>
                <tr className="border-b border-[#D8DCDE] bg-[#F8F9F9]">
                  <th className={thClass}>Contact{sepDiv("__contact__", 200)}</th>
                  {fields.map(f => <th key={f.id} className={thClass}>{f.label}{sepDiv(f.id, 160)}</th>)}
                  <th className={thClass}>Owner{sepDiv("__owner__", 160)}</th>
                  <th className={thClass}>Created{sepDiv("__created__", 120)}</th>
                  <th style={{ width: 48 }} />
                </tr>
              </thead>
              <tbody>
                {(loading || fieldsLoading) && <tr><td colSpan={totalCols} className="h-40 text-center"><Loader2 size={18} className="animate-spin mx-auto text-[#68717A]" /></td></tr>}
                {!loading && data?.deals.length === 0 && (
                  <tr><td colSpan={totalCols} className="h-40 text-center">
                    <div className="flex flex-col items-center gap-2 text-[#68717A]">
                      <Briefcase size={32} strokeWidth={1.2} />
                      <p className="text-sm font-medium">{search ? `No results for "${search}"` : "No deals yet"}</p>
                      {!search && <p className="text-xs">Add your first deal to get started</p>}
                    </div>
                  </td></tr>
                )}
                {!loading && data?.deals.map(deal => (
                  <tr key={deal.id} onClick={() => router.push('/deals/' + deal.id)} className="group border-b border-[#D8DCDE] last:border-0 hover:bg-[#F8F9F9] transition-colors cursor-pointer">
                    {/* Contact — clickable link to contact profile */}
                    <td className="px-4 py-2.5 font-medium">
                      <Link href={`/contacts/${deal.contact_id}`} onClick={e => e.stopPropagation()}
                        className="flex items-center gap-1.5 min-w-0 group/contact rounded px-1 -mx-1 hover:bg-[#EAF7F0] transition-colors w-fit max-w-full">
                        <UserCircle2 size={13} className="text-[#68717A] shrink-0" />
                        <span className="text-[#2F3941] group-hover/contact:text-[#038153] truncate transition-colors">{contactName(deal.contact?.field_values ?? null)}</span>
                      </Link>
                    </td>
                    {/* Dynamic fields — inline editable; deal_name gets link+pencil */}
                    {fields.map(field => (
                      <td key={field.id} className="px-4 py-2.5">
                        {field.field_key === "deal_name"
                          ? <DealNameCell field={field} deal={deal} onSave={(fieldKey, value) => saveCell(deal, fieldKey, value)} />
                          : <EditableCell field={field} deal={deal} onSave={(fieldKey, value) => saveCell(deal, fieldKey, value)} />
                        }
                      </td>
                    ))}
                    {/* Owner */}
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-2 whitespace-nowrap">
                        <Avatar name={deal.user?.name ?? "?"} />
                        <span className="text-[#2F3941]">{deal.user?.name ?? "—"}</span>
                      </span>
                    </td>
                    {/* Created */}
                    <td className="px-4 py-2.5 text-[#68717A] text-xs whitespace-nowrap">{fmt(deal.created_at)}</td>
                    {/* Actions */}
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <RowMenu onDelete={() => setDeleteDeal(deal)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data && data.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#D8DCDE] bg-[#F8F9F9]">
              <span className="text-xs text-[#68717A]">Page {page} of {data.pages} · {data.total} total</span>
              <div className="flex gap-1.5">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="h-7 px-3 text-xs font-medium rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] hover:bg-[#F3F4F6] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Previous</button>
                <button disabled={page === data.pages} onClick={() => setPage(p => p + 1)} className="h-7 px-3 text-xs font-medium rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] hover:bg-[#F3F4F6] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {filterAnchor && (
        <ContactFilterPanel
          anchor={filterAnchor}
          fields={fields.filter(f => f.is_filterable !== false)}
          builtinFields={DEALS_BUILTIN}
          filters={filters}
          onChange={f => { setFilters(f); setPage(1); }}
          onClose={() => setFilterAnchor(null)}
        />
      )}

      <DealModal open={modalOpen} onClose={() => setModalOpen(false)} defaultUserId={defaultUserId}
        onSave={async (formData) => {
          const res = await fetch("/api/deals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData) });
          if (!res.ok) throw new Error((await res.json()).error || "Failed");
          setPage(1); fetchDeals();
        }}
      />
      <DealDeleteDialog open={!!deleteDeal} deal={deleteDeal} onClose={() => setDeleteDeal(null)}
        onConfirm={() => { if (deleteDeal) handleDelete(deleteDeal.id); setDeleteDeal(null); }}
      />
    </div>
  );
}
