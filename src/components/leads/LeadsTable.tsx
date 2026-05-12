"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Search, Plus, Loader2, UserCircle2, MoreHorizontal, Trash2,
  ArrowRightLeft, Settings, X, Check,
} from "lucide-react";
import LeadModal from "./LeadModal";
import LeadDeleteDialog from "./LeadDeleteDialog";
import ContactModal from "@/components/contacts/ContactModal";
import { useSourceField } from "@/hooks/useSourceField";
import SourceCellPicker from "@/components/shared/SourceCellPicker";

// ── Types ─────────────────────────────────────────────────────────────────────

type FieldValues = Record<string, unknown>;

interface LeadFieldOption { id: string; label: string; value: string; }
interface LeadField {
  id: string;
  label: string;
  field_key: string;
  field_type: string;
  sort_order: number;
  is_active: boolean;
  config: string | null;
  options: LeadFieldOption[];
}

interface Lead {
  id: string;
  field_values: FieldValues | null;
  source_id: string | null;
  source: { id: string; name: string } | null;
  attribute_ids: string | null;
  user_id: string;
  created_at: string;
  user: { id: string; name: string };
}

interface LeadFormData {
  id?: string;
  field_values: FieldValues | null;
  source_id: string | null;
  attribute_ids: string[] | null;
  user_id: string;
}

interface LeadsResponse { leads: Lead[]; total: number; page: number; pages: number; }

// ── Cell display (read-only) ──────────────────────────────────────────────────

