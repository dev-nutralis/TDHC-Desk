"use client";

import { useEffect, useState, useRef } from "react";
import {
  GripVertical,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  ChevronDown,
  Loader2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FieldConfig {
  field_key: string;
  label: string;
  field_type: string;
  is_visible: boolean;
  has_notes: boolean;
}

interface AvailableField {
  field_key: string;
  label: string;
  field_type: string;
}

// ---------------------------------------------------------------------------
// Field type display labels
// ---------------------------------------------------------------------------

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: "Text",
  multi_phone: "Multi Phone",
  multi_email: "Multi Email",
  radio: "Radio",
  select: "Dropdown",
  date: "Date",
  boolean: "Yes / No",
  builtin_source: "Source",
  builtin_date: "Date",
  source_flow: "Source Flow",
};

// ---------------------------------------------------------------------------
// FieldRow
// ---------------------------------------------------------------------------

interface FieldRowProps {
  field: FieldConfig;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
  onToggleVisible: () => void;
  onRemove: () => void;
}

function FieldRow({
  field,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onToggleVisible,
  onRemove,
}: FieldRowProps) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={[
        "flex items-center gap-2 px-2 py-2 rounded-lg group transition-all",
        "bg-white hover:bg-[#F8F9F9] border border-transparent",
        isDragging ? "opacity-50" : "opacity-100",
        isDragOver ? "border-t-2 !border-t-[#1D6FA4]" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Drag handle */}
      <GripVertical
        size={15}
        className="text-[#C2C8CC] shrink-0 cursor-grab"
      />

      {/* Label */}
      <span className="flex-1 text-sm text-[#2F3941] truncate">
        {field.label}
      </span>

      {/* Type badge */}
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F3F4F6] text-[#68717A] shrink-0">
        {FIELD_TYPE_LABELS[field.field_type] ?? field.field_type}
      </span>

      {/* Visibility toggle */}
      <button
        type="button"
        onClick={onToggleVisible}
        className="w-7 h-7 rounded-md flex items-center justify-center text-[#68717A] hover:bg-[#F3F4F6] transition-colors shrink-0"
        title={field.is_visible ? "Hide field" : "Show field"}
      >
        {field.is_visible ? <Eye size={14} /> : <EyeOff size={14} />}
      </button>

      {/* Remove */}
      <button
        type="button"
        onClick={onRemove}
        className="w-7 h-7 rounded-md flex items-center justify-center text-[#C2C8CC] hover:text-[#CC3340] hover:bg-[#FFF0F1] transition-colors shrink-0"
        title="Remove field"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AddFieldDropdown
// ---------------------------------------------------------------------------

interface AddFieldDropdownProps {
  available: AvailableField[];
  onAdd: (field: AvailableField) => void;
}

function AddFieldDropdown({ available, onAdd }: AddFieldDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (available.length === 0) return null;

  return (
    <div ref={ref} className="relative mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-xs text-[#1D6FA4] hover:text-[#155a87] font-medium px-1 py-0.5 rounded transition-colors"
      >
        <Plus size={12} />
        Add field
        <ChevronDown
          size={11}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 w-56 bg-white border border-[#D8DCDE] rounded-lg shadow-lg overflow-hidden">
          <div className="py-1 max-h-52 overflow-y-auto">
            {available.map((f) => (
              <button
                key={f.field_key}
                type="button"
                onClick={() => {
                  onAdd(f);
                  setOpen(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-[#2F3941] hover:bg-[#F3F4F6] transition-colors text-left"
              >
                <span>{f.label}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F3F4F6] text-[#68717A] ml-2 shrink-0">
                  {FIELD_TYPE_LABELS[f.field_type] ?? f.field_type}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SectionColumn
// ---------------------------------------------------------------------------

interface SectionColumnProps {
  title: string;
  section: "deal_info" | "details";
  fields: FieldConfig[];
  available: AvailableField[];
  draggingKey: string | null;
  dragOverKey: string | null;
  dragOverSection: string | null;
  onDragStart: (key: string, section: string) => void;
  onDragOver: (e: React.DragEvent, key: string | null, section: string) => void;
  onDrop: (targetKey: string | null, targetSection: string) => void;
  onDragEnd: () => void;
  onToggleVisible: (section: "deal_info" | "details", key: string) => void;
  onRemove: (section: "deal_info" | "details", key: string) => void;
  onAdd: (field: AvailableField, section: "deal_info" | "details") => void;
}

function SectionColumn({
  title,
  section,
  fields,
  available,
  draggingKey,
  dragOverKey,
  dragOverSection,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onToggleVisible,
  onRemove,
  onAdd,
}: SectionColumnProps) {
  return (
    <div className="flex-1 min-w-0 bg-white border border-[#D8DCDE] rounded-xl shadow-sm p-4 flex flex-col">
      {/* Header */}
      <p className="text-sm font-semibold text-[#2F3941] mb-3">{title}</p>

      {/* Drop zone for empty column */}
      <div
        className="flex-1 flex flex-col"
        onDragOver={(e) => {
          if (fields.length === 0) {
            e.preventDefault();
            onDragOver(e, null, section);
          }
        }}
        onDrop={() => {
          if (fields.length === 0) onDrop(null, section);
        }}
      >
        {fields.length === 0 && (
          <div
            className={[
              "flex-1 min-h-[60px] rounded-lg border-2 border-dashed transition-colors",
              dragOverSection === section && dragOverKey === null
                ? "border-[#1D6FA4] bg-[#EFF6FF]"
                : "border-[#D8DCDE]",
            ].join(" ")}
          />
        )}

        {fields.map((field) => (
          <FieldRow
            key={field.field_key}
            field={field}
            isDragging={draggingKey === field.field_key}
            isDragOver={
              dragOverKey === field.field_key &&
              dragOverSection === section
            }
            onDragStart={() => onDragStart(field.field_key, section)}
            onDragOver={(e) => onDragOver(e, field.field_key, section)}
            onDrop={() => onDrop(field.field_key, section)}
            onDragEnd={onDragEnd}
            onToggleVisible={() => onToggleVisible(section, field.field_key)}
            onRemove={() => onRemove(section, field.field_key)}
          />
        ))}
      </div>

      {/* Add field */}
      <AddFieldDropdown
        available={available}
        onAdd={(f) => onAdd(f, section)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function DealProfileLayoutPage() {
  const [dealInfoFields, setDealInfoFields] = useState<FieldConfig[]>([]);
  const [detailFields, setDetailFields] = useState<FieldConfig[]>([]);
  const [available, setAvailable] = useState<AvailableField[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Drag state
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [draggingSection, setDraggingSection] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [dragOverSection, setDragOverSection] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Load
  // ---------------------------------------------------------------------------

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/deal-profile-fields");
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`API error ${res.status}: ${text}`);
      }
      const data = await res.json();

      const di: FieldConfig[] = data.configs
        .filter((c: { section: string }) => c.section === "deal_info")
        .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
        .map((c: { field_key: string; label: string; field_type: string; is_visible: boolean; has_notes: boolean }) => ({
          field_key: c.field_key,
          label: c.label,
          field_type: c.field_type,
          is_visible: c.is_visible,
          has_notes: c.has_notes,
        }));

      const det: FieldConfig[] = data.configs
        .filter((c: { section: string }) => c.section === "details")
        .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
        .map((c: { field_key: string; label: string; field_type: string; is_visible: boolean; has_notes: boolean }) => ({
          field_key: c.field_key,
          label: c.label,
          field_type: c.field_type,
          is_visible: c.is_visible,
          has_notes: c.has_notes,
        }));

      setDealInfoFields(di);
      setDetailFields(det);
      setAvailable(data.available ?? []);
      setIsDirty(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function getFields(section: "deal_info" | "details") {
    return section === "deal_info" ? dealInfoFields : detailFields;
  }

  function setFields(
    section: "deal_info" | "details",
    updater: (prev: FieldConfig[]) => FieldConfig[]
  ) {
    if (section === "deal_info") {
      setDealInfoFields(updater);
    } else {
      setDetailFields(updater);
    }
    setIsDirty(true);
  }

  // ---------------------------------------------------------------------------
  // Drag & drop handlers
  // ---------------------------------------------------------------------------

  function handleDragStart(key: string, section: string) {
    setDraggingKey(key);
    setDraggingSection(section);
  }

  function handleDragOver(
    e: React.DragEvent,
    key: string | null,
    section: string
  ) {
    e.preventDefault();
    setDragOverKey(key);
    setDragOverSection(section);
  }

  function handleDrop(targetKey: string | null, targetSection: string) {
    if (!draggingKey || !draggingSection) return;

    const sourceSection = draggingSection as "deal_info" | "details";
    const destSection = targetSection as "deal_info" | "details";

    if (sourceSection === destSection) {
      // Reorder within same section
      setFields(sourceSection, (prev) => {
        const srcIdx = prev.findIndex((f) => f.field_key === draggingKey);
        if (srcIdx === -1) return prev;

        const destIdx =
          targetKey === null
            ? prev.length
            : prev.findIndex((f) => f.field_key === targetKey);
        if (destIdx === -1 || destIdx === srcIdx) return prev;

        const next = [...prev];
        const [moved] = next.splice(srcIdx, 1);
        const insertAt = destIdx > srcIdx ? destIdx - 1 : destIdx;
        next.splice(insertAt, 0, moved);
        return next;
      });
    } else {
      // Move between sections
      const sourceFields = getFields(sourceSection);
      const movedField = sourceFields.find((f) => f.field_key === draggingKey);
      if (!movedField) return;

      // Remove from source
      setFields(sourceSection, (prev) =>
        prev.filter((f) => f.field_key !== draggingKey)
      );

      // Insert into dest at target position
      setFields(destSection, (prev) => {
        const next = [...prev];
        const destIdx =
          targetKey === null
            ? next.length
            : next.findIndex((f) => f.field_key === targetKey);
        next.splice(destIdx === -1 ? next.length : destIdx, 0, movedField);
        return next;
      });
    }

    setDraggingKey(null);
    setDraggingSection(null);
    setDragOverKey(null);
    setDragOverSection(null);
  }

  function handleDragEnd() {
    setDraggingKey(null);
    setDraggingSection(null);
    setDragOverKey(null);
    setDragOverSection(null);
  }

  // ---------------------------------------------------------------------------
  // Toggle visibility
  // ---------------------------------------------------------------------------

  function handleToggleVisible(
    section: "deal_info" | "details",
    key: string
  ) {
    setFields(section, (prev) =>
      prev.map((f) =>
        f.field_key === key ? { ...f, is_visible: !f.is_visible } : f
      )
    );
  }

  // ---------------------------------------------------------------------------
  // Remove field (moves back to available)
  // ---------------------------------------------------------------------------

  function handleRemove(section: "deal_info" | "details", key: string) {
    const fields = getFields(section);
    const field = fields.find((f) => f.field_key === key);
    if (!field) return;

    setFields(section, (prev) => prev.filter((f) => f.field_key !== key));
    setAvailable((prev) => [
      ...prev,
      { field_key: field.field_key, label: field.label, field_type: field.field_type },
    ]);
    setIsDirty(true);
  }

  // ---------------------------------------------------------------------------
  // Add field from available pool
  // ---------------------------------------------------------------------------

  function handleAdd(
    field: AvailableField,
    section: "deal_info" | "details"
  ) {
    setAvailable((prev) => prev.filter((f) => f.field_key !== field.field_key));
    setFields(section, (prev) => [
      ...prev,
      {
        field_key: field.field_key,
        label: field.label,
        field_type: field.field_type,
        is_visible: true,
        has_notes: false,
      },
    ]);
    setIsDirty(true);
  }

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  async function handleSave() {
    setSaving(true);
    try {
      const configs = [
        ...dealInfoFields.map((f, i) => ({
          field_key: f.field_key,
          section: "deal_info" as const,
          sort_order: i,
          is_visible: f.is_visible,
        })),
        ...detailFields.map((f, i) => ({
          field_key: f.field_key,
          section: "details" as const,
          sort_order: i,
          is_visible: f.is_visible,
        })),
      ];

      const res = await fetch("/api/deal-profile-fields", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configs }),
      });

      if (res.ok) {
        setIsDirty(false);
      }
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setIsDirty(false);
    load();
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-[#2F3941]">
          Deal Profile Layout
        </h1>
        <p className="text-sm text-[#68717A] mt-1">
          Configure which fields appear on the Deal Detail page and how they
          are arranged.
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={20} className="animate-spin text-[#68717A]" />
        </div>
      )}

      {/* Two-column layout */}
      {!loading && (
        <div className="flex gap-4 items-start flex-1">
          <SectionColumn
            title="Deal Information"
            section="deal_info"
            fields={dealInfoFields}
            available={available}
            draggingKey={draggingKey}
            dragOverKey={dragOverKey}
            dragOverSection={dragOverSection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            onToggleVisible={handleToggleVisible}
            onRemove={handleRemove}
            onAdd={handleAdd}
          />

          <SectionColumn
            title="Details"
            section="details"
            fields={detailFields}
            available={available}
            draggingKey={draggingKey}
            dragOverKey={dragOverKey}
            dragOverSection={dragOverSection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            onToggleVisible={handleToggleVisible}
            onRemove={handleRemove}
            onAdd={handleAdd}
          />
        </div>
      )}

      {/* Floating save bar */}
      {isDirty && (
        <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-end gap-2 px-6 py-3 bg-white border-t border-[#D8DCDE] shadow-lg">
          <button
            type="button"
            onClick={handleReset}
            disabled={saving}
            className="h-8 px-4 text-sm font-medium rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] hover:bg-[#F3F4F6] disabled:opacity-50 transition-colors"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 h-8 px-4 text-sm font-medium rounded-md text-white disabled:opacity-70 transition-all hover:brightness-110"
            style={{ background: "#038153" }}
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            Save changes
          </button>
        </div>
      )}
    </div>
  );
}
