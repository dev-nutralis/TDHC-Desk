import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getPlatformId } from "@/lib/platform";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
  const platformId = await getPlatformId(slug) ?? null;

  const { id } = await params;

  const original = await prisma.source.findFirst({
    where: { id, platform_id: platformId },
    include: {
      attribute_groups: {
        orderBy: { sort_order: "asc" },
        include: { items: { orderBy: { sort_order: "asc" } } },
      },
    },
  });

  if (!original) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Find a unique name within this platform
  let name = `${original.name} (Copy)`;
  let counter = 1;
  while (await prisma.source.findFirst({ where: { name, platform_id: platformId } })) {
    counter++;
    name = `${original.name} (Copy ${counter})`;
  }

  const copy = await prisma.source.create({
    data: {
      name,
      platform_id: platformId,
      attribute_groups: {
        create: original.attribute_groups.map(g => ({
          name: g.name,
          sort_order: g.sort_order,
          items: {
            create: g.items.map(item => ({ label: item.label, sort_order: item.sort_order })),
          },
        })),
      },
    },
    include: {
      attribute_groups: {
        orderBy: { sort_order: "asc" },
        include: { items: { orderBy: { sort_order: "asc" } } },
      },
    },
  });

  return NextResponse.json(copy, { status: 201 });
}
