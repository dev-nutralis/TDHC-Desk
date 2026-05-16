"use client";

import { useEffect, useState } from "react";
import { X, Download, Loader2, Check, Link2 } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RemoteFieldOption {
  label: string;
  value: string;
  sort_order: number;
}

interface RemoteField {
  id: string;
  field_key: string;
  label: string;
  field_type: string;
  is_required: boolean;
  config: string | null;
  options: RemoteFieldOption[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
  existingFieldKeys: string[];
}

// ── Module → API mapping ──────────────────────────────────────────────────────
const MODULES = [
  { key: "leads", label: "Leads", api: "/api/lead-fields" },
  { key: "deals", label: "Deals", api: "/api/deal-fields" },
];

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: "Text",
  multi_phone: "Multi Phone",
  multi_email: "Multi Email",
  date: "Date",
  datetime: "Date & Time",
  boolean: "Yes / No",
  radio: "Radio",
  select: "Dropdown",
  conditional_select: "Conditional",
  source_flow: "Source Flow",
};

// ── Style helpers ─────────────────────────────────────────────────────────────
const inputCls =
  "h-9 px-3 text-sm rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] outline-none focus:border-[#038153] focus:ring-2 focus:ring-[#038153]/15 transition-all";
const labelCls = "text-xs font-semibold text-[#2F3941] uppercase tracking-wide";

