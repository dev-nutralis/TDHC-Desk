import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getPlatformId } from "@/lib/platform";

const includeAll = {
  attribute_groups: {
    orderBy: { sort_order: "asc" as const },
    include: { items: { orderBy: { sort_order: "asc" as const } } },
  },
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
  const platformId = await getPlatformId(slug) ?? null;

  const { id } = await params;
  const source = await prisma.source.findFirst({ where: { id, platform_id: platformId }, include: includeAll });
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(source);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
  const platformId = await getPlatformId(slug) ?? null;

  const { id } = await params;
  const existing = await prisma.source.findFirst({ where: { id, platform_id: platformId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { name, attribute_groups } = await req.json();

  // Delete all existing groups (cascades to items)
  await prisma.sourceAttributeGroup.deleteMany({ where: { source_id: id } });

  const source = await prisma.source.update({
    where: { id },
    data: {
      name: name.trim(),
      attribute_groups: {
        create: (attribute_groups || []).map((g: { name: string; items: { label: string }[] }, gi: number) => ({
          name: g.name,
          sort_order: gi,
          items: {
            create: (g.items || [])
              .map((item: { label: string }, ii: number) => ({ label: item.label.trim(), sort_order: ii }))
              .filter((item: { label: string }) => item.label),
          },
        })),
      },
    },
    include: includeAll,
  });

  return NextResponse.json(source);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
  const platformId = await getPlatformId(slug) ?? null;

  const { id } = await params;
  const existing = await prisma.source.findFirst({ where: { id, platform_id: platformId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.source.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
