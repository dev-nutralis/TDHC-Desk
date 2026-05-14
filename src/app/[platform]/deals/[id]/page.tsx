import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getPlatformId } from "@/lib/platform";
import DealDetailClient from "@/components/deals/DealDetailClient";

export interface DealProfileConfigItem {
  field_key: string;
  section: "deal_info" | "details";
  sort_order: number;
  is_visible: boolean;
  label: string;
  field_type: string;
  options: { id: string; label: string; value: string; sort_order: number }[];
  has_notes: boolean;
}

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ platform: string; id: string }>;
}) {
  const { id } = await params;

  const cookieStore = await cookies();
  const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
  const platformId = await getPlatformId(slug) ?? null;
  const plat = platformId
    ? await prisma.platform.findUnique({ where: { id: platformId }, select: { deal_show_source: true } })
    : null;
  const sourceEnabled = plat?.deal_show_source ?? false;

  const [deal, fields, profileConfigs] = await Promise.all([
    prisma.deal.findUnique({
      where: { id },
      include: {
        contact: {
          include: {
            source: true,
          },
        },
        source: true,
        user: true,
      },
    }),
    prisma.dealField.findMany({
      where: { is_active: true },
      orderBy: { sort_order: "asc" },
      include: { options: { orderBy: { sort_order: "asc" } } },
    }),
    prisma.dealProfileConfig.findMany({
      orderBy: [{ section: "asc" }, { sort_order: "asc" }],
    }),
  ]);

  if (!deal) notFound();

  function parseHasNotes(config: string | null | undefined): boolean {
    if (!config) return false;
    try { return JSON.parse(config)?.has_notes === true; } catch { return false; }
  }

  // DealField shape (from prisma.dealField.findMany with options)
  type DealFieldRow = (typeof fields)[number];

  // Build a lookup map from DealField records
  const fieldByKey: Record<string, DealFieldRow> = Object.fromEntries(
    fields.map((f: DealFieldRow) => [f.field_key, f])
  );

  let profileConfig: DealProfileConfigItem[];

  if (profileConfigs.length === 0) {
    // Default layout when DealProfileConfig table is empty — first 3 fields in deal_info
    const firstThree = fields.slice(0, 3);
    profileConfig = firstThree.map((f: DealFieldRow, i: number) => ({
      field_key: f.field_key,
      section: "deal_info" as const,
      sort_order: i,
      is_visible: true,
      label: f.label,
      field_type: f.field_type,
      options: f.options ?? [],
      has_notes: parseHasNotes(f.config),
    }));
  } else {
    const BUILTINS: Record<string, { label: string; field_type: string }> = {
      __source__: { label: "Source", field_type: "builtin_source" },
    };
    profileConfig = profileConfigs.map((pc) => {
      const builtin = BUILTINS[pc.field_key];
      const df = fieldByKey[pc.field_key];
      return {
        field_key: pc.field_key,
        section: pc.section as "deal_info" | "details",
        sort_order: pc.sort_order,
        is_visible: pc.is_visible,
        label: builtin?.label ?? df?.label ?? pc.field_key,
        field_type: builtin?.field_type ?? df?.field_type ?? "text",
        options: df?.options ?? [],
        has_notes: parseHasNotes(df?.config),
      };
    });
  }

  if (!sourceEnabled) {
    profileConfig = profileConfig.filter((c) => c.field_key !== "__source__");
  }

  return (
    <DealDetailClient
      deal={JSON.parse(JSON.stringify(deal))}
      fields={JSON.parse(JSON.stringify(fields))}
      profileConfig={JSON.parse(JSON.stringify(profileConfig))}
    />
  );
}
