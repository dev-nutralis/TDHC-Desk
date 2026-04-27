import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getPlatformId } from "@/lib/platform";

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
    const page = parseInt(searchParams.get("page") || "1");
    const limit = 20;
    const skip = (page - 1) * limit;

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
      clauses.push(`field_values::text ILIKE $${params.length + 1}`);
      params.push("%" + search + "%");
    }

    const { clauses: filterClauses, params: filterParams } = buildFilterClauses(filterConditions);
    // Offset filter param indices by existing param count
    for (const fc of filterClauses) {
      const adjusted = fc.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + params.length}`);
      clauses.push(adjusted);
    }
    params.push(...filterParams);

    const sql = `SELECT id FROM "Contact" WHERE ${clauses.join(" AND ")}`;
    const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(sql, ...params);
    const ids = rows.map((r) => r.id);

    const where = { id: { in: ids }, platform_id: platformId };

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        include: includeSource,
        orderBy: { created_at: "desc" },
        skip,
        take: limit,
      }),
      prisma.contact.count({ where }),
    ]);

    return NextResponse.json({ contacts, total, page, pages: Math.ceil(total / limit) });
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

    const contact = await prisma.contact.create({
      data: {
        field_values: field_values ?? undefined,
        source_id: source_id || null,
        attribute_ids: Array.isArray(attribute_ids) ? JSON.stringify(attribute_ids) : (attribute_ids ?? null),
        user_id,
        platform_id: platformId,
        ...(createdAt ? { created_at: createdAt } : {}),
      },
      include: includeSource,
    });

    return NextResponse.json(contact, { status: 201 });
  } catch (err) {
    console.error("[POST /api/contacts]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
