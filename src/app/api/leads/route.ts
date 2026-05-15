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

  // Paginate at the ID level to avoid skip/take operating on JOIN-duplicated rows
  let allIds: string[];
  if (search) {
    const pattern = `%${search}%`;
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Lead"
      WHERE (
        field_values::text ILIKE ${pattern}
        OR CONCAT(field_values->>'first_name', ' ', field_values->>'last_name') ILIKE ${pattern}
        OR CONCAT(field_values->>'last_name', ' ', field_values->>'first_name') ILIKE ${pattern}
      )
      AND platform_id = ${platformId}
      ORDER BY created_at DESC
    `;
    allIds = rows.map(r => r.id);
  } else {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Lead" WHERE platform_id = ${platformId} ORDER BY created_at DESC
    `;
    allIds = rows.map(r => r.id);
  }

  const total = allIds.length;
  const pageIds = allIds.slice(offset, offset + limit);

  const rawLeads = await prisma.lead.findMany({
    where: { id: { in: pageIds } },
    include: includeSource,
  });

  // Re-sort to match ORDER BY created_at DESC
  const leadMap = new Map(rawLeads.map(l => [l.id, l]));
  const leads = pageIds.map(id => leadMap.get(id)).filter(Boolean) as typeof rawLeads;

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
