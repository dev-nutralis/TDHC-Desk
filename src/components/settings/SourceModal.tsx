"use client";

import { useEffect, useState, useRef } from "react";
import { X, Plus, Trash2, Loader2, Pencil, Copy, Check, GripVertical } from "lucide-react";

interface Item { id?: string; label: string; sort_order?: number; }
interface AttributeGroup { id?: string; name: string; sort_order?: number; items: Item[]; }

interface SourceForm {
  id?: string;
  name: string;
  attribute_groups: AttributeGroup[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: SourceForm) => Promise<void>;
  source?: SourceForm | null;
}

const emptyForm: SourceForm = { name: "", attribute_groups: [] };

// ── Item list inside a group ──────────────────────────────────────────────────
function ItemList({ items, onChange }: { items: Item[]; onChange: (items: Item[]) => void }) {
  const [input, setInput] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const editRef = useRef<HTMLInputElement>(null);

  const add = () => {
    const v = input.trim();
    if (!v) return;
    onChange([...items, { label: v }]);
    setInput("");
  };

  const remove = (idx: number) => {
    if (editingIdx === idx) setEditingIdx(null);
    onChange(items.filter((_, i) => i !== idx));
  };

  const duplicate = (idx: number) => {
    const copy = { ...items[idx], id: undefined };
    const next = [...items];
    next.splice(idx + 1, 0, copy);
    onChange(next);
  };

  const startEdit = (idx: number) => {
    setEditingIdx(idx);
    setEditingValue(items[idx].label);
    setTimeout(() => editRef.current?.focus(), 30);
  };

  const commitEdit = () => {
    if (editingIdx === null) return;
    const v = editingValue.trim();
    if (v) onChange(items.map((item, i) => i === editingIdx ? { ...item, label: v } : item));
    setEditingIdx(null);
  };

  const cancelEdit = () => setEditingIdx(null);

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <ul className="space-y-1">
          {items.map((item, idx) => (
            <li key={idx}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#F8F9F9] border border-[#D8DCDE] group"
              style={editingIdx === idx ? { borderColor: "#038153", background: "#F0FBF7" } : {}}>
              {editingIdx === idx ? (
                <>
                  <input ref={editRef} value={editingValue}
                    onChange={e => setEditingValue(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commitEdit(); } if (e.key === "Escape") cancelEdit(); }}
                    className="flex-1 text-sm bg-transparent outline-none text-[#2F3941]" />
                  <button type="button" onClick={commitEdit} className="text-[#038153] hover:text-[#026b44] transition-colors shrink-0"><Check size={13} /></button>
                  <button type="button" onClick={cancelEdit} className="text-[#68717A] hover:text-[#2F3941] transition-colors shrink-0"><X size={13} /></button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-[#2F3941]">{item.label}</span>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button type="button" onClick={() => startEdit(idx)}
                      className="w-6 h-6 rounded flex items-center justify-center text-[#68717A] hover:bg-[#F3F4F6] hover:text-[#2F3941] transition-colors">
                      <Pencil size={11} />
                    </button>
                    <button type="button" onClick={() => duplicate(idx)}
                      className="w-6 h-6 rounded flex items-center justify-center text-[#68717A] hover:bg-[#EAF7F0] hover:text-[#038153] transition-colors">
                      <Copy size={11} />
                    </button>
                    <button type="button" onClick={() => remove(idx)}
                      className="w-6 h-6 rounded flex items-center justify-center text-[#68717A] hover:bg-[#FFF0F1] hover:text-[#CC3340] transition-colors">
                      <Trash2 size={11} />
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {items.length === 0 && <p className="text-xs text-[#C2C8CC] text-center py-1">No items yet</p>}
      <div className="flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="Type and press Enter..."
          className="flex-1 h-8 px-3 text-sm rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] placeholder:text-[#C2C8CC] outline-none focus:border-[#038153] focus:ring-2 focus:ring-[#038153]/15 transition-all" />
        <button type="button" onClick={add} disabled={!input.trim()}
          className="h-8 w-8 rounded-md border border-[#D8DCDE] text-[#2F3941] hover:bg-[#F3F4F6] disabled:opacity-40 transition-colors flex items-center justify-center shrink-0">
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Single attribute group card ───────────────────────────────────────────────
function GroupCard({
  group, onUpdate, onRemove, onDuplicate,
}: {
  group: AttributeGroup;
  onUpdate: (g: AttributeGroup) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(group.name);
  const nameRef = useRef<HTMLInputElement>(null);

  const startEditName = () => {
    setEditingName(true);
    setNameValue(group.name);
    setTimeout(() => nameRef.current?.focus(), 30);
  };

  const commitName = () => {
    const v = nameValue.trim();
    if (v) onUpdate({ ...group, name: v });
    setEditingName(false);
  };

  const cancelName = () => {
    setNameValue(group.name);
    setEditingName(false);
  };

  return (
    <div className="rounded-lg border border-[#D8DCDE] overflow-hidden">
      {/* Group header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-[#F8F9F9] border-b border-[#D8DCDE] group/header">
        <GripVertical size={14} className="text-[#C2C8CC] shrink-0" />

        {editingName ? (
          <>
            <input ref={nameRef} value={nameValue}
              onChange={e => setNameValue(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commitName(); } if (e.key === "Escape") cancelName(); }}
              className="flex-1 text-[12px] font-semibold uppercase tracking-wider bg-transparent outline-none border-b border-[#038153] text-[#2F3941]" />
            <button type="button" onClick={commitName} className="text-[#038153] hover:text-[#026b44] transition-colors shrink-0"><Check size={13} /></button>
            <button type="button" onClick={cancelName} className="text-[#68717A] hover:text-[#2F3941] transition-colors shrink-0"><X size={13} /></button>
          </>
        ) : (
          <>
            <span className="flex-1 text-[11px] font-semibold uppercase tracking-wider text-[#2F3941]">{group.name}</span>
            <div className="flex items-center gap-0.5 opacity-0 group-hover/header:opacity-100 transition-opacity">
              <button type="button" onClick={startEditName}
                className="w-6 h-6 rounded flex items-center justify-center text-[#68717A] hover:bg-[#F3F4F6] hover:text-[#2F3941] transition-colors"
                title="Rename group">
                <Pencil size={11} />
              </button>
              <button type="button" onClick={onDuplicate}
                className="w-6 h-6 rounded flex items-center justify-center text-[#68717A] hover:bg-[#EAF7F0] hover:text-[#038153] transition-colors"
                title="Duplicate group">
                <Copy size={11} />
              </button>
              <button type="button" onClick={onRemove}
                className="w-6 h-6 rounded flex items-center justify-center text-[#68717A] hover:bg-[#FFF0F1] hover:text-[#CC3340] transition-colors"
                title="Delete group">
                <Trash2 size={11} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Items */}
      <div className="p-4 bg-white">
        <ItemList
          items={group.items}
          onChange={items => onUpdate({ ...group, items })}
        />
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function SourceModal({ open, onClose, onSave, source }: Props) {
  const [form, setForm] = useState<SourceForm>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setForm(source ?? emptyForm);
      setError("");
      setNewGroupName("");
      setTimeout(() => nameRef.current?.focus(), 50);
    }
  }, [open, source]);

  const addGroup = () => {
    const name = newGroupName.trim();
    if (!name) return;
    setForm(prev => ({
      ...prev,
      attribute_groups: [...prev.attribute_groups, { name, items: [] }],
    }));
    setNewGroupName("");
  };

  const updateGroup = (idx: number, g: AttributeGroup) =>
    setForm(prev => ({ ...prev, attribute_groups: prev.attribute_groups.map((x, i) => i === idx ? g : x) }));

  const removeGroup = (idx: number) =>
    setForm(prev => ({ ...prev, attribute_groups: prev.attribute_groups.filter((_, i) => i !== idx) }));

  const duplicateGroup = (idx: number) => {
    const copy: AttributeGroup = {
      ...form.attribute_groups[idx],
      id: undefined,
      name: `${form.attribute_groups[idx].name} (Copy)`,
      items: form.attribute_groups[idx].items.map(item => ({ ...item, id: undefined })),
    };
    setForm(prev => {
      const next = [...prev.attribute_groups];
      next.splice(idx + 1, 0, copy);
      return { ...prev, attribute_groups: next };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await onSave(form);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg bg-white rounded-xl flex flex-col overflow-hidden"
        style={{ maxHeight: "90vh", boxShadow: "0 25px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D8DCDE] shrink-0">
          <div>
            <h2 className="text-[15px] font-semibold text-[#2F3941]">{source ? "Edit Source" : "New Source"}</h2>
            <p className="text-xs text-[#68717A] mt-0.5">Configure the source name and attribute groups</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md flex items-center justify-center text-[#68717A] hover:bg-[#F3F4F6]">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

            {/* Source name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#2F3941] uppercase tracking-wide">
                Source Name <span className="text-[#CC3340]">*</span>
              </label>
              <input ref={nameRef} value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Website, Referral, Event..."
                required
                className="h-9 px-3 text-sm rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] placeholder:text-[#C2C8CC] outline-none focus:border-[#038153] focus:ring-2 focus:ring-[#038153]/15 transition-all" />
            </div>

            {/* Attribute groups */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-[#2F3941] uppercase tracking-wide block">
                Attribute Groups
              </label>

              {form.attribute_groups.length === 0 && (
                <p className="text-xs text-[#C2C8CC] text-center py-3 rounded-lg border border-dashed border-[#D8DCDE]">
                  No attribute groups yet — add one below
                </p>
              )}

              {form.attribute_groups.map((group, idx) => (
                <GroupCard
                  key={idx}
                  group={group}
                  onUpdate={g => updateGroup(idx, g)}
                  onRemove={() => removeGroup(idx)}
                  onDuplicate={() => duplicateGroup(idx)}
                />
              ))}

              {/* Add new group */}
              <div className="flex gap-2">
                <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addGroup(); } }}
                  placeholder="New group name (e.g. General, Intent...)"
                  className="flex-1 h-8 px-3 text-sm rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] placeholder:text-[#C2C8CC] outline-none focus:border-[#038153] focus:ring-2 focus:ring-[#038153]/15 transition-all" />
                <button type="button" onClick={addGroup} disabled={!newGroupName.trim()}
                  className="h-8 px-3 rounded-md border border-[#D8DCDE] text-sm text-[#2F3941] font-medium hover:bg-[#F3F4F6] disabled:opacity-40 transition-colors flex items-center gap-1.5 shrink-0">
                  <Plus size={13} /> Add Group
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-md bg-[#FFF0F1] border border-[#FECDD3]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#CC3340] shrink-0" />
                <p className="text-xs text-[#CC3340]">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#D8DCDE] bg-[#F8F9F9] shrink-0">
            <button type="button" onClick={onClose}
              className="h-8 px-4 text-sm font-medium rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] hover:bg-[#F3F4F6] transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="h-8 px-4 text-sm font-medium rounded-md text-white flex items-center gap-1.5 hover:brightness-110 disabled:opacity-60 transition-all"
              style={{ background: "#038153" }}>
              {loading && <Loader2 size={13} className="animate-spin" />}
              {source ? "Save Changes" : "Create Source"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
