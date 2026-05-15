import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getPlatformId } from "@/lib/platform";
import ContactDetailClient from "@/components/contacts/ContactDetailClient";

export interface ProfileConfigItem {
  field_key: string;
  section: "contact_info" | "details";
  sort_order: number;
  is_visible: boolean;
  label: string;
  field_type: string;
  options: { id: string; label: string; value: string; sort_order: number }[];
  has_notes: boolean;
}

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const cookieStore = await cookies();
  const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
  const platformId = await getPlatformId(slug) ?? null;
  const platform = platformId
    ? await prisma.platform.findUnique({ where: { id: platformId }, select: { contact_show_source: true } })
    : null;
  const sourceEnabled = platform?.contact_show_source ?? true;

  const [contact, fields, profileConfigs] = await Promise.all([
    prisma.contact.findUnique({
      where: { id },
      include: {
        source: {
          include: {
            attribute_groups: {
              orderBy: { sort_order: "asc" },
              include: { items: { orderBy: { sort_order: "asc" } } },
            },
          },
        },
        user: true,
      },
    }),
    prisma.contactField.findMany({
      where: { is_active: true },
      orderBy: { sort_order: "asc" },
      include: { options: { orderBy: { sort_order: "asc" } } },
    }),
    prisma.profileFieldConfig.findMany({
      orderBy: [{ section: "asc" }, { sort_order: "asc" }],
    }),
  ]);

  if (!contact) notFound();

  function parseHasNotes(config: string | null | undefined): boolean {
    if (!config) return false;
    try { return JSON.parse(config)?.has_notes === true; } catch { return false; }
  }

  // Build a lookup map from ContactField records
  const fieldByKey = Object.fromEntries(fields.map((f) => [f.field_key, f]));

  // Built-in field definitions — label overrideable from ContactField DB record
  const builtins: Record<string, Pick<ProfileConfigItem, "label" | "field_type" | "options" | "has_notes">> = {
    __source__: { label: fieldByKey["__source__"]?.label ?? "Source", field_type: "builtin_source", options: [], has_notes: false },
    __added_on__: { label: fieldByKey["__added_on__"]?.label ?? "Added on", field_type: "builtin_date", options: [], has_notes: false },
  };

  let profileConfig: ProfileConfigItem[];

  if (profileConfigs.length === 0) {
    // Default layout when ProfileFieldConfig table is empty
    profileConfig = [
      { field_key: "first_name",      section: "contact_info", sort_order: 0, is_visible: true, label: fieldByKey["first_name"]?.label ?? "First Name",  field_type: fieldByKey["first_name"]?.field_type ?? "text", options: fieldByKey["first_name"]?.options ?? [], has_notes: true  },
      { field_key: "last_name",       section: "contact_info", sort_order: 1, is_visible: true, label: fieldByKey["last_name"]?.label  ?? "Last Name",   field_type: fieldByKey["last_name"]?.field_type  ?? "text", options: fieldByKey["last_name"]?.options  ?? [], has_notes: true  },
      { field_key: "__source__",      section: "contact_info", sort_order: 2, is_visible: true, ...builtins.__source__ },
      { field_key: "mobile_numbers",  section: "details",      sort_order: 0, is_visible: true, label: fieldByKey["mobile_numbers"]?.label ?? "Phone Numbers", field_type: fieldByKey["mobile_numbers"]?.field_type ?? "multi_phone", options: [], has_notes: false },
      { field_key: "emails",          section: "details",      sort_order: 1, is_visible: true, label: fieldByKey["emails"]?.label         ?? "Emails",         field_type: fieldByKey["emails"]?.field_type         ?? "multi_email", options: [], has_notes: false },
      { field_key: "__added_on__",    section: "details",      sort_order: 2, is_visible: true, ...builtins.__added_on__ },
      { field_key: "gender",          section: "details",      sort_order: 3, is_visible: true, label: fieldByKey["gender"]?.label         ?? "Gender",          field_type: fieldByKey["gender"]?.field_type         ?? "radio",       options: fieldByKey["gender"]?.options ?? [], has_notes: true  },
    ];
  } else {
    profileConfig = profileConfigs.map((pc) => {
      if (pc.field_key in builtins) {
        return {
          field_key: pc.field_key,
          section: pc.section as "contact_info" | "details",
          sort_order: pc.sort_order,
          is_visible: pc.is_visible,
          ...builtins[pc.field_key],
        };
      }
      const cf = fieldByKey[pc.field_key];
      return {
        field_key: pc.field_key,
        section: pc.section as "contact_info" | "details",
        sort_order: pc.sort_order,
        is_visible: pc.is_visible,
        label: cf?.label ?? pc.field_key,
        field_type: cf?.field_type ?? "text",
        options: cf?.options ?? [],
        has_notes: parseHasNotes(cf?.config),
      };
    });
  }

  if (!sourceEnabled) {
    profileConfig = profileConfig.filter((c) => c.field_key !== "__source__");
  }

  return (
    <ContactDetailClient
      contact={JSON.parse(JSON.stringify(contact))}
      fields={JSON.parse(JSON.stringify(fields))}
      profileConfig={JSON.parse(JSON.stringify(profileConfig))}
    />
  );
}
