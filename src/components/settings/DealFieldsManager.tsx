"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Eye, Trash2, GripVertical, Loader2, AlertTriangle, X, LayoutList, Download, Link2 } from "lucide-react";
import ContactFieldModal from "./ContactFieldModal";
import ImportDealFieldsModal from "./ImportDealFieldsModal";
import SourceFieldRow, { AddSourceFieldButton } from "./SourceFieldSection";
import { useSourceField } from "@/hooks/useSourceField";

interface DealFieldOption { id: string; label: string; value: string; sort_order: number; }
interface DealField {
  id: string; label: string; field_key: string; field_type: string;
  sort_order: number; is_required: boolean; is_active: boolean;
  is_filterable: boolean; config: string | null;
  source_module: string | null; source_field_id: string | null;
  options: DealFieldOption[];
}

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: "Text", textarea: "Textarea", date: "Date", datetime: "Date & Time",
  boolean: "Yes / No", radio: "Radio", select: "Dropdown",
  multi_phone: "Multi Phone", multi_email: "Multi Email",
  conditional_select: "Conditional", source_flow: "Source Flow",
  serial_id: "ID Number",
};

const MODULE_LABELS: Record<string, string> = {
  leads: "Leads",
  contacts: "Contacts",
};

const OPTION_TYPES = new Set(["radio", "select"]);

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={onChange}
      className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
      style={{ background: checked ? "#038153" : "#D8DCDE" }}>
      <span className="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200"
        style={{ transform: checked ? "translateX(16px)" : "translateX(0)" }} />
    </button>
  );
}