// ── Main component ────────────────────────────────────────────────────────────
export default function ImportFieldsModal({ open, onClose, onImported, existingFieldKeys }: Props) {
  const [module, setModule] = useState("leads");
  const [moduleFields, setModuleFields] = useState<RemoteField[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [fetching, setFetching] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch full field data whenever module changes or modal opens
  useEffect(() => {
    if (!open) return;
    const activeModule = MODULES.find(m => m.key === module) ?? MODULES[0];
    setFetching(true);
    setChecked(new Set());
    fetch(`${activeModule.api}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: RemoteField[]) => setModuleFields(Array.isArray(data) ? data : []))
      .catch(() => setModuleFields([]))
      .finally(() => setFetching(false));
  }, [open, module]);

  useEffect(() => {
    if (!open) { setModule("leads"); setModuleFields([]); }
  }, [open]);

  if (!open) return null;

  const availableFields = moduleFields.filter(f => !existingFieldKeys.includes(f.field_key));

  const allAvailableSelected =
    availableFields.length > 0 && availableFields.every(f => checked.has(f.field_key));

  const toggleSelectAll = () => {
    if (allAvailableSelected) {
      setChecked(prev => {
        const next = new Set(prev);
        availableFields.forEach(f => next.delete(f.field_key));
        return next;
      });
    } else {
      setChecked(prev => {
        const next = new Set(prev);
        availableFields.forEach(f => next.add(f.field_key));
        return next;
      });
    }
  };

  const toggleField = (fieldKey: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(fieldKey)) next.delete(fieldKey);
      else next.add(fieldKey);
      return next;
    });
  };

  // ── Import — copies full config + options + stores source reference ──────────
  async function handleImport() {
    setLoading(true);
    const toImport = moduleFields.filter(f => checked.has(f.field_key));
    await Promise.all(
      toImport.map(f =>
        fetch("/api/contact-fields", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: f.label,
            field_key: f.field_key,
            field_type: f.field_type,
            sort_order: 0,
            is_required: f.is_required,
            config: f.config,
            options: f.options,
            source_module: module,
            source_field_id: f.id,
          }),
        })
      )
    );
    setLoading(false);
    onImported();
    onClose();
  }

  const checkedCount = checked.size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

      <div
        className="relative z-10 w-full max-w-md bg-white rounded-xl flex flex-col overflow-hidden"
        style={{ maxHeight: "90vh", boxShadow: "0 25px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D8DCDE] shrink-0">
          <div>
            <h2 className="text-[15px] font-semibold text-[#2F3941]">Import Fields</h2>
            <p className="text-xs text-[#68717A] mt-0.5">
              Importovani fieldovi su linked — editovanje se radi iz source modula
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md flex items-center justify-center text-[#68717A] hover:bg-[#F3F4F6] transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* Module selector */}
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Source Module</label>
            <select
              value={module}
              onChange={e => { setModule(e.target.value); setChecked(new Set()); }}
              className={`${inputCls} w-full`}
            >
              {MODULES.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </div>

          {/* Fields list */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className={labelCls}>Fields</label>
              {availableFields.length > 0 && (
                <button type="button" onClick={toggleSelectAll} className="text-xs font-medium text-[#038153] hover:underline">
                  {allAvailableSelected ? "Deselect all" : "Select all"}
                </button>
              )}
            </div>

            <div className="rounded-lg border border-[#D8DCDE] overflow-hidden divide-y divide-[#D8DCDE]">
              {fetching && (
                <div className="flex items-center justify-center h-20">
                  <Loader2 size={16} className="animate-spin text-[#68717A]" />
                </div>
              )}
              {!fetching && moduleFields.length === 0 && (
                <div className="flex items-center justify-center h-20 text-sm text-[#68717A]">
                  No fields found in this module.
                </div>
              )}
              {!fetching && moduleFields.map(field => {
                const alreadyAdded = existingFieldKeys.includes(field.field_key);
                const isChecked = checked.has(field.field_key);
                const optionCount = field.options?.length ?? 0;

                return (
                  <label
                    key={field.field_key}
                    className={[
                      "flex items-start gap-3 px-4 py-3 transition-colors select-none",
                      alreadyAdded
                        ? "opacity-50 cursor-not-allowed bg-[#F8F9F9]"
                        : "cursor-pointer hover:bg-[#F0FBF7]",
                    ].join(" ")}
                  >
                    <input
                      type="checkbox"
                      disabled={alreadyAdded}
                      checked={isChecked}
                      onChange={() => toggleField(field.field_key)}
                      className="sr-only"
                    />
                    {/* Custom checkbox */}
                    <span className={[
                      "w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors mt-0.5",
                      alreadyAdded ? "border-[#D8DCDE] bg-[#F3F4F6]"
                        : isChecked ? "border-[#038153] bg-[#038153]"
                        : "border-[#D8DCDE] bg-white",
                    ].join(" ")}>
                      {isChecked && !alreadyAdded && <Check size={10} className="text-white" strokeWidth={3} />}
                    </span>

                    {/* Field info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-[#2F3941] truncate">{field.label}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#EAF7F0] border border-[#B7E5D0] text-[#038153] font-medium shrink-0">
                          {FIELD_TYPE_LABELS[field.field_type] ?? field.field_type}
                        </span>
                        {optionCount > 0 && (
                          <span className="text-[10px] text-[#68717A] shrink-0">
                            {optionCount} {optionCount === 1 ? "option" : "options"}
                          </span>
                        )}
                        {field.field_type === "source_flow" && field.config && (() => {
                          try {
                            const cfg = JSON.parse(field.config);
                            const srcCount = cfg.sources?.length ?? 0;
                            return srcCount > 0 ? (
                              <span className="text-[10px] text-[#68717A] shrink-0">
                                {srcCount} {srcCount === 1 ? "source" : "sources"}
                              </span>
                            ) : null;
                          } catch { return null; }
                        })()}
                      </div>
                      <span className="text-[10px] font-mono text-[#C2C8CC] mt-0.5 block">{field.field_key}</span>
                    </div>

                    {alreadyAdded && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F3F4F6] border border-[#D8DCDE] text-[#68717A] shrink-0 self-center">
                        Already added
                      </span>
                    )}
                  </label>
                );
              })}
            </div>

            {!fetching && availableFields.length === 0 && moduleFields.length > 0 && (
              <p className="text-xs text-[#68717A] text-center py-1">
                All fields from this module have already been added.
              </p>
            )}
          </div>

          {/* Info note */}
          {checkedCount > 0 && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-[#EAF7F0] border border-[#B7E5D0]">
              <Link2 size={13} className="text-[#038153] shrink-0 mt-0.5" />
              <p className="text-xs text-[#038153]">
                Importovani fieldovi su <strong>linked</strong> sa {MODULES.find(m => m.key === module)?.label} modulom.
                Sve izmjene se moraju raditi u {MODULES.find(m => m.key === module)?.label} → Settings.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#D8DCDE] bg-[#F8F9F9] shrink-0">
          <button type="button" onClick={onClose}
            className="h-8 px-4 text-sm font-medium rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] hover:bg-[#F3F4F6] transition-colors">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={checkedCount === 0 || loading}
            className="h-8 px-4 text-sm font-medium rounded-md text-white flex items-center gap-1.5 hover:brightness-110 disabled:opacity-50 transition-all"
            style={{ background: "#038153" }}
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            {checkedCount > 0 ? `Import (${checkedCount})` : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}
