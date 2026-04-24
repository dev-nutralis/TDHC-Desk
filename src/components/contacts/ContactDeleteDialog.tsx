"use client";

import { AlertTriangle, X } from "lucide-react";

interface Contact { id: string; first_name?: string | null; last_name?: string | null; }

interface Props {
  open: boolean;
  contact: Contact | null;
  onClose: () => void;
  onConfirm: () => void;
}

export default function ContactDeleteDialog({ open, contact, onClose, onConfirm }: Props) {
  if (!open || !contact) return null;

  const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "this contact";

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
            <h2 className="text-[14px] font-semibold text-[#2F3941]">Delete Contact</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-md flex items-center justify-center text-[#68717A] hover:bg-[#F3F4F6]">
            <X size={15} />
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-[#68717A]">Delete <span className="font-semibold text-[#2F3941]">"{name}"</span>?</p>
          <p className="text-xs text-[#CC3340] mt-3 font-medium">This action cannot be undone.</p>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#D8DCDE] bg-[#F8F9F9]">
          <button onClick={onClose} className="h-8 px-4 text-sm font-medium rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] hover:bg-[#F3F4F6]">Cancel</button>
          <button onClick={onConfirm} className="h-8 px-4 text-sm font-medium rounded-md text-white hover:brightness-110" style={{ background: "#CC3340" }}>Delete</button>
        </div>
      </div>
    </div>
  );
}
