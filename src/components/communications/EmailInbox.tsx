"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { createPortal } from "react-dom";
import {
  Search, Loader2, Inbox, Send, Archive, Briefcase,
  X, Check, ArchiveRestore, FileEdit, ChevronDown,
  AlertOctagon, StickyNote,
} from "lucide-react";
import EmailThread from "./EmailThread";
import ComposeModal from "./ComposeModal";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "inbox" | "drafts" | "sent" | "archived" | "spam";
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

interface InboxResponse {
  activities: Activity[];
  total: number;
  page: number;
  pages: number;
  isSuperAdmin: boolean;
  allPlatforms: { id: string; name: string; slug: string }[];
}

interface DealResult {
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

function dealName(fv: FieldValues | null): string {
  return (fv?.deal_name as string) || "Unnamed deal";
}

function relativeTime(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 2)   return "just now";
  if (mins < 60)  return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7)   return `${days}d`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function initials(fv: FieldValues | null): string {
  const first = ((fv?.first_name as string) ?? "").trim();
  const last  = ((fv?.last_name  as string) ?? "").trim();
  const fromName = [(first[0] ?? ""), (last[0] ?? "")].join("").toUpperCase();
  if (fromName) return fromName;
  const email = getMainEmail(fv);
  return email.charAt(0).toUpperCase() || "?";
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

// ── Deal picker popover ───────────────────────────────────────────────────────

function DealPicker({
  anchor, currentDealId, onClose, onPick,
}: {
  anchor: DOMRect;
  currentDealId: string | null;
  onClose: () => void;
  onPick: (dealId: string | null) => Promise<void>;
}) {
  const [search, setSearch]   = useState("");
  const [deals, setDeals]     = useState<DealResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [onClose]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/deals?page=1${search ? `&search=${encodeURIComponent(search)}` : ""}`);
        const data = await res.json();
        setDeals(data.deals ?? []);
      } catch { setDeals([]); }
      finally  { setLoading(false); }
    }, 200);
    return () => clearTimeout(t);
  }, [search]);

  const pick = async (id: string | null) => {
    setSaving(id ?? "__clear__");
    await onPick(id);
    setSaving(null);
    onClose();
  };

  const openUp = typeof window !== "undefined" && window.innerHeight - anchor.bottom < 300;

  return createPortal(
    <div ref={ref} style={{
      position: "fixed",
      top:    openUp ? undefined : anchor.bottom + 4,
      bottom: openUp ? window.innerHeight - anchor.top + 4 : undefined,
      left:   Math.min(anchor.left, (typeof window !== "undefined" ? window.innerWidth : 1200) - 300),
      width:  280,
      zIndex: 9999,
    }} className="bg-white rounded-xl border border-[#D8DCDE] shadow-2xl overflow-hidden flex flex-col">
      <div className="p-2 border-b border-[#D8DCDE]">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#68717A]" />
          <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search deals..."
            className="w-full h-8 pl-8 pr-2 text-sm rounded-md border border-[#D8DCDE] outline-none focus:border-[#038153] focus:ring-2 focus:ring-[#038153]/15" />
        </div>
      </div>
      <div className="overflow-y-auto" style={{ maxHeight: 240 }}>
        {loading && <div className="flex justify-center py-4"><Loader2 size={14} className="animate-spin text-[#68717A]" /></div>}
        {!loading && currentDealId && (
          <button onClick={() => pick(null)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#68717A] hover:bg-[#FFF0F1] hover:text-[#CC3340] text-left transition-colors">
            <X size={11} /> Remove association
          </button>
        )}
        {!loading && deals.length === 0 && <p className="text-xs text-[#68717A] text-center py-4">No deals found</p>}
        {!loading && deals.map(deal => (
          <button key={deal.id} onClick={() => pick(deal.id)}
            className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left transition-colors ${deal.id === currentDealId ? "bg-[#EAF7F0] text-[#038153] font-medium" : "text-[#2F3941] hover:bg-[#F8F9F9]"}`}>
            {saving === deal.id
              ? <Loader2 size={12} className="animate-spin shrink-0" />
              : <span className="w-3 shrink-0">{deal.id === currentDealId && <Check size={11} />}</span>}
            <Briefcase size={12} className="text-[#68717A] shrink-0" />
            <span className="truncate">{dealName(deal.field_values)}</span>
          </button>
        ))}
      </div>
    </div>,
    document.body
  );
}

