"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Mail, StickyNote, Loader2, Send, FileText, RefreshCw,
  ArrowDownLeft, ArrowUpRight, Type, Image, Link2, Braces,
  Paperclip, X, Check, Bold, Italic, Heading1, Heading2,
  Quote, List, ListOrdered, Pencil, ChevronDown, ChevronUp,
  Archive, CornerUpLeft, MessageSquare,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Activity {
  id: string;
  type: "email" | "note" | "sms";
  direction: "outbound" | "inbound";
  subject?: string | null;
  body: string;
  archived: boolean;
  created_at: string;
}

interface AttachmentFile {
  filename: string;
  content: string;   // base64
  contentType: string;
  size: number;
}

interface Props {
  contactId: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTimestamp(iso: string): string {
  const d = new Date(iso);
  const day   = String(d.getDate()).padStart(2, "0");
  const month = d.toLocaleString("en-GB", { month: "short" });
  const year  = d.getFullYear();
  const hh    = String(d.getHours()).padStart(2, "0");
  const mm    = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year}, ${hh}:${mm}`;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

function TabBar({
  active,
  onChange,
}: {
  active: "email" | "note" | "sms";
  onChange: (tab: "email" | "note" | "sms") => void;
}) {
  const tabs: { key: "email" | "note" | "sms"; label: string }[] = [
    { key: "email", label: "Email" },
    { key: "note",  label: "Internal Note" },
    { key: "sms",   label: "SMS" },
  ];
  return (
    <div className="flex border-b border-[#D8DCDE]">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={[
            "px-4 py-2.5 text-sm font-medium transition-colors focus:outline-none",
            active === t.key
              ? "border-b-2 border-[#038153] text-[#2F3941] -mb-px"
              : "text-[#68717A] hover:text-[#2F3941]",
          ].join(" ")}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

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
  editorRef,
  onClose,
}: {
  editorRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
}) {
  const [active, setActive] = useState<Record<string, boolean>>({});
  const toolbarRef = useRef<HTMLDivElement>(null);

  const queryActive = () => {
    try {
      const blockRaw = (document.queryCommandValue("formatBlock") ?? "")
        .toLowerCase()
        .replace(/^<|>$/g, "");
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
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleDown);
    return () => document.removeEventListener("mousedown", handleDown);
  }, [onClose, editorRef]);

  const isActive = (command: string, value?: string) =>
    command === "formatBlock"
      ? active[`block_${value?.toLowerCase() ?? ""}`] ?? false
      : active[command] ?? false;

  return (
    <div
      ref={toolbarRef}
      className="absolute z-50 bottom-full mb-2 left-0 flex items-center gap-0.5 bg-white rounded-lg border border-[#D8DCDE] shadow-lg px-1.5 py-1.5"
    >
      {FORMAT_COMMANDS.map(({ icon, label, command, value }) => {
        const on = isActive(command, value);
        return (
          <button
            key={label}
            type="button"
            title={label}
            onMouseDown={(e) => {
              e.preventDefault();
              editorRef.current?.focus();
              // eslint-disable-next-line @typescript-eslint/no-deprecated
              document.execCommand(command, false, value);
              requestAnimationFrame(() => queryActive());
            }}
            className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
              on ? "bg-[#EAF7F0] text-[#038153]" : "text-[#2F3941] hover:bg-[#F3F4F6]"
            }`}
          >
            {icon}
          </button>
        );
      })}
    </div>
  );
}

// ── Link popover ──────────────────────────────────────────────────────────────

function LinkPopover({
  onInsert,
  onClose,
  initialText = "",
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
      <input
        ref={urlRef}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleInsert(); if (e.key === "Escape") onClose(); }}
        placeholder="https://..."
        className="h-8 px-2.5 text-sm rounded-md border border-[#D8DCDE] text-[#2F3941] placeholder-[#C2C8CC] focus:outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153] transition-colors"
      />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleInsert(); if (e.key === "Escape") onClose(); }}
        placeholder="Display text (optional)"
        className="h-8 px-2.5 text-sm rounded-md border border-[#D8DCDE] text-[#2F3941] placeholder-[#C2C8CC] focus:outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153] transition-colors"
      />
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

interface EmailTemplate { id: string; name: string; subject: string | null; body: string; }

