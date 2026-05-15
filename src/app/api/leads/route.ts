import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getPlatformId } from "@/lib/platform";
import { applySerialIds } from "@/lib/serial-id";
import { Prisma } from "@prisma/client";

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
  const cookieStore = await cookies();
  const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
  const platformId = await getPlatformId(slug) ?? null;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const limit = Math.min(parseInt(searchParams.get("limit") || "45"), 500);
  const offset = parseInt(searchParams.get("offset") || "0");

  // For search we use raw SQL for JSONB text search; otherwise standard query
  if (search) {
    const pattern = `%${search}%`;
    const [leads, countResult] = await Promise.all([
      prisma.$queryRaw<unknown[]>`
        SELECT l.*, row_to_json(s.*) as source, row_to_json(u.*) as user
        FROM "Lead" l
        LEFT JOIN "Source" s ON l.source_id = s.id
        LEFT JOIN "User" u ON l.user_id = u.id
        WHERE (
          l.field_values::text ILIKE ${pattern}
          OR CONCAT(l.field_values->>'first_name', ' ', l.field_values->>'last_name') ILIKE ${pattern}
          OR CONCAT(l.field_values->>'last_name', ' ', l.field_values->>'first_name') ILIKE ${pattern}
        )
        AND l.platform_id = ${platformId}
        ORDER BY l.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) FROM "Lead" WHERE (
          field_values::text ILIKE ${pattern}
          OR CONCAT(field_values->>'first_name', ' ', field_values->>'last_name') ILIKE ${pattern}
          OR CONCAT(field_values->>'last_name', ' ', field_values->>'first_name') ILIKE ${pattern}
        )
        AND platform_id = ${platformId}
      `,
    ]);
    const total = Number(countResult[0].count);
    return NextResponse.json({ leads, total, offset, hasMore: offset + (leads as unknown[]).length < total });
  }

  const where = { platform_id: platformId };

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({ where, include: includeSource, orderBy: { created_at: "desc" }, skip: offset, take: limit }),
    prisma.lead.count({ where }),
  ]);

  return NextResponse.json({ leads, total, offset, hasMore: offset + leads.length < total });
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
  const platformId = await getPlatformId(slug) ?? null;

  const { field_values, source_id, attribute_ids, user_id } = await req.json();

  if (!user_id)
    return NextResponse.json({ error: "User is required" }, { status: 400 });

  const fvWithSerial = await applySerialIds("lead", platformId, (field_values ?? {}) as Record<string, unknown>);

  const lead = await prisma.lead.create({
    data: {
      field_values: fvWithSerial as Prisma.InputJsonValue,
      source_id: source_id || null,
      attribute_ids: attribute_ids?.length ? JSON.stringify(attribute_ids) : null,
      user_id,
      platform_id: platformId,
    },
    include: includeSource,
  });

  return NextResponse.json(lead, { status: 201 });
}
