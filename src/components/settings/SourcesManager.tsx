"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Tag, Loader2, AlertTriangle, X, Copy } from "lucide-react";
import SourceModal from "./SourceModal";

interface Item { id?: string; label: string; sort_order?: number; }
interface AttributeGroup { id?: string; name: string; sort_order?: number; items: Item[]; }
interface Source {
  id: string;
  name: string;
  attribute_groups: AttributeGroup[];
}

function DeleteConfirm({ source, onClose, onConfirm }: { source: Source; onClose: () => void; onConfirm: () => void; }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-white rounded-xl overflow-hidden"
        style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.18)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#D8DCDE]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#FFF0F1] flex items-center justify-center">
              <AlertTriangle size={15} className="text-[#CC3340]" />
            </div>
            <h2 className="text-[14px] font-semibold text-[#2F3941]">Delete Source</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-md flex items-center justify-center text-[#68717A] hover:bg-[#F3F4F6]">
            <X size={15} />
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-[#68717A]">Delete source <span className="font-semibold text-[#2F3941]">"{source.name}"</span>? Leads using this source will not be deleted.</p>
          <p className="text-xs text-[#CC3340] mt-3 font-medium">This cannot be undone.</p>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#D8DCDE] bg-[#F8F9F9]">
          <button onClick={onClose} className="h-8 px-4 text-sm font-medium rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] hover:bg-[#F3F4F6]">Cancel</button>
          <button onClick={onConfirm} className="h-8 px-4 text-sm font-medium rounded-md text-white hover:brightness-110" style={{ background: "#CC3340" }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

export default function SourcesManager() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editSource, setEditSource] = useState<Source | null>(null);
  const [deleteSource, setDeleteSource] = useState<Source | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/sources");
    setSources(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  const handleSave = async (data: Omit<Source, "id">) => {
    const method = editSource ? "PUT" : "POST";
    const url = editSource ? `/api/sources/${editSource.id}` : "/api/sources";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (!res.ok) throw new Error((await res.json()).error || "Failed");
    fetch_();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/sources/${id}`, { method: "DELETE" });
    fetch_();
  };

  const handleDuplicate = async (id: string) => {
    await fetch(`/api/sources/${id}/duplicate`, { method: "POST" });
    fetch_();
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={() => { setEditSource(null); setModalOpen(true); }}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-sm font-medium text-white hover:brightness-110 transition-all"
          style={{ background: "#038153" }}
        >
          <Plus size={14} /> Add Source
        </button>
      </div>

      <div className="bg-white rounded-lg border border-[#D8DCDE] overflow-hidden shadow-sm">
        {loading && (
          <div className="flex items-center justify-center h-40">
            <Loader2 size={18} className="animate-spin text-[#68717A]" />
          </div>
        )}

        {!loading && sources.length === 0 && (
          <div className="flex flex-col items-center gap-2 h-40 justify-center text-[#68717A]">
            <Tag size={28} strokeWidth={1.2} />
            <p className="text-sm font-medium">No sources yet</p>
          </div>
        )}

        {!loading && sources.map((source, idx) => (
          <div key={source.id}
            className={`flex items-start gap-4 px-5 py-4 hover:bg-[#F8F9F9] transition-colors group ${idx < sources.length - 1 ? "border-b border-[#D8DCDE]" : ""}`}>

            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "#EAF7F0" }}>
              <Tag size={15} style={{ color: "#038153" }} />
            </div>

            <div className="flex-1 min-w-0 space-y-2">
              <p className="text-sm font-semibold text-[#2F3941]">{source.name}</p>

              {source.attribute_groups.length > 0 ? (
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  {source.attribute_groups.map(group => (
                    <div key={group.id}>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#68717A] mb-1">{group.name}</p>
                      {group.items.length === 0
                        ? <span className="text-[11px] text-[#C2C8CC]">None</span>
                        : (
                          <div className="flex flex-wrap gap-1">
                            {group.items.map(item => (
                              <span key={item.id} className="text-[10px] px-1.5 py-0.5 rounded border border-[#D8DCDE] bg-[#F8F9F9] text-[#2F3941]">
                                {item.label}
                              </span>
                            ))}
                          </div>
                        )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#C2C8CC]">No attribute groups</p>
              )}
            </div>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button onClick={() => { setEditSource(source); setModalOpen(true); }}
                className="w-8 h-8 rounded-md flex items-center justify-center text-[#68717A] hover:bg-[#F3F4F6] hover:text-[#2F3941] transition-colors"
                title="Edit">
                <Pencil size={14} />
              </button>
              <button onClick={() => handleDuplicate(source.id)}
                className="w-8 h-8 rounded-md flex items-center justify-center text-[#68717A] hover:bg-[#EAF7F0] hover:text-[#038153] transition-colors"
                title="Duplicate">
                <Copy size={14} />
              </button>
              <button onClick={() => setDeleteSource(source)}
                className="w-8 h-8 rounded-md flex items-center justify-center text-[#68717A] hover:bg-[#FFF0F1] hover:text-[#CC3340] transition-colors"
                title="Delete">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <SourceModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSave} source={editSource} />
      {deleteSource && (
        <DeleteConfirm source={deleteSource} onClose={() => setDeleteSource(null)}
          onConfirm={() => { handleDelete(deleteSource.id); setDeleteSource(null); }} />
      )}
    </div>
  );
}
