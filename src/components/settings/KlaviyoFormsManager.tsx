"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  Trash2,
  Copy,
  CheckCheck,
  Loader2,
  Webhook,
  AlertTriangle,
  X,
  Settings2,
  ChevronDown,
} from "lucide-react";
import { useParams } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

type TransformType = "" | "split_name_first" | "split_name_last";

interface FieldMapping {
  klaviyo_field: string;
  contact_field_key: string;
  transform?: TransformType;
  static_value?: string;
  static_attribute_ids?: string[];
}

interface SourceAttributeItem { id: string; label: string; sort_order: number; }
interface SourceAttributeGroup { id: string; name: string; sort_order: number; items: SourceAttributeItem[]; }
interface SourceWithGroups { id: string; name: string; attribute_groups: SourceAttributeGroup[]; }

interface KlaviyoForm {
  id: string;
  name: string;
  token: string;
  created_at: string;
  platform_id: string;
  mappings: FieldMapping[];
  create_deal: boolean;
  create_deal_new_only: boolean;
  deal_mappings: FieldMapping[];
}

interface FieldOption {
  value: string;
  label: string;
}

interface ContactField {
  id: string;
  field_key: string;
  label: string;
  field_type?: string;
  options?: FieldOption[];
}

interface Platform {
  id: string;
  name: string;
  slug: string;
}

const KLAVIYO_SUGGESTIONS = [
  "email",
  "first_name",
  "last_name",
  "phone_number",
  "organization",
  "properties.form_name",
  "$form_name",
  "{first_name}",
  "{last_name}",
  "{email}",
  "{$form_name}",
  "{first_name} {last_name}",
  "{$form_name} - {first_name} {last_name}",
];

// ── Template token preview ────────────────────────────────────────────────────

const VARIABLE_CHIPS = [
  { label: "first_name", value: "{first_name}" },
  { label: "last_name",  value: "{last_name}" },
  { label: "email",      value: "{email}" },
  { label: "phone",      value: "{phone_number}" },
  { label: "form name",  value: "{$form_name}" },
];

function parseTemplate(template: string): { type: "text" | "var"; content: string }[] {
  const parts: { type: "text" | "var"; content: string }[] = [];
  const regex = /\{([^}]+)\}/g;
  let last = 0;
  let match;
  while ((match = regex.exec(template)) !== null) {
    if (match.index > last) parts.push({ type: "text", content: template.slice(last, match.index) });
    parts.push({ type: "var", content: match[1] });
    last = match.index + match[0].length;
  }
  if (last < template.length) parts.push({ type: "text", content: template.slice(last) });
  return parts;
}

