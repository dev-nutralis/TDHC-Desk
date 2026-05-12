"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Search, Check, X } from "lucide-react";

interface SourceOption { id: string; name: string; }

interface Props {
  value: { id: string; name: string } | null;
  onSave: (sourceId: string | null) => Promise<void> | void;
}

export default function SourceCellPicker({ value, onSave }: Props) {
  const [open, setOpen]       = useState(false);
  const [anchor, setAnchor]   = useState<DOMRect | null>(null);
  const [sources, setSources] = useState<SourceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch]   = useState("");
  const [saving, setSaving]   = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Open popover
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAnchor((e.currentTarget as HTMLElement).getBoundingClientRect());
    setOpen(true);
  };

  // Fetch sources on open
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/sources")
      .then(r => r.ok ? r.json() : [])
      .then((data: { id: string; name: string }[]) => setSources(data.map(s => ({ id: s.id, name: s.name }))))
      .catch(() => setSources([]))
      .finally(() => setLoading(false));
  }, [open]);

  // Click-outside to close
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [open]);

  const pick = async (id: string | null) => {
    setSaving(id ?? "__clear__");
    await onSave(id);
    setSaving(null);
    setOpen(false);
  };

  const filtered = search.trim()
    ? sources.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
    : sources;

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="text-left w-full text-sm hover:bg-[#F3F4F6] rounded px-1 -mx-1 truncate"
      >
        {value?.name
          ? <span className="text-[#2F3941]">{value.name}</span>
          : <span className="text-[#C2C8CC]">—</span>}
      </button>

      {open && anchor && typeof window !== "undefined" && createPortal(
        <div
          ref={ref}
          style={{
            position: "fixed",
            top: Math.min(anchor.bottom + 4, window.innerHeight - 320),
            left: Math.min(anchor.left, window.innerWidth - 280),
            width: 260,
            zIndex: 9999,
          }}
          className="bg-white rounded-xl border border-[#D8DCDE] shadow-2xl overflow-hidden flex flex-col"
        >
          <div className="p-2 border-b border-[#D8DCDE]">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#68717A]" />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search sources..."
                className="w-full h-8 pl-8 pr-2 text-sm rounded-md border border-[#D8DCDE] outline-none focus:border-[#038153] focus:ring-2 focus:ring-[#038153]/15"
              />
            </div>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 240 }}>
            {loading && (
              <div className="flex justify-center py-4">
                <Loader2 size={14} className="animate-spin text-[#68717A]" />
              </div>
            )}

            {!loading && value && (
              <button
                onClick={() => pick(null)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#68717A] hover:bg-[#FFF0F1] hover:text-[#CC3340] text-left transition-colors"
              >
                {saving === "__clear__"
                  ? <Loader2 size={11} className="animate-spin" />
                  : <X size={11} />}
                Clear source
              </button>
            )}

            {!loading && filtered.length === 0 && (
              <p className="text-xs text-[#68717A] text-center py-4">
                {search ? "No matching sources" : "No sources defined"}
              </p>
            )}

            {!loading && filtered.map(s => {
              const selected = s.id === value?.id;
              return (
                <button
                  key={s.id}
                  onClick={() => pick(s.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left transition-colors ${
                    selected ? "bg-[#EAF7F0] text-[#038153] font-medium" : "text-[#2F3941] hover:bg-[#F8F9F9]"
                  }`}
                >
                  {saving === s.id
                    ? <Loader2 size={12} className="animate-spin shrink-0" />
                    : <span className="w-3 shrink-0">{selected && <Check size={11} />}</span>}
                  <span className="truncate">{s.name}</span>
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
