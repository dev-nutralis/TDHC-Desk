"use client";

import { useEffect, useState, useRef } from "react";
import { X, Loader2, ChevronDown, Plus, Trash2, Star } from "lucide-react";

// ── Source Flow types ─────────────────────────────────────────────────────────
interface SFItem   { id: string; label: string; value: string; }
interface SFGroup  { id: string; name: string; items: SFItem[]; }
interface SFSource { id: string; label: string; value: string; groups: SFGroup[]; }
interface SFValue  { source: string; groups: Record<string, string>; }

// ── Types ────────────────────────────────────────────────────────────────────

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
  field_type:
    | "text"
    | "multi_phone"
    | "multi_email"
    | "date"
    | "datetime"
    | "boolean"
    | "radio"
    | "select"
    | "conditional_select"
    | "source_select"
    | "source_flow";
  sort_order: number;
  is_required: boolean;
  is_active: boolean;
  config: string | null;
  options: ContactFieldOption[];
}

type FieldValues = Record<string, unknown>;

interface Source {
  id: string;
  name: string;
  attribute_groups: AttributeGroup[];
}
interface AttributeGroup {
  id: string;
  name: string;
  items: { id: string; label: string }[];
}

interface Contact {
  id: string;
  field_values: FieldValues | null;
  source_id: string | null;
  attribute_ids: string | null;
  source: Source | null;
  user_id: string;
  created_at: string;
  user: { id: string; name: string };
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    field_values: FieldValues;
    source_id: string | null;
    attribute_ids: string[] | null;
    user_id: string;
    created_at?: string;
  }) => Promise<void>;
  contact?: Contact | null;
  defaultUserId: string;
  convertLeadId?: string;
  prefillValues?: {
    field_values?: FieldValues;
    source_id?: string;
  };
}

interface PhoneEntry { number: string; note: string; }
interface EmailEntry { address: string; is_main: boolean; note: string; }

// ── Helpers ──────────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function parseAttribIds(raw: string | null): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

// ── Shared style constants ───────────────────────────────────────────────────

const inputCls =
  "h-9 px-3 text-sm rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] placeholder:text-[#C2C8CC] outline-none focus:border-[#038153] focus:ring-2 focus:ring-[#038153]/15 transition-all";

const labelCls = "text-xs font-semibold text-[#2F3941] uppercase tracking-wide";

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionDivider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <span className="text-[11px] font-semibold text-[#68717A] uppercase tracking-wider whitespace-nowrap">
        {title}
      </span>
      <div className="flex-1 border-t border-[#D8DCDE]" />
    </div>
  );
}

