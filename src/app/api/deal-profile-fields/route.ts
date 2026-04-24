import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Default layout used when DealProfileConfig table is empty
// ---------------------------------------------------------------------------
async function buildDefaultConfigs() {
  const firstThree = await prisma.dealField.findMany({
    where: { is_active: true },
    orderBy: { sort_order: "asc" },
    take: 3,
  });

  return firstThree.map((f, i) => ({
    field_key: f.field_key,
    section: "deal_info",
    sort_order: i,
    is_visible: true,
  }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
type OptionRow = { label: string; value: string; sort_order: number };

interface EnrichedConfig {
  field_key: string;
  section: "deal_info" | "details";
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
  rawConfigs: Array<{
    field_key: string;
    section: string;
    sort_order: number;
    is_visible: boolean;
  }>
) {
  // Fetch all active DealFields with their options
  const dealFields = await prisma.dealField.findMany({
    where: { is_active: true },
    include: { options: { orderBy: { sort_order: "asc" } } },
    orderBy: { sort_order: "asc" },
  });

  // Build a quick-lookup map: field_key → DealField row
  const dfByKey = new Map(dealFields.map((f) => [f.field_key, f]));

  // Enrich each config row
  const configs: EnrichedConfig[] = rawConfigs.map((cfg) => {
    const df = dfByKey.get(cfg.field_key);

    const label = df?.label ?? cfg.field_key;
    const field_type = df?.field_type ?? "text";
    const options: OptionRow[] =
      df?.options.map((o) => ({
        label: o.label,
        value: o.value,
        sort_order: o.sort_order,
      })) ?? [];
    const has_notes = parseHasNotes(df?.config);

    return {
      field_key: cfg.field_key,
      section: cfg.section as "deal_info" | "details",
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

  // Available = active DealFields NOT in configs
  const available: AvailableField[] = dealFields
    .filter((f) => !usedKeys.has(f.field_key))
    .map((f) => ({ field_key: f.field_key, label: f.label, field_type: f.field_type }));

  return { configs, available };
}

// ---------------------------------------------------------------------------
// GET /api/deal-profile-fields
// ---------------------------------------------------------------------------
export async function GET(_req: NextRequest) {
  try {
    const dbConfigs = await prisma.dealProfileConfig.findMany({
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
        : await buildDefaultConfigs();

    const body = await buildResponse(rawConfigs);
    return NextResponse.json(body);
  } catch (err) {
    console.error("[GET /api/deal-profile-fields]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PUT /api/deal-profile-fields
// ---------------------------------------------------------------------------
export async function PUT(req: NextRequest) {
  try {
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

    // Full replace inside a transaction
    await prisma.$transaction([
      prisma.dealProfileConfig.deleteMany(),
      prisma.dealProfileConfig.createMany({
        data: incoming.map((item) => ({
          field_key: item.field_key,
          section: item.section,
          sort_order: item.sort_order ?? 0,
          is_visible: item.is_visible ?? true,
        })),
      }),
    ]);

    const responseBody = await buildResponse(incoming);
    return NextResponse.json(responseBody);
  } catch (err) {
    console.error("[PUT /api/deal-profile-fields]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
