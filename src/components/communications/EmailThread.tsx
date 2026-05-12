"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Loader2, ArrowLeft, Mail, Phone, Briefcase, StickyNote,
} from "lucide-react";
import MessageComposer from "./MessageComposer";

// ── Types ─────────────────────────────────────────────────────────────────────

type FieldValues = Record<string, unknown>;

interface Activity {
  id: string;
  contact_id: string;
  contact: { id: string; field_values: FieldValues | null };
  subject: string | null;
  body: string;
  type: "email" | "note";
  direction: "inbound" | "outbound";
  deal_id: string | null;
  deal: { id: string; field_values: FieldValues | null } | null;
  archived: boolean;
  is_draft: boolean;
  is_spam: boolean;
  is_read: boolean;
  thread_id: string | null;
  created_at: string;
  platform?: { name: string; slug: string } | null;
}

interface ThreadMessage {
  id: string;
  type: "email" | "note";
  direction: "inbound" | "outbound";
  subject: string | null;
  body: string;
  is_draft: boolean;
  created_at: string;
}

interface ContactDeal {
  id: string;
  field_values: FieldValues | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMainEmail(fv: FieldValues | null): string {
  const emails = fv?.emails as { address?: string; is_main?: boolean }[] | undefined;
  if (!Array.isArray(emails) || emails.length === 0) return "";
  const main = emails.find(e => e.is_main) ?? emails[0];
  return main?.address ?? "";
}

function contactName(fv: FieldValues | null): string {
  const first = (fv?.first_name as string) ?? "";
  const last  = (fv?.last_name  as string) ?? "";
  const name = [first, last].filter(Boolean).join(" ").trim();
  if (name) return name;
  return getMainEmail(fv) || "—";
}

function initials(fv: FieldValues | null): string {
  const first = ((fv?.first_name as string) ?? "").trim();
  const last  = ((fv?.last_name  as string) ?? "").trim();
  const fromName = [(first[0] ?? ""), (last[0] ?? "")].join("").toUpperCase();
  if (fromName) return fromName;
  const email = getMainEmail(fv);
  return email.charAt(0).toUpperCase() || "?";
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function getEmails(fv: FieldValues | null): string[] {
  const raw = fv?.emails;
  if (Array.isArray(raw)) {
    return raw.map((e: { address?: string } | string) =>
      typeof e === "string" ? e : (e.address ?? "")
    ).filter(Boolean);
  }
  return [];
}

function getPhones(fv: FieldValues | null): string[] {
  const raw = fv?.phones ?? fv?.phone;
  if (Array.isArray(raw)) {
    return raw.map((p: { number?: string } | string) =>
      typeof p === "string" ? p : (p.number ?? "")
    ).filter(Boolean);
  }
  if (typeof raw === "string" && raw) return [raw];
  return [];
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  contactFv,
}: {
  msg: ThreadMessage;
  contactFv: FieldValues | null;
}) {
  const isOutbound = msg.direction === "outbound";
  const isNote = msg.type === "note";

  return (
    <div className={`rounded-xl border shadow-sm overflow-hidden ${
      isNote
        ? "border-[#FDE68A] bg-[#FFFBEB]"
        : isOutbound
        ? "border-[#B7E5D0] bg-[#F0FDF8]"
        : "border-[#D8DCDE] bg-white"
    }`}>
      {/* Message header */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Avatar */}
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
          isNote ? "bg-[#F59E0B]" : isOutbound ? "bg-[#038153]" : "bg-[#6B7280]"
        }`}>
          {isNote
            ? <StickyNote size={15} />
            : isOutbound
            ? "Me"
            : initials(contactFv)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[#2F3941]">
              {isNote
                ? "Internal Note"
                : isOutbound
                ? "You"
                : contactName(contactFv)}
            </span>
            {msg.is_draft && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#FFF0F1] border border-[#FCA5A5] text-[#CC3340] font-medium">
                Draft
              </span>
            )}
          </div>
          <div className="text-[11px] text-[#68717A]">{fmtTime(msg.created_at)}</div>
        </div>
      </div>

      {/* Message body — always visible */}
      <div className="px-4 pb-4 border-t border-[#D8DCDE]/50">
        <div
          className="mt-3 text-sm text-[#2F3941] leading-relaxed prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: msg.body || "<em>No content</em>" }}
        />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  activity: Activity;
  platformSlug: string;
  onClose: () => void;
  onRefresh: () => void;
}

export default function EmailThread({ activity, platformSlug, onClose, onRefresh }: Props) {
  const [thread, setThread]       = useState<ThreadMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [deals, setDeals]         = useState<ContactDeal[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchThread = useCallback(async () => {
    if (!activity.thread_id) {
      setThread([{
        id: activity.id,
        type: activity.type,
        direction: activity.direction,
        subject: activity.subject,
        body: activity.body,
        is_draft: activity.is_draft,
        created_at: activity.created_at,
      }]);
      return;
    }
    setThreadLoading(true);
    try {
      const res = await fetch(`/api/communications?thread_id=${encodeURIComponent(activity.thread_id)}&page=1`);
      const data = await res.json();
      const msgs: ThreadMessage[] = (data.activities ?? []).map((a: Activity) => ({
        id: a.id,
        type: a.type,
        direction: a.direction,
        subject: a.subject,
        body: a.body,
        is_draft: a.is_draft,
        created_at: a.created_at,
      }));
      msgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      setThread(msgs);
    } catch {
      setThread([]);
    } finally {
      setThreadLoading(false);
    }
  }, [activity.thread_id, activity.id, activity.type, activity.direction, activity.subject, activity.body, activity.is_draft, activity.created_at]);

  const fetchDeals = useCallback(async () => {
    try {
      const res = await fetch(`/api/contacts/${activity.contact_id}/deals`);
      if (res.ok) setDeals(await res.json());
    } catch { /* no deals API yet */ }
  }, [activity.contact_id]);

  useEffect(() => {
    fetchThread();
    fetchDeals();
  }, [fetchThread, fetchDeals]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  const contactFv = activity.contact.field_values;
  const emails    = getEmails(contactFv);
  const phones    = getPhones(contactFv);

  const handleReplySent = () => {
    fetchThread();
    onRefresh();
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Thread area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Thread header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#D8DCDE] bg-white shrink-0">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#68717A] hover:text-[#2F3941] hover:bg-[#F3F4F6] transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-[#2F3941] truncate">
              {activity.subject || "(no subject)"}
            </h2>
            <p className="text-xs text-[#68717A]">
              {contactName(contactFv)}
              {thread.length > 1 && ` · ${thread.length} messages`}
            </p>
          </div>
          {activity.platform && (
            <span className="text-[10px] px-2 py-1 rounded-full bg-[#F3F4F6] text-[#68717A] font-medium shrink-0">
              {activity.platform.name}
            </span>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {threadLoading && (
            <div className="flex justify-center py-8">
              <Loader2 size={18} className="animate-spin text-[#68717A]" />
            </div>
          )}
          {!threadLoading && thread.map(msg => (
            <MessageBubble key={msg.id} msg={msg} contactFv={contactFv} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Composer — Email + Internal Note tabs */}
        {!activity.is_draft && (
          <div className="px-5 pb-5 pt-3 shrink-0 border-t border-[#D8DCDE] bg-[#F8F9F9]">
            <MessageComposer
              contactId={activity.contact_id}
              defaultSubject={activity.subject ? (activity.subject.startsWith("Re:") ? activity.subject : `Re: ${activity.subject}`) : ""}
              defaultTab="email"
              threadId={activity.thread_id}
              onSent={handleReplySent}
            />
          </div>
        )}
      </div>

      {/* ── Contact info panel ── */}
      <div className="w-56 shrink-0 border-l border-[#D8DCDE] bg-white overflow-y-auto flex flex-col">
        <div className="p-4 border-b border-[#D8DCDE]">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-2 mb-3">
            <div className="w-12 h-12 rounded-full bg-[#038153] flex items-center justify-center text-white text-base font-bold">
              {initials(contactFv)}
            </div>
            <div className="text-center">
              <a
                href={`/${platformSlug}/contacts/${activity.contact_id}`}
                className="text-sm font-semibold text-[#038153] hover:underline"
              >
                {contactName(contactFv)}
              </a>
            </div>
          </div>

          {/* Emails */}
          {emails.length > 0 && (
            <div className="space-y-1.5">
              {emails.map(e => (
                <div key={e} className="flex items-center gap-1.5 text-[11px] text-[#68717A]">
                  <Mail size={10} className="shrink-0 text-[#038153]" />
                  <span className="truncate">{e}</span>
                </div>
              ))}
            </div>
          )}

          {/* Phones */}
          {phones.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {phones.map(p => (
                <div key={p} className="flex items-center gap-1.5 text-[11px] text-[#68717A]">
                  <Phone size={10} className="shrink-0 text-[#038153]" />
                  <span className="truncate">{p}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Deals */}
        {deals.length > 0 && (
          <div className="p-4">
            <p className="text-[10px] font-semibold text-[#68717A] uppercase tracking-wider mb-2">Deals</p>
            <div className="space-y-1.5">
              {deals.map(d => (
                <a
                  key={d.id}
                  href={`/${platformSlug}/deals/${d.id}`}
                  className="flex items-center gap-1.5 text-[11px] text-[#038153] hover:underline"
                >
                  <Briefcase size={10} className="shrink-0" />
                  <span className="truncate">
                    {(d.field_values?.deal_name as string) || "Unnamed deal"}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