function CellValue({ field, fv }: { field: LeadField; fv: FieldValues | null }) {
  const raw = fv?.[field.field_key];
  const empty = <span className="text-[#C2C8CC]">—</span>;
  if (raw === undefined || raw === null || raw === "") return empty;

  switch (field.field_type) {
    case "text":
      return <span className="text-[#2F3941] truncate block" title={raw as string}>{raw as string}</span>;

    case "multi_phone": {
      const phones = raw as { number: string; note?: string }[];
      if (!Array.isArray(phones) || !phones.length) return empty;
      return (
        <span className="text-[#2F3941] text-xs">
          {phones[0].number}
          {phones.length > 1 && <span className="ml-1 text-[#68717A]">+{phones.length - 1}</span>}
        </span>
      );
    }

    case "multi_email": {
      const emails = raw as { address: string; is_main?: boolean }[];
      if (!Array.isArray(emails) || !emails.length) return empty;
      const main = emails.find(e => e.is_main) ?? emails[0];
      return (
        <span className="text-[#2F3941] text-xs truncate block" title={main.address}>
          {main.address}
          {emails.length > 1 && <span className="ml-1 text-[#68717A]">+{emails.length - 1}</span>}
        </span>
      );
    }

    case "date":
      return (
        <span className="text-[#2F3941] text-xs whitespace-nowrap">
          {new Date(raw as string).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
        </span>
      );

    case "datetime":
      return (
        <span className="text-[#2F3941] text-xs whitespace-nowrap">
          {new Date(raw as string).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
        </span>
      );

    case "boolean":
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${raw === true || raw === "true" ? "bg-[#EAF7F0] text-[#038153]" : "bg-[#F3F4F6] text-[#68717A]"}`}>
          {raw === true || raw === "true" ? "Yes" : "No"}
        </span>
      );

    case "radio":
    case "select":
    case "conditional_select": {
      const opt = field.options.find(o => o.value === raw);
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#F3F4F6] text-[#2F3941]">
          {opt?.label ?? (raw as string)}
        </span>
      );
    }

    case "source_flow": {
      const val = raw as { source?: string; groups?: Record<string, string> };
      if (!val?.source) return empty;
      try {
        const cfg = JSON.parse(field.config ?? "{}");
        const sources = cfg.sources ?? [];
        const src = sources.find((s: { value: string; label: string }) => s.value === val.source);
        const srcLabel = src?.label ?? val.source;
        const groupLabels: string[] = [];
        if (src && val.groups) {
          for (const grp of src.groups ?? []) {
            const selected = val.groups[grp.id];
            if (selected) {
              const item = grp.items?.find((it: { value: string; label: string }) => it.value === selected);
              if (item) groupLabels.push(item.label);
            }
          }
        }
        return (
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium w-fit" style={{ background: "#EAF7F0", color: "#038153" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[#038153] shrink-0" />
              {srcLabel}
            </span>
            {groupLabels.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-0.5">
                {groupLabels.map((gl, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded border border-[#D8DCDE] text-[#68717A] bg-[#F8F9F9]">{gl}</span>
                ))}
              </div>
            )}
          </div>
        );
      } catch {
        return <span className="text-[#2F3941] text-xs">{val.source}</span>;
      }
    }

    default:
      return <span className="text-[#2F3941] text-xs">{String(raw)}</span>;
  }
}

// ── Cell popover shell ────────────────────────────────────────────────────────

function CellPopover({ anchor, onClose, children }: {
  anchor: DOMRect;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const down = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const key  = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [onClose]);

  const openUp = typeof window !== "undefined" && window.innerHeight - anchor.bottom < 240;

  return createPortal(
    <div
      ref={ref}
      style={{
        position: "fixed",
        top:    openUp ? undefined : anchor.bottom + 4,
        bottom: openUp ? window.innerHeight - anchor.top + 4 : undefined,
        left: Math.min(anchor.left, (typeof window !== "undefined" ? window.innerWidth : 1200) - 260),
        minWidth: Math.max(anchor.width, 220),
        zIndex: 9998,
      }}
      className="bg-white rounded-lg border border-[#D8DCDE] shadow-lg overflow-hidden"
    >
      {children}
    </div>,
    document.body
  );
}

// ── Field-specific inline editors ────────────────────────────────────────────

function TextEditor({ raw, onSave, onClose }: { raw: unknown; onSave: (v: unknown) => Promise<void>; onClose: () => void }) {
  const [val, setVal] = useState(raw != null ? String(raw) : "");
  const [saving, setSaving] = useState(false);
  const save = async () => { setSaving(true); await onSave(val || null); setSaving(false); };
  return (
    <div className="p-3 flex flex-col gap-2.5">
      <input
        autoFocus
        className="w-full h-8 px-3 text-sm rounded-md border border-[#D8DCDE] focus:border-[#038153] focus:outline-none focus:ring-2 focus:ring-[#038153]/15"
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") onClose(); }}
      />
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
  const toInputVal = (v: unknown) => {
    if (!v) return "";
    try { return isDatetime ? new Date(v as string).toISOString().slice(0, 16) : new Date(v as string).toISOString().slice(0, 10); }
    catch { return ""; }
  };
  const [val, setVal] = useState(toInputVal(raw));
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    await onSave(val ? (isDatetime ? new Date(val).toISOString() : val) : null);
    setSaving(false);
  };
  return (
    <div className="p-3 flex flex-col gap-2.5">
      <input
        autoFocus
        type={isDatetime ? "datetime-local" : "date"}
        className="w-full h-8 px-3 text-sm rounded-md border border-[#D8DCDE] focus:border-[#038153] focus:outline-none focus:ring-2 focus:ring-[#038153]/15"
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === "Escape") onClose(); }}
      />
      <div className="flex justify-end gap-1.5">
        <button onClick={onClose} className="h-7 px-3 text-xs font-medium rounded-md border border-[#D8DCDE] text-[#2F3941] hover:bg-[#F3F4F6]">Cancel</button>
        <button onClick={save} disabled={saving} className="h-7 px-3 text-xs font-medium rounded-md text-white hover:brightness-110 disabled:opacity-50 flex items-center gap-1" style={{ background: "#038153" }}>
          {saving ? <Loader2 size={11} className="animate-spin" /> : "Save"}
        </button>
      </div>
    </div>
  );
}

function OptionsEditor({ field, raw, onSave }: { field: LeadField; raw: unknown; onSave: (v: unknown) => Promise<void> }) {
  const [saving, setSaving] = useState<string | null>(null);
  const pick = async (val: string | null) => {
    setSaving(val ?? "__clear__");
    await onSave(val);
    setSaving(null);
  };
  return (
    <div className="py-1" style={{ maxHeight: 260, overflowY: "auto" }}>
      {raw !== undefined && raw !== null && raw !== "" && (
        <button onClick={() => pick(null)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#68717A] hover:bg-[#F8F9F9] text-left">
          <X size={11} /> Clear
        </button>
      )}
      {field.options.map(opt => (
        <button
          key={opt.id}
          onClick={() => pick(opt.value)}
          disabled={saving !== null}
          className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${raw === opt.value ? "bg-[#EAF7F0] text-[#038153] font-medium" : "text-[#2F3941] hover:bg-[#F8F9F9]"}`}
        >
          {saving === opt.value ? <Loader2 size={11} className="animate-spin shrink-0" /> : <span className="w-3 shrink-0">{raw === opt.value && <Check size={11} />}</span>}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

interface SFSource { value: string; label: string; groups?: { id: string; label: string; items: { value: string; label: string }[] }[] }

function SourceFlowEditor({ field, raw, onSave, onClose }: { field: LeadField; raw: unknown; onSave: (v: unknown) => Promise<void>; onClose: () => void }) {
  const cfg = useMemo(() => { try { return JSON.parse(field.config ?? "{}"); } catch { return {}; } }, [field.config]);
  const sources: SFSource[] = cfg.sources ?? [];
  const init = (raw as { source?: string; groups?: Record<string, string> }) ?? {};
  const [selSrc, setSelSrc] = useState(init.source ?? "");
  const [selGrps, setSelGrps] = useState<Record<string, string>>(init.groups ?? {});
  const [saving, setSaving] = useState(false);
  const currentSrc = sources.find(s => s.value === selSrc);

  const save = async () => {
    setSaving(true);
    await onSave(selSrc ? { source: selSrc, groups: selGrps } : null);
    setSaving(false);
  };

  return (
    <div className="p-3 flex flex-col gap-3" style={{ minWidth: 240 }}>
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-[#68717A] mb-1 block">Source</label>
        <select value={selSrc} onChange={e => { setSelSrc(e.target.value); setSelGrps({}); }}
          className="w-full h-8 px-2 text-sm rounded-md border border-[#D8DCDE] focus:border-[#038153] focus:outline-none bg-white">
          <option value="">— None —</option>
          {sources.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>
      {currentSrc?.groups?.map(grp => (
        <div key={grp.id}>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-[#68717A] mb-1 block">{grp.label}</label>
          <select value={selGrps[grp.id] ?? ""} onChange={e => setSelGrps(prev => ({ ...prev, [grp.id]: e.target.value }))}
            className="w-full h-8 px-2 text-sm rounded-md border border-[#D8DCDE] focus:border-[#038153] focus:outline-none bg-white">
            <option value="">— None —</option>
            {grp.items.map(it => <option key={it.value} value={it.value}>{it.label}</option>)}
          </select>
        </div>
      ))}
      <div className="flex justify-end gap-1.5 pt-1 border-t border-[#D8DCDE]">
        <button onClick={onClose} className="h-7 px-3 text-xs font-medium rounded-md border border-[#D8DCDE] text-[#2F3941] hover:bg-[#F3F4F6]">Cancel</button>
        <button onClick={save} disabled={saving} className="h-7 px-3 text-xs font-medium rounded-md text-white hover:brightness-110 disabled:opacity-50 flex items-center gap-1" style={{ background: "#038153" }}>
          {saving ? <Loader2 size={11} className="animate-spin" /> : "Save"}
        </button>
      </div>
    </div>
  );
}

function MultiPhoneEditor({ raw, onSave, onClose }: { raw: unknown; onSave: (v: unknown) => Promise<void>; onClose: () => void }) {
  const init = Array.isArray(raw) ? (raw as { number: string; note?: string }[]) : [];
  const [phones, setPhones] = useState(init.length ? init : [{ number: "", note: "" }]);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    const filtered = phones.filter(p => p.number.trim());
    await onSave(filtered.length ? filtered : null);
    setSaving(false);
  };
  return (
    <div className="p-3 flex flex-col gap-2" style={{ minWidth: 260 }}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#68717A]">Phone Numbers</p>
      {phones.map((ph, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input autoFocus={i === 0} placeholder="e.g. +386 40 123 456" value={ph.number}
            onChange={e => setPhones(prev => prev.map((p, j) => j === i ? { ...p, number: e.target.value } : p))}
            onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") onClose(); }}
            className="flex-1 h-8 px-2 text-sm rounded-md border border-[#D8DCDE] focus:border-[#038153] focus:outline-none" />
          <button onClick={() => setPhones(prev => prev.filter((_, j) => j !== i))}
            className="w-6 h-6 flex items-center justify-center text-[#68717A] hover:text-[#CC3340] rounded">
            <X size={12} />
          </button>
        </div>
      ))}
      <button onClick={() => setPhones(prev => [...prev, { number: "", note: "" }])}
        className="text-xs text-[#038153] hover:underline text-left">+ Add number</button>
      <div className="flex justify-end gap-1.5 pt-1 border-t border-[#D8DCDE]">
        <button onClick={onClose} className="h-7 px-3 text-xs font-medium rounded-md border border-[#D8DCDE] text-[#2F3941] hover:bg-[#F3F4F6]">Cancel</button>
        <button onClick={save} disabled={saving} className="h-7 px-3 text-xs font-medium rounded-md text-white hover:brightness-110 disabled:opacity-50 flex items-center gap-1" style={{ background: "#038153" }}>
          {saving ? <Loader2 size={11} className="animate-spin" /> : "Save"}
        </button>
      </div>
    </div>
  );
}

function MultiEmailEditor({ raw, onSave, onClose }: { raw: unknown; onSave: (v: unknown) => Promise<void>; onClose: () => void }) {
  const init = Array.isArray(raw) ? (raw as { address: string; is_main?: boolean }[]) : [];
  const [emails, setEmails] = useState(init.length ? init : [{ address: "", is_main: true }]);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    const filtered = emails.filter(e => e.address.trim());
    await onSave(filtered.length ? filtered : null);
    setSaving(false);
  };
  return (
    <div className="p-3 flex flex-col gap-2" style={{ minWidth: 280 }}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#68717A]">Email Addresses</p>
      {emails.map((em, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input autoFocus={i === 0} type="email" placeholder="email@example.com" value={em.address}
            onChange={e => setEmails(prev => prev.map((m, j) => j === i ? { ...m, address: e.target.value } : m))}
            onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") onClose(); }}
            className="flex-1 h-8 px-2 text-sm rounded-md border border-[#D8DCDE] focus:border-[#038153] focus:outline-none" />
          <button onClick={() => {
            setEmails(prev => {
              const next = prev.filter((_, j) => j !== i);
              if (em.is_main && next.length) next[0].is_main = true;
              return next;
            });
          }} className="w-6 h-6 flex items-center justify-center text-[#68717A] hover:text-[#CC3340] rounded">
            <X size={12} />
          </button>
        </div>
      ))}
      <button onClick={() => setEmails(prev => [...prev, { address: "", is_main: false }])}
        className="text-xs text-[#038153] hover:underline text-left">+ Add email</button>
      <div className="flex justify-end gap-1.5 pt-1 border-t border-[#D8DCDE]">
        <button onClick={onClose} className="h-7 px-3 text-xs font-medium rounded-md border border-[#D8DCDE] text-[#2F3941] hover:bg-[#F3F4F6]">Cancel</button>
        <button onClick={save} disabled={saving} className="h-7 px-3 text-xs font-medium rounded-md text-white hover:brightness-110 disabled:opacity-50 flex items-center gap-1" style={{ background: "#038153" }}>
          {saving ? <Loader2 size={11} className="animate-spin" /> : "Save"}
        </button>
      </div>
    </div>
  );
}

// ── Editable cell ─────────────────────────────────────────────────────────────

function EditableCell({ field, lead, onSave }: {
  field: LeadField;
  lead: Lead;
  onSave: (fieldKey: string, value: unknown) => Promise<void>;
}) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [toggling, setToggling] = useState(false);
  const cellRef = useRef<HTMLDivElement>(null);
  const raw = lead.field_values?.[field.field_key];

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

  const save = async (value: unknown) => {
    await onSave(field.field_key, value);
    setAnchor(null);
  };

  const renderEditor = () => {
    switch (field.field_type) {
      case "text":
        return <TextEditor raw={raw} onSave={save} onClose={() => setAnchor(null)} />;
      case "date":
      case "datetime":
        return <DateEditor raw={raw} fieldType={field.field_type} onSave={save} onClose={() => setAnchor(null)} />;
      case "select":
      case "radio":
      case "conditional_select":
        return <OptionsEditor field={field} raw={raw} onSave={save} />;
      case "source_flow":
        return <SourceFlowEditor field={field} raw={raw} onSave={save} onClose={() => setAnchor(null)} />;
      case "multi_phone":
        return <MultiPhoneEditor raw={raw} onSave={save} onClose={() => setAnchor(null)} />;
      case "multi_email":
        return <MultiEmailEditor raw={raw} onSave={save} onClose={() => setAnchor(null)} />;
      default:
        return <TextEditor raw={raw} onSave={save} onClose={() => setAnchor(null)} />;
    }
  };

  return (
    <>
      <div
        ref={cellRef}
        onClick={handleClick}
        className="cursor-pointer hover:bg-[#EAF7F0] rounded px-1 -mx-1 transition-colors min-h-[22px] flex items-center"
      >
        {toggling
          ? <Loader2 size={12} className="animate-spin text-[#68717A]" />
          : <CellValue field={field} fv={lead.field_values} />
        }
      </div>
      {anchor && (
        <CellPopover anchor={anchor} onClose={() => setAnchor(null)}>
          {renderEditor()}
        </CellPopover>
      )}
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold text-white shrink-0" style={{ background: "#038153" }}>
      {initials}
    </span>
  );
}

// ── Row menu ──────────────────────────────────────────────────────────────────

function RowMenu({ onConvert, onDelete }: { onConvert: () => void; onDelete: () => void }) {
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
      const openUp = window.innerHeight - rect.bottom < 120;
      setCoords({ top: openUp ? rect.top : rect.bottom, left: rect.right - 160, openUp });
    }
    setOpen(o => !o);
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
      onMouseDown={e => e.stopPropagation()}
    >
      <button onClick={() => { setOpen(false); onConvert(); }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#2F3941] hover:bg-[#F8F9F9] transition-colors text-left">
        <ArrowRightLeft size={13} className="text-[#1D6FA4]" /> Convert
      </button>
      <div className="my-1 border-t border-[#D8DCDE]" />
      <button onClick={() => { setOpen(false); onDelete(); }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#CC3340] hover:bg-[#FFF0F1] transition-colors text-left">
        <Trash2 size={13} /> Delete
      </button>
    </div>
  ) : null;

  return (
    <>
      <button ref={btnRef} onClick={handleToggle}
        className="w-7 h-7 rounded-md flex items-center justify-center text-[#68717A] hover:bg-[#F3F4F6] hover:text-[#2F3941] transition-colors">
        <MoreHorizontal size={15} />
      </button>
      {typeof window !== "undefined" && createPortal(dropdown, document.body)}
    </>
  );
}

// ── Resize helpers ────────────────────────────────────────────────────────────

interface ResizingState { key: string; startX: number; startW: number; }

function loadColWidths(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem("leads_col_widths") ?? "{}"); } catch { return {}; }
}

// ── Main component ────────────────────────────────────────────────────────────

type Column =
  | { type: "field"; field: LeadField }
  | { type: "source" };

export default function LeadsTable({ defaultUserId }: { defaultUserId: string }) {
  const source = useSourceField("lead");
  const [data, setData] = useState<LeadsResponse | null>(null);
  const [fields, setFields] = useState<LeadField[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editLead, setEditLead] = useState<LeadFormData | null>(null);
  const [deleteLead, setDeleteLead] = useState<Lead | null>(null);
  const [convertLead, setConvertLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);

  // Column resize
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [resizeLineX, setResizeLineX] = useState<number | null>(null);
  const resizingRef = useRef<ResizingState | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setColWidths(loadColWidths()); }, []);

  const startResize = useCallback((e: React.MouseEvent, key: string, defaultW: number) => {
    e.preventDefault();
    e.stopPropagation();
    const startW = colWidths[key] ?? defaultW;
    resizingRef.current = { key, startX: e.clientX, startW };
    setResizeLineX(e.clientX);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      const r = resizingRef.current;
      if (!r) return;
      const newW = Math.max(60, r.startW + (ev.clientX - r.startX));
      setColWidths(prev => ({ ...prev, [r.key]: newW }));
      setResizeLineX(ev.clientX);
    };

    const onUp = () => {
      resizingRef.current = null;
      setResizeLineX(null);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setColWidths(prev => {
        try { localStorage.setItem("leads_col_widths", JSON.stringify(prev)); } catch { /* */ }
        return prev;
      });
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [colWidths]);

  // Fetch fields
  useEffect(() => {
    fetch("/api/lead-fields?active=true")
      .then(r => r.ok ? r.json() : [])
      .then((d: LeadField[]) => setFields(Array.isArray(d) ? d : []))
      .catch(() => setFields([]))
      .finally(() => setFieldsLoading(false));
  }, []);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (search) params.set("search", search);
    const res = await fetch(`/api/leads?${params}`);
    setData(await res.json());
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    const t = setTimeout(fetchLeads, 250);
    return () => clearTimeout(t);
  }, [fetchLeads]);

  const saveCell = useCallback(async (lead: Lead, fieldKey: string, value: unknown) => {
    // Optimistic update
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        leads: prev.leads.map(l =>
          l.id === lead.id
            ? { ...l, field_values: { ...(l.field_values ?? {}), [fieldKey]: value } }
            : l
        ),
      };
    });
    // Persist
    await fetch(`/api/leads/${lead.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        field_values: { ...(lead.field_values ?? {}), [fieldKey]: value },
        source_id: lead.source_id,
        attribute_ids: (() => { try { return JSON.parse(lead.attribute_ids ?? "[]"); } catch { return []; } })(),
        user_id: lead.user_id,
      }),
    });
  }, []);

  const handleSave = async (form: { id?: string; field_values: FieldValues; source_id: string | null; attribute_ids: string[] | null; user_id: string }) => {
    const method = form.id ? "PUT" : "POST";
    const url = form.id ? `/api/leads/${form.id}` : "/api/leads";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (!res.ok) throw new Error((await res.json()).error || "Failed");
    setPage(1);
    fetchLeads();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/leads/${id}`, { method: "DELETE" });
    fetchLeads();
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  const columns: Column[] = (() => {
    const arr: Column[] = fields.map(f => ({ type: "field" as const, field: f }));
    if (source.enabled) {
      let insertAt = arr.findIndex(c => c.type === "field" && c.field.sort_order >= source.sortOrder);
      if (insertAt === -1) insertAt = arr.length;
      arr.splice(insertAt, 0, { type: "source" as const });
    }
    return arr;
  })();

  const totalCols = columns.length + 4;
  const isReady = !fieldsLoading;
  const thClass = "text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#68717A] whitespace-nowrap relative select-none";

  return (
    <div className="flex flex-col gap-4">
      {/* Resize indicator line — scoped to table height */}
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

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#68717A]" />
          <input
            type="text"
            placeholder="Search leads..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 pr-3 h-8 text-sm rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] placeholder:text-[#68717A] outline-none focus:border-[#038153] focus:ring-2 focus:ring-[#038153]/15 transition-all w-64"
          />
        </div>
        <div className="flex-1" />
        {data && (
          <span className="text-sm text-[#68717A]">
            {data.total} {data.total === 1 ? "lead" : "leads"}
          </span>
        )}
        <button
          onClick={() => { setEditLead(null); setModalOpen(true); }}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-sm font-medium text-white hover:brightness-110 active:scale-95 transition-all"
          style={{ background: "#038153" }}
        >
          <Plus size={14} strokeWidth={2.5} /> Add Lead
        </button>
      </div>

      {/* No fields state */}
      {isReady && columns.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 rounded-lg border border-dashed border-[#D8DCDE] bg-white text-center">
          <Settings size={28} className="text-[#C2C8CC]" strokeWidth={1.2} />
          <div>
            <p className="text-sm font-medium text-[#2F3941]">No lead fields configured</p>
            <p className="text-xs text-[#68717A] mt-1">Go to Settings → Leads to add fields.</p>
          </div>
        </div>
      )}

      {/* Table */}
      {(isReady && columns.length > 0) && (
        <div ref={tableContainerRef} className="bg-white rounded-lg border border-[#D8DCDE] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="text-sm" style={{ tableLayout: "fixed", width: "max-content", minWidth: "100%" }}>
              <colgroup>
                <col style={{ width: colWidths["__id__"] ?? 120 }} />
                {columns.map(c => c.type === "source"
                  ? <col key="__source__" style={{ width: colWidths["__source__"] ?? 180 }} />
                  : <col key={c.field.id} style={{ width: colWidths[c.field.id] ?? 160 }} />)}
                <col style={{ width: colWidths["__owner__"] ?? 160 }} />
                <col style={{ width: colWidths["__created__"] ?? 120 }} />
                <col style={{ width: 48 }} />
              </colgroup>
              <thead>
                <tr className="border-b border-[#D8DCDE] bg-[#F8F9F9]">
                  <th className={thClass}>
                    ID
                    <div onMouseDown={e => startResize(e, "__id__", 120)} className="absolute top-0 bottom-0 w-[9px] cursor-col-resize z-10 flex items-center justify-center" style={{ right: -4 }}>
                      <div className="w-px h-full bg-[#D8DCDE] hover:bg-[#038153] transition-colors" />
                    </div>
                  </th>
                  {columns.map(c => {
                    if (c.type === "source") {
                      return (
                        <th key="__source__" className={thClass}>
                          Source
                          <div onMouseDown={e => startResize(e, "__source__", 180)} className="absolute top-0 bottom-0 w-[9px] cursor-col-resize z-10 flex items-center justify-center" style={{ right: -4 }}>
                            <div className="w-px h-full bg-[#D8DCDE] hover:bg-[#038153] transition-colors" />
                          </div>
                        </th>
                      );
                    }
                    const f = c.field;
                    return (
                    <th key={f.id} className={thClass}>
                      {f.label}
                      <div
                        onMouseDown={e => startResize(e, f.id, 160)}
                        className="absolute top-0 bottom-0 w-[9px] cursor-col-resize z-10 flex items-center justify-center"
                        style={{ right: -4 }}
                      >
                        <div className="w-px h-full bg-[#D8DCDE] hover:bg-[#038153] transition-colors" />
                      </div>
                    </th>
                    );
                  })}
                  <th className={thClass}>
                    Owner
                    <div onMouseDown={e => startResize(e, "__owner__", 160)} className="absolute top-0 bottom-0 w-[9px] cursor-col-resize z-10 flex items-center justify-center" style={{ right: -4 }}>
                      <div className="w-px h-full bg-[#D8DCDE] hover:bg-[#038153] transition-colors" />
                    </div>
                  </th>
                  <th className={thClass}>
                    Created
                    <div onMouseDown={e => startResize(e, "__created__", 120)} className="absolute top-0 bottom-0 w-[9px] cursor-col-resize z-10 flex items-center justify-center" style={{ right: -4 }}>
                      <div className="w-px h-full bg-[#D8DCDE] hover:bg-[#038153] transition-colors" />
                    </div>
                  </th>
                  <th style={{ width: 48 }} />
                </tr>
              </thead>
              <tbody>
                {(loading || fieldsLoading) && (
                  <tr><td colSpan={totalCols} className="h-40 text-center"><Loader2 size={18} className="animate-spin mx-auto text-[#68717A]" /></td></tr>
                )}
                {!loading && data?.leads.length === 0 && (
                  <tr>
                    <td colSpan={totalCols} className="h-40 text-center">
                      <div className="flex flex-col items-center gap-2 text-[#68717A]">
                        <UserCircle2 size={32} strokeWidth={1.2} />
                        <p className="text-sm font-medium">{search ? `No results for "${search}"` : "No leads yet"}</p>
                        {!search && <p className="text-xs">Add your first lead to get started</p>}
                      </div>
                    </td>
                  </tr>
                )}
                {!loading && data?.leads.map(lead => (
                  <tr key={lead.id} className="group border-b border-[#D8DCDE] last:border-0 hover:bg-[#F8F9F9] transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs text-[#68717A] select-all" title={lead.id}>
                      {lead.id.slice(0, 8)}…
                    </td>
                    {columns.map((c, fi) => {
                      if (c.type === "source") {
                        return (
                          <td key="__source__" className="px-4 py-2.5 text-sm" onClick={e => e.stopPropagation()}>
                            <SourceCellPicker
                              value={lead.source}
                              onSave={async (sourceId) => {
                                await fetch(`/api/leads/${lead.id}`, {
                                  method: "PUT",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ source_id: sourceId, attribute_ids: null, field_values: lead.field_values, user_id: lead.user_id }),
                                });
                                fetchLeads();
                              }}
                            />
                          </td>
                        );
                      }
                      const field = c.field;
                      return (
                        <td key={field.id} className={`px-4 py-2.5 ${fi === 0 ? "font-medium" : ""}`}>
                          <EditableCell
                            field={field}
                            lead={lead}
                            onSave={(fieldKey, value) => saveCell(lead, fieldKey, value)}
                          />
                        </td>
                      );
                    })}
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-2 whitespace-nowrap">
                        <Avatar name={lead.user?.name ?? "?"} />
                        <span className="text-[#2F3941]">{lead.user?.name ?? "—"}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[#68717A] text-xs whitespace-nowrap">
                      {fmt(lead.created_at)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <RowMenu
                          onConvert={() => setConvertLead(lead)}
                          onDelete={() => setDeleteLead(lead)}
                        />
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
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                  className="h-7 px-3 text-xs font-medium rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] hover:bg-[#F3F4F6] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Previous</button>
                <button disabled={page === data.pages} onClick={() => setPage(p => p + 1)}
                  className="h-7 px-3 text-xs font-medium rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] hover:bg-[#F3F4F6] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      <LeadModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        lead={editLead}
        defaultUserId={defaultUserId}
      />
      <LeadDeleteDialog
        open={!!deleteLead}
        lead={deleteLead}
        onClose={() => setDeleteLead(null)}
        onConfirm={() => { if (deleteLead) handleDelete(deleteLead.id); setDeleteLead(null); }}
      />
      <ContactModal
        open={!!convertLead}
        onClose={() => setConvertLead(null)}
        convertLeadId={convertLead?.id}
        prefillValues={convertLead ? {
          field_values: convertLead.field_values ?? undefined,
          source_id:    convertLead.source_id ?? undefined,
        } : undefined}
        defaultUserId={defaultUserId}
        onSave={async (formData) => {
          const res = await fetch("/api/contacts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          });
          if (!res.ok) throw new Error((await res.json()).error || "Failed to create contact");
          await fetch(`/api/leads/${convertLead!.id}`, { method: "DELETE" });
          setConvertLead(null);
          fetchLeads();
        }}
      />
    </div>
  );
}