function RadioGroup({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className={labelCls}>{label}</label>
      <div className="flex flex-wrap gap-3">
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(selected ? "" : opt.value)}
              className="flex items-center gap-1.5 text-sm text-[#2F3941] select-none"
            >
              <span
                className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
                style={{
                  borderColor: selected ? "#038153" : "#D8DCDE",
                  background: selected ? "#038153" : "white",
                }}
              >
                {selected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
              </span>
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AttributeSelect({
  group,
  attributeIds,
  onSelect,
}: {
  group: AttributeGroup;
  attributeIds: string[];
  onSelect: (groupItemIds: string[], selectedId: string | null) => void;
}) {
  if (!group.items.length) return null;
  const groupItemIds = group.items.map((i) => i.id);
  const currentValue = attributeIds.find((id) => groupItemIds.includes(id)) ?? "";

  return (
    <div className="flex flex-col gap-1.5">
      <label className={labelCls}>{group.name}</label>
      <div className="relative">
        <select
          value={currentValue}
          onChange={(e) => onSelect(groupItemIds, e.target.value || null)}
          className={`w-full pl-3 pr-8 ${inputCls} appearance-none`}
        >
          <option value="">— Select {group.name} —</option>
          {group.items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={13}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#68717A] pointer-events-none"
        />
      </div>
    </div>
  );
}

// ── Multi-phone field ─────────────────────────────────────────────────────────

function MultiPhoneField({
  value,
  onChange,
}: {
  value: PhoneEntry[];
  onChange: (v: PhoneEntry[]) => void;
}) {
  const add = () => onChange([...value, { number: "", note: "" }]);
  const update = (idx: number, field: keyof PhoneEntry, val: string) =>
    onChange(value.map((m, i) => (i === idx ? { ...m, [field]: val } : m)));
  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      {value.map((mob, idx) => (
        <div key={idx} className="flex gap-2 items-start">
          <div className="flex flex-col gap-1 flex-1">
            <input
              value={mob.number}
              onChange={(e) => update(idx, "number", e.target.value)}
              placeholder="Number"
              className={`w-full ${inputCls}`}
            />
            <input
              value={mob.note}
              onChange={(e) => update(idx, "note", e.target.value)}
              placeholder="Note (optional)"
              className={`w-full ${inputCls}`}
            />
          </div>
          <button
            type="button"
            onClick={() => remove(idx)}
            className="mt-1 w-7 h-7 flex items-center justify-center rounded-md text-[#CC3340] hover:bg-[#FFF0F1] transition-colors shrink-0"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1 text-xs font-medium transition-colors"
        style={{ color: "#038153" }}
      >
        <Plus size={13} />
        Add Phone
      </button>
    </div>
  );
}

// ── Multi-email field ─────────────────────────────────────────────────────────

function MultiEmailField({
  value,
  onChange,
}: {
  value: EmailEntry[];
  onChange: (v: EmailEntry[]) => void;
}) {
  const add = () => {
    const isFirst = value.length === 0;
    onChange([...value, { address: "", is_main: isFirst, note: "" }]);
  };

  const update = (idx: number, field: keyof EmailEntry, val: string | boolean) =>
    onChange(value.map((e, i) => (i === idx ? { ...e, [field]: val } : e)));

  const setMain = (idx: number) =>
    onChange(value.map((e, i) => ({ ...e, is_main: i === idx })));

  const remove = (idx: number) => {
    const next = value.filter((_, i) => i !== idx);
    if (value[idx].is_main && next.length > 0) {
      next[0] = { ...next[0], is_main: true };
    }
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {value.map((em, idx) => (
        <div key={idx} className="flex gap-2 items-start">
          <div className="flex flex-col gap-1 flex-1">
            <input
              value={em.address}
              onChange={(e) => update(idx, "address", e.target.value)}
              placeholder="email@example.com"
              type="email"
              className={`w-full ${inputCls}`}
            />
            <input
              value={em.note}
              onChange={(e) => update(idx, "note", e.target.value)}
              placeholder="Note (optional)"
              className={`w-full ${inputCls}`}
            />
          </div>
          <div className="flex flex-col gap-1 items-center mt-1 shrink-0">
            {em.is_main ? (
              <span
                className="flex items-center gap-0.5 px-2 h-6 rounded-full text-[11px] font-semibold"
                style={{ background: "#E6F4EF", color: "#038153" }}
              >
                <Star size={10} fill="#038153" />
                Main
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setMain(idx)}
                className="flex items-center gap-0.5 px-2 h-6 rounded-full text-[11px] font-medium border border-[#D8DCDE] text-[#68717A] hover:border-[#038153] hover:text-[#038153] transition-colors"
              >
                <Star size={10} />
                Set Main
              </button>
            )}
            <button
              type="button"
              onClick={() => remove(idx)}
              className="w-7 h-7 flex items-center justify-center rounded-md text-[#CC3340] hover:bg-[#FFF0F1] transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1 text-xs font-medium transition-colors"
        style={{ color: "#038153" }}
      >
        <Plus size={13} />
        Add Email
      </button>
    </div>
  );
}

// ── Source Flow field renderer ────────────────────────────────────────────────
function SourceFlowField({
  field,
  value,
  onChange,
}: {
  field: ContactField;
  value: unknown;
  onChange: (val: SFValue) => void;
}) {
  let sources: SFSource[] = [];
  try {
    const cfg = JSON.parse(field.config ?? "{}");
    sources = cfg.sources ?? [];
  } catch { /* no config */ }

  const val = (value as SFValue) ?? { source: "", groups: {} };
  const selectedSource = sources.find(s => s.value === val.source) ?? null;

  const setSource = (sourceVal: string) => onChange({ source: sourceVal, groups: {} });
  const setGroup  = (groupId: string, itemVal: string) =>
    onChange({ ...val, groups: { ...val.groups, [groupId]: itemVal } });

  return (
    <div className="space-y-3">
      <div className="relative">
        <select
          value={val.source}
          onChange={e => setSource(e.target.value)}
          className={`w-full pl-3 pr-8 ${inputCls} appearance-none`}
        >
          <option value="">— Select —</option>
          {sources.map(s => <option key={s.id} value={s.value}>{s.label}</option>)}
        </select>
        <ChevronDown
          size={13}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#68717A] pointer-events-none"
        />
      </div>

      {selectedSource?.groups.filter(g => g.items.length > 0).map(grp => (
        <div key={grp.id} className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[#68717A] uppercase tracking-wide">{grp.name}</label>
          <div className="relative">
            <select
              value={val.groups[grp.id] ?? ""}
              onChange={e => setGroup(grp.id, e.target.value)}
              className={`w-full pl-3 pr-8 ${inputCls} appearance-none`}
            >
              <option value="">— Select {grp.name} —</option>
              {grp.items.map(it => (
                <option key={it.id} value={it.value}>{it.label}</option>
              ))}
            </select>
            <ChevronDown
              size={13}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#68717A] pointer-events-none"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Dynamic field renderer ────────────────────────────────────────────────────

function DynamicField({
  field,
  fieldValues,
  onChange,
}: {
  field: ContactField;
  fieldValues: FieldValues;
  onChange: (key: string, val: unknown) => void;
}) {
  const val = fieldValues[field.field_key];

  switch (field.field_type) {
    case "text":
      return (
        <input
          type="text"
          value={(val as string) ?? ""}
          onChange={(e) => onChange(field.field_key, e.target.value)}
          className={`w-full ${inputCls}`}
          placeholder={field.label}
        />
      );

    case "multi_phone":
      return (
        <MultiPhoneField
          value={(val as PhoneEntry[]) ?? []}
          onChange={(v) => onChange(field.field_key, v)}
        />
      );

    case "multi_email":
      return (
        <MultiEmailField
          value={(val as EmailEntry[]) ?? []}
          onChange={(v) => onChange(field.field_key, v)}
        />
      );

    case "date":
      return (
        <input
          type="date"
          value={(val as string) ?? ""}
          onChange={(e) => onChange(field.field_key, e.target.value)}
          className={`w-full ${inputCls}`}
        />
      );

    case "datetime":
      return (
        <input
          type="datetime-local"
          value={(val as string) ?? ""}
          onChange={(e) => onChange(field.field_key, e.target.value)}
          className={`w-full ${inputCls}`}
        />
      );

    case "boolean":
      return (
        <div className="relative">
          <select
            value={val === true || val === "true" ? "true" : val === false || val === "false" ? "false" : ""}
            onChange={(e) => onChange(field.field_key, e.target.value === "" ? "" : e.target.value)}
            className={`w-full pl-3 pr-8 ${inputCls} appearance-none`}
          >
            <option value="">— Select —</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
          <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#68717A] pointer-events-none" />
        </div>
      );

    case "radio":
      return (
        <RadioGroup
          label=""
          value={(val as string) ?? ""}
          onChange={(v) => onChange(field.field_key, v)}
          options={field.options.map((o) => ({ value: o.value, label: o.label }))}
        />
      );

    case "select":
      return (
        <div className="relative">
          <select
            value={(val as string) ?? ""}
            onChange={(e) => onChange(field.field_key, e.target.value)}
            className={`w-full pl-3 pr-8 ${inputCls} appearance-none`}
          >
            <option value="">— Select —</option>
            {field.options.map((o) => (
              <option key={o.id} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#68717A] pointer-events-none" />
        </div>
      );

    case "conditional_select": {
      let depends_on = "";
      let show_when = "";
      try {
        const cfg = JSON.parse(field.config ?? "{}");
        depends_on = cfg.depends_on ?? "";
        show_when = cfg.show_when ?? "";
      } catch {
        return null;
      }

      const depVal = fieldValues[depends_on];
      const shouldShow =
        String(depVal) === show_when ||
        (depVal === true && show_when === "true") ||
        (depVal === false && show_when === "false");

      if (!shouldShow) return null;

      return (
        <div className="relative">
          <select
            value={(val as string) ?? ""}
            onChange={(e) => onChange(field.field_key, e.target.value)}
            className={`w-full pl-3 pr-8 ${inputCls} appearance-none`}
          >
            <option value="">— Select —</option>
            {field.options.map((o) => (
              <option key={o.id} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#68717A] pointer-events-none" />
        </div>
      );
    }

    case "source_flow":
      return (
        <SourceFlowField
          field={field}
          value={val}
          onChange={(v) => onChange(field.field_key, v)}
        />
      );

    default:
      return null;
  }
}

// ── Main Modal ────────────────────────────────────────────────────────────────

export default function ContactModal({
  open,
  onClose,
  onSave,
  contact,
  defaultUserId,
  convertLeadId,
  prefillValues,
}: Props) {
  const [fields, setFields] = useState<ContactField[]>([]);
  const [fieldValues, setFieldValues] = useState<FieldValues>({});
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [attributeIds, setAttributeIds] = useState<string[]>([]);
  const [userId, setUserId] = useState(defaultUserId);
  const [createdAt, setCreatedAt] = useState(todayISO());
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const firstRef = useRef<HTMLInputElement>(null);

  // Fetch contact fields once on mount
  useEffect(() => {
    setFieldsLoading(true);
    fetch("/api/contact-fields?active=true")
      .then((r) => r.json())
      .then((data: ContactField[]) => setFields(data))
      .catch(() => setFields([]))
      .finally(() => setFieldsLoading(false));
  }, []);

  // Fetch sources once
  useEffect(() => {
    fetch("/api/sources")
      .then((r) => r.json())
      .then(setSources)
      .catch(() => setSources([]));
  }, []);

  // Reset form when modal opens or contact changes
  useEffect(() => {
    if (!open) return;
    if (!contact && prefillValues) {
      setFieldValues(prefillValues.field_values ?? {});
      setSourceId(prefillValues.source_id ?? null);
    } else {
      setFieldValues(contact?.field_values ?? {});
      setSourceId(contact?.source_id ?? null);
    }
    setAttributeIds(parseAttribIds(contact?.attribute_ids ?? null));
    setUserId(contact?.user_id ?? defaultUserId);
    setCreatedAt(contact ? contact.created_at.slice(0, 10) : todayISO());
    setError("");
    setTimeout(() => firstRef.current?.focus(), 50);
  }, [open, contact, defaultUserId]);

  // Keep selected source in sync
  useEffect(() => {
    setSelectedSource(sources.find((s) => s.id === sourceId) ?? null);
  }, [sourceId, sources]);

  const setFV = (key: string, val: unknown) =>
    setFieldValues((prev) => ({ ...prev, [key]: val }));

  const handleAttributeSelect = (groupItemIds: string[], selectedId: string | null) => {
    setAttributeIds((prev) => {
      const without = prev.filter((id) => !groupItemIds.includes(id));
      return selectedId ? [...without, selectedId] : without;
    });
  };

  // Validation
  const validate = (): string => {
    for (const field of fields) {
      if (!field.is_required) continue;

      // Skip fields whose conditional visibility is not met
      if (field.config) {
        try {
          const cfg = JSON.parse(field.config);
          if (cfg.depends_on) {
            const depVal = fieldValues[cfg.depends_on];
            const show_when = String(cfg.show_when ?? "");
            let shouldShow: boolean;
            if (show_when === "__filled__") {
              shouldShow = depVal !== undefined && depVal !== null && depVal !== "" && !(Array.isArray(depVal) && depVal.length === 0);
            } else {
              shouldShow =
                String(depVal) === show_when ||
                (depVal === true && show_when === "true") ||
                (depVal === false && show_when === "false");
            }
            if (!shouldShow) continue;
          }
        } catch {
          // malformed config — validate normally
        }
      }

      const val = fieldValues[field.field_key];
      const isEmpty =
        val === undefined ||
        val === null ||
        val === "" ||
        (Array.isArray(val) && val.length === 0);

      if (isEmpty) return `"${field.label}" is required.`;
    }

    // Validate source_select fields
    const sourceSelectField = fields.find((f) => f.field_type === "source_select");
    if (sourceSelectField?.is_required && !sourceId) {
      return `"${sourceSelectField.label}" is required.`;
    }

    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        field_values: fieldValues,
        source_id: sourceId,
        attribute_ids: attributeIds.length > 0 ? attributeIds : null,
        user_id: userId,
        created_at: createdAt,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const isEdit = !!contact;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div
        className="relative z-10 w-full max-w-lg bg-white rounded-xl flex flex-col overflow-hidden"
        style={{
          maxHeight: "90vh",
          boxShadow: "0 25px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D8DCDE] shrink-0">
          <div>
            <h2 className="text-[15px] font-semibold text-[#2F3941]">
              {convertLeadId ? "Convert to Contact" : isEdit ? "Edit Contact" : "Add New Contact"}
            </h2>
            <p className="text-xs text-[#68717A] mt-0.5">
              Fill in the contact&apos;s information
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
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

            {/* Dynamic fields */}
            {fieldsLoading ? (
              <div className="flex items-center justify-center h-24">
                <Loader2 size={18} className="animate-spin text-[#68717A]" />
              </div>
            ) : (
              fields.map((field, idx) => {
                // Insert section dividers at logical boundaries
                const prevField = fields[idx - 1];
                const isFirstMultiPhone = field.field_type === "multi_phone" && prevField?.field_type !== "multi_phone";
                const isFirstMultiEmail = field.field_type === "multi_email" && prevField?.field_type !== "multi_email";
                const isFirstOther =
                  idx === 0 ||
                  (field.field_type !== "multi_phone" &&
                    field.field_type !== "multi_email" &&
                    (prevField?.field_type === "multi_phone" || prevField?.field_type === "multi_email"));

                // Check conditional visibility for any field that has depends_on in config
                if (field.config) {
                  try {
                    const cfg = JSON.parse(field.config);
                    if (cfg.depends_on) {
                      const depVal = fieldValues[cfg.depends_on];
                      const show_when = String(cfg.show_when ?? "");
                      let shouldShow: boolean;
                      if (show_when === "__filled__") {
                        shouldShow = depVal !== undefined && depVal !== null && depVal !== "" && !(Array.isArray(depVal) && depVal.length === 0);
                      } else {
                        shouldShow =
                          String(depVal) === show_when ||
                          (depVal === true && show_when === "true") ||
                          (depVal === false && show_when === "false");
                      }
                      if (!shouldShow) return null;
                    }
                  } catch {
                    // malformed config — show the field
                  }
                }

                return (
                  <div key={field.id} className="flex flex-col gap-1.5">
                    {(isFirstMultiPhone || isFirstMultiEmail) && (
                      <SectionDivider
                        title={isFirstMultiPhone ? "Phone Numbers" : "Emails"}
                      />
                    )}
                    {isFirstOther && idx !== 0 && (
                      <SectionDivider title="Details" />
                    )}
                    {field.field_type !== "radio" && (
                      <label className={labelCls}>
                        {field.label}
                        {field.is_required && (
                          <span className="text-[#CC3340] ml-0.5">*</span>
                        )}
                      </label>
                    )}
                    {field.field_type === "radio" ? (
                      <RadioGroup
                        label={field.label}
                        value={(fieldValues[field.field_key] as string) ?? ""}
                        onChange={(v) => setFV(field.field_key, v)}
                        options={field.options.map((o) => ({ value: o.value, label: o.label }))}
                      />
                    ) : field.field_type === "source_select" ? (
                      <div className="space-y-3">
                        <div className="relative">
                          <select
                            value={sourceId ?? ""}
                            onChange={(e) => {
                              setSourceId(e.target.value || null);
                              setAttributeIds([]);
                            }}
                            className={`w-full pl-3 pr-8 ${inputCls} appearance-none`}
                          >
                            <option value="">— Select source —</option>
                            {sources.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                          <ChevronDown
                            size={13}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#68717A] pointer-events-none"
                          />
                        </div>
                        {selectedSource?.attribute_groups
                          .filter((g) => g.items.length > 0)
                          .map((group) => (
                            <AttributeSelect
                              key={group.id}
                              group={group}
                              attributeIds={attributeIds}
                              onSelect={handleAttributeSelect}
                            />
                          ))}
                      </div>
                    ) : (
                      <DynamicField
                        field={field}
                        fieldValues={fieldValues}
                        onChange={setFV}
                      />
                    )}
                    {(() => {
                      try {
                        const cfg = JSON.parse(field.config ?? "{}");
                        if (!cfg.has_notes) return null;
                      } catch { return null; }
                      const notesKey = `${field.field_key}__notes`;
                      return (
                        <textarea
                          value={(fieldValues[notesKey] as string) ?? ""}
                          onChange={e => setFV(notesKey, e.target.value)}
                          placeholder="Notes..."
                          rows={2}
                          className="w-full px-3 py-2 text-sm rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] placeholder:text-[#C2C8CC] outline-none focus:border-[#038153] focus:ring-2 focus:ring-[#038153]/15 transition-all resize-none"
                        />
                      );
                    })()}
                  </div>
                );
              })
            )}

            {/* Created At */}
            <SectionDivider title="Details" />
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Created At</label>
              <input
                ref={firstRef}
                type="date"
                value={createdAt}
                onChange={(e) => setCreatedAt(e.target.value)}
                className={`w-full ${inputCls}`}
              />
            </div>


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
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-4 text-sm font-medium rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] hover:bg-[#F3F4F6] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-8 px-4 text-sm font-medium rounded-md text-white flex items-center gap-1.5 hover:brightness-110 active:scale-95 disabled:opacity-60 transition-all"
              style={{ background: "#038153" }}
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              {convertLeadId ? "Convert" : isEdit ? "Save Changes" : "Add Contact"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
