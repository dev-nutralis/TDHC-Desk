"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Search, Loader2, Inbox, Send, Archive, Briefcase, X, Check, ArchiveRestore } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "inbox" | "sent" | "archived";
type FieldValues = Record<string, unknown>;

interface Activity {
  id: string;
  contact_id: string;
  contact: { id: string; field_values: FieldValues | null };
  subject: string | null;
  body: string;
  deal_id: string | null;
  deal: { id: string; field_values: FieldValues | null } | null;
  archived: boolean;
  created_at: string;
}

interface InboxResponse {
  activities: Activity[];
  total: number;
  page: number;
  pages: number;
}

interface DealResult {
  id: string;
  field_values: FieldValues | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function contactName(fv: FieldValues | null): string {
  const first = (fv?.first_name as string) ?? "";
  const last  = (fv?.last_name  as string) ?? "";
  return [first, last].filter(Boolean).join(" ") || "—";
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
  if (mins < 60)  return `${mins} minutes ago`;
  if (hours < 24) return `${hours === 1 ? "an hour" : `${hours} hours`} ago`;
  if (days < 7)   return `${days === 1 ? "a day" : `${days} days`} ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function initials(fv: FieldValues | null): string {
  const first = ((fv?.first_name as string) ?? "").trim();
  const last  = ((fv?.last_name  as string) ?? "").trim();
  return [(first[0] ?? ""), (last[0] ?? "")].join("").toUpperCase() || "?";
}

// ── Deal picker popover ───────────────────────────────────────────────────────

function DealPicker({
  anchor,
  currentDealId,
  onClose,
  onPick,
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
        {loading && (
          <div className="flex justify-center py-4">
            <Loader2 size={14} className="animate-spin text-[#68717A]" />
          </div>
        )}
        {!loading && currentDealId && (
          <button onClick={() => pick(null)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#68717A] hover:bg-[#FFF0F1] hover:text-[#CC3340] text-left transition-colors">
            <X size={11} /> Remove association
          </button>
        )}
        {!loading && deals.length === 0 && (
          <p className="text-xs text-[#68717A] text-center py-4">No deals found</p>
        )}
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

// ── Tab bar ───────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "inbox",    label: "Inbox",    icon: Inbox   },
  { id: "sent",     label: "Sent",     icon: Send    },
  { id: "archived", label: "Archived", icon: Archive },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function CommunicationsInbox() {
  const router = useRouter();
  const [tab, setTab]         = useState<Tab>("inbox");
  const [data, setData]       = useState<InboxResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [page, setPage]       = useState(1);
  const [picker, setPicker]   = useState<{ activityId: string; dealId: string | null; anchor: DOMRect } | null>(null);
  const [archiving, setArchiving] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), tab });
    if (search) params.set("search", search);
    const res = await fetch(`/api/communications?${params}`);
    setData(await res.json());
    setLoading(false);
  }, [page, search, tab]);

  useEffect(() => {
    const t = setTimeout(fetchData, 250);
    return () => clearTimeout(t);
  }, [fetchData]);

  // Reset page when tab or search changes
  useEffect(() => { setPage(1); }, [tab, search]);

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
    fetchData();
  };

  const emptyLabel =
    tab === "inbox"    ? "No inbound emails yet" :
    tab === "sent"     ? "No sent emails yet"    :
    "No archived emails";

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center gap-0 px-6 border-b border-[#D8DCDE] bg-white shrink-0">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === id
                ? "border-[#038153] text-[#038153]"
                : "border-transparent text-[#68717A] hover:text-[#2F3941]"
            }`}
          >
            <Icon size={13} strokeWidth={1.8} />
            {label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-[#D8DCDE] bg-white shrink-0">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#68717A]" />
          <input type="text" placeholder="Search by subject or contact..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-3 h-8 text-sm rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] placeholder:text-[#68717A] outline-none focus:border-[#038153] focus:ring-2 focus:ring-[#038153]/15 transition-all w-72" />
        </div>
        <div className="flex-1" />
        {data && (
          <span className="text-sm text-[#68717A]">
            {data.total} {data.total === 1 ? "email" : "emails"}
          </span>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto bg-white">
        {loading && (
          <div className="flex items-center justify-center h-40">
            <Loader2 size={18} className="animate-spin text-[#68717A]" />
          </div>
        )}

        {!loading && data?.activities.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-[#68717A]">
            {tab === "archived" ? <Archive size={32} strokeWidth={1.2} /> :
             tab === "sent"     ? <Send size={32} strokeWidth={1.2} />    :
             <Inbox size={32} strokeWidth={1.2} />}
            <p className="text-sm font-medium">
              {search ? `No results for "${search}"` : emptyLabel}
            </p>
          </div>
        )}

        {!loading && data?.activities.map((activity, idx) => {
          const name   = contactName(activity.contact.field_values);
          const ini    = initials(activity.contact.field_values);
          const isLast = idx === (data.activities.length - 1);

          return (
            <div
              key={activity.id}
              onClick={() => router.push(`/contacts/${activity.contact_id}`)}
              className={`group flex items-center gap-4 px-6 py-3.5 cursor-pointer hover:bg-[#F8F9F9] transition-colors ${!isLast ? "border-b border-[#F3F4F6]" : ""}`}
            >
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                style={{ background: "#038153" }}>
                {ini}
              </div>

              {/* Contact name */}
              <div className="w-44 shrink-0">
                <span className="text-sm font-medium text-[#2F3941] truncate block">{name}</span>
              </div>

              {/* Subject + deal association */}
              <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                <span className="text-sm text-[#2F3941] truncate">
                  {activity.subject || "(no subject)"}
                </span>

                {activity.deal ? (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setPicker({ activityId: activity.id, dealId: activity.deal_id, anchor: e.currentTarget.getBoundingClientRect() });
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#EAF7F0] border border-[#B7E5D0] text-[#038153] hover:brightness-95 shrink-0 transition-all"
                  >
                    <Briefcase size={10} />
                    {dealName(activity.deal.field_values)}
                  </button>
                ) : (
                  tab !== "archived" && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setPicker({ activityId: activity.id, dealId: null, anchor: e.currentTarget.getBoundingClientRect() });
                      }}
                      className="text-[11px] text-[#68717A] hover:text-[#038153] transition-colors shrink-0 whitespace-nowrap"
                    >
                      + Add deal association
                    </button>
                  )
                )}
              </div>

              {/* Timestamp */}
              <div className="shrink-0 text-xs text-[#68717A] whitespace-nowrap">
                {relativeTime(activity.created_at)}
              </div>

              {/* Archive / Unarchive button */}
              <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                {tab === "archived" ? (
                  <button
                    onClick={e => handleArchive(e, activity.id, false)}
                    title="Unarchive"
                    className="p-1.5 rounded-md text-[#68717A] hover:text-[#038153] hover:bg-[#EAF7F0] transition-colors"
                  >
                    {archiving === activity.id
                      ? <Loader2 size={13} className="animate-spin" />
                      : <ArchiveRestore size={13} />}
                  </button>
                ) : (
                  <button
                    onClick={e => handleArchive(e, activity.id, true)}
                    title="Archive"
                    className="p-1.5 rounded-md text-[#68717A] hover:text-[#CC3340] hover:bg-[#FFF0F1] transition-colors"
                  >
                    {archiving === activity.id
                      ? <Loader2 size={13} className="animate-spin" />
                      : <Archive size={13} />}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-[#D8DCDE] bg-[#F8F9F9] shrink-0">
          <span className="text-xs text-[#68717A]">Page {page} of {data.pages} · {data.total} total</span>
          <div className="flex gap-1.5">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="h-7 px-3 text-xs font-medium rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] hover:bg-[#F3F4F6] disabled:opacity-40 disabled:cursor-not-allowed">
              Previous
            </button>
            <button disabled={page === data.pages} onClick={() => setPage(p => p + 1)}
              className="h-7 px-3 text-xs font-medium rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] hover:bg-[#F3F4F6] disabled:opacity-40 disabled:cursor-not-allowed">
              Next
            </button>
          </div>
        </div>
      )}

      {/* Deal picker */}
      {picker && (
        <DealPicker
          anchor={picker.anchor}
          currentDealId={picker.dealId}
          onClose={() => setPicker(null)}
          onPick={dealId => handleDealPick(picker.activityId, dealId)}
        />
      )}
    </div>
  );
}
