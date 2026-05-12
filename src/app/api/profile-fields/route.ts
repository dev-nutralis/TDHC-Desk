import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getPlatformId } from "@/lib/platform";

// ---------------------------------------------------------------------------
// Built-in synthetic fields (not stored in ContactField table)
// ---------------------------------------------------------------------------
const BUILTINS: Record<string, { label: string; field_type: string }> = {
  __id__: { label: "ID", field_type: "builtin_id" },
  __source__: { label: "Source", field_type: "builtin_source" },
  __added_on__: { label: "Added on", field_type: "builtin_date" },
};

// ---------------------------------------------------------------------------
// Default layout used when ProfileFieldConfig table is empty
// ---------------------------------------------------------------------------
const DEFAULT_CONFIGS = [
  { field_key: "first_name", section: "contact_info", sort_order: 0, is_visible: true },
  { field_key: "last_name", section: "contact_info", sort_order: 1, is_visible: true },
  { field_key: "__source__", section: "contact_info", sort_order: 2, is_visible: true },
  { field_key: "mobile_numbers", section: "details", sort_order: 0, is_visible: true },
  { field_key: "emails", section: "details", sort_order: 1, is_visible: true },
  { field_key: "__added_on__", section: "details", sort_order: 2, is_visible: true },
  { field_key: "gender", section: "details", sort_order: 3, is_visible: true },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
type OptionRow = { label: string; value: string; sort_order: number };

interface EnrichedConfig {
  field_key: string;
  section: "contact_info" | "details";
  sort_order: number;
  is_visible: boolean;
  label: string;
  field_type: string;
  options: OptionRow[];
  has_notes: boolean;
}

interface AvailableField {
  field_key: string;
  label: string;
  field_type: string;
}

function parseHasNotes(config: string | null | undefined): boolean {
  if (!config) return false;
  try {
    const parsed = JSON.parse(config);
    return parsed?.has_notes === true;
  } catch {
    return false;
  }
}

async function buildResponse(
  platformId: string | null,
  rawConfigs: Array<{
    field_key: string;
    section: string;
    sort_order: number;
    is_visible: boolean;
  }>
) {
  // Fetch all active ContactFields with their options for this platform
  const contactFields = await prisma.contactField.findMany({
    where: { is_active: true, platform_id: platformId },
    include: { options: { orderBy: { sort_order: "asc" } } },
    orderBy: { sort_order: "asc" },
  });

  // Build a quick-lookup map: field_key → ContactField row
  const cfByKey = new Map(contactFields.map((f) => [f.field_key, f]));

  // Enrich each config row
  const configs: EnrichedConfig[] = rawConfigs.map((cfg) => {
    const builtin = BUILTINS[cfg.field_key];
    const cf = cfByKey.get(cfg.field_key);

    const label = builtin?.label ?? cf?.label ?? cfg.field_key;
    const field_type = builtin?.field_type ?? cf?.field_type ?? "text";
    const options: OptionRow[] = cf?.options.map((o) => ({
      label: o.label,
      value: o.value,
      sort_order: o.sort_order,
    })) ?? [];
    const has_notes = parseHasNotes(cf?.config);

    return {
      field_key: cfg.field_key,
      section: cfg.section as "contact_info" | "details",
      sort_order: cfg.sort_order,
      is_visible: cfg.is_visible,
      label,
      field_type,
      options,
      has_notes,
    };
  });

  // Build the set of field_keys already in configs
  const usedKeys = new Set(rawConfigs.map((c) => c.field_key));

  // Available = active ContactFields NOT in configs
  const available: AvailableField[] = contactFields
    .filter((f) => !usedKeys.has(f.field_key))
    .map((f) => ({ field_key: f.field_key, label: f.label, field_type: f.field_type }));

  // Also add built-ins not in configs
  for (const [key, meta] of Object.entries(BUILTINS)) {
    if (!usedKeys.has(key)) {
      available.push({ field_key: key, label: meta.label, field_type: meta.field_type });
    }
  }

  return { configs, available };
}

// ---------------------------------------------------------------------------
// GET /api/profile-fields
// ---------------------------------------------------------------------------
export async function GET(_req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
    const platformId = await getPlatformId(slug) ?? null;

    // Source field is controlled by platform toggle
    const platform = platformId
      ? await prisma.platform.findUnique({ where: { id: platformId }, select: { contact_show_source: true } })
      : null;
    const sourceEnabled = platform?.contact_show_source ?? true;

    const dbConfigs = await prisma.profileFieldConfig.findMany({
      where: { platform_id: platformId },
      orderBy: [{ section: "asc" }, { sort_order: "asc" }],
    });

    const rawConfigs =
      dbConfigs.length > 0
        ? dbConfigs.map((r) => ({
            field_key: r.field_key,
            section: r.section,
            sort_order: r.sort_order,
            is_visible: r.is_visible,
          }))
        : (DEFAULT_CONFIGS as unknown as Array<{
            field_key: string;
            section: string;
            sort_order: number;
            is_visible: boolean;
          }>);

    // Filter out __source__ if source field is disabled for contacts
    const filteredConfigs = sourceEnabled
      ? rawConfigs
      : rawConfigs.filter((c) => c.field_key !== "__source__");

    const body = await buildResponse(platformId, filteredConfigs);
    if (!sourceEnabled) {
      body.available = body.available.filter((a) => a.field_key !== "__source__");
    }
    return NextResponse.json(body);
  } catch (err) {
    console.error("[GET /api/profile-fields]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PUT /api/profile-fields
// ---------------------------------------------------------------------------
export async function PUT(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
    const platformId = await getPlatformId(slug) ?? null;

    const body = await req.json();

    if (!Array.isArray(body?.configs)) {
      return NextResponse.json(
        { error: "Body must contain a configs array" },
        { status: 400 }
      );
    }

    const incoming: Array<{
      field_key: string;
      section: string;
      sort_order: number;
      is_visible: boolean;
    }> = body.configs;

    for (const item of incoming) {
      if (!item.field_key || !item.section) {
        return NextResponse.json(
          { error: "Each config entry must have field_key and section" },
          { status: 400 }
        );
      }
    }

    // Full replace inside a transaction (scoped to this platform)
    await prisma.$transaction([
      prisma.profileFieldConfig.deleteMany({ where: { platform_id: platformId } }),
      prisma.profileFieldConfig.createMany({
        data: incoming.map((item) => ({
          field_key: item.field_key,
          section: item.section,
          sort_order: item.sort_order ?? 0,
          is_visible: item.is_visible ?? true,
          platform_id: platformId,
        })),
      }),
    ]);

    const responseBody = await buildResponse(platformId, incoming);
    return NextResponse.json(responseBody);
  } catch (err) {
    console.error("[PUT /api/profile-fields]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
