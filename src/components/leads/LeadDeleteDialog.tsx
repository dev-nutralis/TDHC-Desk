"use client";

import { AlertTriangle, X } from "lucide-react";

type FieldValues = Record<string, unknown>;
interface Lead { id: string; field_values?: FieldValues | null; }

interface Props {
  open: boolean;
  lead: Lead | null;
  onClose: () => void;
  onConfirm: () => void;
}

export default function LeadDeleteDialog({ open, lead, onClose, onConfirm }: Props) {
  if (!open || !lead) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-white rounded-xl overflow-hidden"
        style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)" }}>

        <div className="flex items-center justify-between px-5 py-4 border-b border-[#D8DCDE]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#FFF0F1] flex items-center justify-center">
              <AlertTriangle size={15} className="text-[#CC3340]" />
            </div>
            <h2 className="text-[14px] font-semibold text-[#2F3941]">Delete Lead</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-md flex items-center justify-center text-[#68717A] hover:bg-[#F3F4F6] transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="text-sm text-[#68717A]">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-[#2F3941]">{
              (() => {
                const fv = lead.field_values ?? {};
                const parts = [fv.nickname, fv.first_name, fv.last_name].filter(Boolean).join(" ");
                return parts || "this lead";
              })()
            }</span>?
          </p>

          <p className="text-xs text-[#CC3340] mt-3 font-medium">This action cannot be undone.</p>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#D8DCDE] bg-[#F8F9F9]">
          <button
            onClick={onClose}
            className="h-8 px-4 text-sm font-medium rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] hover:bg-[#F3F4F6] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="h-8 px-4 text-sm font-medium rounded-md text-white transition-all hover:brightness-110 active:scale-95"
            style={{ background: "#CC3340" }}
          >
            Delete Lead
          </button>
        </div>
      </div>
    </div>
  );
}