function TemplateInput({
  value,
  datalistId,
  onChange,
}: {
  value: string;
  datalistId: string;
  onChange: (v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isTemplate = value.includes("{");
  const tokens = isTemplate ? parseTemplate(value) : [];

  const insertVariable = (chip: string) => {
    const el = inputRef.current;
    if (!el) { onChange(value + chip); return; }
    const start = el.selectionStart ?? value.length;
    const end   = el.selectionEnd   ?? value.length;
    const next = value.slice(0, start) + chip + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + chip.length, start + chip.length);
    });
  };

  return (
    <div className="space-y-1.5">
      <input
        ref={inputRef}
        type="text"
        list={datalistId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="first_name or {first_name} {last_name}"
        className="w-full h-8 px-3 text-sm rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] placeholder-[#C2C8CC] focus:outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153] transition-colors font-mono"
      />

      {/* Variable chip buttons */}
      <div className="flex flex-wrap gap-1">
        {VARIABLE_CHIPS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => insertVariable(c.value)}
            className="h-5 px-2 text-[10px] rounded-full border border-[#038153]/40 text-[#038153] bg-[#EAF7F0] hover:bg-[#038153] hover:text-white transition-colors"
          >
            + {c.label}
          </button>
        ))}
      </div>

      {/* Live preview */}
      {isTemplate && tokens.length > 0 && (
        <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 rounded-md bg-white border border-[#D8DCDE] min-h-[28px]">
          {tokens.map((t, i) =>
            t.type === "var" ? (
              <span key={i} className="inline-flex items-center h-5 px-1.5 rounded text-[10px] font-medium bg-[#EAF7F0] text-[#038153] border border-[#038153]/30">
                {t.content}
              </span>
            ) : (
              <span key={i} className="text-[11px] text-[#68717A]">{t.content}</span>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ── Generic MappingRows (shared between contact and deal editors) ──────────────

function MappingRows({
  mappings,
  fields,
  sources,
  loadingFields,
  datalistId,
  showTransform = false,
  showStaticValue = false,
  onUpdate,
  onUpdateAttribs,
  onRemove,
}: {
  mappings: FieldMapping[];
  fields: ContactField[];
  sources: SourceWithGroups[];
  loadingFields: boolean;
  datalistId: string;
  showTransform?: boolean;
  showStaticValue?: boolean;
  onUpdate: (index: number, field: keyof FieldMapping, value: string) => void;
  onUpdateAttribs: (index: number, attribs: string[]) => void;
  onRemove: (index: number) => void;
}) {
  const colCount = 2 + (showTransform ? 1 : 0) + (showStaticValue ? 1 : 0);
  const cols = colCount === 4
    ? "grid-cols-[1fr_auto_1fr_1fr_auto]"
    : colCount === 3
      ? "grid-cols-[1fr_auto_1fr_auto]"
      : "grid-cols-[1fr_auto_1fr_1fr_1fr_auto]";

  return (
    <div className="space-y-2">
      {mappings.length > 0 && (
        <div className={`grid ${cols} gap-2 items-center`}>
          <span className="text-[10px] font-medium text-[#68717A] uppercase tracking-wide">Klaviyo field</span>
          <span />
          <span className="text-[10px] font-medium text-[#68717A] uppercase tracking-wide">Field</span>
          {showTransform && <span className="text-[10px] font-medium text-[#68717A] uppercase tracking-wide">Transform</span>}
          {showStaticValue && <span className="text-[10px] font-medium text-[#68717A] uppercase tracking-wide">Fixed value</span>}
          <span />
        </div>
      )}
      {mappings.map((mapping, i) => {
        const selectedField = fields.find((f) => f.field_key === mapping.contact_field_key);
        const fieldType = selectedField?.field_type ?? "text";
        const isTextLike = fieldType === "text" || fieldType === "textarea";
        const isSelectLike = fieldType === "select" || fieldType === "radio";
        const isDateField = fieldType === "date";
        const isSourceField = fieldType === "builtin_source" || fieldType === "source_select";
        const hasOptions = isSelectLike && (selectedField?.options?.length ?? 0) > 0;
        // Source and select/radio fields: show Klaviyo input when no static value is chosen (dynamic mode)
        const hideKlaviyoField = showStaticValue && (!isTextLike || isSourceField) && !((isSourceField || isSelectLike) && !mapping.static_value);
        const useNow = mapping.static_value === "$now";

        return (
          <div key={i} className={`grid ${cols} gap-2 items-start`}>
            {/* Klaviyo field / fixed value placeholder */}
            {hideKlaviyoField ? (
              <div className="h-8 flex items-center px-3 rounded-md border border-[#D8DCDE] bg-[#F3F4F6]">
                <span className="text-xs text-[#C2C8CC]">Fixed value only</span>
              </div>
            ) : (
              <TemplateInput
                value={mapping.klaviyo_field}
                datalistId={datalistId}
                onChange={(v) => onUpdate(i, "klaviyo_field", v)}
              />
            )}

            <span className="text-[#C2C8CC] text-xs select-none">→</span>

            {/* Target field selector */}
            <div className="relative">
              <select
                value={mapping.contact_field_key}
                onChange={(e) => onUpdate(i, "contact_field_key", e.target.value)}
                className="w-full h-8 pl-3 pr-7 text-sm rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] focus:outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153] appearance-none transition-colors"
              >
                <option value="">{loadingFields ? "Loading…" : "Select field"}</option>
                {fields.map((f) => (
                  <option key={f.field_key} value={f.field_key}>{f.label} ({f.field_key})</option>
                ))}
              </select>
              <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#68717A]" />
            </div>

            {/* Transform — only for text-like fields */}
            {showTransform && (
              !isTextLike ? (
                <div className="h-8" />
              ) : (
                <div className="relative">
                  <select
                    value={mapping.transform ?? ""}
                    onChange={(e) => onUpdate(i, "transform", e.target.value)}
                    className="w-full h-8 pl-3 pr-7 text-sm rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] focus:outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153] appearance-none transition-colors"
                  >
                    <option value="">None</option>
                    <option value="split_name_first">Split name → First</option>
                    <option value="split_name_last">Split name → Last</option>
                  </select>
                  <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#68717A]" />
                </div>
              )
            )}

            {/* Fixed value */}
            {showStaticValue && (
              isDateField ? (
                <div className="space-y-1.5">
                  <div className="flex rounded-md border border-[#D8DCDE] overflow-hidden text-xs font-medium">
                    <button
                      type="button"
                      onClick={() => onUpdate(i, "static_value", "$now")}
                      className={`flex-1 h-8 px-2 transition-colors ${useNow ? "bg-[#038153] text-white" : "bg-white text-[#68717A] hover:bg-[#F3F4F6]"}`}
                    >
                      Submission date
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdate(i, "static_value", "")}
                      className={`flex-1 h-8 px-2 border-l border-[#D8DCDE] transition-colors ${!useNow ? "bg-[#038153] text-white" : "bg-white text-[#68717A] hover:bg-[#F3F4F6]"}`}
                    >
                      Fixed date
                    </button>
                  </div>
                  {!useNow && (
                    <input
                      type="date"
                      value={mapping.static_value ?? ""}
                      onChange={(e) => onUpdate(i, "static_value", e.target.value)}
                      className="w-full h-8 px-3 text-sm rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] focus:outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153] transition-colors"
                    />
                  )}
                </div>
              ) : isSourceField ? (
                (() => {
                  const selSrc = sources.find(s => s.name === mapping.static_value) ?? null;
                  // Build groupId → selectedItemId map from mapping.static_attribute_ids
                  const attribMap: Record<string, string> = {};
                  for (const itemId of (mapping.static_attribute_ids ?? [])) {
                    for (const grp of selSrc?.attribute_groups ?? []) {
                      if (grp.items.some(it => it.id === itemId)) { attribMap[grp.id] = itemId; break; }
                    }
                  }
                  return (
                    <div className="space-y-2">
                      <div className="relative">
                        <select
                          value={mapping.static_value ?? ""}
                          onChange={(e) => { onUpdate(i, "static_value", e.target.value); onUpdateAttribs(i, []); }}
                          className="w-full h-8 pl-3 pr-7 text-sm rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] focus:outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153] appearance-none transition-colors"
                        >
                          <option value="">— select source —</option>
                          {sources.map(s => (
                            <option key={s.id} value={s.name}>{s.name}</option>
                          ))}
                        </select>
                        <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#68717A]" />
                      </div>
                      {selSrc && selSrc.attribute_groups.length > 0 && (
                        <div className="pl-3 border-l-2 border-[#D8DCDE] space-y-2">
                          {selSrc.attribute_groups.map(grp => (
                            <div key={grp.id} className="relative">
                              <select
                                value={attribMap[grp.id] ?? ""}
                                onChange={(e) => {
                                  const newMap = { ...attribMap, [grp.id]: e.target.value };
                                  onUpdateAttribs(i, Object.values(newMap).filter(Boolean));
                                }}
                                className="w-full h-8 pl-3 pr-7 text-xs rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] focus:outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153] appearance-none transition-colors"
                              >
                                <option value="">— {grp.name} —</option>
                                {grp.items.map(it => (
                                  <option key={it.id} value={it.id}>{it.label}</option>
                                ))}
                              </select>
                              <ChevronDown size={11} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#68717A]" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : hasOptions ? (
                <div className="relative">
                  <select
                    value={mapping.static_value ?? ""}
                    onChange={(e) => onUpdate(i, "static_value", e.target.value)}
                    className="w-full h-8 pl-3 pr-7 text-sm rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] focus:outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153] appearance-none transition-colors"
                  >
                    <option value="">— none —</option>
                    {selectedField!.options!.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#68717A]" />
                </div>
              ) : isTextLike ? null : (
                <input
                  type={fieldType === "number" ? "number" : "text"}
                  value={mapping.static_value ?? ""}
                  onChange={(e) => onUpdate(i, "static_value", e.target.value)}
                  placeholder="Fixed value"
                  className="h-8 px-3 text-sm rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] placeholder-[#C2C8CC] focus:outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153] transition-colors"
                />
              )
            )}

            <button onClick={() => onRemove(i)} title="Remove" className="w-7 h-7 flex items-center justify-center rounded-md text-[#68717A] hover:bg-[#FFF0F1] hover:text-[#CC3340] transition-colors">
              <Trash2 size={13} />
            </button>
          </div>
        );
      })}
      {mappings.length === 0 && (
        <p className="text-xs text-[#C2C8CC] text-center py-2">No mappings yet.</p>
      )}
    </div>
  );
}

// ── MappingEditor ─────────────────────────────────────────────────────────────

function MappingEditor({
  form,
  onClose,
  onSaved,
}: {
  form: KlaviyoForm;
  onClose: () => void;
  onSaved: (updatedForm: KlaviyoForm) => void;
}) {
  const [mappings, setMappings] = useState<FieldMapping[]>(form.mappings ?? []);
  const [dealMappings, setDealMappings] = useState<FieldMapping[]>(form.deal_mappings ?? []);
  const [createDeal, setCreateDeal] = useState<boolean>(form.create_deal ?? false);
  const [createDealNewOnly, setCreateDealNewOnly] = useState<boolean>(form.create_deal_new_only ?? false);
  const [contactFields, setContactFields] = useState<ContactField[]>([]);
  const [dealFields, setDealFields] = useState<ContactField[]>([]);
  const [sources, setSources] = useState<SourceWithGroups[]>([]);
  const [loadingFields, setLoadingFields] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchFields = async () => {
      setLoadingFields(true);
      try {
        const [cRes, dRes, sRes] = await Promise.all([
          fetch("/api/contact-fields"),
          fetch("/api/deal-fields"),
          fetch("/api/sources"),
        ]);
        const cData = cRes.ok ? (await cRes.json()) as ContactField[] : [];
        const dData = dRes.ok ? (await dRes.json()) as ContactField[] : [];
        const sData = sRes.ok ? (await sRes.json()) as SourceWithGroups[] : [];
        // Builtins are not stored in ContactField/DealField tables — inject for mapping support
        const builtinSourceField: ContactField = {
          id: "__source__", field_key: "__source__", label: "★ Source (global field)", field_type: "builtin_source",
        };
        if (!cancelled) {
          setContactFields([builtinSourceField, ...cData]);
          setDealFields([builtinSourceField, ...dData]);
          setSources(sData);
        }
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoadingFields(false);
      }
    };
    void fetchFields();
    return () => { cancelled = true; };
  }, []);

  const updateContactRow = (i: number, field: keyof FieldMapping, value: string) =>
    setMappings((prev) => prev.map((m, idx) => idx === i ? { ...m, [field]: value } : m));
  const updateContactAttribs = (i: number, attribs: string[]) =>
    setMappings((prev) => prev.map((m, idx) => idx === i ? { ...m, static_attribute_ids: attribs } : m));
  const removeContactRow = (i: number) =>
    setMappings((prev) => prev.filter((_, idx) => idx !== i));

  const updateDealRow = (i: number, field: keyof FieldMapping, value: string) =>
    setDealMappings((prev) => prev.map((m, idx) => idx === i ? { ...m, [field]: value } : m));
  const updateDealAttribs = (i: number, attribs: string[]) =>
    setDealMappings((prev) => prev.map((m, idx) => idx === i ? { ...m, static_attribute_ids: attribs } : m));
  const removeDealRow = (i: number) =>
    setDealMappings((prev) => prev.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/klaviyo-forms/${form.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappings, create_deal: createDeal, create_deal_new_only: createDealNewOnly, deal_mappings: dealMappings }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to save");
      }
      const { form: updatedForm } = (await res.json()) as { form: KlaviyoForm };
      onSaved(updatedForm);
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const datalistId = `klaviyo-suggestions-${form.id}`;

  return (
    <div className="mt-2 border border-[#D8DCDE] rounded-lg bg-[#F8F9F9] p-4 space-y-4">
      <datalist id={datalistId}>
        {KLAVIYO_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
      </datalist>

      {/* ── Contact field mappings ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-[#2F3941] uppercase tracking-wide">Contact Fields</p>
          <button onClick={onClose} className="text-[#68717A] hover:text-[#2F3941] transition-colors" title="Close">
            <X size={13} />
          </button>
        </div>
        <MappingRows
          mappings={mappings}
          fields={contactFields}
          sources={sources}
          loadingFields={loadingFields}
          datalistId={datalistId}
          showTransform
          showStaticValue
          onUpdate={updateContactRow}
          onUpdateAttribs={updateContactAttribs}
          onRemove={removeContactRow}
        />
        <button
          onClick={() => setMappings((p) => [...p, { klaviyo_field: "", contact_field_key: "" }])}
          className="flex items-center gap-1 text-xs text-[#038153] font-medium hover:underline"
        >
          <Plus size={12} /> Add mapping
        </button>
      </div>

      {/* ── Deal creation toggle ── */}
      <div className="border-t border-[#D8DCDE] pt-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#2F3941] uppercase tracking-wide">Auto-create Deal</p>
            <p className="text-[11px] text-[#68717A] mt-0.5">Create a deal for every form submission</p>
          </div>
          <button
            onClick={() => setCreateDeal((v) => !v)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${createDeal ? "bg-[#038153]" : "bg-[#D8DCDE]"}`}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${createDeal ? "translate-x-4" : "translate-x-0.5"}`} />
          </button>
        </div>

        {createDeal && (
          <div className="space-y-3">
            {/* New-contact-only sub-option */}
            <div className="flex items-center justify-between rounded-md bg-white border border-[#D8DCDE] px-3 py-2">
              <div>
                <p className="text-xs font-medium text-[#2F3941]">Only for new contacts</p>
                <p className="text-[11px] text-[#68717A] mt-0.5">Skip deal creation when the contact already exists</p>
              </div>
              <button
                onClick={() => setCreateDealNewOnly((v) => !v)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${createDealNewOnly ? "bg-[#038153]" : "bg-[#D8DCDE]"}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${createDealNewOnly ? "translate-x-4" : "translate-x-0.5"}`} />
              </button>
            </div>

            <p className="text-[11px] font-medium text-[#68717A] uppercase tracking-wide">Deal Field Mappings</p>
            <MappingRows
              mappings={dealMappings}
              fields={dealFields}
              sources={sources}
              loadingFields={loadingFields}
              datalistId={datalistId}
              showStaticValue
              onUpdate={updateDealRow}
              onUpdateAttribs={updateDealAttribs}
              onRemove={removeDealRow}
            />
            <button
              onClick={() => setDealMappings((p) => [...p, { klaviyo_field: "", contact_field_key: "" }])}
              className="flex items-center gap-1 text-xs text-[#038153] font-medium hover:underline"
            >
              <Plus size={12} /> Add deal mapping
            </button>
          </div>
        )}
      </div>

      {/* Error */}
      {saveError && (
        <div className="flex items-center gap-2 bg-[#FFF0F1] border border-[#CC3340]/30 rounded-md px-3 py-2">
          <AlertTriangle size={13} className="text-[#CC3340] shrink-0" />
          <p className="text-xs text-[#CC3340]">{saveError}</p>
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-end gap-2 pt-1 border-t border-[#D8DCDE]">
        <button onClick={onClose} className="h-7 px-3 text-xs rounded-md border border-[#D8DCDE] text-[#68717A] hover:bg-[#F3F4F6] transition-colors">
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 h-7 px-3 text-xs rounded-md text-white hover:brightness-110 disabled:opacity-50 transition-all"
          style={{ background: "#038153" }}
        >
          {saving && <Loader2 size={11} className="animate-spin" />}
          Save
        </button>
      </div>
    </div>
  );
}

// ── Form row ──────────────────────────────────────────────────────────────────

function FormRow({
  form,
  platformSlug,
  onDelete,
  onUpdate,
}: {
  form: KlaviyoForm;
  platformSlug: string;
  onDelete: (form: KlaviyoForm) => void;
  onUpdate: (form: KlaviyoForm) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showMapping, setShowMapping] = useState(false);

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/webhooks/klaviyo/${platformSlug}/${form.token}`
      : `/api/webhooks/klaviyo/${platformSlug}/${form.token}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const mappingCount = form.mappings?.length ?? 0;

  return (
    <div className="bg-white rounded-lg border border-[#D8DCDE] px-4 py-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[#2F3941] truncate">{form.name}</p>

        <div className="flex items-center gap-1 shrink-0">
          {/* Configure button */}
          <button
            onClick={() => setShowMapping((v) => !v)}
            title="Configure field mappings"
            className={`h-7 flex items-center gap-1 px-2 rounded-md text-xs transition-colors ${
              showMapping
                ? "bg-[#EAF7F0] text-[#038153] border border-[#038153]/30"
                : "border border-[#D8DCDE] text-[#68717A] hover:bg-[#F3F4F6] hover:text-[#2F3941]"
            }`}
          >
            <Settings2 size={12} />
            <span>
              {mappingCount > 0
                ? `${mappingCount} mapping${mappingCount !== 1 ? "s" : ""}`
                : "Configure"}
            </span>
          </button>

          {confirmDelete ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[#68717A]">Delete?</span>
              <button
                onClick={() => onDelete(form)}
                className="h-6 px-2.5 text-xs rounded-md text-white hover:brightness-110 transition-all"
                style={{ background: "#CC3340" }}
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="h-6 px-2.5 text-xs rounded-md border border-[#D8DCDE] text-[#68717A] hover:bg-[#F3F4F6] transition-colors"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              title="Delete form"
              className="w-7 h-7 flex items-center justify-center rounded-md text-[#68717A] hover:bg-[#FFF0F1] hover:text-[#CC3340] transition-colors"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <code className="flex-1 min-w-0 block bg-[#F8F9F9] border border-[#D8DCDE] rounded-md px-2.5 py-1.5 text-xs text-[#2F3941] font-mono truncate">
          {webhookUrl}
        </code>
        <button
          onClick={handleCopy}
          title="Copy webhook URL"
          className={`w-7 h-7 shrink-0 flex items-center justify-center rounded-md border transition-colors ${
            copied
              ? "border-[#038153] bg-[#EAF7F0] text-[#038153]"
              : "border-[#D8DCDE] text-[#68717A] hover:bg-[#F3F4F6] hover:text-[#2F3941]"
          }`}
        >
          {copied ? <CheckCheck size={13} /> : <Copy size={13} />}
        </button>
      </div>

      {/* Inline mapping editor */}
      {showMapping && (
        <MappingEditor
          form={form}
          onClose={() => setShowMapping(false)}
          onSaved={(updatedForm) => {
            onUpdate(updatedForm);
            setShowMapping(false);
          }}
        />
      )}
    </div>
  );
}

// ── Add form panel ─────────────────────────────────────────────────────────────

function AddFormPanel({
  onSave,
  onCancel,
  saving,
  error,
}: {
  onSave: (name: string) => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
}) {
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) onSave(name.trim());
  };

  return (
    <div className="bg-white rounded-xl border border-[#D8DCDE] shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#2F3941]">New Klaviyo Form</h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-[#68717A] hover:text-[#2F3941] transition-colors"
        >
          <X size={15} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-[#68717A]">Form name</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Newsletter Signup"
            className="w-full h-8 px-3 text-sm rounded-md border border-[#D8DCDE] text-[#2F3941] placeholder-[#C2C8CC] focus:outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153] transition-colors"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-[#FFF0F1] border border-[#CC3340]/30 rounded-md px-3 py-2">
            <AlertTriangle size={13} className="text-[#CC3340] shrink-0" />
            <p className="text-xs text-[#CC3340]">{error}</p>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-8 px-4 text-sm rounded-md border border-[#D8DCDE] text-[#68717A] hover:bg-[#F3F4F6] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="flex items-center gap-1.5 h-8 px-4 text-sm rounded-md text-white hover:brightness-110 disabled:opacity-50 transition-all"
            style={{ background: "#038153" }}
          >
            {saving && <Loader2 size={12} className="animate-spin" />}
            Create Form
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function KlaviyoFormsManager() {
  const params = useParams();
  const platformSlug = typeof params.platform === "string" ? params.platform : "";

  const [platformId, setPlatformId] = useState<string | null>(null);
  const [forms, setForms] = useState<KlaviyoForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Load platform ID then forms ──────────────────────────────────────────────

  const loadForms = useCallback(async (pid: string) => {
    try {
      const res = await fetch(`/api/platforms/${pid}/klaviyo-forms`);
      if (!res.ok) throw new Error("Failed to load forms");
      const data = (await res.json()) as { forms: KlaviyoForm[] };
      setForms(data.forms);
    } catch {
      setLoadError("Failed to load Klaviyo forms.");
    }
  }, []);

  useEffect(() => {
    if (!platformSlug) return;

    let cancelled = false;

    const init = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch("/api/platforms");
        if (!res.ok) throw new Error("Failed to load platforms");
        const data = await res.json();
        const platforms: Platform[] = data.platforms ?? data;
        const match = platforms.find((p) => p.slug === platformSlug);
        if (!match) throw new Error(`Platform "${platformSlug}" not found`);
        if (cancelled) return;
        setPlatformId(match.id);
        await loadForms(match.id);
      } catch (err: unknown) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to initialise.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void init();
    return () => { cancelled = true; };
  }, [platformSlug, loadForms]);

  // ── Add form ─────────────────────────────────────────────────────────────────

  const handleAddForm = async (name: string) => {
    if (!platformId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/platforms/${platformId}/klaviyo-forms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to create form");
      }
      setShowAddForm(false);
      await loadForms(platformId);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Failed to create form");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete form ───────────────────────────────────────────────────────────────

  const handleDelete = async (form: KlaviyoForm) => {
    try {
      await fetch(`/api/klaviyo-forms/${form.id}`, { method: "DELETE" });
      setForms((prev) => prev.filter((f) => f.id !== form.id));
    } catch {
      /* ignore */
    }
  };

  // ── Update form (after mapping save) ─────────────────────────────────────────

  const handleUpdate = (updatedForm: KlaviyoForm) => {
    setForms((prev) =>
      prev.map((f) => (f.id === updatedForm.id ? updatedForm : f))
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={20} className="animate-spin text-[#68717A]" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex items-center gap-3 bg-[#FFF0F1] border border-[#CC3340]/30 rounded-xl px-4 py-3">
        <AlertTriangle size={16} className="text-[#CC3340] shrink-0" />
        <p className="text-sm text-[#CC3340]">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex justify-end">
        <button
          onClick={() => { setSaveError(null); setShowAddForm(true); }}
          className="flex items-center gap-1.5 h-8 px-3 text-sm font-medium rounded-md text-white hover:brightness-110 transition-all"
          style={{ background: "#038153" }}
        >
          <Plus size={14} /> Add Form
        </button>
      </div>

      {/* Empty state */}
      {forms.length === 0 && !showAddForm && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Webhook size={32} className="text-[#C2C8CC] mb-3" />
          <p className="text-sm font-medium text-[#68717A]">No forms yet</p>
          <p className="text-xs text-[#C2C8CC] mt-1">
            Add a Klaviyo form to get a webhook URL for syncing submissions.
          </p>
        </div>
      )}

      {/* Form list */}
      {forms.map((form) => (
        <FormRow
          key={form.id}
          form={form}
          platformSlug={platformSlug}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
        />
      ))}

      {/* Add form panel */}
      {showAddForm && (
        <AddFormPanel
          onSave={handleAddForm}
          onCancel={() => { setShowAddForm(false); setSaveError(null); }}
          saving={saving}
          error={saveError}
        />
      )}
    </div>
  );
}
