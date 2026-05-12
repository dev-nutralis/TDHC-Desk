"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Globe, Loader2, ExternalLink, Lock, ChevronDown,
  Plus, GripVertical, Eye, Trash2,
} from "lucide-react";
import { useSourceField, type SourceModuleKey } from "@/hooks/useSourceField";

interface AddButtonProps {
  module: SourceModuleKey;
}

/** Header button used when Source is not yet added — toggles Source ON */
export function AddSourceFieldButton({ module }: AddButtonProps) {
  const { loading, enabled, updateEnabled } = useSourceField(module);
  const [saving, setSaving] = useState(false);

  if (loading || enabled) return null;

  const handleClick = async () => {
    setSaving(true);
    await updateEnabled(true);
    setSaving(false);
  };

  return (
    <button
      onClick={handleClick}
      disabled={saving}
      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-sm font-medium border border-[#D8DCDE] bg-white text-[#2F3941] hover:bg-[#F3F4F6] transition-all disabled:opacity-60"
    >
      {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
      Add Source field
    </button>
  );
}

interface RowProps {
  module: SourceModuleKey;
  // Drag wiring from parent
  isDragging?: boolean;
  isDragOver?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onDrop?: (e: React.DragEvent) => void;
}

/** In-list source row — rendered inside FieldsManager when toggle is ON */
export default function SourceFieldRow({
  module,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
}: RowProps) {
  const params = useParams();
  const platformSlug = (params?.platform as string) ?? "";
  const sourcesHref = platformSlug ? `/${platformSlug}/settings/sources` : "/settings/sources";

  const { loading, enabled, sources, updateEnabled } = useSourceField(module);
  const [expanded, setExpanded] = useState(false);
  const [removing, setRemoving] = useState(false);

  if (loading || !enabled) return null;

  const handleRemove = async () => {
    setRemoving(true);
    await updateEnabled(false);
    setRemoving(false);
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
      className={`border-b border-[#F3F4F6] last:border-b-0 transition-all ${isDragging ? "opacity-50" : ""} ${isDragOver ? "bg-[#EFF6FF]" : ""}`}
    >
      <div className="flex items-center gap-2 px-3 py-2.5 bg-[#FAFBFB]">
        <GripVertical size={14} className="text-[#68717A] shrink-0 cursor-grab active:cursor-grabbing" />

        <div className="w-7 h-7 rounded-full bg-[#EAF7F0] flex items-center justify-center shrink-0">
          <Globe size={13} className="text-[#038153]" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-[#2F3941]">Source</span>
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-[#F3F4F6] text-[#68717A]">
              <Lock size={9} /> Global field
            </span>
            <span className="text-[11px] text-[#68717A]">
              {sources.length} {sources.length === 1 ? "source" : "sources"} defined
            </span>
          </div>
        </div>

        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F3F4F6] text-[#68717A] shrink-0">Source</span>

        <button
          onClick={() => setExpanded(e => !e)}
          title={expanded ? "Hide preview" : "View options"}
          className="w-7 h-7 rounded-md flex items-center justify-center text-[#68717A] hover:bg-[#F3F4F6] transition-colors shrink-0"
        >
          {expanded ? <ChevronDown size={14} /> : <Eye size={14} />}
        </button>

        <button
          onClick={handleRemove}
          disabled={removing}
          title="Remove Source field"
          className="w-7 h-7 rounded-md flex items-center justify-center text-[#C2C8CC] hover:text-[#CC3340] hover:bg-[#FFF0F1] transition-colors shrink-0 disabled:opacity-60"
        >
          {removing ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
        </button>
      </div>

      {expanded && (
        <div className="px-12 pb-4 bg-[#FAFBFB] border-t border-[#F3F4F6]">
          <p className="text-[11px] text-[#68717A] py-2">
            Read-only preview.{" "}
            <Link href={sourcesHref} className="text-[#1D6FA4] hover:underline inline-flex items-center gap-0.5">
              Edit in Settings → Sources <ExternalLink size={9} />
            </Link>
          </p>
          {sources.length === 0 ? (
            <p className="text-xs text-[#C2C8CC]">No sources defined yet.</p>
          ) : (
            <div className="space-y-3">
              {sources.map(s => (
                <div key={s.id} className="bg-white rounded-md border border-[#D8DCDE] p-3">
                  <p className="text-sm font-semibold text-[#2F3941] mb-2">{s.name}</p>
                  {s.attribute_groups.length === 0 ? (
                    <p className="text-[11px] text-[#C2C8CC]">No attribute groups</p>
                  ) : (
                    <div className="space-y-2">
                      {s.attribute_groups.map(g => (
                        <div key={g.id}>
                          <p className="text-[11px] font-semibold text-[#68717A] uppercase tracking-wider mb-1">{g.name}</p>
                          <div className="flex flex-wrap gap-1">
                            {g.items.length === 0
                              ? <span className="text-[11px] text-[#C2C8CC]">No items</span>
                              : g.items.map(i => (
                                  <span key={i.id} className="text-[11px] px-2 py-0.5 rounded-full bg-[#F3F4F6] text-[#2F3941] border border-[#D8DCDE]">
                                    {i.label}
                                  </span>
                                ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
