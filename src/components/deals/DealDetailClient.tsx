"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Phone,
  Mail,
  Calendar,
  Globe,
  Tag,
  Hash,
} from "lucide-react";
import DealModal from "./DealModal";
import DealActivityFeed from "./DealActivityFeed";

// ── Types ─────────────────────────────────────────────────────────────────────

type FieldValues = Record<string, unknown>;

interface PhoneEntry { number: string; note: string; }
interface DealFieldOption { id: string; label: string; value: string; sort_order: number; }
interface DealField {
  id: string;
  label: string;
  field_key: string;
  field_type: string;
  sort_order: number;
  is_required: boolean;
  is_active: boolean;
  config: string | null;
  options: DealFieldOption[];
}

interface ContactSource {
  id: string;
  name: string;
}
interface Contact {
  id: string;
  field_values: FieldValues | null;
  source: ContactSource | null;
}

interface Deal {
  id: string;
  field_values: FieldValues | null;
  contact_id: string;
  contact: Contact;
  source: ContactSource | null;
  user_id: string;
  user: { id: string; name: string };
  created_at: string;
}

interface DealProfileConfigItem {
  field_key: string;
  section: "deal_info" | "details";
  sort_order: number;
  is_visible: boolean;
  label: string;
  field_type: string;
  options: { id: string; label: string; value: string; sort_order: number }[];
  has_notes: boolean;
}

