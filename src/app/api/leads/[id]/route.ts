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
  user: { select: { id: true, first_name: true, last_name: true } },
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
  const platformId = await getPlatformId(slug) ?? null;

  const { id } = await params;
  const lead = await prisma.lead.findFirst({ where: { id, platform_id: platformId }, include: includeSource });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(lead);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
  const platformId = await getPlatformId(slug) ?? null;

  const { id } = await params;
  const { field_values, source_id, attribute_ids, user_id } = await req.json();

  const existing = await prisma.lead.findFirst({ where: { id, platform_id: platformId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const lead = await prisma.lead.update({
    where: { id },
    data: {
      field_values: field_values ?? {},
      source_id: source_id || null,
      attribute_ids: attribute_ids?.length ? JSON.stringify(attribute_ids) : null,
      user_id,
    },
    include: includeSource,
  });

  return NextResponse.json(lead);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
  const platformId = await getPlatformId(slug) ?? null;

  const { id } = await params;
  const existing = await prisma.lead.findFirst({ where: { id, platform_id: platformId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.lead.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
