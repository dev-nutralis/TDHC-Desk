import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
  user: { select: { id: true, name: true } },
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search    = searchParams.get("search") || "";
    const contactId = searchParams.get("contact_id") || "";
    const page      = parseInt(searchParams.get("page") || "1");
    const limit     = 20;
    const skip      = (page - 1) * limit;

    let filterConditions: FilterCondition[] = [];
    try {
      const fp = searchParams.get("filters");
      if (fp) filterConditions = JSON.parse(fp);
    } catch { /* ignore */ }

    const clauses: string[] = [];
    const params: unknown[] = [];

    if (search) {
      clauses.push(`field_values::text ILIKE $${params.length + 1}`);
      params.push("%" + search + "%");
    }

    const { clauses: filterClauses, params: filterParams } = buildFilterClauses(filterConditions);
    for (const fc of filterClauses) {
      clauses.push(fc.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + params.length}`));
    }
    params.push(...filterParams);

    // Base where (contact_id scope)
    const baseWhere: Record<string, unknown> = {};
    if (contactId) baseWhere.contact_id = contactId;

    let ids: string[] | null = null;
    if (clauses.length > 0) {
      const contactClause = contactId ? ` AND contact_id = '${contactId.replace(/'/g, "''")}'` : "";
      const sql = `SELECT id FROM "Deal" WHERE ${clauses.join(" AND ")}${contactClause}`;
      const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(sql, ...params);
      ids = rows.map(r => r.id);
    }

    const where = ids !== null ? { ...baseWhere, id: { in: ids } } : baseWhere;

    const [deals, total] = await Promise.all([
      prisma.deal.findMany({
        where,
        include: includeContact,
        orderBy: { created_at: "desc" },
        skip,
        take: limit,
      }),
      prisma.deal.count({ where }),
    ]);

    return NextResponse.json({ deals, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("[GET /api/deals]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { contact_id, field_values, user_id } = await req.json();

  if (!contact_id)
    return NextResponse.json({ error: "contact_id is required" }, { status: 400 });
  if (!user_id)
    return NextResponse.json({ error: "user_id is required" }, { status: 400 });

  const deal = await prisma.deal.create({
    data: {
      contact_id,
      field_values: field_values ?? {},
      user_id,
    },
    include: includeContact,
  });

  return NextResponse.json(deal, { status: 201 });
}
