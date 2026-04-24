import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const original = await prisma.source.findUnique({
    where: { id },
    include: {
      attribute_groups: {
        orderBy: { sort_order: "asc" },
        include: { items: { orderBy: { sort_order: "asc" } } },
      },
    },
  });

  if (!original) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Find a unique name
  let name = `${original.name} (Copy)`;
  let counter = 1;
  while (await prisma.source.findFirst({ where: { name } })) {
    counter++;
    name = `${original.name} (Copy ${counter})`;
  }

  const copy = await prisma.source.create({
    data: {
      name,
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
