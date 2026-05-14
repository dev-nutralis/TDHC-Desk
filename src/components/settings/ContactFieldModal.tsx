"use client";

import { useEffect, useState, useRef } from "react";
import { X, Plus, Trash2, Loader2, ChevronDown, ChevronRight } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ContactFieldOption {
  id?: string;
  label: string;
  value: string;
  sort_order: number;
  _deleted?: boolean;
  _dirty?: boolean;
}

interface ContactField {
  id: string;
  label: string;
  field_key: string;
  field_type: string;
  sort_order: number;
  is_required: boolean;
  is_active: boolean;
  is_filterable: boolean;
  config: string | null;
  options: ContactFieldOption[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  field?: ContactField | null;
  apiBase?: string;
  viewOnly?: boolean;
  sourceModuleLabel?: string;
  moduleLabel?: string;
}

// ── Source Flow types ─────────────────────────────────────────────────────────
interface SFItem   { id: string; label: string; value: string; }
interface SFGroup  { id: string; name: string; items: SFItem[]; }
interface SFSource { id: string; label: string; value: string; groups: SFGroup[]; }

const uid = () => Math.random().toString(36).slice(2, 9);

// ── Field types ───────────────────────────────────────────────────────────────
const FIELD_TYPES = [
  { value: "text",               label: "Text" },
  { value: "multi_phone",        label: "Multiple Phone Numbers" },
  { value: "multi_email",        label: "Multiple Emails" },
  { value: "date",               label: "Date" },
  { value: "datetime",           label: "Date & Time" },
  { value: "boolean",            label: "Yes / No" },
  { value: "radio",              label: "Radio" },
  { value: "select",             label: "Dropdown (single choice)" },
  { value: "conditional_select", label: "Conditional Dropdown" },
  { value: "serial_id",          label: "ID Number (9-digit auto)" },
];

const OPTION_TYPES = new Set(["radio", "select", "conditional_select"]);

// ── Helpers ───────────────────────────────────────────────────────────────────
function slugify(str: string) {
  return str
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

const inputCls =
  "h-9 px-3 text-sm rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] outline-none focus:border-[#038153] focus:ring-2 focus:ring-[#038153]/15 transition-all placeholder:text-[#C2C8CC]";

const labelCls = "text-xs font-semibold text-[#2F3941] uppercase tracking-wide";

function emptyForm() {
  return {
    label: "",
    field_key: "",
    field_type: "text",
    is_required: false,
    is_filterable: true,
    config_is_conditional: false,
    config_depends_on: "",
    config_show_when: "",
    config_use_as_created_at: false,
    config_radio_multiple: false,
    config_has_notes: false,
  };
}

// ── Source Flow Editor ────────────────────────────────────────────────────────
function SourceFlowEditor({
  sources,
  onChange,
}: {
  sources: SFSource[];
  onChange: (s: SFSource[]) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const addSource = () => {
    const s: SFSource = { id: uid(), label: "", value: "", groups: [] };
    onChange([...sources, s]);
    setExpanded(prev => new Set([...prev, s.id]));
  };

  const updSrc = (si: number, patch: Partial<SFSource>) =>
    onChange(sources.map((s, i) => (i === si ? { ...s, ...patch } : s)));

  const rmSrc = (si: number) => onChange(sources.filter((_, i) => i !== si));

  const addGroup = (si: number) => {
    const g: SFGroup = { id: uid(), name: "", items: [] };
    updSrc(si, { groups: [...sources[si].groups, g] });
  };

  const updGrp = (si: number, gi: number, patch: Partial<SFGroup>) =>
    updSrc(si, {
      groups: sources[si].groups.map((g, i) => (i === gi ? { ...g, ...patch } : g)),
    });

  const rmGrp = (si: number, gi: number) =>
    updSrc(si, { groups: sources[si].groups.filter((_, i) => i !== gi) });

  const addItem = (si: number, gi: number) => {
    const it: SFItem = { id: uid(), label: "", value: "" };
    updGrp(si, gi, { items: [...sources[si].groups[gi].items, it] });
  };

  const updItem = (si: number, gi: number, ii: number, patch: Partial<SFItem>) =>
    updGrp(si, gi, {
      items: sources[si].groups[gi].items.map((it, i) =>
        i === ii ? { ...it, ...patch } : it
      ),
    });

  const rmItem = (si: number, gi: number, ii: number) =>
    updGrp(si, gi, {
      items: sources[si].groups[gi].items.filter((_, i) => i !== ii),
    });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className={labelCls}>Sources</label>
        <button
          type="button"
          onClick={addSource}
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-xs font-medium border border-[#D8DCDE] text-[#2F3941] hover:bg-[#F3F4F6] transition-colors"
        >
          <Plus size={12} /> Add Source
        </button>
      </div>

      {sources.length === 0 && (
        <p className="text-xs text-[#C2C8CC] text-center py-3 rounded-lg border border-dashed border-[#D8DCDE]">
          No sources yet — add one above
        </p>
      )}

      <div className="space-y-2">
        {sources.map((src, si) => (
          <div key={src.id} className="rounded-lg border border-[#D8DCDE] overflow-hidden">

            {/* Source row */}
            <div className="flex items-center gap-2 px-3 py-2 bg-[#F8F9F9]">
              <button
                type="button"
                onClick={() => toggle(src.id)}
                className="shrink-0 text-[#68717A] hover:text-[#2F3941] transition-colors"
              >
                {expanded.has(src.id)
                  ? <ChevronDown size={13} />
                  : <ChevronRight size={13} />}
              </button>
              <input
                value={src.label}
                onChange={e =>
                  updSrc(si, { label: e.target.value, value: slugify(e.target.value) })
                }
                placeholder="Source name (e.g. Website)"
                className="flex-1 h-7 px-2 text-sm rounded border border-transparent bg-transparent focus:bg-white focus:border-[#D8DCDE] outline-none text-[#2F3941] placeholder:text-[#C2C8CC]"
              />
              <span className="text-[10px] font-mono text-[#68717A] shrink-0 px-1.5 py-0.5 rounded bg-[#EAECEE]">
                {src.value || "—"}
              </span>
              <button
                type="button"
                onClick={() => rmSrc(si)}
                className="w-6 h-6 rounded flex items-center justify-center text-[#68717A] hover:bg-[#FFF0F1] hover:text-[#CC3340] transition-colors shrink-0"
              >
                <Trash2 size={12} />
              </button>
            </div>

            {/* Groups panel */}
            {expanded.has(src.id) && (
              <div className="px-3 py-3 space-y-3 border-t border-[#D8DCDE] bg-white">
                {src.groups.length === 0 && (
                  <p className="text-[11px] text-[#C2C8CC] italic">No groups — click below to add one</p>
                )}

                {src.groups.map((grp, gi) => (
                  <div key={grp.id} className="rounded-md border border-[#D8DCDE] overflow-hidden">

                    {/* Group header */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-[#F8F9F9]">
                      <input
                        value={grp.name}
                        onChange={e => updGrp(si, gi, { name: e.target.value })}
                        placeholder="Group name (e.g. Campaign)"
                        className="flex-1 h-7 px-2 text-sm rounded border border-transparent bg-transparent focus:bg-white focus:border-[#D8DCDE] outline-none text-[#2F3941] placeholder:text-[#C2C8CC]"
                      />
                      <button
                        type="button"
                        onClick={() => rmGrp(si, gi)}
                        className="w-6 h-6 rounded flex items-center justify-center text-[#68717A] hover:bg-[#FFF0F1] hover:text-[#CC3340] transition-colors shrink-0"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    {/* Items */}
                    <div className="px-3 pt-2 pb-3 space-y-1.5 bg-white border-t border-[#D8DCDE]">
                      {grp.items.map((it, ii) => (
                        <div key={it.id} className="flex items-center gap-2">
                          <input
                            value={it.label}
                            onChange={e =>
                              updItem(si, gi, ii, {
                                label: e.target.value,
                                value: slugify(e.target.value),
                              })
                            }
                            placeholder="Item label (e.g. Google Ads)"
                            className={`${inputCls} flex-1`}
                          />
                          <span className="text-[10px] font-mono text-[#68717A] shrink-0 px-1.5 py-0.5 rounded bg-[#EAECEE] w-24 truncate">
                            {it.value || "—"}
                          </span>
                          <button
                            type="button"
                            onClick={() => rmItem(si, gi, ii)}
                            className="w-7 h-7 rounded flex items-center justify-center text-[#68717A] hover:bg-[#FFF0F1] hover:text-[#CC3340] transition-colors shrink-0"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addItem(si, gi)}
                        className="flex items-center gap-1 text-xs font-medium text-[#038153] hover:underline mt-0.5"
                      >
                        <Plus size={11} /> Add Item
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => addGroup(si)}
                  className="flex items-center gap-1 text-xs font-medium text-[#1D6FA4] hover:underline"
                >
                  <Plus size={11} /> Add Group
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ContactFieldModal({
  open,
  onClose,
  onSaved,
  field,
  viewOnly = false,
  apiBase = "/api/contact-fields",
  sourceModuleLabel = "Leads",
  moduleLabel = "contact",
}: Props) {
  const [form, setForm] = useState(emptyForm());
  const [keyAutoSync, setKeyAutoSync] = useState(true);
  const [options, setOptions] = useState<ContactFieldOption[]>([]);
  const [deletedOptionIds, setDeletedOptionIds] = useState<string[]>([]);
  const [allFields, setAllFields] = useState<ContactField[]>([]);
  const [sfSources, setSfSources] = useState<SFSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const labelRef = useRef<HTMLInputElement>(null);

  const isEditing = !!field;

  useEffect(() => {
    if (!open) return;
    fetch(apiBase)
      .then(r => r.ok ? r.json() : [])
      .then((data: ContactField[]) => {
        setAllFields(Array.isArray(data) ? data.filter(f => f.field_key !== field?.field_key) : []);
      })
      .catch(() => setAllFields([]));
  }, [open, field?.field_key]);

  useEffect(() => {
    if (!open) return;
    setError("");
    setDeletedOptionIds([]);
    if (field) {
      let cfgDepends = "";
      let cfgShow = "";
      let cfgUseAsCreatedAt = false;
      let cfgRadioMultiple = false;
      let cfgHasNotes = false;
      let cfgSfSources: SFSource[] = [];
      if (field.config) {
        try {
          const parsed = JSON.parse(field.config);
          cfgDepends         = parsed.depends_on        ?? "";
          cfgShow            = parsed.show_when         ?? "";
          cfgUseAsCreatedAt  = parsed.use_as_created_at ?? false;
          cfgRadioMultiple   = parsed.multiple          ?? false;
          cfgHasNotes        = parsed.has_notes         ?? false;
          cfgSfSources       = parsed.sources           ?? [];
        } catch { /* ignore */ }
      }
      setForm({
        label: field.label,
        field_key: field.field_key,
        field_type: field.field_type,
        is_required: field.is_required,
        is_filterable: field.is_filterable ?? true,
        config_is_conditional: !!cfgDepends,
        config_depends_on: cfgDepends,
        config_show_when: cfgShow,
        config_use_as_created_at: cfgUseAsCreatedAt,
        config_radio_multiple: cfgRadioMultiple,
        config_has_notes: cfgHasNotes,
      });
      setOptions(field.options.map(o => ({ ...o })));
      setSfSources(cfgSfSources);
      setKeyAutoSync(false);
    } else {
      setForm(emptyForm());
      setOptions([]);
      setSfSources([]);
      setKeyAutoSync(true);
    }
    setTimeout(() => labelRef.current?.focus(), 50);
  }, [open, field]);

  const handleLabelChange = (val: string) => {
    setForm(prev => ({
      ...prev,
      label: val,
      field_key: keyAutoSync ? slugify(val) : prev.field_key,
    }));
  };

  const handleKeyChange = (val: string) => {
    setKeyAutoSync(false);
    setForm(prev => ({ ...prev, field_key: val }));
  };

  // ── Options management ──────────────────────────────────────────────────────
  const addOption = () => {
    setOptions(prev => [...prev, { label: "", value: "", sort_order: prev.length, _dirty: true }]);
  };

  const updateOptionLabel = (idx: number, label: string) => {
    setOptions(prev => prev.map((o, i) => {
      if (i !== idx) return o;
      const value = o.id ? o.value : slugify(label);
      return { ...o, label, value, _dirty: true };
    }));
  };

  const updateOptionValue = (idx: number, value: string) => {
    setOptions(prev => prev.map((o, i) =>
      i === idx ? { ...o, value, _dirty: true } : o
    ));
  };

  const removeOption = (idx: number) => {
    const opt = options[idx];
    if (opt.id) setDeletedOptionIds(prev => [...prev, opt.id!]);
    setOptions(prev => prev.filter((_, i) => i !== idx));
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!form.label.trim()) { setError("Label is required."); return; }
    if (!form.field_key.trim()) { setError("Field key is required."); return; }

    if (OPTION_TYPES.has(form.field_type)) {
      for (const opt of options) {
        if (!opt.label.trim() || !opt.value.trim()) {
          setError("All options must have a label and value.");
          return;
        }
      }
    }

    if (form.field_type === "source_flow") {
      for (const src of sfSources) {
        if (!src.label.trim()) { setError("All sources must have a name."); return; }
        for (const grp of src.groups) {
          if (!grp.name.trim()) { setError("All groups must have a name."); return; }
          for (const it of grp.items) {
            if (!it.label.trim()) { setError("All items must have a label."); return; }
          }
        }
      }
    }

    setLoading(true);
    try {
      const configObj: Record<string, unknown> = {};
      if (form.field_type === "radio") {
        configObj.multiple = form.config_radio_multiple;
      }
      if ((form.field_type === "date" || form.field_type === "datetime") && form.config_use_as_created_at) {
        configObj.use_as_created_at = true;
      }
      if (form.config_is_conditional && form.config_depends_on.trim()) {
        configObj.depends_on = form.config_depends_on.trim();
        configObj.show_when  = form.config_show_when.trim();
      }
      if (form.config_has_notes) {
        configObj.has_notes = true;
      }
      if (form.field_type === "source_flow") {
        configObj.sources = sfSources;
      }
      const config = Object.keys(configObj).length > 0 ? JSON.stringify(configObj) : null;

      const body: Record<string, unknown> = {
        label:         form.label.trim(),
        field_key:     form.field_key.trim(),
        field_type:    form.field_type,
        is_required:   form.is_required,
        is_filterable: form.is_filterable,
        config,
      };

      let savedId: string;

      if (isEditing && field) {
        const res = await fetch(`${apiBase}/${field.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Failed to update field");
        savedId = field.id;
      } else {
        const res = await fetch(apiBase, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Failed to create field");
        const created = await res.json();
        savedId = created.id;
      }

      // Sync flat options (radio/select/conditional_select)
      const optionOps: Promise<Response>[] = [];
      for (const optId of deletedOptionIds) {
        optionOps.push(fetch(`${apiBase}/options/${optId}`, { method: "DELETE" }));
      }
      if (OPTION_TYPES.has(form.field_type)) {
        options.forEach((opt, idx) => {
          if (!opt.id) {
            optionOps.push(
              fetch(`${apiBase}/${savedId}/options`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ label: opt.label.trim(), value: opt.value.trim(), sort_order: idx }),
              })
            );
          } else if (opt._dirty) {
            optionOps.push(
              fetch(`${apiBase}/options/${opt.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ label: opt.label.trim(), value: opt.value.trim(), sort_order: idx }),
              })
            );
          }
        });
      }
      await Promise.all(optionOps);

      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const showOptions = OPTION_TYPES.has(form.field_type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

      <div
        className="relative z-10 w-full max-w-lg bg-white rounded-xl flex flex-col overflow-hidden"
        style={{ maxHeight: "90vh", boxShadow: "0 25px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D8DCDE] shrink-0">
          <div>
            <h2 className="text-[15px] font-semibold text-[#2F3941]">
              {viewOnly ? "View Field" : isEditing ? "Edit Field" : `New ${moduleLabel.charAt(0).toUpperCase() + moduleLabel.slice(1)} Field`}
            </h2>
            <p className="text-xs text-[#68717A] mt-0.5">
              {viewOnly
                ? `Read-only — edit this field from the source module (${sourceModuleLabel})`
                : isEditing
                ? "Update the field configuration"
                : `Define a new field for ${moduleLabel} records`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md flex items-center justify-center text-[#68717A] hover:bg-[#F3F4F6]"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className={`overflow-y-auto flex-1 px-6 py-5 space-y-4 ${viewOnly ? "pointer-events-none select-none opacity-70" : ""}`}>

            {/* Label */}
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Label <span className="text-[#CC3340]">*</span></label>
              <input
                ref={labelRef}
                value={form.label}
                onChange={e => handleLabelChange(e.target.value)}
                placeholder="e.g. Phone Number, Date of Birth..."
                required
                className={`${inputCls} w-full`}
              />
            </div>

            {/* Field Key */}
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Field Key <span className="text-[#CC3340]">*</span></label>
              <input
                value={form.field_key}
                onChange={e => handleKeyChange(e.target.value)}
                placeholder="e.g. phone_number"
                required
                disabled={isEditing}
                className={`${inputCls} w-full font-mono ${isEditing ? "opacity-60 cursor-not-allowed bg-[#F8F9F9]" : ""}`}
              />
              <p className="text-[11px] text-[#68717A]">
                Used internally to store data.{" "}
                {isEditing
                  ? "Cannot be changed after creation."
                  : "Auto-generated from label — you can edit it."}
              </p>
            </div>

            {/* Field Type */}
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Field Type</label>
              <select
                value={form.field_type}
                onChange={e => setForm(prev => ({ ...prev, field_type: e.target.value }))}
                className={`${inputCls} w-full`}
              >
                {FIELD_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Source Flow editor */}
            {form.field_type === "source_flow" && (
              <div className="rounded-lg border border-[#D8DCDE] bg-[#F8F9F9] p-4 space-y-3">
                <div>
                  <p className="text-sm font-medium text-[#2F3941]">Configure Source Flow</p>
                  <p className="text-[11px] text-[#68717A] mt-0.5">
                    Define top-level sources, each with optional attribute groups and items — mirrors the Lead Sources flow.
                  </p>
                </div>
                <SourceFlowEditor sources={sfSources} onChange={setSfSources} />
              </div>
            )}

            {/* Radio: single / multiple */}
            {form.field_type === "radio" && (
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Choice mode</label>
                <div className="inline-flex rounded-md border border-[#D8DCDE] overflow-hidden w-fit">
                  {[
                    { value: false, label: "Single choice" },
                    { value: true,  label: "Multiple choice" },
                  ].map(({ value, label }) => {
                    const active = form.config_radio_multiple === value;
                    return (
                      <button
                        key={String(value)}
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, config_radio_multiple: value }))}
                        className="h-8 px-4 text-sm font-medium transition-colors"
                        style={{ background: active ? "#038153" : "#fff", color: active ? "#fff" : "#2F3941" }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Required */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[#2F3941]">Required</p>
                <p className="text-xs text-[#68717A] mt-0.5">This field must be filled when saving a {moduleLabel}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.is_required}
                onClick={() => setForm(prev => ({ ...prev, is_required: !prev.is_required }))}
                className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
                style={{ background: form.is_required ? "#038153" : "#D8DCDE" }}
              >
                <span
                  className="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200"
                  style={{ transform: form.is_required ? "translateX(16px)" : "translateX(0)" }}
                />
              </button>
            </div>

            {/* Additional notes */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[#2F3941]">Additional notes</p>
                <p className="text-xs text-[#68717A] mt-0.5">Adds a notes text area below this field when filling in a contact</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.config_has_notes}
                onClick={() => setForm(prev => ({ ...prev, config_has_notes: !prev.config_has_notes }))}
                className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
                style={{ background: form.config_has_notes ? "#038153" : "#D8DCDE" }}
              >
                <span
                  className="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200"
                  style={{ transform: form.config_has_notes ? "translateX(16px)" : "translateX(0)" }}
                />
              </button>
            </div>

            {/* Use in filter */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[#2F3941]">Use in filter</p>
                <p className="text-xs text-[#68717A] mt-0.5">Show this field as an option when filtering {moduleLabel}s</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.is_filterable}
                onClick={() => setForm(prev => ({ ...prev, is_filterable: !prev.is_filterable }))}
                className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
                style={{ background: form.is_filterable ? "#038153" : "#D8DCDE" }}
              >
                <span
                  className="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200"
                  style={{ transform: form.is_filterable ? "translateX(16px)" : "translateX(0)" }}
                />
              </button>
            </div>

            {/* Use as created_at */}
            {(form.field_type === "date" || form.field_type === "datetime") && (
              <div className="flex items-center justify-between gap-3 p-4 rounded-lg border border-[#D8DCDE] bg-[#F8F9F9]">
                <div>
                  <p className="text-sm font-medium text-[#2F3941]">Use as record creation date</p>
                  <p className="text-xs text-[#68717A] mt-0.5">
                    If filled, overrides the automatic creation timestamp. If left empty, defaults to now.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.config_use_as_created_at}
                  onClick={() => setForm(prev => ({ ...prev, config_use_as_created_at: !prev.config_use_as_created_at }))}
                  className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
                  style={{ background: form.config_use_as_created_at ? "#038153" : "#D8DCDE" }}
                >
                  <span
                    className="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200"
                    style={{ transform: form.config_use_as_created_at ? "translateX(16px)" : "translateX(0)" }}
                  />
                </button>
              </div>
            )}

            {/* Show conditionally */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[#2F3941]">Show conditionally</p>
                <p className="text-xs text-[#68717A] mt-0.5">Only show this field when another field has a specific value</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.config_is_conditional}
                onClick={() => setForm(prev => ({ ...prev, config_is_conditional: !prev.config_is_conditional }))}
                className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
                style={{ background: form.config_is_conditional ? "#038153" : "#D8DCDE" }}
              >
                <span
                  className="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200"
                  style={{ transform: form.config_is_conditional ? "translateX(16px)" : "translateX(0)" }}
                />
              </button>
            </div>

            {form.config_is_conditional && (() => {
              const dependsOnField = allFields.find(f => f.field_key === form.config_depends_on) ?? null;
              const showWhenControl = (() => {
                if (!dependsOnField) {
                  return <p className="text-xs text-[#C2C8CC] italic">Select a field above to see options</p>;
                }
                if (dependsOnField.field_type === "boolean") {
                  return (
                    <select
                      value={form.config_show_when}
                      onChange={e => setForm(prev => ({ ...prev, config_show_when: e.target.value }))}
                      className={`${inputCls} w-full`}
                    >
                      <option value="">— Select —</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  );
                }
                if (["radio", "select", "conditional_select"].includes(dependsOnField.field_type)) {
                  return (
                    <select
                      value={form.config_show_when}
                      onChange={e => setForm(prev => ({ ...prev, config_show_when: e.target.value }))}
                      className={`${inputCls} w-full`}
                    >
                      <option value="">— Select option —</option>
                      {dependsOnField.options.map(o => (
                        <option key={o.id ?? o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  );
                }
                return (
                  <select
                    value={form.config_show_when}
                    onChange={e => setForm(prev => ({ ...prev, config_show_when: e.target.value }))}
                    className={`${inputCls} w-full`}
                  >
                    <option value="">— Select —</option>
                    <option value="__filled__">Is filled</option>
                  </select>
                );
              })();

              return (
                <div className="space-y-3 p-4 rounded-lg border border-[#D8DCDE] bg-[#F8F9F9]">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-[#68717A] font-medium">Show when field</label>
                    <select
                      value={form.config_depends_on}
                      onChange={e => setForm(prev => ({
                        ...prev,
                        config_depends_on: e.target.value,
                        config_show_when: "",
                      }))}
                      className={`${inputCls} w-full`}
                    >
                      <option value="">— Select field —</option>
                      {allFields.map(f => (
                        <option key={f.id} value={f.field_key}>{f.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-[#68717A] font-medium">equals</label>
                    {showWhenControl}
                  </div>
                </div>
              );
            })()}

            {/* Flat options (radio / select / conditional_select) */}
            {showOptions && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className={labelCls}>Options</label>
                  <button
                    type="button"
                    onClick={addOption}
                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-xs font-medium border border-[#D8DCDE] text-[#2F3941] hover:bg-[#F3F4F6] transition-colors"
                  >
                    <Plus size={12} /> Add Option
                  </button>
                </div>

                {options.length === 0 && (
                  <p className="text-xs text-[#C2C8CC] text-center py-3 rounded-lg border border-dashed border-[#D8DCDE]">
                    No options yet — add one above
                  </p>
                )}

                <div className="space-y-2">
                  {options.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="flex-1 flex gap-2">
                        <input
                          value={opt.label}
                          onChange={e => updateOptionLabel(idx, e.target.value)}
                          placeholder="Label"
                          className={`${inputCls} flex-1`}
                        />
                        <input
                          value={opt.value}
                          onChange={e => updateOptionValue(idx, e.target.value)}
                          placeholder="value"
                          className={`${inputCls} w-32 font-mono text-xs`}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeOption(idx)}
                        className="w-8 h-8 rounded-md flex items-center justify-center text-[#68717A] hover:bg-[#FFF0F1] hover:text-[#CC3340] transition-colors shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-md bg-[#FFF0F1] border border-[#FECDD3]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#CC3340] shrink-0" />
                <p className="text-xs text-[#CC3340]">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#D8DCDE] bg-[#F8F9F9] shrink-0">
            {viewOnly ? (
              <button
                type="button"
                onClick={onClose}
                className="h-8 px-4 text-sm font-medium rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] hover:bg-[#F3F4F6] transition-colors"
              >
                Close
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="h-8 px-4 text-sm font-medium rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] hover:bg-[#F3F4F6] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="h-8 px-4 text-sm font-medium rounded-md text-white flex items-center gap-1.5 hover:brightness-110 disabled:opacity-60 transition-all"
                  style={{ background: "#038153" }}
                >
                  {loading && <Loader2 size={13} className="animate-spin" />}
                  {isEditing ? "Save Changes" : "Create Field"}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
