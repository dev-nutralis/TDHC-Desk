"use client";

import { useState, useEffect, useCallback } from "react";
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

interface FieldMapping {
  klaviyo_field: string;
  contact_field_key: string;
}

interface KlaviyoForm {
  id: string;
  name: string;
  token: string;
  created_at: string;
  platform_id: string;
  mappings: FieldMapping[];
}

interface ContactField {
  id: string;
  field_key: string;
  label: string;
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
];

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
  const [mappings, setMappings] = useState<FieldMapping[]>(
    form.mappings?.length ? form.mappings : []
  );
  const [contactFields, setContactFields] = useState<ContactField[]>([]);
  const [loadingFields, setLoadingFields] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchFields = async () => {
      setLoadingFields(true);
      try {
        const res = await fetch("/api/contact-fields");
        if (!res.ok) throw new Error("Failed to load contact fields");
        const data = (await res.json()) as ContactField[];
        if (!cancelled) setContactFields(data);
      } catch {
        // silently fail — user can still type field_key manually
      } finally {
        if (!cancelled) setLoadingFields(false);
      }
    };
    void fetchFields();
    return () => { cancelled = true; };
  }, []);

  const addRow = () => {
    setMappings((prev) => [...prev, { klaviyo_field: "", contact_field_key: "" }]);
  };

  const removeRow = (index: number) => {
    setMappings((prev) => prev.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, field: keyof FieldMapping, value: string) => {
    setMappings((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/klaviyo-forms/${form.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappings }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to save mappings");
      }
      const { form: updatedForm } = (await res.json()) as { form: KlaviyoForm };
      onSaved(updatedForm);
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save mappings");
    } finally {
      setSaving(false);
    }
  };

  const datalistId = `klaviyo-suggestions-${form.id}`;

  return (
    <div className="mt-2 border border-[#D8DCDE] rounded-lg bg-[#F8F9F9] p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-[#2F3941] uppercase tracking-wide">
          Field Mappings
        </p>
        <button
          onClick={onClose}
          className="text-[#68717A] hover:text-[#2F3941] transition-colors"
          title="Close"
        >
          <X size={13} />
        </button>
      </div>

      {/* Datalist for Klaviyo field suggestions */}
      <datalist id={datalistId}>
        {KLAVIYO_SUGGESTIONS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      {/* Column labels */}
      {mappings.length > 0 && (
        <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-center">
          <span className="text-[10px] font-medium text-[#68717A] uppercase tracking-wide">
            Klaviyo field
          </span>
          <span />
          <span className="text-[10px] font-medium text-[#68717A] uppercase tracking-wide">
            Contact field
          </span>
          <span />
        </div>
      )}

      {/* Mapping rows */}
      <div className="space-y-2">
        {mappings.map((mapping, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-center"
          >
            {/* Klaviyo field — text input + datalist */}
            <input
              type="text"
              list={datalistId}
              value={mapping.klaviyo_field}
              onChange={(e) => updateRow(i, "klaviyo_field", e.target.value)}
              placeholder="e.g. email or properties.city"
              className="h-8 px-3 text-sm rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] placeholder-[#C2C8CC] focus:outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153] transition-colors"
            />

            {/* Arrow */}
            <span className="text-[#C2C8CC] text-xs select-none">→</span>

            {/* Contact field — select */}
            <div className="relative">
              <select
                value={mapping.contact_field_key}
                onChange={(e) => updateRow(i, "contact_field_key", e.target.value)}
                className="w-full h-8 pl-3 pr-7 text-sm rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] focus:outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153] appearance-none transition-colors"
              >
                <option value="">
                  {loadingFields ? "Loading…" : "Select field"}
                </option>
                {contactFields.map((f) => (
                  <option key={f.field_key} value={f.field_key}>
                    {f.label} ({f.field_key})
                  </option>
                ))}
              </select>
              <ChevronDown
                size={12}
                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#68717A]"
              />
            </div>

            {/* Delete row */}
            <button
              onClick={() => removeRow(i)}
              title="Remove mapping"
              className="w-7 h-7 flex items-center justify-center rounded-md text-[#68717A] hover:bg-[#FFF0F1] hover:text-[#CC3340] transition-colors"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {mappings.length === 0 && (
        <p className="text-xs text-[#C2C8CC] text-center py-2">
          No mappings yet. Add one below.
        </p>
      )}

      {/* Error */}
      {saveError && (
        <div className="flex items-center gap-2 bg-[#FFF0F1] border border-[#CC3340]/30 rounded-md px-3 py-2">
          <AlertTriangle size={13} className="text-[#CC3340] shrink-0" />
          <p className="text-xs text-[#CC3340]">{saveError}</p>
        </div>
      )}

      {/* Footer actions */}
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={addRow}
          className="flex items-center gap-1 text-xs text-[#038153] font-medium hover:underline transition-all"
        >
          <Plus size={12} /> Add mapping
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="h-7 px-3 text-xs rounded-md border border-[#D8DCDE] text-[#68717A] hover:bg-[#F3F4F6] transition-colors"
          >
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
