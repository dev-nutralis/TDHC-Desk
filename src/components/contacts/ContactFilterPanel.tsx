"use client";

import { useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Plus } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FilterCondition {
  id: string;
  field_key: string;
  field_type: string;
  label: string;
  operator: string;
  value: string;
  value2?: string; // "to" date for range operator
}

interface FieldOption { id: string; label: string; value: string; }
interface Field {
  id: string;
  label: string;
  field_key: string;
  field_type: string;
  options: FieldOption[];
}

// ── Built-in fields always present ────────────────────────────────────────────

const BUILTIN: Field[] = [
  { id: "__first_name__", label: "First Name",  field_key: "first_name",   field_type: "text", options: [] },
  { id: "__last_name__",  label: "Last Name",   field_key: "last_name",    field_type: "text", options: [] },
  { id: "__added_on__",   label: "Added On",    field_key: "__added_on__", field_type: "date", options: [] },
];

// ── Operator map per field type ────────────────────────────────────────────────

const OPS: Record<string, { value: string; label: string; noValue?: boolean }[]> = {
  text: [
    { value: "contains",    label: "contains" },
    { value: "equals",      label: "equals" },
    { value: "starts_with", label: "starts with" },
    { value: "not_empty",   label: "is not empty", noValue: true },
    { value: "is_empty",    label: "is empty",     noValue: true },
  ],
  date: [
    { value: "range",     label: "is between" },
    { value: "not_empty", label: "is not empty", noValue: true },
    { value: "is_empty",  label: "is empty",     noValue: true },
  ],
  datetime: [
    { value: "range",     label: "is between" },
    { value: "not_empty", label: "is not empty", noValue: true },
    { value: "is_empty",  label: "is empty",     noValue: true },
  ],
  boolean: [
    { value: "is_true",  label: "is Yes", noValue: true },
    { value: "is_false", label: "is No",  noValue: true },
  ],
  select: [
    { value: "equals",     label: "is" },
    { value: "not_equals", label: "is not" },
    { value: "not_empty",  label: "is not empty", noValue: true },
    { value: "is_empty",   label: "is empty",     noValue: true },
  ],
  radio: [
    { value: "equals",     label: "is" },
    { value: "not_equals", label: "is not" },
    { value: "not_empty",  label: "is not empty", noValue: true },
    { value: "is_empty",   label: "is empty",     noValue: true },
  ],
  conditional_select: [
    { value: "equals",     label: "is" },
    { value: "not_equals", label: "is not" },
    { value: "not_empty",  label: "is not empty", noValue: true },
    { value: "is_empty",   label: "is empty",     noValue: true },
  ],
  multi_phone: [
    { value: "contains",  label: "contains" },
    { value: "not_empty", label: "is not empty", noValue: true },
    { value: "is_empty",  label: "is empty",     noValue: true },
  ],
  multi_email: [
    { value: "contains",  label: "contains" },
    { value: "not_empty", label: "is not empty", noValue: true },
    { value: "is_empty",  label: "is empty",     noValue: true },
  ],
  source_flow: [
    { value: "not_empty", label: "is not empty", noValue: true },
    { value: "is_empty",  label: "is empty",     noValue: true },
  ],
  source_select: [
    { value: "not_empty", label: "is not empty", noValue: true },
    { value: "is_empty",  label: "is empty",     noValue: true },
  ],
};

function opsFor(t: string) { return OPS[t] ?? OPS.text; }
function defaultOp(t: string) { return opsFor(t)[0]?.value ?? "contains"; }

// ── Chip label helper (exported for use in ContactsTable) ──────────────────────

export function chipLabel(c: FilterCondition): string {
  const op = opsFor(c.field_type).find(o => o.value === c.operator);
  const opLabel = op?.label ?? c.operator;
  if (op?.noValue) return `${c.label} ${opLabel}`;
  if (c.operator === "range") {
    if (c.value && c.value2) return `${c.label}: ${c.value} → ${c.value2}`;
    if (c.value)  return `${c.label}: from ${c.value}`;
    if (c.value2) return `${c.label}: until ${c.value2}`;
    return `${c.label} range`;
  }
  if (!c.value) return `${c.label} ${opLabel}`;
  return `${c.label} ${opLabel} "${c.value}"`;
}

// ── Single filter row ──────────────────────────────────────────────────────────

