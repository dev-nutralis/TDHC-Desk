import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getPlatformId } from "@/lib/platform";
import { applySerialIds } from "@/lib/serial-id";
import { Prisma } from "@prisma/client";

interface FilterCondition {
  field_key: string;
  field_type: string;
  operator: string;
  value: string;
  value2?: string;
}

function buildFilterClauses(filterConditions: FilterCondition[]): { clauses: string[]; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];

  for (const f of filterConditions) {
    if (f.field_key === "__added_on__") {
      if (f.operator === "range") {
        const parts: string[] = [];
        if (f.value)  { parts.push(`DATE(created_at) >= $${params.length + 1}::date`); params.push(f.value); }
        if (f.value2) { parts.push(`DATE(created_at) <= $${params.length + 1}::date`); params.push(f.value2); }
        if (parts.length) clauses.push(parts.join(" AND "));
      } else if (f.operator === "is_empty") {
        clauses.push("FALSE");
      }
      continue;
    }

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(f.field_key) || f.field_key.length > 64) continue;
    const k = f.field_key;

    switch (f.operator) {
      case "contains":
        if (!f.value.trim()) break;
        clauses.push(`field_values->>'${k}' ILIKE $${params.length + 1}`);
        params.push("%" + f.value + "%");
        break;
      case "equals":
        if (!f.value) break;
        clauses.push(`field_values->>'${k}' = $${params.length + 1}`);
        params.push(f.value);
        break;
      case "not_equals":
        if (!f.value) break;
        clauses.push(`(field_values->>'${k}' != $${params.length + 1} OR field_values->>'${k}' IS NULL)`);
        params.push(f.value);
        break;
      case "starts_with":
        if (!f.value) break;
        clauses.push(`field_values->>'${k}' ILIKE $${params.length + 1}`);
        params.push(f.value + "%");
        break;
      case "range": {
        const parts: string[] = [];
        if (f.value)  { parts.push(`(field_values->>'${k}')::date >= $${params.length + 1}::date`); params.push(f.value); }
        if (f.value2) { parts.push(`(field_values->>'${k}')::date <= $${params.length + 1}::date`); params.push(f.value2); }
        if (parts.length) clauses.push(parts.join(" AND "));
        break;
      }
      case "is_true":
        clauses.push(`field_values->>'${k}' = 'true'`);
        break;
      case "is_false":
        clauses.push(`(field_values->>'${k}' = 'false' OR field_values->>'${k}' IS NULL)`);
        break;
      case "not_empty":
        clauses.push(`(field_values->>'${k}' IS NOT NULL AND field_values->>'${k}' != '' AND field_values->>'${k}' != 'null')`);
        break;
      case "is_empty":
        clauses.push(`(field_values->>'${k}' IS NULL OR field_values->>'${k}' = '' OR field_values->>'${k}' = 'null')`);
        break;
    }
  }

  return { clauses, params };
}

const includeContact = {
  contact: { select: { id: true, field_values: true } },
  source: {
    include: {
      attribute_groups: {
        orderBy: { sort_order: "asc" as const },
        include: { items: { orderBy: { sort_order: "asc" as const } } },
      },
    },
  },
  user: { select: { id: true, first_name: true, last_name: true } },
};

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
    const platformId = await getPlatformId(slug) ?? null;

    const { searchParams } = new URL(req.url);
    const search    = searchParams.get("search") || "";
    const contactId = searchParams.get("contact_id") || "";
    const limit     = Math.min(parseInt(searchParams.get("limit") || "45"), 500);
    const offset    = parseInt(searchParams.get("offset") || "0");

    let filterConditions: FilterCondition[] = [];
    try {
      const fp = searchParams.get("filters");
      if (fp) filterConditions = JSON.parse(fp);
    } catch { /* ignore */ }

    const clauses: string[] = [];
    const params: unknown[] = [];

    // Add platform_id clause first
    clauses.push(`platform_id = $${params.length + 1}`);
    params.push(platformId);

    if (search) {
      clauses.push(`(
        field_values::text ILIKE $${params.length + 1}
        OR CONCAT(field_values->>'first_name', ' ', field_values->>'last_name') ILIKE $${params.length + 1}
        OR CONCAT(field_values->>'last_name', ' ', field_values->>'first_name') ILIKE $${params.length + 1}
      )`);
      params.push("%" + search + "%");
    }

    const { clauses: filterClauses, params: filterParams } = buildFilterClauses(filterConditions);
    for (const fc of filterClauses) {
      clauses.push(fc.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + params.length}`));
    }
    params.push(...filterParams);

    // Paginate at the ID level to avoid skip/take operating on JOIN-duplicated rows.
    // For the common case (no search, no filters) use pure Prisma to avoid $queryRawUnsafe
    // connection pool issues on Neon serverless.
    let allIds: string[];
    if (!search && filterConditions.length === 0) {
      const pWhere = { platform_id: platformId, ...(contactId ? { contact_id: contactId } : {}) };
      const idRows = await prisma.deal.findMany({ where: pWhere, select: { id: true }, orderBy: { created_at: "desc" } });
      allIds = idRows.map(r => r.id);
    } else {
      const contactClause = contactId ? ` AND contact_id = '${contactId.replace(/'/g, "''")}'` : "";
      const sql = `SELECT id FROM "Deal" WHERE ${clauses.join(" AND ")}${contactClause} ORDER BY created_at DESC`;
      const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(sql, ...params);
      allIds = rows.map(r => r.id);
    }
    const total = allIds.length;

    const pageIds = allIds.slice(offset, offset + limit);
    const rawDeals = await prisma.deal.findMany({
      where: { id: { in: pageIds } },
      include: includeContact,
    });

    // Re-sort to match ORDER BY created_at DESC (IN clause doesn't guarantee order)
    const dealMap = new Map(rawDeals.map(d => [d.id, d]));
    const deals = pageIds.map(id => dealMap.get(id)).filter(Boolean) as typeof rawDeals;

    return NextResponse.json({ deals, total, offset, hasMore: offset + deals.length < total });
  } catch (err) {
    console.error("[GET /api/deals]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
  const platformId = await getPlatformId(slug) ?? null;

  const { contact_id, field_values, user_id, source_id, attribute_ids } = await req.json();

  if (!contact_id)
    return NextResponse.json({ error: "contact_id is required" }, { status: 400 });
  if (!user_id)
    return NextResponse.json({ error: "user_id is required" }, { status: 400 });

  // Inherit source/attributes from parent contact if not provided
  let resolvedSourceId = source_id ?? null;
  let resolvedAttributeIds = attribute_ids ?? null;
  if (source_id === undefined || attribute_ids === undefined) {
    const parent = await prisma.contact.findUnique({
      where: { id: contact_id },
      select: { source_id: true, attribute_ids: true },
    });
    if (source_id === undefined) resolvedSourceId = parent?.source_id ?? null;
    if (attribute_ids === undefined) resolvedAttributeIds = parent?.attribute_ids ?? null;
  }

  const fvWithSerial = await applySerialIds("deal", platformId, (field_values ?? {}) as Record<string, unknown>);

  const deal = await prisma.deal.create({
    data: {
      contact_id,
      field_values: fvWithSerial as Prisma.InputJsonValue,
      user_id,
      platform_id: platformId,
      source_id: resolvedSourceId,
      attribute_ids: resolvedAttributeIds,
    },
    include: includeContact,
  });

  // Async Klaviyo sync via contact
  import("@/lib/klaviyo-sync").then(({ syncContactToKlaviyo }) =>
    syncContactToKlaviyo(deal.contact_id).catch(console.error)
  );

  return NextResponse.json(deal, { status: 201 });
}