function DeleteConfirm({ field, onClose, onConfirm }: { field: DealField; onClose: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-white rounded-xl overflow-hidden" style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.18)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#D8DCDE]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#FFF0F1] flex items-center justify-center"><AlertTriangle size={15} className="text-[#CC3340]" /></div>
            <h2 className="text-[14px] font-semibold text-[#2F3941]">Delete Field</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-md flex items-center justify-center text-[#68717A] hover:bg-[#F3F4F6]"><X size={15} /></button>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-[#68717A]">Delete field <span className="font-semibold text-[#2F3941]">"{field.label}"</span>? This cannot be undone.</p>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#D8DCDE] bg-[#F8F9F9]">
          <button onClick={onClose} className="h-8 px-4 text-sm font-medium rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] hover:bg-[#F3F4F6]">Cancel</button>
          <button onClick={onConfirm} className="h-8 px-4 text-sm font-medium rounded-md text-white hover:brightness-110" style={{ background: "#CC3340" }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

type Item =
  | { type: "field"; field: DealField }
  | { type: "source" };

export default function DealFieldsManager() {
  const [fields, setFields] = useState<DealField[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editField, setEditField] = useState<DealField | null>(null);
  const [viewField, setViewField] = useState<DealField | null>(null);
  const [deleteField, setDeleteField] = useState<DealField | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const source = useSourceField("deal");

  const fetchFields = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/deal-fields");
    setFields(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchFields(); }, [fetchFields]);

  useEffect(() => {
    const h = () => fetchFields();
    window.addEventListener("source-field-changed", h);
    return () => window.removeEventListener("source-field-changed", h);
  }, [fetchFields]);

  const items: Item[] = (() => {
    const arr: Item[] = fields.map(f => ({ type: "field" as const, field: f }));
    if (source.enabled) {
      const insertAt = Math.max(0, Math.min(source.sortOrder, arr.length));
      arr.splice(insertAt, 0, { type: "source" as const });
    }
    return arr;
  })();

  const handleDelete = async (id: string) => { await fetch(`/api/deal-fields/${id}`, { method: "DELETE" }); fetchFields(); };

  const handleToggleActive = async (field: DealField) => {
    setTogglingId(field.id);
    await fetch(`/api/deal-fields/${field.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_active: !field.is_active }) });
    await fetchFields();
    setTogglingId(null);
  };

  const openEdit = (field: DealField) => {
    setEditField(field);
    setModalOpen(true);
  };

  const openView = (field: DealField) => {
    setViewField(field);
  };

  const handleDragStart = (e: React.DragEvent, idx: number) => { setDragIdx(idx); e.dataTransfer.effectAllowed = "move"; };
  const handleDragOver  = (e: React.DragEvent, idx: number) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragOverIdx !== idx) setDragOverIdx(idx); };
  const handleDragEnd   = () => { setDragIdx(null); setDragOverIdx(null); };

  const handleDrop = async (e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === dropIdx) { setDragIdx(null); setDragOverIdx(null); return; }

    const newItems = [...items];
    const [moved] = newItems.splice(dragIdx, 1);
    newItems.splice(dropIdx, 0, moved);

    const newSourceIdx = newItems.findIndex(it => it.type === "source");
    const newFields: DealField[] = newItems
      .map((it, i) => {
        if (it.type !== "field") return null;
        const offset = (newSourceIdx !== -1 && i > newSourceIdx) ? 1 : 0;
        return { ...it.field, sort_order: i - offset };
      })
      .filter((f): f is DealField => f !== null);

    setFields(newFields);
    setDragIdx(null); setDragOverIdx(null);

    const promises: Promise<unknown>[] = newFields.map(f =>
      fetch(`/api/deal-fields/${f.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sort_order: f.sort_order }) })
    );
    if (newSourceIdx !== -1 && source.enabled && newSourceIdx !== source.sortOrder) {
      promises.push(source.updateSortOrder(newSourceIdx));
    }
    await Promise.all(promises);
  };

  const existingFieldKeys = fields.map(f => f.field_key);

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        <AddSourceFieldButton module="deal" />
        <button
          onClick={() => setImportOpen(true)}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-sm font-medium border border-[#D8DCDE] text-[#68717A] bg-white hover:bg-[#F3F4F6] transition-all"
        >
          <Download size={13} /> Import from module
        </button>
        <button onClick={() => { setEditField(null); setModalOpen(true); }}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-sm font-medium text-white hover:brightness-110 transition-all"
          style={{ background: "#038153" }}>
          <Plus size={14} /> Add Field
        </button>
      </div>

      <div className="bg-white rounded-lg border border-[#D8DCDE] overflow-hidden shadow-sm">
        {loading && <div className="flex items-center justify-center h-40"><Loader2 size={18} className="animate-spin text-[#68717A]" /></div>}

        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center gap-2 h-40 justify-center text-[#68717A]">
            <LayoutList size={28} strokeWidth={1.2} />
            <p className="text-sm font-medium">No fields defined yet.</p>
          </div>
        )}

        {!loading && items.map((it, idx) => {
          const isOver = dragOverIdx === idx && dragIdx !== idx;
          const isDragging = dragIdx === idx;

          if (it.type === "source") {
            return (
              <SourceFieldRow
                key="__source__"
                module="deal"
                isDragging={isDragging}
                isDragOver={isOver}
                onDragStart={e => handleDragStart(e, idx)}
                onDragOver={e => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                onDrop={e => handleDrop(e, idx)}
              />
            );
          }

          const field = it.field;
          const isLinked = !!field.source_module;
          const moduleLabel = field.source_module ? (MODULE_LABELS[field.source_module] ?? field.source_module) : null;

          return (
            <div key={field.id} draggable onDragStart={e => handleDragStart(e, idx)} onDragOver={e => handleDragOver(e, idx)} onDragEnd={handleDragEnd} onDrop={e => handleDrop(e, idx)}
              className={["flex items-center gap-3 px-4 py-3 transition-colors group", idx < items.length - 1 ? "border-b border-[#D8DCDE]" : "", isDragging ? "opacity-40 bg-[#F8F9F9]" : "hover:bg-[#F8F9F9]", isOver ? "border-t-2 border-t-[#038153]" : ""].join(" ")}>
              <GripVertical size={15} className="text-[#C2C8CC] shrink-0 cursor-grab active:cursor-grabbing hover:text-[#68717A] transition-colors" />
              <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-[#2F3941]">{field.label}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F3F4F6] border border-[#D8DCDE] text-[#68717A] font-medium">{FIELD_TYPE_LABELS[field.field_type] ?? field.field_type}</span>
                {field.is_required && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FFF4EC] border border-[#FDDCB5] text-[#B35A00] font-medium">Required</span>}
                {OPTION_TYPES.has(field.field_type) && <span className="text-[11px] text-[#68717A]">{field.options.length} {field.options.length === 1 ? "option" : "options"}</span>}
                {isLinked && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-[#EAF7F0] border border-[#B7E5D0] text-[#038153] font-medium">
                    <Link2 size={9} /> Linked · {moduleLabel}
                  </span>
                )}
              </div>
              <div className="shrink-0 flex items-center gap-1.5">
                {togglingId === field.id ? <Loader2 size={14} className="animate-spin text-[#68717A]" /> : <Toggle checked={field.is_active} onChange={() => handleToggleActive(field)} />}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                {isLinked ? (
                  <button onClick={() => openView(field)} className="w-8 h-8 rounded-md flex items-center justify-center text-[#68717A] hover:bg-[#F3F4F6] hover:text-[#2F3941] transition-colors"><Eye size={14} /></button>
                ) : (
                  <button onClick={() => openEdit(field)} className="w-8 h-8 rounded-md flex items-center justify-center text-[#68717A] hover:bg-[#F3F4F6] hover:text-[#2F3941] transition-colors"><Pencil size={14} /></button>
                )}
                <button onClick={() => setDeleteField(field)} className="w-8 h-8 rounded-md flex items-center justify-center text-[#68717A] hover:bg-[#FFF0F1] hover:text-[#CC3340] transition-colors"><Trash2 size={14} /></button>
              </div>
            </div>
          );
        })}
      </div>

      <ContactFieldModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={fetchFields}
        field={editField}
        apiBase="/api/deal-fields"
        moduleLabel="deal"
      />
      <ContactFieldModal
        open={!!viewField}
        onClose={() => setViewField(null)}
        onSaved={() => {}}
        field={viewField as Parameters<typeof ContactFieldModal>[0]["field"]}
        apiBase="/api/deal-fields"
        moduleLabel="deal"
        viewOnly
        sourceModuleLabel={viewField?.source_module === "contacts" ? "Contacts" : "Leads"}
      />
      {deleteField && <DeleteConfirm field={deleteField} onClose={() => setDeleteField(null)} onConfirm={() => { handleDelete(deleteField.id); setDeleteField(null); }} />}
      <ImportDealFieldsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={fetchFields}
        existingFieldKeys={existingFieldKeys}
      />
    </div>
  );
}
