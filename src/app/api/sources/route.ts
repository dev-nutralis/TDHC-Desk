import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const includeAll = {
  attribute_groups: {
    orderBy: { sort_order: "asc" as const },
    include: { items: { orderBy: { sort_order: "asc" as const } } },
  },
};

export async function GET() {
  const sources = await prisma.source.findMany({
    include: includeAll,
    orderBy: { name: "asc" },
  });
  return NextResponse.json(sources);
}

export async function POST(req: NextRequest) {
  const { name, attribute_groups } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const existing = await prisma.source.findFirst({ where: { name: name.trim() } });
  if (existing) return NextResponse.json({ error: "Source already exists" }, { status: 409 });

  const source = await prisma.source.create({
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

  return NextResponse.json(source, { status: 201 });
}
