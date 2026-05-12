"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  X, Search, Loader2, Send, FileEdit,
  Bold, Italic, List, ListOrdered,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type FieldValues = Record<string, unknown>;

interface ContactResult {
  id: string;
  field_values: FieldValues | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function contactName(fv: FieldValues | null): string {
  const first = (fv?.first_name as string) ?? "";
  const last  = (fv?.last_name  as string) ?? "";
  return [first, last].filter(Boolean).join(" ") || "—";
}

function contactEmail(fv: FieldValues | null): string | null {
  const raw = fv?.emails;
  if (Array.isArray(raw) && raw.length > 0) {
    const main = (raw as { address?: string; is_main?: boolean }[]).find(e => e.is_main) ?? raw[0];
    return (main as { address?: string }).address ?? null;
  }
  return null;
}

// ── Contact picker ────────────────────────────────────────────────────────────

function ContactPicker({
  value,
  onChange,
}: {
  value: ContactResult | null;
  onChange: (c: ContactResult | null) => void;
}) {
  const [search, setSearch]   = useState("");
  const [results, setResults] = useState<ContactResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen]       = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, []);

  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/contacts?page=1&search=${encodeURIComponent(search)}`);
        const data = await res.json();
        setResults(data.contacts ?? []);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 200);
    return () => clearTimeout(t);
  }, [search]);

  if (value) {
    return (
      <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-[#D8DCDE] bg-white">
        <span className="flex-1 text-sm text-[#2F3941] truncate">
          {contactName(value.field_values)}
          {contactEmail(value.field_values) && (
            <span className="text-[#68717A] ml-1.5">{"<"}{contactEmail(value.field_values)}{">"}</span>
          )}
        </span>
        <button
          onClick={() => onChange(null)}
          className="text-[#68717A] hover:text-[#CC3340] transition-colors"
        >
          <X size={13} />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#68717A]" />
        <input
          autoFocus
          value={search}
          onChange={e => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search contact by name or email…"
          className="w-full h-9 pl-8 pr-3 text-sm rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] placeholder:text-[#C2C8CC] outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153]/30 transition-all"
        />
      </div>
      {open && (search.trim().length > 0) && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-white rounded-lg border border-[#D8DCDE] shadow-lg overflow-hidden z-50">
          {loading && (
            <div className="flex justify-center py-3">
              <Loader2 size={14} className="animate-spin text-[#68717A]" />
            </div>
          )}
          {!loading && results.length === 0 && (
            <p className="text-xs text-[#68717A] text-center py-3">No contacts found</p>
          )}
          {!loading && results.map(c => (
            <button
              key={c.id}
              onClick={() => { onChange(c); setOpen(false); setSearch(""); }}
              className="w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-[#F8F9F9] transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-[#038153] flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5">
                {((c.field_values?.first_name as string)?.[0] ?? "").toUpperCase() || "?"}
              </div>
              <div>
                <div className="text-sm font-medium text-[#2F3941]">{contactName(c.field_values)}</div>
                {contactEmail(c.field_values) && (
                  <div className="text-xs text-[#68717A]">{contactEmail(c.field_values)}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Formatting toolbar ────────────────────────────────────────────────────────

const FORMAT_BTNS = [
  { icon: <Bold size={13} />,        cmd: "bold",                 label: "Bold"   },
  { icon: <Italic size={13} />,      cmd: "italic",               label: "Italic" },
  { icon: <List size={13} />,        cmd: "insertUnorderedList",  label: "Bullet" },
  { icon: <ListOrdered size={13} />, cmd: "insertOrderedList",    label: "Number" },
];

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
  onSent:  () => void;
  onDraft: () => void;
}

export default function ComposeModal({ onClose, onSent, onDraft }: Props) {
  const [contact, setContact]   = useState<ContactResult | null>(null);
  const [subject, setSubject]   = useState("");
  const [sending, setSending]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const execCmd = (cmd: string, value?: string) => {
    editorRef.current?.focus();
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    document.execCommand(cmd, false, value);
  };

  const getContent = useCallback(() => ({
    html: editorRef.current?.innerHTML?.trim() ?? "",
    text: editorRef.current?.innerText?.trim() ?? "",
  }), []);

  const submit = async (is_draft: boolean) => {
    if (!contact) { setError("Select a contact first"); return; }
    const { html, text } = getContent();
    if (!is_draft && !text) { setError("Message body is required"); return; }

    setError(null);
    is_draft ? setSaving(true) : setSending(true);

    try {
      const res = await fetch("/api/communications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: contact.id,
          subject: subject.trim() || "(no subject)",
          html,
          text,
          is_draft,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed");
      }
      is_draft ? onDraft() : onSent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSending(false);
      setSaving(false);
    }
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-0">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full sm:w-[620px] max-h-[85vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#D8DCDE] shrink-0">
          <FileEdit size={16} className="text-[#038153]" />
          <h2 className="text-sm font-semibold text-[#2F3941] flex-1">New message</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#68717A] hover:text-[#2F3941] hover:bg-[#F3F4F6] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-5 pt-4 pb-2 space-y-3">
            {/* To */}
            <div className="flex items-start gap-3">
              <span className="text-xs font-semibold text-[#68717A] w-12 mt-2.5 shrink-0">To</span>
              <div className="flex-1">
                <ContactPicker value={contact} onChange={setContact} />
              </div>
            </div>

            {/* Subject */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-[#68717A] w-12 shrink-0">Subject</span>
              <input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Subject…"
                className="flex-1 h-9 px-3 text-sm rounded-md border border-[#D8DCDE] text-[#2F3941] placeholder:text-[#C2C8CC] outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153]/30 transition-all"
              />
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-[#D8DCDE] mx-5" />

          {/* Formatting toolbar */}
          <div className="flex items-center gap-0.5 px-5 py-2 border-b border-[#D8DCDE]">
            {FORMAT_BTNS.map(({ icon, cmd, label }) => (
              <button
                key={label}
                type="button"
                title={label}
                onMouseDown={e => { e.preventDefault(); execCmd(cmd); }}
                className="w-7 h-7 flex items-center justify-center rounded text-[#68717A] hover:bg-[#F3F4F6] hover:text-[#2F3941] transition-colors"
              >
                {icon}
              </button>
            ))}
          </div>

          {/* Editor */}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Write your message…"
            className="min-h-[200px] px-5 py-4 text-sm text-[#2F3941] outline-none leading-relaxed empty:before:content-[attr(data-placeholder)] empty:before:text-[#C2C8CC]"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-[#D8DCDE] bg-[#F8F9F9] shrink-0">
          <div>
            {error && <span className="text-xs text-[#CC3340]">{error}</span>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => submit(true)}
              disabled={saving || sending}
              className="flex items-center gap-1.5 h-8 px-4 text-xs font-medium rounded-lg border border-[#D8DCDE] bg-white text-[#2F3941] hover:bg-[#F3F4F6] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <FileEdit size={12} />}
              Save draft
            </button>
            <button
              onClick={() => submit(false)}
              disabled={sending || saving}
              className="flex items-center gap-1.5 h-8 px-4 text-xs font-semibold rounded-lg text-white transition-colors hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: "#038153" }}
            >
              {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
