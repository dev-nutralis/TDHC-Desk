"use client";

import { AlertTriangle, X } from "lucide-react";

interface Deal { id: string; field_values: Record<string, unknown> | null; }

export default function DealDeleteDialog({
  open, deal, onClose, onConfirm,
}: { open: boolean; deal: Deal | null; onClose: () => void; onConfirm: () => void }) {
  if (!open || !deal) return null;
  const name = (deal.field_values?.deal_name as string) || "this deal";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-white rounded-xl overflow-hidden" style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.18)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#D8DCDE]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#FFF0F1] flex items-center justify-center">
              <AlertTriangle size={15} className="text-[#CC3340]" />
            </div>
            <h2 className="text-[14px] font-semibold text-[#2F3941]">Delete Deal</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-md flex items-center justify-center text-[#68717A] hover:bg-[#F3F4F6]">
            <X size={15} />
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-[#68717A]">
            Delete deal <span className="font-semibold text-[#2F3941]">"{name}"</span>? This action cannot be undone.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#D8DCDE] bg-[#F8F9F9]">
          <button onClick={onClose} className="h-8 px-4 text-sm font-medium rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] hover:bg-[#F3F4F6]">
            Cancel
          </button>
          <button onClick={onConfirm} className="h-8 px-4 text-sm font-medium rounded-md text-white hover:brightness-110" style={{ background: "#CC3340" }}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