interface Props {
  deal: Deal;
  fields: DealField[];
  profileConfig: DealProfileConfigItem[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function iconForField(field_key: string, field_type: string): React.ReactNode {
  if (field_type === "multi_phone" || field_key === "mobile_numbers") return <Phone size={14} />;
  if (field_type === "multi_email" || field_key === "emails") return <Mail size={14} />;
  if (field_type === "builtin_id" || field_key === "__id__") return <Hash size={14} />;
  if (field_type === "builtin_date" || field_key === "__added_on__") return <Calendar size={14} />;
  if (field_type === "builtin_source" || field_type === "source_select" || field_key === "__source__") return <Globe size={14} />;
  if (field_type === "source_flow") return <Globe size={14} />;
  return <Tag size={14} />;
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-[#68717A]">{icon}</span>
      <span className="text-[11px] font-semibold text-[#68717A] uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DealDetailClient({ deal: initial, fields, profileConfig }: Props) {
  const router = useRouter();
  const [deal, setDeal] = useState(initial);
  const [editOpen, setEditOpen] = useState(false);

  const fv = deal.field_values ?? {};

  // Derive deal title: prefer deal_name/name field, then first text field in profileConfig order
  const dealTitle = (() => {
    const nameVal = (fv.deal_name ?? fv.name) as string | undefined;
    if (nameVal?.trim()) return nameVal.trim();
    const sorted = [...profileConfig].sort((a, b) => a.sort_order - b.sort_order);
    for (const item of sorted) {
      if (item.field_type === "text" || item.field_type === "textarea") {
        const val = fv[item.field_key] as string | undefined;
        if (val?.trim()) return val.trim();
      }
    }
    return "Untitled Deal";
  })();

  // Contact display name
  const contactFv = deal.contact.field_values ?? {};
  const contactFirst = (contactFv.first_name as string) ?? "";
  const contactLast  = (contactFv.last_name  as string) ?? "";
  const contactName  = [contactFirst, contactLast].filter(Boolean).join(" ") || "—";
  const contactInitials = [contactFirst[0], contactLast[0]].filter(Boolean).join("").toUpperCase();

  // ── Save handler (PUT) ───────────────────────────────────────────────────────

  const handleEditSave = async (data: { contact_id: string; field_values: FieldValues; user_id: string }) => {
    const res = await fetch(`/api/deals/${deal.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "Failed to save");
    const updated: Deal = await res.json();
    setDeal(updated);
  };

  // ── Value renderer ───────────────────────────────────────────────────────────

  function renderFieldValue(item: DealProfileConfigItem): React.ReactNode {
    const { field_key, field_type } = item;
    const val = fv[field_key];

    const empty = <span className="text-sm text-[#C2C8CC]">—</span>;

    switch (field_type) {
      case "builtin_id": {
        return (
          <span className="text-sm font-mono text-[#68717A] select-all" title={deal.id}>{deal.id}</span>
        );
      }

      case "builtin_source": {
        return (
          <span className="text-sm text-[#2F3941]">
            {deal.source?.name || <span className="text-[#C2C8CC]">—</span>}
          </span>
        );
      }

      case "multi_phone": {
        const phones = (val as PhoneEntry[] | undefined) ?? [];
        if (phones.length === 0) return <p className="text-sm text-[#C2C8CC]">No phone numbers added</p>;
        return (
          <div className="space-y-3">
            {phones.map((p, i) => (
              <div key={i}>
                {p.number ? (
                  <a href={`tel:${p.number}`} className="text-sm font-medium text-[#038153] hover:underline">
                    {p.number}
                  </a>
                ) : (
                  <span className="text-sm font-medium text-[#C2C8CC]">—</span>
                )}
                {p.note && (
                  <p className="text-xs text-[#68717A] mt-0.5">
                    <span className="font-medium">Note:</span> {p.note}
                  </p>
                )}
              </div>
            ))}
          </div>
        );
      }

      case "text":
      case "textarea": {
        const str = val as string | undefined;
        return str ? <span className="text-sm text-[#2F3941]">{str}</span> : empty;
      }

      case "date": {
        const str = val as string | undefined;
        return str ? <span className="text-sm text-[#2F3941]">{fmt(str)}</span> : empty;
      }

      case "datetime": {
        const str = val as string | undefined;
        if (!str) return empty;
        const d = new Date(str);
        const formatted =
          d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
          " " +
          d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
        return <span className="text-sm text-[#2F3941]">{formatted}</span>;
      }

      case "boolean": {
        const display =
          val === true || val === "true"
            ? "Yes"
            : val === false || val === "false"
            ? "No"
            : null;
        return display ? <span className="text-sm text-[#2F3941]">{display}</span> : empty;
      }

      case "radio":
      case "select": {
        const strVal = val as string | undefined;
        const optLabel = item.options.find((o) => o.value === strVal)?.label ?? strVal;
        return optLabel ? (
          <span className="text-sm text-[#2F3941]">{optLabel}</span>
        ) : empty;
      }

      case "source_flow": {
        if (!val || typeof val !== "object") return empty;
        const sfVal = val as { source?: string; groups?: Record<string, string> };
        if (!sfVal.source) return empty;

        // Find matching DealField to parse config
        const df = fields.find((f) => f.field_key === field_key);
        let srcLabel = sfVal.source;
        const groupLabels: string[] = [];

        if (df?.config) {
          try {
            const cfg = JSON.parse(df.config);
            const sources: { value: string; label: string; groups?: { id: string; items?: { value: string; label: string }[] }[] }[] = cfg.sources ?? [];
            const src = sources.find((s) => s.value === sfVal.source);
            if (src) {
              srcLabel = src.label;
              if (sfVal.groups) {
                for (const grp of src.groups ?? []) {
                  const selected = sfVal.groups[grp.id];
                  if (selected) {
                    const item = grp.items?.find((it) => it.value === selected);
                    if (item) groupLabels.push(item.label);
                  }
                }
              }
            }
          } catch { /* ignore parse errors */ }
        }

        const parts = [srcLabel, ...groupLabels].filter(Boolean).join(" · ");
        return <span className="text-sm text-[#2F3941]">{parts}</span>;
      }

      default: {
        return val !== undefined && val !== null && val !== ""
          ? <span className="text-sm text-[#2F3941]">{String(val)}</span>
          : empty;
      }
    }
  }

  // ── Derived config slices ────────────────────────────────────────────────────

  const dealInfoFields = profileConfig
    .filter((i) => i.section === "deal_info" && i.is_visible)
    .sort((a, b) => a.sort_order - b.sort_order);

  const detailsFields = profileConfig
    .filter((i) => i.section === "details" && i.is_visible)
    .sort((a, b) => a.sort_order - b.sort_order);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col flex-1 min-h-0">

      {/* Breadcrumb bar */}
      <div className="flex items-center gap-2 px-6 h-14 border-b border-[#D8DCDE] bg-white shrink-0">
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center w-7 h-7 rounded-md text-[#68717A] hover:bg-[#F3F4F6] hover:text-[#2F3941] transition-colors"
          title="Go back"
        >
          <ArrowLeft size={15} />
        </button>
        <div className="flex items-center gap-1.5 text-sm">
          <Link
            href="/deals"
            className="text-[#68717A] hover:text-[#2F3941] transition-colors"
          >
            Deals
          </Link>
          <span className="text-[#C2C8CC]">/</span>
          <span className="text-[#2F3941] font-medium">{dealTitle}</span>
        </div>
      </div>

      {/* Page body */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex gap-6 items-start">

          {/* ── Left column: deal info (30%) ───────────────────────────────── */}
          <div className="w-[30%] shrink-0 space-y-4">

            {/* ── Deal Info card ────────────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-[#D8DCDE] shadow-sm p-5">

              {/* Avatar + title + Edit row */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                    style={{ background: "#038153" }}
                  >
                    {contactInitials || "—"}
                  </div>
                  <span className="text-sm font-semibold text-[#2F3941] truncate">{dealTitle}</span>
                </div>
                <button
                  onClick={() => setEditOpen(true)}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-md text-sm font-medium border border-[#D8DCDE] bg-white text-[#2F3941] hover:bg-[#F3F4F6] transition-colors shrink-0 ml-3"
                >
                  <Pencil size={13} />
                  Edit
                </button>
              </div>

              {/* Contact link */}
              <div className="mb-4 pb-4 border-b border-[#D8DCDE]">
                <span className="text-[10px] font-semibold text-[#68717A] uppercase tracking-wide">Contact</span>
                <div className="mt-1">
                  <Link
                    href={`/contacts/${deal.contact.id}`}
                    className="text-sm text-[#038153] hover:underline"
                  >
                    {contactName}
                  </Link>
                </div>
              </div>

              {/* Dynamic deal_info fields */}
              <div className="space-y-3">
                {dealInfoFields.map((item) => (
                  <div key={item.field_key} className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold text-[#68717A] uppercase tracking-wide">
                      {item.label}
                    </span>
                    {renderFieldValue(item)}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Details card ─────────────────────────────────────────────── */}
            {detailsFields.length > 0 && (
              <div className="bg-white rounded-xl border border-[#D8DCDE] shadow-sm divide-y divide-[#D8DCDE]">
                {detailsFields.map((item) => (
                  <div key={item.field_key} className="p-5">
                    <SectionHeader
                      icon={iconForField(item.field_key, item.field_type)}
                      label={item.label}
                    />
                    {renderFieldValue(item)}
                  </div>
                ))}
              </div>
            )}

          </div>{/* end left column */}

          {/* ── Right column: activity feed (70%) ─────────────────────────── */}
          <div className="flex-1 min-w-0">
            <DealActivityFeed dealId={deal.id} contactId={deal.contact.id} />
          </div>

        </div>{/* end flex row */}
      </div>

      {/* Edit modal */}
      <DealModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSave={handleEditSave}
        defaultUserId={deal.user_id}
        prefillContactId={deal.contact.id}
      />
    </div>
  );
}
