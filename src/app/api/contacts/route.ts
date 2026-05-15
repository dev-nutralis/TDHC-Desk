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
    // Special: __added_on__ maps to the created_at column
    if (f.field_key === "__added_on__") {
      if (f.operator === "range") {
        const parts: string[] = [];
        if (f.value)  { parts.push(`DATE(created_at) >= $${params.length + 1}::date`); params.push(f.value); }
        if (f.value2) { parts.push(`DATE(created_at) <= $${params.length + 1}::date`); params.push(f.value2); }
        if (parts.length) clauses.push(parts.join(" AND "));
      } else if (f.operator === "is_empty") {
        clauses.push("FALSE");
      }
      // not_empty: created_at is always set, no clause needed
      continue;
    }

    // Validate field_key to prevent SQL injection (alphanumeric + underscore only)
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

const includeSource = {
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
    const search = searchParams.get("search") || "";
    const limit = Math.min(parseInt(searchParams.get("limit") || "45"), 500);
    const offset = parseInt(searchParams.get("offset") || "0");

    let filterConditions: FilterCondition[] = [];
    try {
      const fp = searchParams.get("filters");
      if (fp) filterConditions = JSON.parse(fp);
    } catch { /* ignore malformed filters */ }

    // Build raw SQL WHERE clauses from search + filters
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
    // Offset filter param indices by existing param count
    for (const fc of filterClauses) {
      const adjusted = fc.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + params.length}`);
      clauses.push(adjusted);
    }
    params.push(...filterParams);

    let allIds: string[];
    if (!search && filterConditions.length === 0) {
      const idRows = await prisma.contact.findMany({ where: { platform_id: platformId }, select: { id: true }, orderBy: { created_at: "desc" } });
      allIds = idRows.map(r => r.id);
    } else {
      const sql = `SELECT id FROM "Contact" WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC`;
      const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(sql, ...params);
      allIds = rows.map((r) => r.id);
    }
    const total = allIds.length;

    const pageIds = allIds.slice(offset, offset + limit);
    const rawContacts = await prisma.contact.findMany({
      where: { id: { in: pageIds } },
      include: includeSource,
    });

    // Re-sort to match ORDER BY created_at DESC
    const contactMap = new Map(rawContacts.map(c => [c.id, c]));
    const contacts = pageIds.map(id => contactMap.get(id)).filter(Boolean) as typeof rawContacts;

    return NextResponse.json({ contacts, total, offset, hasMore: offset + contacts.length < total });
  } catch (err) {
    console.error("[GET /api/contacts]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
    const platformId = await getPlatformId(slug) ?? null;

    const { field_values, source_id, attribute_ids, user_id } = await req.json();

    if (!user_id)
      return NextResponse.json({ error: "User is required" }, { status: 400 });

    // Check if any date field has use_as_created_at: true and a value was provided
    let createdAt: Date | undefined;
    const dateFields = await prisma.contactField.findMany({
      where: { field_type: "date", is_active: true },
      select: { field_key: true, config: true },
    });
    for (const df of dateFields) {
      try {
        const cfg = JSON.parse(df.config ?? "{}");
        if (cfg.use_as_created_at && field_values?.[df.field_key]) {
          createdAt = new Date(field_values[df.field_key] as string);
          break;
        }
      } catch { /* skip */ }
    }

    // Auto-fill any serial_id fields with the next number
    const fvWithSerial = await applySerialIds("contact", platformId, (field_values ?? {}) as Record<string, unknown>);

    const contact = await prisma.contact.create({
      data: {
        field_values: fvWithSerial as Prisma.InputJsonValue,
        source_id: source_id || null,
        attribute_ids: Array.isArray(attribute_ids) ? JSON.stringify(attribute_ids) : (attribute_ids ?? null),
        user_id,
        platform_id: platformId,
        ...(createdAt ? { created_at: createdAt } : {}),
      },
      include: includeSource,
    });

    // Async Klaviyo sync — don't await, don't block response
    import("@/lib/klaviyo-sync").then(({ syncContactToKlaviyo }) =>
      syncContactToKlaviyo(contact.id).catch(console.error)
    );

    return NextResponse.json(contact, { status: 201 });
  } catch (err) {
    console.error("[POST /api/contacts]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