// ── Platform dropdown (super admin) ───────────────────────────────────────────

function PlatformFilter({
  platforms,
  value,
  onChange,
}: {
  platforms: { id: string; name: string; slug: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, []);

  const label = value === "all"
    ? "All platforms"
    : platforms.find(p => p.id === value)?.name ?? "All platforms";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] hover:bg-[#F3F4F6] transition-colors whitespace-nowrap"
      >
        {label}
        <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 right-0 w-48 bg-white rounded-lg border border-[#D8DCDE] shadow-lg overflow-hidden z-50">
          <button
            onClick={() => { onChange("all"); setOpen(false); }}
            className={`w-full text-left px-3 py-2 text-sm transition-colors ${value === "all" ? "bg-[#EAF7F0] text-[#038153] font-medium" : "text-[#2F3941] hover:bg-[#F8F9F9]"}`}
          >
            All platforms
          </button>
          {platforms.map(p => (
            <button
              key={p.id}
              onClick={() => { onChange(p.id); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${value === p.id ? "bg-[#EAF7F0] text-[#038153] font-medium" : "text-[#2F3941] hover:bg-[#F8F9F9]"}`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tabs config ───────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "inbox",    label: "Inbox",    icon: Inbox         },
  { id: "drafts",   label: "Drafts",   icon: FileEdit      },
  { id: "sent",     label: "Sent",     icon: Send          },
  { id: "archived", label: "Archived", icon: Archive       },
  { id: "spam",     label: "Spam",     icon: AlertOctagon  },
];

// ── Empty state icons ─────────────────────────────────────────────────────────

const TAB_ICONS: Record<Tab, React.ElementType> = {
  inbox:    Inbox,
  drafts:   FileEdit,
  sent:     Send,
  archived: Archive,
  spam:     AlertOctagon,
};

// ── Main component ────────────────────────────────────────────────────────────

export default function EmailInbox() {
  const params = useParams();
  const platform = (params?.platform as string) ?? "";

  const [tab, setTab]             = useState<Tab>("inbox");
  const [data, setData]           = useState<InboxResponse | null>(null);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [page, setPage]           = useState(1);
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [picker, setPicker]       = useState<{ activityId: string; dealId: string | null; anchor: DOMRect } | null>(null);
  const [archiving, setArchiving] = useState<string | null>(null);
  const [markingRead, setMarkingRead] = useState<string | null>(null);

  const selectedActivity = data?.activities.find(a => a.id === selectedId) ?? null;

  const fetchData = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), tab });
    if (search) qs.set("search", search);
    if (isSuperAdmin) qs.set("platform", platformFilter);
    try {
      const res = await fetch(`/api/communications?${qs}`);
      const text = await res.text();
      const json = text ? JSON.parse(text) : { activities: [], total: 0, page: 1, pages: 0 };
      setData(json);
      if (json.isSuperAdmin !== undefined) setIsSuperAdmin(json.isSuperAdmin);
    } catch (err) {
      console.error("[EmailInbox] fetch failed", err);
      setData({ activities: [], total: 0, page: 1, pages: 0, isSuperAdmin: false, allPlatforms: [] });
    } finally {
      setLoading(false);
    }
  }, [page, search, tab, platformFilter, isSuperAdmin]);

  useEffect(() => {
    const t = setTimeout(fetchData, 250);
    return () => clearTimeout(t);
  }, [fetchData]);

  // Reset page when tab or search changes
  useEffect(() => { setPage(1); setSelectedId(null); }, [tab, search]);

  const handleDealPick = async (activityId: string, dealId: string | null) => {
    await fetch(`/api/communications/${activityId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deal_id: dealId }),
    });
    fetchData();
  };

  const handleArchive = async (e: React.MouseEvent, activityId: string, archive: boolean) => {
    e.stopPropagation();
    setArchiving(activityId);
    await fetch(`/api/communications/${activityId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: archive }),
    });
    setArchiving(null);
    if (selectedId === activityId) setSelectedId(null);
    fetchData();
  };

  const handleMarkSpam = async (e: React.MouseEvent, activityId: string, spam: boolean) => {
    e.stopPropagation();
    await fetch(`/api/communications/${activityId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_spam: spam }),
    });
    if (selectedId === activityId) setSelectedId(null);
    fetchData();
  };

  const handleSelectActivity = async (activity: Activity) => {
    setSelectedId(activity.id);
    if (!activity.is_read) {
      setMarkingRead(activity.id);
      await fetch(`/api/communications/${activity.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_read: true }),
      });
      setMarkingRead(null);
      // Optimistically update local state
      setData(d => d ? {
        ...d,
        activities: d.activities.map(a => a.id === activity.id ? { ...a, is_read: true } : a),
      } : d);
    }
  };

  const EmptyIcon = TAB_ICONS[tab];
  const emptyLabel =
    tab === "inbox"    ? "No inbound emails yet" :
    tab === "drafts"   ? "No drafts" :
    tab === "sent"     ? "No sent emails yet" :
    tab === "spam"     ? "No spam" :
    "No archived emails";

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left panel ── */}
      <div className="w-[360px] shrink-0 flex flex-col border-r border-[#D8DCDE] h-full overflow-hidden bg-white">
        {/* Tab bar */}
        <div className="flex items-center gap-0 px-3 border-b border-[#D8DCDE] shrink-0 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1 px-3 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === id
                  ? "border-[#038153] text-[#038153]"
                  : "border-transparent text-[#68717A] hover:text-[#2F3941]"
              }`}
            >
              <Icon size={12} strokeWidth={1.8} />
              {label}
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#D8DCDE] shrink-0">
          <div className="relative flex-1">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#68717A]" />
            <input type="text" placeholder="Search…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-2 h-8 text-xs rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] placeholder:text-[#68717A] outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153]/30 transition-all" />
          </div>
          {isSuperAdmin && (
            <PlatformFilter
              platforms={data?.allPlatforms ?? []}
              value={platformFilter}
              onChange={v => { setPlatformFilter(v); setPage(1); }}
            />
          )}
          <button
            onClick={() => setShowCompose(true)}
            className="flex items-center gap-1 h-8 px-3 text-xs font-semibold rounded-md text-white transition-colors hover:brightness-110 shrink-0"
            style={{ background: "#038153" }}
          >
            <FileEdit size={12} />
            Compose
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center h-32">
              <Loader2 size={18} className="animate-spin text-[#68717A]" />
            </div>
          )}

          {!loading && data?.activities.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-[#68717A]">
              <EmptyIcon size={28} strokeWidth={1.2} />
              <p className="text-xs font-medium">
                {search ? `No results for "${search}"` : emptyLabel}
              </p>
            </div>
          )}

          {!loading && data?.activities.map((activity) => {
            const name    = contactName(activity.contact.field_values);
            const ini     = initials(activity.contact.field_values);
            const unread  = !activity.is_read;
            const isNote  = activity.type === "note";
            const preview = stripHtml(activity.body).slice(0, 60);
            const selected = activity.id === selectedId;

            return (
              <div
                key={activity.id}
                onClick={() => handleSelectActivity(activity)}
                className={`group flex items-start gap-2.5 px-3 py-3 cursor-pointer border-b border-[#F3F4F6] transition-colors ${
                  selected ? "bg-[#EAF7F0]" : "hover:bg-[#F8F9F9]"
                }`}
              >
                {/* Unread dot */}
                <div className="w-1.5 shrink-0 mt-2">
                  {unread && !markingRead && (
                    <div className="w-1.5 h-1.5 rounded-full bg-[#038153]" />
                  )}
                </div>

                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 ${isNote ? "bg-[#F59E0B]" : "bg-[#038153]"}`}>
                  {isNote ? <StickyNote size={14} /> : ini}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className={`text-xs truncate flex-1 ${unread ? "font-bold text-[#2F3941]" : "font-medium text-[#2F3941]"}`}>
                      {name}
                    </span>
                    {activity.platform && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#F3F4F6] text-[#68717A] shrink-0 leading-tight">
                        {activity.platform.name}
                      </span>
                    )}
                    <span className="text-[10px] text-[#68717A] shrink-0 ml-1">
                      {relativeTime(activity.created_at)}
                    </span>
                  </div>
                  <div className={`text-xs truncate mt-0.5 ${unread ? "font-semibold text-[#2F3941]" : "text-[#2F3941]"}`}>
                    {activity.is_draft && <span className="text-[#CC3340] mr-1">[Draft]</span>}
                    {activity.subject || "(no subject)"}
                  </div>
                  <div className="text-[11px] text-[#68717A] truncate mt-0.5">
                    {preview || "—"}
                  </div>

                  {/* Deal badge + actions row */}
                  <div className="flex items-center gap-1.5 mt-1">
                    {activity.deal ? (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setPicker({ activityId: activity.id, dealId: activity.deal_id, anchor: e.currentTarget.getBoundingClientRect() });
                        }}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-[#EAF7F0] border border-[#B7E5D0] text-[#038153] hover:brightness-95 shrink-0 transition-all"
                      >
                        <Briefcase size={9} />
                        {dealName(activity.deal.field_values)}
                      </button>
                    ) : tab !== "archived" && tab !== "spam" ? (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setPicker({ activityId: activity.id, dealId: null, anchor: e.currentTarget.getBoundingClientRect() });
                        }}
                        className="text-[10px] text-[#C2C8CC] hover:text-[#038153] transition-colors opacity-0 group-hover:opacity-100"
                      >
                        + deal
                      </button>
                    ) : null}

                    <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Archive/Unarchive */}
                      {tab === "archived" ? (
                        <button
                          onClick={e => handleArchive(e, activity.id, false)}
                          title="Unarchive"
                          className="p-1 rounded text-[#68717A] hover:text-[#038153] hover:bg-[#EAF7F0] transition-colors"
                        >
                          {archiving === activity.id
                            ? <Loader2 size={11} className="animate-spin" />
                            : <ArchiveRestore size={11} />}
                        </button>
                      ) : tab !== "spam" && (
                        <button
                          onClick={e => handleArchive(e, activity.id, true)}
                          title="Archive"
                          className="p-1 rounded text-[#68717A] hover:text-[#CC3340] hover:bg-[#FFF0F1] transition-colors"
                        >
                          {archiving === activity.id
                            ? <Loader2 size={11} className="animate-spin" />
                            : <Archive size={11} />}
                        </button>
                      )}
                      {/* Spam / Not spam */}
                      {tab === "spam" ? (
                        <button
                          onClick={e => handleMarkSpam(e, activity.id, false)}
                          title="Not spam"
                          className="p-1 rounded text-[#68717A] hover:text-[#038153] hover:bg-[#EAF7F0] transition-colors"
                        >
                          <Check size={11} />
                        </button>
                      ) : tab !== "archived" && (
                        <button
                          onClick={e => handleMarkSpam(e, activity.id, true)}
                          title="Mark as spam"
                          className="p-1 rounded text-[#68717A] hover:text-[#CC3340] hover:bg-[#FFF0F1] transition-colors"
                        >
                          <AlertOctagon size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-[#D8DCDE] bg-[#F8F9F9] shrink-0">
            <span className="text-[10px] text-[#68717A]">Page {page}/{data.pages}</span>
            <div className="flex gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="h-6 px-2.5 text-[10px] font-medium rounded border border-[#D8DCDE] bg-white text-[#2F3941] hover:bg-[#F3F4F6] disabled:opacity-40 disabled:cursor-not-allowed">
                ‹ Prev
              </button>
              <button disabled={page === data.pages} onClick={() => setPage(p => p + 1)}
                className="h-6 px-2.5 text-[10px] font-medium rounded border border-[#D8DCDE] bg-white text-[#2F3941] hover:bg-[#F3F4F6] disabled:opacity-40 disabled:cursor-not-allowed">
                Next ›
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 overflow-hidden bg-[#F8F9F9]">
        {selectedActivity ? (
          <EmailThread
            activity={selectedActivity}
            platformSlug={platform}
            onClose={() => setSelectedId(null)}
            onRefresh={fetchData}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-[#C2C8CC]">
            <Inbox size={40} strokeWidth={1} />
            <p className="text-sm">Select a message to read</p>
          </div>
        )}
      </div>

      {/* Deal picker */}
      {picker && (
        <DealPicker
          anchor={picker.anchor}
          currentDealId={picker.dealId}
          onClose={() => setPicker(null)}
          onPick={dealId => handleDealPick(picker.activityId, dealId)}
        />
      )}

      {/* Compose modal */}
      {showCompose && (
        <ComposeModal
          onClose={() => setShowCompose(false)}
          onSent={() => { setShowCompose(false); setTab("sent"); fetchData(); }}
          onDraft={() => { setShowCompose(false); setTab("drafts"); fetchData(); }}
        />
      )}
    </div>
  );
}