function FilterRow({
  cond,
  allFields,
  builtinList,
  onChange,
  onRemove,
}: {
  cond: FilterCondition;
  allFields: Field[];
  builtinList: Field[];
  onChange: (c: FilterCondition) => void;
  onRemove: () => void;
}) {
  const ops     = opsFor(cond.field_type);
  const selOp   = ops.find(o => o.value === cond.operator);
  const noValue = selOp?.noValue ?? false;
  const field   = allFields.find(f => f.field_key === cond.field_key);
  const customFields = allFields.filter(f => !builtinList.find(b => b.field_key === f.field_key));

  const sel = "h-8 text-sm rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153]/20 transition-all appearance-none px-2.5";

  const handleFieldChange = (key: string) => {
    const f = allFields.find(x => x.field_key === key);
    if (!f) return;
    onChange({ ...cond, field_key: f.field_key, field_type: f.field_type, label: f.label, operator: defaultOp(f.field_type), value: "", value2: undefined });
  };

  const handleOpChange = (op: string) => {
    const opDef = ops.find(o => o.value === op);
    onChange({ ...cond, operator: op, value: opDef?.noValue ? "" : cond.value, value2: opDef?.noValue ? undefined : cond.value2 });
  };

  return (
    <div className="flex items-center gap-2">

      {/* Field */}
      <select value={cond.field_key} onChange={e => handleFieldChange(e.target.value)} className={`${sel} min-w-0 flex-1`}>
        <optgroup label="Built-in">
          {builtinList.map(f => <option key={f.field_key} value={f.field_key}>{f.label}</option>)}
        </optgroup>
        {customFields.length > 0 && (
          <optgroup label="Custom Fields">
            {customFields.map(f => <option key={f.field_key} value={f.field_key}>{f.label}</option>)}
          </optgroup>
        )}
      </select>

      {/* Operator */}
      <select value={cond.operator} onChange={e => handleOpChange(e.target.value)} className={`${sel} w-[130px] shrink-0`}>
        {ops.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      {/* Value */}
      {!noValue && (
        cond.operator === "range"
          ? (
            <div className="flex items-center gap-1.5 shrink-0">
              <input
                type="date"
                value={cond.value}
                onChange={e => onChange({ ...cond, value: e.target.value })}
                className={`${sel} w-[120px]`}
              />
              <span className="text-xs text-[#68717A] shrink-0">→</span>
              <input
                type="date"
                value={cond.value2 ?? ""}
                onChange={e => onChange({ ...cond, value2: e.target.value })}
                className={`${sel} w-[120px]`}
              />
            </div>
          )
          : (cond.field_type === "select" || cond.field_type === "radio" || cond.field_type === "conditional_select") && (field?.options.length ?? 0) > 0
          ? (
            <select value={cond.value} onChange={e => onChange({ ...cond, value: e.target.value })} className={`${sel} w-[130px] shrink-0`}>
              <option value="">— Any —</option>
              {field!.options.map(o => <option key={o.id} value={o.value}>{o.label}</option>)}
            </select>
          )
          : (
            <input
              type="text"
              value={cond.value}
              onChange={e => onChange({ ...cond, value: e.target.value })}
              placeholder="Value…"
              className="h-8 w-[130px] shrink-0 px-2.5 text-sm rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] placeholder:text-[#C2C8CC] outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153]/20 transition-all"
            />
          )
      )}
      {noValue && <div className="w-[130px] shrink-0" />}

      {/* Remove */}
      <button type="button" onClick={onRemove}
        className="w-7 h-7 flex items-center justify-center rounded-md text-[#68717A] hover:text-[#CC3340] hover:bg-[#FFF0F1] transition-colors shrink-0">
        <X size={13} />
      </button>
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────────

interface Props {
  anchor: DOMRect;
  fields: Field[];
  builtinFields?: Field[];
  filters: FilterCondition[];
  onChange: (f: FilterCondition[]) => void;
  onClose: () => void;
}

export default function ContactFilterPanel({ anchor, fields, builtinFields, filters, onChange, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const effectiveBuiltin = builtinFields ?? BUILTIN;

  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [onClose]);

  if (typeof window === "undefined") return null;

  const allFields: Field[] = [
    ...effectiveBuiltin,
    ...fields.filter(f => !effectiveBuiltin.find(b => b.field_key === f.field_key)),
  ];

  const addFilter = () => {
    const first = allFields[0];
    if (!first) return;
    onChange([...filters, {
      id: Math.random().toString(36).slice(2),
      field_key: first.field_key,
      field_type: first.field_type,
      label: first.label,
      operator: defaultOp(first.field_type),
      value: "",
    }]);
  };

  const openUp = window.innerHeight - anchor.bottom < 320;
  const style: React.CSSProperties = {
    position: "fixed",
    left: Math.min(anchor.left, window.innerWidth - 590),
    zIndex: 9999,
    width: 580,
    ...(openUp
      ? { bottom: window.innerHeight - anchor.top + 4 }
      : { top: anchor.bottom + 4 }),
  };

  return createPortal(
    <div ref={ref} style={style} className="bg-white rounded-xl border border-[#D8DCDE] shadow-2xl p-4 flex flex-col gap-3">

      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[#2F3941] uppercase tracking-wide">Filters</span>
        {filters.length > 0 && (
          <button type="button" onClick={() => onChange([])} className="text-xs text-[#CC3340] hover:underline">
            Clear all
          </button>
        )}
      </div>

      {filters.length === 0 && (
        <p className="text-sm text-[#68717A]">No filters applied.</p>
      )}

      {filters.length > 0 && (
        <div className="flex flex-col gap-2">
          {filters.map(c => (
            <FilterRow
              key={c.id}
              cond={c}
              allFields={allFields}
              builtinList={effectiveBuiltin}
              onChange={updated => onChange(filters.map(f => f.id === c.id ? updated : f))}
              onRemove={() => onChange(filters.filter(f => f.id !== c.id))}
            />
          ))}
        </div>
      )}

      <button type="button" onClick={addFilter}
        className="flex items-center gap-1.5 text-sm font-medium w-fit"
        style={{ color: "#038153" }}>
        <Plus size={13} /> Add filter
      </button>

    </div>,
    document.body
  );
}