function TemplatePicker({
  onInsert,
  onClose,
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

// ── Signature picker ──────────────────────────────────────────────────────────

interface EmailSignature { id: string; name: string; body: string; }

function SignaturePicker({
  onInsert,
  onClose,
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
        className="text-sm truncate" style={{ color: "#1D6FA4" }}>
        {url}
      </a>
      <button type="button" onClick={onEdit}
        className="shrink-0 text-[#68717A] hover:text-[#2F3941] transition-colors" title="Edit link">
        <Pencil size={13} />
      </button>
    </div>
  );
}

// ── Activity item ─────────────────────────────────────────────────────────────

const HTML_TAG_RE = /<[a-z][\s\S]*?>/i;

function ActivityItem({
  activity,
  archiving,
  onArchive,
  onReply,
}: {
  activity: Activity;
  archiving: boolean;
  onArchive: () => void;
  onReply: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const isEmail   = activity.type === "email";
  const isSms     = activity.type === "sms";
  const isInbound = activity.direction === "inbound";

  const iconColor  = isEmail ? (isInbound ? "#038153" : "#1D6FA4") : isSms ? "#7C3AED" : "#B45309";
  const badgeBg    = isEmail ? (isInbound ? "#EAF7F0" : "#E8F2F9") : isSms ? "#F3F0FF" : "#FEF3C7";
  const badgeText  = isEmail ? (isInbound ? "#038153" : "#1D6FA4") : isSms ? "#7C3AED" : "#B45309";
  const badgeLabel = isEmail
    ? (isInbound ? "Received" : "Sent")
    : isSms
    ? (isInbound ? "SMS received" : `SMS → ${activity.subject ?? ""}`)
    : "Internal Note";

  const hasHtml = HTML_TAG_RE.test(activity.body);
  const previewText = hasHtml ? stripHtml(activity.body) : activity.body;

  return (
    <div className={[
      "group py-4 px-1 rounded-lg",
      isInbound ? "bg-[#F6FDF9]" : "",
    ].join(" ")}>
      <div className="flex gap-3">
        {/* Left icon column */}
        <div className="shrink-0 mt-0.5 flex flex-col items-center gap-1">
          {isEmail
            ? <Mail size={16} style={{ color: iconColor }} />
            : isSms
            ? <MessageSquare size={16} style={{ color: iconColor }} />
            : <StickyNote size={16} style={{ color: iconColor }} />}
          {(isEmail || isSms) && (isInbound
            ? <ArrowDownLeft size={10} style={{ color: iconColor }} />
            : <ArrowUpRight size={10} style={{ color: iconColor }} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header row: badge + timestamp + actions */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: badgeBg, color: badgeText }}>
              {badgeLabel}
            </span>
            <span className="text-xs text-[#68717A]">{fmtTimestamp(activity.created_at)}</span>
            {/* Action buttons — visible on hover */}
            {isEmail && (
              <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={onReply}
                  title="Reply"
                  className="flex items-center gap-1 h-6 px-2 text-[11px] font-medium rounded-md text-[#68717A] hover:text-[#1D6FA4] hover:bg-[#E8F2F9] transition-colors"
                >
                  <CornerUpLeft size={12} /> Reply
                </button>
                {!isInbound && (
                  <button
                    onClick={onArchive}
                    title="Delete sent email"
                    className="flex items-center gap-1 h-6 px-2 text-[11px] font-medium rounded-md text-[#68717A] hover:text-[#CC3340] hover:bg-[#FFF0F1] transition-colors"
                  >
                    {archiving
                      ? <Loader2 size={12} className="animate-spin" />
                      : <Archive size={12} />}
                    Archive
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Subject */}
          {isEmail && activity.subject && (
            <p className="text-sm font-semibold text-[#2F3941] mb-1 truncate">{activity.subject}</p>
          )}

          {/* Collapsed preview — always 3 lines max */}
          {!expanded && (
            <p className="text-sm text-[#68717A] line-clamp-3 break-words">{previewText}</p>
          )}

          {/* Expanded full content */}
          {expanded && (
            <div className="mt-2 rounded-lg border border-[#D8DCDE] bg-white overflow-hidden">
              <div className="px-4 py-3 max-h-[480px] overflow-y-auto">
                {hasHtml ? (
                  <div
                    className="text-sm break-words text-[#2F3941] [&_a]:text-[#1D6FA4] [&_a]:underline [&_h1]:text-base [&_h1]:font-bold [&_h2]:text-sm [&_h2]:font-bold [&_blockquote]:border-l-2 [&_blockquote]:border-[#D8DCDE] [&_blockquote]:pl-3 [&_blockquote]:text-[#68717A] [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4"
                    dangerouslySetInnerHTML={{ __html: activity.body }}
                  />
                ) : (
                  <p className="text-sm whitespace-pre-wrap break-words text-[#2F3941]">{activity.body}</p>
                )}
              </div>
            </div>
          )}

          {/* Expand / collapse toggle */}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-1.5 flex items-center gap-1 text-[11px] text-[#68717A] hover:text-[#038153] transition-colors"
          >
            {expanded
              ? <><ChevronUp size={12} /> Hide preview</>
              : <><ChevronDown size={12} /> Show preview</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ContactActivityFeed({ contactId }: Props) {
  // Compose state
  const [activeTab,  setActiveTab]  = useState<"email" | "note" | "sms">("email");
  const [subject,    setSubject]    = useState("");
  const [body,       setBody]       = useState("");
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [saving,     setSaving]     = useState(false);
  const [saveError,  setSaveError]  = useState<string | null>(null);

  // SMS state
  const [smsPhone,   setSmsPhone]   = useState("");
  const [smsBody,    setSmsBody]    = useState("");
  const [phones,     setPhones]     = useState<string[]>([]);

  // Refs
  const editorRef      = useRef<HTMLDivElement>(null);
  const composeRef     = useRef<HTMLDivElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const imageInputRef  = useRef<HTMLInputElement>(null);
  const savedRangeRef  = useRef<Range | null>(null);
  const editingLinkRef = useRef<HTMLAnchorElement | null>(null);

  // Toolbar popovers
  const [linkPopoverOpen,     setLinkPopoverOpen]     = useState(false);
  const [formattingOpen,      setFormattingOpen]      = useState(false);
  const [templatePickerOpen,  setTemplatePickerOpen]  = useState(false);
  const [signaturePickerOpen, setSignaturePickerOpen] = useState(false);
  const [initialLinkText,     setInitialLinkText]     = useState("");
  const [linkTooltip, setLinkTooltip] = useState<{ url: string; x: number; y: number; el: HTMLAnchorElement } | null>(null);

  // Feed state
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [reloadKey,  setReloadKey]  = useState(0);
  const [syncing,    setSyncing]    = useState(true);
  const [archiving,  setArchiving]  = useState<string | null>(null);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  // Fetch activities
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(null);
    fetch(`/api/contacts/${contactId}/activities`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load");
        return res.json() as Promise<Activity[]>;
      })
      .then((data) => { if (!cancelled) { setActivities(data); setLoading(false); } })
      .catch((err: unknown) => {
        if (!cancelled) { setFetchError(err instanceof Error ? err.message : "Failed to load"); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, [contactId, reloadKey]);

  // Auto-sync on mount
  useEffect(() => {
    setSyncing(true);
    fetch("/api/email-sync", { method: "POST" })
      .then((res) => res.json())
      .then((json) => { if ((json.synced ?? 0) > 0) reload(); })
      .catch(() => {})
      .finally(() => setSyncing(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);

  // Archive a sent email — moves it to Archived tab in Communications
  const handleArchive = async (activityId: string) => {
    setArchiving(activityId);
    await fetch(`/api/communications/${activityId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    }).catch(console.error);
    setArchiving(null);
    reload();
  };

  // Reply: pre-fill compose with quoted original
  const handleReply = (activity: Activity) => {
    setActiveTab("email");
    const reSubject = activity.subject
      ? (activity.subject.startsWith("Re:") ? activity.subject : `Re: ${activity.subject}`)
      : "";
    setSubject(reSubject);

    // Build quoted body as HTML
    const quotedHtml = `<br><br><blockquote style="border-left:2px solid #D8DCDE;padding-left:12px;color:#68717A;margin:0">${
      HTML_TAG_RE.test(activity.body) ? activity.body : activity.body.replace(/\n/g, "<br>")
    }</blockquote>`;

    if (editorRef.current) {
      editorRef.current.innerHTML = quotedHtml;
      setBody(editorRef.current.innerText?.trim() ?? "");
      // Move cursor to start
      const range = document.createRange();
      const sel   = window.getSelection();
      range.setStart(editorRef.current, 0);
      range.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }

    // Scroll compose area into view
    composeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => editorRef.current?.focus(), 300);
  };

  const handleTabChange = (tab: "email" | "note" | "sms") => {
    setActiveTab(tab);
    setSubject("");
    setBody("");
    setAttachments([]);
    setSaveError(null);
    setLinkPopoverOpen(false);
    setFormattingOpen(false);
    setTemplatePickerOpen(false);
    setSignaturePickerOpen(false);
    setLinkTooltip(null);
    if (editorRef.current) editorRef.current.innerHTML = "";

    // Load contact phones when switching to SMS tab
    if (tab === "sms" && phones.length === 0) {
      fetch(`/api/contacts/${contactId}`)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (!data?.field_values) return;
          const fv = data.field_values as Record<string, unknown>;
          const phoneEntries = Object.values(fv).find(
            (v) => Array.isArray(v) && v.length > 0 && typeof (v as any[])[0]?.number === "string"
          ) as { number: string }[] | undefined;
          const nums = (phoneEntries ?? []).map((p) => p.number).filter(Boolean);
          if (nums.length > 0) {
            setPhones(nums);
            setSmsPhone(nums[0]);
          }
        })
        .catch(() => {});
    }
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

  function fmtSize(bytes: number) {
    if (bytes < 1024)          return `${bytes} B`;
    if (bytes < 1024 * 1024)   return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const handleSubmit = async () => {
    const htmlBody = editorRef.current?.innerHTML ?? "";
    const textBody = editorRef.current?.innerText?.trim() ?? "";
    if (!textBody) return;

    setSaving(true);
    setSaveError(null);
    try {
      const payload: {
        type: "email" | "note" | "sms";
        subject?: string;
        body: string;
        html?: string;
        attachments?: AttachmentFile[];
      } = { type: activeTab, body: textBody, html: htmlBody };
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

      setSubject("");
      setBody("");
      setAttachments([]);
      if (editorRef.current) editorRef.current.innerHTML = "";
      reload();
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleSmsSubmit = async () => {
    if (!smsPhone.trim() || !smsBody.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/contacts/${contactId}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "sms", phone: smsPhone.trim(), body: smsBody.trim() }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? "Failed to send SMS");
      }
      setSmsBody("");
      reload();
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const reversed = [...activities].reverse();

  return (
    <div className="flex flex-col gap-4">

      {/* Compose */}
      <div ref={composeRef} className="bg-white rounded-xl border border-[#D8DCDE] shadow-sm overflow-visible">
        <TabBar active={activeTab} onChange={handleTabChange} />
        <div className="flex flex-col">
          {activeTab === "email" && (
            <div className="px-4 pt-3">
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
                className="w-full h-9 px-3 text-sm rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] placeholder-[#C2C8CC] focus:outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153] transition-colors"
              />
            </div>
          )}

          {/* ── SMS compose ── */}
          {activeTab === "sms" && (
            <div className="px-4 pt-3 flex flex-col gap-3">
              {/* Phone selector */}
              <div className="flex items-center gap-2">
                {phones.length > 1 ? (
                  <select
                    value={smsPhone}
                    onChange={(e) => setSmsPhone(e.target.value)}
                    className="flex-1 h-9 px-3 text-sm rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] focus:outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153] transition-colors"
                  >
                    {phones.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                ) : (
                  <input
                    type="tel"
                    value={smsPhone}
                    onChange={(e) => setSmsPhone(e.target.value)}
                    placeholder="Phone number"
                    className="flex-1 h-9 px-3 text-sm rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] placeholder-[#C2C8CC] focus:outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153] transition-colors"
                  />
                )}
              </div>
              {/* Message textarea */}
              <div className="relative">
                <textarea
                  value={smsBody}
                  onChange={(e) => setSmsBody(e.target.value)}
                  placeholder="Write your SMS message..."
                  rows={4}
                  className="w-full px-3 py-2 text-sm rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] placeholder-[#C2C8CC] focus:outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153] transition-colors resize-none"
                />
                <span className="absolute bottom-2 right-2 text-[10px] text-[#68717A]">
                  {smsBody.length}/160
                </span>
              </div>
              {/* Send row */}
              <div className="flex items-center justify-end gap-2 pb-1">
                {saveError && <span className="text-xs text-[#CC3340] mr-auto">{saveError}</span>}
                <button
                  onClick={handleSmsSubmit}
                  disabled={saving || !smsPhone.trim() || !smsBody.trim()}
                  className="flex items-center gap-1.5 h-8 px-4 rounded-md text-sm font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 active:scale-95"
                  style={{ background: "#038153" }}
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <MessageSquare size={13} />}
                  Send SMS
                </button>
              </div>
            </div>
          )}

          <div className="px-4 pt-3" style={{ display: activeTab === "sms" ? "none" : undefined }}>
            <div className="relative">
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={() => setBody(editorRef.current?.innerText?.trim() ?? "")}
                onClick={handleEditorClick}
                className="w-full min-h-[96px] px-3 py-2 text-sm rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] focus:outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153] transition-colors"
                style={{ resize: "vertical", overflow: "auto" }}
              />
              {!body && (
                <div className="absolute top-2 left-3 text-sm text-[#C2C8CC] pointer-events-none select-none">
                  {activeTab === "email" ? "Write your email..." : "Write a note..."}
                </div>
              )}
            </div>
          </div>

          {/* Toolbar + send row — hidden for SMS (SMS has its own send UI above) */}
          <div className="flex items-center gap-1 px-3 py-2.5 border-t border-[#D8DCDE] mt-2"
            style={{ display: activeTab === "sms" ? "none" : undefined }}>
            {activeTab === "email" && (
              <>
                <div className="relative">
                  <button type="button" title="Text formatting"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setFormattingOpen((o) => !o);
                      setLinkPopoverOpen(false);
                    }}
                    className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${
                      formattingOpen ? "bg-[#EAF7F0] text-[#038153]" : "text-[#68717A] hover:bg-[#F3F4F6] hover:text-[#2F3941]"
                    }`}
                  >
                    <Type size={15} />
                  </button>
                  {formattingOpen && (
                    <FormattingToolbar editorRef={editorRef} onClose={() => setFormattingOpen(false)} />
                  )}
                </div>

                <button type="button" title="Insert image" onClick={() => imageInputRef.current?.click()}
                  className="w-8 h-8 flex items-center justify-center rounded-md text-[#68717A] hover:bg-[#F3F4F6] hover:text-[#2F3941] transition-colors">
                  <Image size={15} />
                </button>
                <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => handleFiles(e.target.files)} />

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

                <button type="button" onClick={() => fileInputRef.current?.click()} title="Attach file"
                  className="w-8 h-8 flex items-center justify-center rounded-md text-[#68717A] hover:bg-[#F3F4F6] hover:text-[#2F3941] transition-colors">
                  <Paperclip size={15} />
                </button>
                <input ref={fileInputRef} type="file" multiple className="hidden"
                  onChange={(e) => handleFiles(e.target.files)} />

                <span className="w-px h-4 bg-[#D8DCDE] mx-1" />

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
      </div>

      {/* Link tooltip */}
      {linkTooltip && (
        <LinkTooltip url={linkTooltip.url} x={linkTooltip.x} y={linkTooltip.y}
          onEdit={handleEditLink} onClose={() => setLinkTooltip(null)} />
      )}

      {/* Feed */}
      <div className="bg-white rounded-xl border border-[#D8DCDE] shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#D8DCDE]">
          <span className="text-[11px] font-semibold text-[#68717A] uppercase tracking-wider">Activity</span>
          {syncing && (
            <span className="flex items-center gap-1.5 text-xs text-[#68717A]">
              <RefreshCw size={11} className="animate-spin" /> Syncing inbox...
            </span>
          )}
        </div>
        <div className={`px-4 transition-all duration-300 ${syncing ? "blur-sm pointer-events-none select-none" : ""}`}>
          {loading ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 size={20} className="animate-spin text-[#68717A]" />
            </div>
          ) : fetchError ? (
            <div className="py-10 text-center"><p className="text-sm text-[#CC3340]">{fetchError}</p></div>
          ) : reversed.length === 0 ? (
            <div className="py-10 text-center"><p className="text-sm text-[#C2C8CC]">No activity yet</p></div>
          ) : (
            <div className="divide-y divide-[#D8DCDE]">
              {reversed.map((activity) => (
                <ActivityItem
                  key={activity.id}
                  activity={activity}
                  archiving={archiving === activity.id}
                  onArchive={() => handleArchive(activity.id)}
                  onReply={() => handleReply(activity)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
