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
  User,
  UserCircle2,
  Globe,
  Tag,
  Hash,
} from "lucide-react";
import ContactModal from "./ContactModal";
import ContactActivityFeed from "./ContactActivityFeed";
import { useSipPhoneContext } from "@/context/SipPhoneContext";

function DialButton({ number }: { number: string }) {
  const { phone } = useSipPhoneContext();
  const canDial = phone?.state === "idle";

  if (!phone) {
    return (
      <a href={`tel:${number}`} className="text-sm font-medium text-[#038153] hover:underline">
        {number}
      </a>
    );
  }

  return (
    <button
      onClick={() => canDial && phone.dial(number)}
      disabled={!canDial}
      className="flex items-center gap-1.5 text-sm font-medium text-[#038153] hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
      title={canDial ? `Call ${number}` : "Phone busy"}
    >
      <Phone size={13} />
      {number}
    </button>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface PhoneEntry { number: string; note: string; }
interface EmailEntry { address: string; is_main: boolean; note: string; }

interface ContactFieldOption { id: string; label: string; value: string; sort_order: number; }
interface ContactField {
  id: string;
  label: string;
  field_key: string;
  field_type: string;
  sort_order: number;
  is_required: boolean;
  is_active: boolean;
  config: string | null;
  options: ContactFieldOption[];
}

type FieldValues = Record<string, unknown>;

interface AttributeGroup {
  id: string;
  name: string;
  items: { id: string; label: string }[];
}
interface Source {
  id: string;
  name: string;
  attribute_groups: AttributeGroup[];
}
interface Contact {
  id: string;
  field_values: FieldValues | null;
  source_id: string | null;
  attribute_ids: string | null;
  source: Source | null;
  user_id: string;
  created_at: string;
  user: { id: string; name: string };
}

interface ProfileConfigItem {
  field_key: string;
  section: "contact_info" | "details";
  sort_order: number;
  is_visible: boolean;
  label: string;
  field_type: string;
  options: { id: string; label: string; value: string; sort_order: number }[];
  has_notes: boolean;
}

interface Props {
  contact: Contact;
  fields: ContactField[];
  profileConfig: ProfileConfigItem[];
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
  if (field_type === "radio" || field_type === "select") return <User size={14} />;
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

export default function ContactDetailClient({ contact: initial, fields, profileConfig }: Props) {
  const router = useRouter();
  const [contact, setContact] = useState(initial);
  const [editOpen, setEditOpen] = useState(false);

  const fv = contact.field_values ?? {};

  const firstName = (fv.first_name as string) ?? "";
  const lastName  = (fv.last_name  as string) ?? "";
  const fullName  = [firstName, lastName].filter(Boolean).join(" ") || "—";
  const initials  = [firstName[0], lastName[0]].filter(Boolean).join("").toUpperCase();

  const isBlacklisted = fv.blacklisted === "true" || fv.blacklisted === true;

  // Helper: returns the __notes value for a field key if it exists
  const noteFor = (key: string): string | null => {
    const n = fv[`${key}__notes`];
    return typeof n === "string" && n.trim() ? n.trim() : null;
  };

  // ── Save handler (PUT) ───────────────────────────────────────────────────────

  const handleEditSave = async (formData: {
    field_values: FieldValues;
    source_id: string | null;
    attribute_ids: string[] | null;
    user_id: string;
    created_at?: string;
  }) => {
    const res = await fetch(`/api/contacts/${contact.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "Failed to save");
    const updated: Contact = await res.json();
    setContact(updated);
  };

  // ── Value renderer ───────────────────────────────────────────────────────────

  function renderFieldValue(item: ProfileConfigItem, section: "contact_info" | "details"): React.ReactNode {
    const { field_key, field_type } = item;

    switch (field_type) {
      case "multi_phone": {
        const raw = fv[field_key];
        const phones: PhoneEntry[] = Array.isArray(raw)
          ? (raw as PhoneEntry[])
          : typeof raw === "string" && raw
            ? [{ number: raw, note: "" }]
            : [];
        if (phones.length === 0) {
          return <p className="text-sm text-[#C2C8CC]">No phone numbers added</p>;
        }
        return (
          <div className="space-y-3">
            {phones.map((p, i) => (
              <div key={i}>
                {p.number ? (
                  <DialButton number={p.number} />
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

      case "multi_email": {
        const rawEmail = fv[field_key];
        const emails: EmailEntry[] = Array.isArray(rawEmail)
          ? (rawEmail as EmailEntry[])
          : typeof rawEmail === "string" && rawEmail
            ? [{ address: rawEmail, is_main: false, note: "" }]
            : [];
        if (emails.length === 0) {
          return <p className="text-sm text-[#C2C8CC]">No emails added</p>;
        }
        return (
          <div className="space-y-3">
            {emails.map((e, i) => (
              <div key={i}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-[#2F3941]">
                    {e.address || <span className="text-[#C2C8CC]">—</span>}
                  </span>
                  {e.is_main && (
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: "#E6F4EF", color: "#038153" }}
                    >
                      Main
                    </span>
                  )}
                </div>
                {e.note && (
                  <p className="text-xs text-[#68717A] mt-0.5">
                    <span className="font-medium">Note:</span> {e.note}
                  </p>
                )}
              </div>
            ))}
          </div>
        );
      }

      case "source_select": {
        return (
          <span className="text-sm text-[#2F3941]">
            {contact.source?.name || <span className="text-[#C2C8CC]">—</span>}
          </span>
        );
      }

      case "builtin_id": {
        return (
          <span className="text-sm font-mono text-[#68717A] select-all" title={contact.id}>{contact.id}</span>
        );
      }

      case "builtin_source": {
        return (
          <span className="text-sm text-[#2F3941]">
            {contact.source?.name || <span className="text-[#C2C8CC]">—</span>}
          </span>
        );
      }

      case "builtin_date": {
        return (
          <span className="text-sm text-[#2F3941]">{fmt(contact.created_at)}</span>
        );
      }

      case "radio":
      case "select": {
        const val = fv[field_key] as string | undefined;
        const optLabel = item.options.find((o) => o.value === val)?.label ?? val;
        return (
          <>
            {optLabel ? (
              <span className="text-sm text-[#2F3941]">{optLabel}</span>
            ) : (
              <span className="text-sm text-[#C2C8CC]">Not specified</span>
            )}
            {section === "details" && item.has_notes && noteFor(field_key) && (
              <div className="mt-2 pt-2 border-t border-[#D8DCDE]">
                <p className="text-[10px] font-semibold text-[#68717A] uppercase tracking-wide">Note</p>
                <p className="text-xs text-[#2F3941] mt-0.5">{noteFor(field_key)}</p>
              </div>
            )}
          </>
        );
      }

      case "boolean": {
        const val = fv[field_key];
        const display =
          val === true || val === "true"
            ? "Yes"
            : val === false || val === "false"
            ? "No"
            : null;
        return display ? (
          <span className="text-sm text-[#2F3941]">{display}</span>
        ) : (
          <span className="text-sm text-[#C2C8CC]">—</span>
        );
      }

      case "date": {
        const val = fv[field_key] as string | undefined;
        return val ? (
          <span className="text-sm text-[#2F3941]">{fmt(val)}</span>
        ) : (
          <span className="text-sm text-[#C2C8CC]">—</span>
        );
      }

      case "datetime": {
        const val = fv[field_key] as string | undefined;
        if (!val) return <span className="text-sm text-[#C2C8CC]">—</span>;
        const d = new Date(val);
        const formatted = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
          + " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
        return <span className="text-sm text-[#2F3941]">{formatted}</span>;
      }

      default: {
        // text and all other types
        const val = fv[field_key] as string | undefined;
        return (
          <>
            {val ? (
              <span className="text-sm text-[#2F3941]">{val}</span>
            ) : (
              <span className="text-sm text-[#C2C8CC]">—</span>
            )}
            {section === "details" && item.has_notes && noteFor(field_key) && (
              <div className="mt-1">
                <p className="text-[10px] font-semibold text-[#68717A] uppercase tracking-wide">Note</p>
                <p className="text-xs text-[#2F3941] mt-0.5">{noteFor(field_key)}</p>
              </div>
            )}
          </>
        );
      }
    }
  }

  // ── Derived config slices ────────────────────────────────────────────────────

  const contactInfoFields = profileConfig
    .filter((i) => i.section === "contact_info" && i.is_visible)
    .sort((a, b) => a.sort_order - b.sort_order);

  const detailsFields = profileConfig
    .filter((i) => i.section === "details" && i.is_visible)
    .sort((a, b) => a.sort_order - b.sort_order);

  // Notes to show at the bottom of the Contact Info card
  const contactInfoNotes = contactInfoFields.filter(
    (item) => item.has_notes && noteFor(item.field_key)
  );

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
            href="/contacts"
            className="text-[#68717A] hover:text-[#2F3941] transition-colors"
          >
            Contacts
          </Link>
          <span className="text-[#C2C8CC]">/</span>
          <span className="text-[#2F3941] font-medium">{fullName}</span>
        </div>
      </div>

      {/* Page body */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex gap-6 items-start">

          {/* ── Left column: contact info (30%) ───────────────────────────── */}
          <div className="w-[30%] shrink-0 space-y-4">

            {/* ── Profile header card ──────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-[#D8DCDE] shadow-sm p-5">

              {/* Avatar + Edit row — always rendered, not configurable */}
              <div className="flex items-center justify-between mb-5">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0"
                  style={{ background: "#1D6FA4" }}
                >
                  {initials || <UserCircle2 size={28} strokeWidth={1.5} />}
                </div>
                <button
                  onClick={() => setEditOpen(true)}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-md text-sm font-medium border border-[#D8DCDE] bg-white text-[#2F3941] hover:bg-[#F3F4F6] transition-colors"
                >
                  <Pencil size={13} />
                  Edit
                </button>
              </div>

              {/* Dynamic contact_info fields */}
              <div className="space-y-3">
                {contactInfoFields.map((item) => (
                  <div key={item.field_key} className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold text-[#68717A] uppercase tracking-wide">
                      {item.label}
                    </span>
                    {/* Special case: last_name shows blacklisted badge */}
                    {item.field_key === "last_name" ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        {(() => {
                          const val = fv["last_name"] as string | undefined;
                          return val ? (
                            <span className="text-sm text-[#2F3941]">{val}</span>
                          ) : (
                            <span className="text-sm text-[#C2C8CC]">—</span>
                          );
                        })()}
                        {isBlacklisted && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-[#FFF0F1] text-[#CC3340]">
                            Blacklisted
                          </span>
                        )}
                      </div>
                    ) : (
                      renderFieldValue(item, "contact_info")
                    )}
                  </div>
                ))}

                {/* Notes section at the bottom of the card */}
                {contactInfoNotes.length > 0 && (
                  <div className="pt-3 border-t border-[#D8DCDE] space-y-2">
                    {contactInfoNotes.map((item) => (
                      <div key={item.field_key}>
                        <p className="text-[10px] font-semibold text-[#68717A] uppercase tracking-wide">
                          {item.label} — Note
                        </p>
                        <p className="text-xs text-[#2F3941] mt-0.5">{noteFor(item.field_key)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Details card ─────────────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-[#D8DCDE] shadow-sm divide-y divide-[#D8DCDE]">
              {detailsFields.map((item) => (
                <div key={item.field_key} className="p-5">
                  <SectionHeader
                    icon={iconForField(item.field_key, item.field_type)}
                    label={item.label}
                  />
                  {renderFieldValue(item, "details")}
                </div>
              ))}
            </div>

          </div>{/* end left column */}

          {/* ── Right column: activity feed (70%) ─────────────────────────── */}
          <div className="flex-1 min-w-0">
            <ContactActivityFeed contactId={contact.id} />
          </div>

        </div>{/* end flex row */}
      </div>

      {/* Edit modal */}
      <ContactModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSave={handleEditSave}
        contact={{
          ...contact,
          attribute_ids: contact.attribute_ids ?? null,
        }}
        defaultUserId={contact.user_id}
      />
    </div>
  );
}
