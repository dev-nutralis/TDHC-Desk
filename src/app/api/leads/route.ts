import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getPlatformId } from "@/lib/platform";

const includeSource = {
  source: {
    include: {
      attribute_groups: {
        orderBy: { sort_order: "asc" as const },
        include: { items: { orderBy: { sort_order: "asc" as const } } },
      },
    },
  },
  user: { select: { id: true, name: true } },
};

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
  const platformId = await getPlatformId(slug) ?? null;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = 20;
  const skip = (page - 1) * limit;

  // For search we use raw SQL for JSONB text search; otherwise standard query
  if (search) {
    const pattern = `%${search}%`;
    const [leads, countResult] = await Promise.all([
      prisma.$queryRaw<unknown[]>`
        SELECT l.*, row_to_json(s.*) as source, row_to_json(u.*) as user
        FROM "Lead" l
        LEFT JOIN "Source" s ON l.source_id = s.id
        LEFT JOIN "User" u ON l.user_id = u.id
        WHERE l.field_values::text ILIKE ${pattern}
        AND l.platform_id = ${platformId}
        ORDER BY l.created_at DESC
        LIMIT ${limit} OFFSET ${skip}
      `,
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) FROM "Lead" WHERE field_values::text ILIKE ${pattern}
        AND platform_id = ${platformId}
      `,
    ]);
    const total = Number(countResult[0].count);
    return NextResponse.json({ leads, total, page, pages: Math.ceil(total / limit) });
  }

  const where = { platform_id: platformId };

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({ where, include: includeSource, orderBy: { created_at: "desc" }, skip, take: limit }),
    prisma.lead.count({ where }),
  ]);

  return NextResponse.json({ leads, total, page, pages: Math.ceil(total / limit) });
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
  const platformId = await getPlatformId(slug) ?? null;

  const { field_values, source_id, attribute_ids, user_id } = await req.json();

  if (!user_id)
    return NextResponse.json({ error: "User is required" }, { status: 400 });

  const lead = await prisma.lead.create({
    data: {
      field_values: field_values ?? {},
      source_id: source_id || null,
      attribute_ids: attribute_ids?.length ? JSON.stringify(attribute_ids) : null,
      user_id,
      platform_id: platformId,
    },
    include: includeSource,
  });

  return NextResponse.json(lead, { status: 201 });
}
