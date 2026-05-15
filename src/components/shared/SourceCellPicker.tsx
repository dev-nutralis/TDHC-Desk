"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Search, Check, X, ChevronRight, ChevronLeft } from "lucide-react";

interface AttributeItem { id: string; label: string; }
interface AttributeGroup { id: string; name: string; items: AttributeItem[]; }
interface SourceOption { id: string; name: string; attribute_groups: AttributeGroup[]; }

interface Props {
  value: { id: string; name: string; attribute_groups?: AttributeGroup[] } | null;
  attributeIds?: string[];
  onSave: (sourceId: string | null, attributeIds: string[]) => Promise<void> | void;
  attributeLabels?: string[];
}

export default function SourceCellPicker({ value, attributeIds = [], onSave, attributeLabels }: Props) {
  const [open, setOpen]           = useState(false);
  const [anchor, setAnchor]       = useState<DOMRect | null>(null);
  const [sources, setSources]     = useState<SourceOption[]>([]);
  const [loading, setLoading]     = useState(false);
  const [search, setSearch]       = useState("");
  const [saving, setSaving]       = useState(false);

  // Step 1: source selection; Step 2: attribute selection
  const [step, setStep]               = useState<1 | 2>(1);
  const [pendingSource, setPendingSource] = useState<SourceOption | null>(null);
  const [selectedAttrIds, setSelectedAttrIds] = useState<string[]>([]);

  const ref = useRef<HTMLDivElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAnchor((e.currentTarget as HTMLElement).getBoundingClientRect());
    setStep(1);
    setPendingSource(null);
    setSelectedAttrIds([]);
    setSearch("");
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/sources")
      .then(r => r.ok ? r.json() : [])
      .then((data: SourceOption[]) => setSources(data))
      .catch(() => setSources([]))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [open]);

  const allItems = (src: SourceOption) => src.attribute_groups.flatMap(g => g.items);

  const pickSource = (src: SourceOption | null) => {
    if (!src) {
      // Clear
      onSave(null, []);
      setOpen(false);
      return;
    }
    const hasAttrs = allItems(src).length > 0;
    if (hasAttrs) {
      // Pre-select existing attribute ids that belong to this source
      const itemIds = new Set(allItems(src).map(i => i.id));
      setSelectedAttrIds(attributeIds.filter(id => itemIds.has(id)));
      setPendingSource(src);
      setStep(2);
    } else {
      onSave(src.id, []);
      setOpen(false);
    }
  };

  const toggleAttr = (id: string) => {
    setSelectedAttrIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const applyAttrs = async () => {
    if (!pendingSource) return;
    setSaving(true);
    await onSave(pendingSource.id, selectedAttrIds);
    setSaving(false);
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
        className="text-left w-full text-sm hover:bg-[#F3F4F6] rounded px-1 -mx-1"
      >
        {value?.name
          ? <span className="text-[#2F3941] block truncate">{value.name}</span>
          : <span className="text-[#C2C8CC]">—</span>}
        {attributeLabels && attributeLabels.length > 0 && (
          <span className="flex flex-wrap gap-1 mt-0.5">
            {attributeLabels.map((label, i) => (
              <span key={i} className="inline-block text-[10px] leading-tight bg-[#EAF7F0] text-[#038153] rounded px-1.5 py-0.5 truncate max-w-[160px]">
                {label}
              </span>
            ))}
          </span>
        )}
      </button>

      {open && anchor && typeof window !== "undefined" && createPortal(
        <div
          ref={ref}
          style={{
            position: "fixed",
            top: Math.min(anchor.bottom + 4, window.innerHeight - 360),
            left: Math.min(anchor.left, window.innerWidth - 280),
            width: 280,
            zIndex: 9999,
          }}
          className="bg-white rounded-xl border border-[#D8DCDE] shadow-2xl overflow-hidden flex flex-col"
        >
          {/* ── Step 1: Source list ── */}
          {step === 1 && (
            <>
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
              <div className="overflow-y-auto" style={{ maxHeight: 280 }}>
                {loading && (
                  <div className="flex justify-center py-4">
                    <Loader2 size={14} className="animate-spin text-[#68717A]" />
                  </div>
                )}
                {!loading && value && (
                  <button
                    onClick={() => pickSource(null)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#68717A] hover:bg-[#FFF0F1] hover:text-[#CC3340] text-left transition-colors"
                  >
                    <X size={11} />
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
                  const hasAttrs = allItems(s).length > 0;
                  return (
                    <button
                      key={s.id}
                      onClick={() => pickSource(s)}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left transition-colors ${
                        selected ? "bg-[#EAF7F0] text-[#038153] font-medium" : "text-[#2F3941] hover:bg-[#F8F9F9]"
                      }`}
                    >
                      <span className="w-3 shrink-0">{selected && !hasAttrs && <Check size={11} />}</span>
                      <span className="flex-1 truncate">{s.name}</span>
                      {hasAttrs && <ChevronRight size={12} className="text-[#68717A] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* ── Step 2: Attribute selection ── */}
          {step === 2 && pendingSource && (
            <>
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#D8DCDE]">
                <button
                  onClick={() => setStep(1)}
                  className="text-[#68717A] hover:text-[#2F3941] transition-colors"
                >
                  <ChevronLeft size={15} />
                </button>
                <span className="text-sm font-medium text-[#2F3941] truncate flex-1">{pendingSource.name}</span>
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: 260 }}>
                {pendingSource.attribute_groups.map(group => (
                  <div key={group.id}>
                    {pendingSource.attribute_groups.length > 1 && (
                      <div className="px-3 pt-2 pb-1">
                        <span className="text-[10px] font-semibold text-[#68717A] uppercase tracking-wide">{group.name}</span>
                      </div>
                    )}
                    {group.items.map(item => {
                      const checked = selectedAttrIds.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          onClick={() => toggleAttr(item.id)}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                            checked ? "bg-[#EAF7F0] text-[#038153]" : "text-[#2F3941] hover:bg-[#F8F9F9]"
                          }`}
                        >
                          <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            checked ? "bg-[#038153] border-[#038153]" : "border-[#D8DCDE]"
                          }`}>
                            {checked && <Check size={10} className="text-white" />}
                          </span>
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="p-2 border-t border-[#D8DCDE]">
                <button
                  onClick={applyAttrs}
                  disabled={saving}
                  className="w-full h-8 bg-[#038153] hover:bg-[#026b43] disabled:opacity-60 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  Apply
                </button>
              </div>
            </>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
