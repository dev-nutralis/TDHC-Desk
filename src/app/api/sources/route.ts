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

export async function GET() {
  const cookieStore = await cookies();
  const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
  const platformId = await getPlatformId(slug) ?? null;

  const sources = await prisma.source.findMany({
    where: { platform_id: platformId },
    include: includeAll,
    orderBy: { name: "asc" },
  });
  return NextResponse.json(sources);
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
  const platformId = await getPlatformId(slug) ?? null;

  const { name, attribute_groups } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const existing = await prisma.source.findFirst({ where: { name: name.trim(), platform_id: platformId } });
  if (existing) return NextResponse.json({ error: "Source already exists" }, { status: 409 });

  const source = await prisma.source.create({
    data: {
      name: name.trim(),
      platform_id: platformId,
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

  return NextResponse.json(source, { status: 201 });
}
