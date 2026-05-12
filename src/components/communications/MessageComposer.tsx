"use client";

import { useState, useEffect, useRef } from "react";
import {
  Loader2, Send, FileText, Type, Image, Link2, Braces,
  Paperclip, X, Check, Bold, Italic, Heading1, Heading2,
  Quote, List, ListOrdered, Pencil, ChevronDown, Mail, StickyNote,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AttachmentFile {
  filename: string;
  content: string;
  contentType: string;
  size: number;
}

interface EmailTemplate { id: string; name: string; subject: string | null; body: string; }
interface EmailSignature { id: string; name: string; body: string; }

type Tab = "email" | "note";

// ── Formatting toolbar ────────────────────────────────────────────────────────

const FORMAT_COMMANDS = [
  { icon: <Bold size={13} />,        label: "Bold",          command: "bold" },
  { icon: <Italic size={13} />,      label: "Italic",        command: "italic" },
  { icon: <Heading1 size={13} />,    label: "Heading 1",     command: "formatBlock", value: "h1" },
  { icon: <Heading2 size={13} />,    label: "Heading 2",     command: "formatBlock", value: "h2" },
  { icon: <Quote size={13} />,       label: "Blockquote",    command: "formatBlock", value: "blockquote" },
  { icon: <List size={13} />,        label: "Bullet list",   command: "insertUnorderedList" },
  { icon: <ListOrdered size={13} />, label: "Numbered list", command: "insertOrderedList" },
];

function FormattingToolbar({
  editorRef, onClose,
}: {
  editorRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
}) {
  const [active, setActive] = useState<Record<string, boolean>>({});
  const toolbarRef = useRef<HTMLDivElement>(null);

  const queryActive = () => {
    try {
      const blockRaw = (document.queryCommandValue("formatBlock") ?? "").toLowerCase().replace(/^<|>$/g, "");
      setActive({
        bold:                document.queryCommandState("bold"),
        italic:              document.queryCommandState("italic"),
        insertUnorderedList: document.queryCommandState("insertUnorderedList"),
        insertOrderedList:   document.queryCommandState("insertOrderedList"),
        [`block_${blockRaw}`]: !!blockRaw,
      });
    } catch { /* ignore */ }
  };

  useEffect(() => { queryActive(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleDown = (e: MouseEvent) => {
      if (
        toolbarRef.current && !toolbarRef.current.contains(e.target as Node) &&
        editorRef.current  && !editorRef.current.contains(e.target as Node)
      ) onClose();
    };
    document.addEventListener("mousedown", handleDown);
    return () => document.removeEventListener("mousedown", handleDown);
  }, [onClose, editorRef]);

  const isActive = (command: string, value?: string) =>
    command === "formatBlock"
      ? active[`block_${value?.toLowerCase() ?? ""}`] ?? false
      : active[command] ?? false;

  return (
    <div ref={toolbarRef}
      className="absolute z-50 bottom-full mb-2 left-0 flex items-center gap-0.5 bg-white rounded-lg border border-[#D8DCDE] shadow-lg px-1.5 py-1.5">
      {FORMAT_COMMANDS.map(({ icon, label, command, value }) => {
        const on = isActive(command, value);
        return (
          <button key={label} type="button" title={label}
            onMouseDown={(e) => {
              e.preventDefault();
              editorRef.current?.focus();
              // eslint-disable-next-line @typescript-eslint/no-deprecated
              document.execCommand(command, false, value);
              requestAnimationFrame(() => queryActive());
            }}
            className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
              on ? "bg-[#EAF7F0] text-[#038153]" : "text-[#2F3941] hover:bg-[#F3F4F6]"
            }`}>
            {icon}
          </button>
        );
      })}
    </div>
  );
}

// ── Link popover ──────────────────────────────────────────────────────────────

function LinkPopover({
  onInsert, onClose, initialText = "",
}: {
  onInsert: (url: string, text: string) => void;
  onClose: () => void;
  initialText?: string;
}) {
  const [url, setUrl]   = useState("https://");
  const [text, setText] = useState(initialText);
  const urlRef = useRef<HTMLInputElement>(null);

  useEffect(() => { urlRef.current?.focus(); }, []);

  const handleInsert = () => {
    const trimmed = url.trim();
    if (!trimmed || trimmed === "https://") return;
    onInsert(trimmed, text.trim() || trimmed);
  };

  return (
    <div className="absolute z-50 bottom-full mb-2 left-0 w-72 bg-white rounded-lg border border-[#D8DCDE] shadow-lg p-3 flex flex-col gap-2">
      <p className="text-xs font-semibold text-[#68717A] uppercase tracking-wide mb-0.5">Insert link</p>
      <input ref={urlRef} value={url} onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleInsert(); if (e.key === "Escape") onClose(); }}
        placeholder="https://..."
        className="h-8 px-2.5 text-sm rounded-md border border-[#D8DCDE] text-[#2F3941] placeholder-[#C2C8CC] focus:outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153] transition-colors" />
      <input value={text} onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleInsert(); if (e.key === "Escape") onClose(); }}
        placeholder="Display text (optional)"
        className="h-8 px-2.5 text-sm rounded-md border border-[#D8DCDE] text-[#2F3941] placeholder-[#C2C8CC] focus:outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153] transition-colors" />
      <div className="flex justify-end gap-2 pt-0.5">
        <button type="button" onClick={onClose}
          className="h-7 px-3 text-xs font-medium rounded-md border border-[#D8DCDE] text-[#68717A] hover:bg-[#F3F4F6] transition-colors">
          Cancel
        </button>
        <button type="button" onClick={handleInsert}
          className="h-7 px-3 text-xs font-medium rounded-md text-white flex items-center gap-1 transition-colors hover:brightness-110"
          style={{ background: "#038153" }}>
          <Check size={11} /> Insert
        </button>
      </div>
    </div>
  );
}

// ── Template picker ───────────────────────────────────────────────────────────

function TemplatePicker({
  onInsert, onClose,
}: {
  onInsert: (tpl: EmailTemplate) => void;
  onClose: () => void;
}) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading]     = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/email-templates")
      .then((r) => r.json())
      .then((data) => setTemplates(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handleDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handleDown);
    return () => document.removeEventListener("mousedown", handleDown);
  }, [onClose]);

  return (
    <div ref={ref}
      className="absolute z-50 bottom-full mb-2 left-0 w-64 bg-white rounded-lg border border-[#D8DCDE] shadow-lg overflow-hidden">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#68717A] px-3 py-2 border-b border-[#D8DCDE]">
        Insert Template
      </p>
      {loading ? (
        <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-[#68717A]" /></div>
      ) : templates.length === 0 ? (
        <p className="text-xs text-[#C2C8CC] px-3 py-4 text-center">
          No templates yet. Create one in Settings → Emails.
        </p>
      ) : (
        <div className="max-h-52 overflow-y-auto">
          {templates.map((t) => (
            <button key={t.id} type="button" onClick={() => onInsert(t)}
              className="w-full text-left px-3 py-2.5 hover:bg-[#F3F4F6] transition-colors border-b border-[#D8DCDE] last:border-0">
              <p className="text-sm font-medium text-[#2F3941] truncate">{t.name}</p>
              {t.subject && <p className="text-xs text-[#68717A] truncate mt-0.5">{t.subject}</p>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Signature/Tag picker ──────────────────────────────────────────────────────

function SignaturePicker({
  onInsert, onClose,
}: {
  onInsert: (sig: EmailSignature) => void;
  onClose: () => void;
}) {
  const [signatures, setSignatures] = useState<EmailSignature[]>([]);
  const [loading, setLoading]       = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/email-signatures")
      .then((r) => r.json())
      .then((data) => setSignatures(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handleDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handleDown);
    return () => document.removeEventListener("mousedown", handleDown);
  }, [onClose]);

  return (
    <div ref={ref}
      className="absolute z-50 bottom-full mb-2 left-0 w-56 bg-white rounded-lg border border-[#D8DCDE] shadow-lg overflow-hidden">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#68717A] px-3 py-2 border-b border-[#D8DCDE]">
        Insert Tag
      </p>
      {loading ? (
        <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-[#68717A]" /></div>
      ) : signatures.length === 0 ? (
        <p className="text-xs text-[#C2C8CC] px-3 py-4 text-center">
          No tags yet. Create one in Settings → Emails.
        </p>
      ) : (
        <div className="max-h-52 overflow-y-auto">
          {signatures.map((s) => (
            <button key={s.id} type="button" onClick={() => onInsert(s)}
              className="w-full text-left px-3 py-2.5 hover:bg-[#F3F4F6] transition-colors border-b border-[#D8DCDE] last:border-0">
              <p className="text-sm font-medium text-[#2F3941] truncate">{s.name}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Link tooltip ──────────────────────────────────────────────────────────────

function LinkTooltip({
  url, x, y, onEdit, onClose,
}: {
  url: string; x: number; y: number; onEdit: () => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handleDown);
    return () => document.removeEventListener("mousedown", handleDown);
  }, [onClose]);

  return (
    <div ref={ref} style={{ position: "fixed", left: x, top: y + 6, zIndex: 1000 }}
      className="flex items-center gap-2 bg-white rounded-lg border border-[#D8DCDE] shadow-lg px-3 py-2 max-w-xs">
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="text-sm truncate" style={{ color: "#1D6FA4" }}>{url}</a>
      <button type="button" onClick={onEdit}
        className="shrink-0 text-[#68717A] hover:text-[#2F3941] transition-colors" title="Edit link">
        <Pencil size={13} />
      </button>
    </div>
  );
}

function fmtSize(bytes: number) {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Main MessageComposer ──────────────────────────────────────────────────────

interface Props {
  contactId: string;
  defaultSubject?: string;
  defaultTab?: Tab;
  threadId?: string | null;
  onSent: () => void;
}

export default function MessageComposer({
  contactId,
  defaultSubject = "",
  defaultTab = "email",
  threadId = null,
  onSent,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);
  const [subject, setSubject]     = useState(defaultSubject);
  const [body, setBody]           = useState("");
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [formattingOpen, setFormattingOpen]       = useState(false);
  const [linkPopoverOpen, setLinkPopoverOpen]     = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [signaturePickerOpen, setSignaturePickerOpen] = useState(false);
  const [initialLinkText, setInitialLinkText]     = useState("");
  const [linkTooltip, setLinkTooltip] = useState<{ url: string; x: number; y: number; el: HTMLAnchorElement } | null>(null);

  const editorRef       = useRef<HTMLDivElement>(null);
  const fileInputRef    = useRef<HTMLInputElement>(null);
  const imageInputRef   = useRef<HTMLInputElement>(null);
  const savedRangeRef   = useRef<Range | null>(null);
  const editingLinkRef  = useRef<HTMLAnchorElement | null>(null);

  // Sync defaultSubject when it changes (e.g., switching threads)
  useEffect(() => { setSubject(defaultSubject); }, [defaultSubject]);

  const closeAllPopups = () => {
    setFormattingOpen(false);
    setLinkPopoverOpen(false);
    setTemplatePickerOpen(false);
    setSignaturePickerOpen(false);
  };

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setSaveError(null);
    closeAllPopups();
    setLinkTooltip(null);
    setAttachments([]);
  };

  const handleInsertSignature = (sig: EmailSignature) => {
    setSignaturePickerOpen(false);
    const editor = editorRef.current;
    if (!editor) return;
    const sep = document.createElement("p");
    sep.innerHTML = "<br>--<br>";
    const sigDiv = document.createElement("div");
    sigDiv.innerHTML = sig.body;
    editor.appendChild(sep);
    editor.appendChild(sigDiv);
    setBody(editor.innerText?.trim() ?? "");
  };

  const handleInsertTemplate = (tpl: EmailTemplate) => {
    setTemplatePickerOpen(false);
    if (tpl.subject && !subject.trim()) setSubject(tpl.subject);
    if (editorRef.current) {
      editorRef.current.innerHTML = tpl.body;
      setBody(editorRef.current.innerText?.trim() ?? "");
    }
  };

  const handleLinkButtonClick = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
      setInitialLinkText(sel.toString());
    } else {
      savedRangeRef.current = null;
      setInitialLinkText("");
    }
    setLinkPopoverOpen((o) => !o);
    setFormattingOpen(false);
  };

  const handleInsertLink = (url: string, displayText: string) => {
    setLinkPopoverOpen(false);
    setLinkTooltip(null);
    const editor = editorRef.current;
    if (!editor) return;

    if (editingLinkRef.current) {
      const existing = editingLinkRef.current;
      existing.href = url;
      existing.textContent = displayText;
      editingLinkRef.current = null;
      setBody(editor.innerText?.trim() ?? "");
      return;
    }

    const link = document.createElement("a");
    link.href = url;
    link.textContent = displayText;
    link.setAttribute("data-editor-link", "true");
    link.style.color = "#1D6FA4";
    link.style.textDecoration = "underline";
    link.style.textDecorationStyle = "dotted";
    link.style.cursor = "pointer";

    const range = savedRangeRef.current;
    if (range) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      range.deleteContents();
      range.insertNode(link);
      const newRange = document.createRange();
      newRange.setStartAfter(link);
      newRange.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(newRange);
    } else {
      editor.focus();
      editor.appendChild(link);
    }

    savedRangeRef.current = null;
    setBody(editor.innerText?.trim() ?? "");
  };

  const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "A" && target.hasAttribute("data-editor-link")) {
      e.preventDefault();
      const rect = target.getBoundingClientRect();
      setLinkTooltip({ url: (target as HTMLAnchorElement).href, x: rect.left, y: rect.bottom, el: target as HTMLAnchorElement });
    } else {
      setLinkTooltip(null);
    }
  };

  const handleEditLink = () => {
    if (!linkTooltip) return;
    editingLinkRef.current = linkTooltip.el;
    setInitialLinkText(linkTooltip.el.textContent ?? "");
    setLinkTooltip(null);
    setLinkPopoverOpen(true);
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const base64 = dataUrl.split(",")[1];
        setAttachments((prev) => [
          ...prev,
          { filename: file.name, content: base64, contentType: file.type || "application/octet-stream", size: file.size },
        ]);
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current)  fileInputRef.current.value  = "";
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const removeAttachment = (idx: number) => setAttachments((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    const htmlBody = editorRef.current?.innerHTML ?? "";
    const textBody = editorRef.current?.innerText?.trim() ?? "";
    if (!textBody) return;

    setSaving(true);
    setSaveError(null);
    try {
      const payload: {
        type: Tab;
        subject?: string;
        body: string;
        html?: string;
        attachments?: AttachmentFile[];
        thread_id?: string | null;
      } = {
        type: activeTab,
        body: textBody,
        html: htmlBody,
        thread_id: threadId,
      };
      if (activeTab === "email" && subject.trim()) payload.subject = subject.trim();
      if (activeTab === "email" && attachments.length > 0) payload.attachments = attachments;

      const res = await fetch(`/api/contacts/${contactId}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? "Failed to save");
      }

      setBody("");
      setAttachments([]);
      if (editorRef.current) editorRef.current.innerHTML = "";
      onSent();
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-[#D8DCDE] shadow-sm overflow-visible">
      {/* Tab bar */}
      <div className="flex border-b border-[#D8DCDE]">
        {[
          { key: "email" as Tab, label: "Email", icon: Mail },
          { key: "note"  as Tab, label: "Internal Note", icon: StickyNote },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => handleTabChange(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors focus:outline-none ${
              activeTab === key
                ? "border-b-2 border-[#038153] text-[#2F3941] -mb-px"
                : "text-[#68717A] hover:text-[#2F3941]"
            }`}>
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col">
        {/* Subject (email only) */}
        {activeTab === "email" && (
          <div className="px-4 pt-3">
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="w-full h-9 px-3 text-sm rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] placeholder-[#C2C8CC] focus:outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153] transition-colors" />
          </div>
        )}

        {/* Editor */}
        <div className="px-4 pt-3">
          <div className="relative">
            <div ref={editorRef} contentEditable suppressContentEditableWarning
              onInput={() => setBody(editorRef.current?.innerText?.trim() ?? "")}
              onClick={handleEditorClick}
              className="w-full min-h-[96px] px-3 py-2 text-sm rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] focus:outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153] transition-colors"
              style={{ resize: "vertical", overflow: "auto" }} />
            {!body && (
              <div className="absolute top-2 left-3 text-sm text-[#C2C8CC] pointer-events-none select-none">
                {activeTab === "email" ? "Write your email..." : "Write a note..."}
              </div>
            )}
          </div>
        </div>

        {/* Toolbar + Send */}
        <div className="flex items-center gap-1 px-3 py-2.5 border-t border-[#D8DCDE] mt-2">
          {activeTab === "email" && (
            <>
              {/* Formatting */}
              <div className="relative">
                <button type="button" title="Text formatting"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setFormattingOpen((o) => !o);
                    setLinkPopoverOpen(false);
                  }}
                  className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${
                    formattingOpen ? "bg-[#EAF7F0] text-[#038153]" : "text-[#68717A] hover:bg-[#F3F4F6] hover:text-[#2F3941]"
                  }`}>
                  <Type size={15} />
                </button>
                {formattingOpen && <FormattingToolbar editorRef={editorRef} onClose={() => setFormattingOpen(false)} />}
              </div>

              {/* Image */}
              <button type="button" title="Insert image" onClick={() => imageInputRef.current?.click()}
                className="w-8 h-8 flex items-center justify-center rounded-md text-[#68717A] hover:bg-[#F3F4F6] hover:text-[#2F3941] transition-colors">
                <Image size={15} />
              </button>
              <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden"
                onChange={(e) => handleFiles(e.target.files)} />

              {/* Link */}
              <div className="relative">
                <button type="button" title="Insert link" onClick={handleLinkButtonClick}
                  className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${
                    linkPopoverOpen ? "bg-[#EAF7F0] text-[#038153]" : "text-[#68717A] hover:bg-[#F3F4F6] hover:text-[#2F3941]"
                  }`}>
                  <Link2 size={15} />
                </button>
                {linkPopoverOpen && (
                  <LinkPopover onInsert={handleInsertLink}
                    onClose={() => { setLinkPopoverOpen(false); editingLinkRef.current = null; }}
                    initialText={initialLinkText} />
                )}
              </div>

              {/* Tags / Signature */}
              <div className="relative">
                <button type="button" title="Insert tag"
                  onClick={() => { setSignaturePickerOpen((o) => !o); setTemplatePickerOpen(false); setFormattingOpen(false); setLinkPopoverOpen(false); }}
                  className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${
                    signaturePickerOpen ? "bg-[#EAF7F0] text-[#038153]" : "text-[#68717A] hover:bg-[#F3F4F6] hover:text-[#2F3941]"
                  }`}>
                  <Braces size={15} />
                </button>
                {signaturePickerOpen && (
                  <SignaturePicker onInsert={handleInsertSignature} onClose={() => setSignaturePickerOpen(false)} />
                )}
              </div>

              <span className="w-px h-4 bg-[#D8DCDE] mx-1" />

              {/* Attachments */}
              <button type="button" onClick={() => fileInputRef.current?.click()} title="Attach file"
                className="w-8 h-8 flex items-center justify-center rounded-md text-[#68717A] hover:bg-[#F3F4F6] hover:text-[#2F3941] transition-colors">
                <Paperclip size={15} />
              </button>
              <input ref={fileInputRef} type="file" multiple className="hidden"
                onChange={(e) => handleFiles(e.target.files)} />

              <span className="w-px h-4 bg-[#D8DCDE] mx-1" />

              {/* Templates */}
              <div className="relative">
                <button type="button"
                  onClick={() => { setTemplatePickerOpen((o) => !o); setFormattingOpen(false); setLinkPopoverOpen(false); }}
                  className={`flex items-center gap-1 h-7 px-2.5 text-xs font-medium rounded-md transition-colors ${
                    templatePickerOpen ? "bg-[#EAF7F0] text-[#038153]" : "text-[#68717A] hover:bg-[#F3F4F6] hover:text-[#2F3941]"
                  }`}>
                  <FileText size={13} /> Insert template <ChevronDown size={11} />
                </button>
                {templatePickerOpen && (
                  <TemplatePicker onInsert={handleInsertTemplate} onClose={() => setTemplatePickerOpen(false)} />
                )}
              </div>
            </>
          )}

          <div className="flex-1" />
          {saveError && <span className="text-xs text-[#CC3340] mr-2">{saveError}</span>}

          <button onClick={handleSubmit} disabled={saving || !body.trim()}
            className="flex items-center gap-1.5 h-8 px-4 rounded-md text-sm font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 active:scale-95"
            style={{ background: "#038153" }}>
            {saving
              ? <Loader2 size={13} className="animate-spin" />
              : activeTab === "email" ? <Send size={13} /> : <FileText size={13} />}
            {activeTab === "email" ? "Send Email" : "Save Note"}
          </button>
        </div>

        {/* Attached files */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pb-3">
            {attachments.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-[#D8DCDE] bg-[#F8F9F9] text-[#2F3941]">
                <Paperclip size={11} className="text-[#68717A]" />
                {f.filename}
                <span className="text-[#68717A]">({fmtSize(f.size)})</span>
                <button type="button" onClick={() => removeAttachment(i)}
                  className="ml-0.5 text-[#68717A] hover:text-[#CC3340] transition-colors">
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Link tooltip */}
      {linkTooltip && (
        <LinkTooltip url={linkTooltip.url} x={linkTooltip.x} y={linkTooltip.y}
          onEdit={handleEditLink} onClose={() => setLinkTooltip(null)} />
      )}
    </div>
  );
}
