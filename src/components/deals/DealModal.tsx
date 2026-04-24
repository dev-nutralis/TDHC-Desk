"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Search, Loader2, UserCircle2, Link2 } from "lucide-react";

type FieldValues = Record<string, unknown>;

interface DealFieldOption { id: string; label: string; value: string; }
interface DealField {
  id: string; label: string; field_key: string; field_type: string;
  is_active: boolean; is_required: boolean; config: string | null; options: DealFieldOption[];
  source_module: string | null; source_field_id: string | null;
}

interface ContactResult {
  id: string;
  field_values: FieldValues | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: { contact_id: string; field_values: FieldValues; user_id: string }) => Promise<void>;
  defaultUserId: string;
  prefillContactId?: string;
}

function contactName(fv: FieldValues | null): string {
  const first = (fv?.first_name as string) ?? "";
  const last  = (fv?.last_name  as string) ?? "";
  return [first, last].filter(Boolean).join(" ") || "—";
}

// ── Contact picker ────────────────────────────────────────────────────────────

function ContactPicker({ value, onChange }: { value: ContactResult | null; onChange: (c: ContactResult) => void }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ContactResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/contacts?search=${encodeURIComponent(search)}&page=1`);
        const data = await res.json();
        setResults(data.contacts ?? []);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div ref={wrapRef} className="relative">
      {value ? (
        <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-[#D8DCDE] bg-white">
          <UserCircle2 size={14} className="text-[#68717A] shrink-0" />
          <span className="text-sm text-[#2F3941] flex-1 truncate">{contactName(value.field_values)}</span>
          <button onClick={() => { onChange({ id: "", field_values: null }); setSearch(""); setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
            className="text-[#68717A] hover:text-[#CC3340]"><X size={13} /></button>
        </div>
      ) : (
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#68717A]" />
          <input
            ref={inputRef}
            autoFocus
            className="w-full h-9 pl-9 pr-3 text-sm rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] outline-none focus:border-[#038153] focus:ring-2 focus:ring-[#038153]/15 placeholder:text-[#C2C8CC]"
            placeholder="Search contacts..."
            value={search}
            onChange={e => { setSearch(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
          />
          {loading && <Loader2 size={12} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[#68717A]" />}
        </div>
      )}

      {open && !value?.id && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg border border-[#D8DCDE] shadow-lg z-10 max-h-48 overflow-y-auto">
          {results.map(c => (
            <button key={c.id} onClick={() => { onChange(c); setOpen(false); setSearch(""); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-[#F8F9F9] transition-colors">
              <UserCircle2 size={14} className="text-[#68717A] shrink-0" />
              <span className="text-[#2F3941]">{contactName(c.field_values)}</span>
            </button>
          ))}
        </div>
      )}
      {open && !value?.id && search.length > 1 && !loading && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg border border-[#D8DCDE] shadow-lg z-10 px-3 py-3 text-xs text-[#68717A]">
          No contacts found for "{search}"
        </div>
      )}
    </div>
  );
}

// ── Field input renderers ─────────────────────────────────────────────────────

function FieldInput({ field, value, onChange }: { field: DealField; value: unknown; onChange: (v: unknown) => void }) {
  const cls = "w-full h-9 px-3 text-sm rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] outline-none focus:border-[#038153] focus:ring-2 focus:ring-[#038153]/15 placeholder:text-[#C2C8CC]";

  switch (field.field_type) {
    case "text":
      return <input className={cls} value={(value as string) ?? ""} onChange={e => onChange(e.target.value)} />;

    case "textarea":
      return <textarea className={`${cls} h-auto py-2 resize-none`} rows={3} value={(value as string) ?? ""} onChange={e => onChange(e.target.value)} />;

    case "date":
      return <input type="date" className={cls} value={(value as string) ?? ""} onChange={e => onChange(e.target.value)} />;

    case "datetime":
      return (
        <input type="datetime-local" className={cls}
          value={value ? (new Date(value as string).toISOString().slice(0, 16)) : ""}
          onChange={e => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)} />
      );

    case "boolean":
      return (
        <div className="flex items-center gap-3 h-9">
          {(["true", "false"] as const).map(v => (
            <label key={v} className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" name={field.field_key} value={v}
                checked={String(value) === v}
                onChange={() => onChange(v === "true")}
                className="accent-[#038153]" />
              <span className="text-sm text-[#2F3941]">{v === "true" ? "Yes" : "No"}</span>
            </label>
          ))}
        </div>
      );

    case "source_flow": {
      let sources: { id: string; label: string; value: string; groups: { id: string; name: string; items: { id: string; label: string; value: string }[] }[] }[] = [];
      try { sources = JSON.parse(field.config ?? "{}").sources ?? []; } catch { /**/ }
      const sfVal = (value && typeof value === "object" && "source" in (value as object))
        ? value as { source: string; groups: Record<string, string> }
        : { source: "", groups: {} };
      const selectedSource = sources.find(s => s.value === sfVal.source) ?? null;
      const selectCls = `${cls}`;
      return (
        <div className="space-y-2">
          <select value={sfVal.source} onChange={e => onChange({ source: e.target.value, groups: {} })} className={selectCls}>
            <option value="">— Select source —</option>
            {sources.map(s => <option key={s.id} value={s.value}>{s.label}</option>)}
          </select>
          {selectedSource?.groups.filter(g => g.items.length > 0).map(grp => (
            <div key={grp.id} className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[#68717A]">{grp.name}</span>
              <select value={sfVal.groups[grp.id] ?? ""} onChange={e => onChange({ ...sfVal, groups: { ...sfVal.groups, [grp.id]: e.target.value } })} className={selectCls}>
                <option value="">— Select {grp.name} —</option>
                {grp.items.map(it => <option key={it.id} value={it.value}>{it.label}</option>)}
              </select>
            </div>
          ))}
        </div>
      );
    }

    case "radio":
      return (
        <div className="flex flex-wrap gap-3">
          {field.options.map(opt => (
            <label key={opt.id} className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" name={field.field_key} value={opt.value}
                checked={value === opt.value}
                onChange={() => onChange(opt.value)}
                className="accent-[#038153]" />
              <span className="text-sm text-[#2F3941]">{opt.label}</span>
            </label>
          ))}
        </div>
      );

    case "select":
      return (
        <select className={cls} value={(value as string) ?? ""} onChange={e => onChange(e.target.value || null)}>
          <option value="">— Select —</option>
          {field.options.map(opt => <option key={opt.id} value={opt.value}>{opt.label}</option>)}
        </select>
      );

    default:
      return <input className={cls} value={(value as string) ?? ""} onChange={e => onChange(e.target.value)} />;
  }
}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function DealModal({ open, onClose, onSave, defaultUserId, prefillContactId }: Props) {
  const [dealFields, setDealFields] = useState<DealField[]>([]);
  const [contact, setContact]       = useState<ContactResult | null>(null);
  const [fieldValues, setFieldValues] = useState<FieldValues>({});
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState("");

  // Load deal fields once
  useEffect(() => {
    fetch("/api/deal-fields?active=true")
      .then(r => r.json())
      .then((f: DealField[]) => setDealFields(Array.isArray(f) ? f : []))
      .catch(() => {});
  }, []);

  // Pull matching field values from a contact into deal form
  const autoFillFromContact = useCallback((contactFv: FieldValues | null, currentFields: DealField[]) => {
    if (!contactFv) return;
    const patch: FieldValues = {};
    for (const f of currentFields) {
      if (contactFv[f.field_key] !== undefined) patch[f.field_key] = contactFv[f.field_key];
    }
    if (Object.keys(patch).length > 0) setFieldValues(prev => ({ ...prev, ...patch }));
  }, []);

  // Pre-fill contact if given
  useEffect(() => {
    if (!open) return;
    setFieldValues({});
    setError("");
    if (prefillContactId) {
      fetch(`/api/contacts/${prefillContactId}`)
        .then(r => r.json())
        .then((c: ContactResult) => {
          setContact(c);
          autoFillFromContact(c.field_values, dealFields);
        })
        .catch(() => {});
    } else {
      setContact(null);
    }
  }, [open, prefillContactId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleContactChange = useCallback((c: ContactResult) => {
    setContact(c.id ? c : null);
    if (c.id) autoFillFromContact(c.field_values, dealFields);
  }, [dealFields, autoFillFromContact]);

  const setField = (key: string, val: unknown) => setFieldValues(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    if (!contact?.id) { setError("Please select a contact"); return; }
    setSaving(true);
    setError("");
    try {
      await onSave({ contact_id: contact.id, field_values: fieldValues, user_id: defaultUserId });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (!open || typeof window === "undefined") return null;

  const modalContent = (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-white rounded-xl overflow-hidden flex flex-col" style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.18)", maxHeight: "90vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#D8DCDE] shrink-0">
          <h2 className="text-[14px] font-semibold text-[#2F3941]">New Deal</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-md flex items-center justify-center text-[#68717A] hover:bg-[#F3F4F6]"><X size={15} /></button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* Primary Contact */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#2F3941] uppercase tracking-wide">
              Primary Contact <span className="text-[#CC3340]">*</span>
            </label>
            <ContactPicker value={contact} onChange={handleContactChange} />
          </div>

          {/* Dynamic deal fields */}
          {dealFields.map(field => (
            <div key={field.id} className="space-y-1">
              <label className="text-xs font-semibold text-[#2F3941] uppercase tracking-wide flex items-center gap-1.5">
                {field.label}{field.is_required && <span className="text-[#CC3340]">*</span>}
                {field.source_module && <Link2 size={10} className="text-[#038153]" />}
              </label>
              <FieldInput field={field} value={fieldValues[field.field_key]} onChange={v => setField(field.field_key, v)} />
            </div>
          ))}

          {error && <p className="text-xs text-[#CC3340]">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#D8DCDE] bg-[#F8F9F9] shrink-0">
          <button onClick={onClose} className="h-8 px-4 text-sm font-medium rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] hover:bg-[#F3F4F6]">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="h-8 px-4 text-sm font-medium rounded-md text-white hover:brightness-110 disabled:opacity-50 flex items-center gap-1.5" style={{ background: "#038153" }}>
            {saving && <Loader2 size={13} className="animate-spin" />}
            Create Deal
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
