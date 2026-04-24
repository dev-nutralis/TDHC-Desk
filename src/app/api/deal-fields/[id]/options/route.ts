import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const options = await prisma.dealFieldOption.findMany({ where: { field_id: id }, orderBy: { sort_order: "asc" } });
  return NextResponse.json(options);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { label, value, sort_order } = await req.json();
  if (!label?.trim()) return NextResponse.json({ error: "label is required" }, { status: 400 });
  if (!value?.trim()) return NextResponse.json({ error: "value is required" }, { status: 400 });
  const option = await prisma.dealFieldOption.create({
    data: { field_id: id, label: label.trim(), value: value.trim(), sort_order: sort_order ?? 0 },
  });
  return NextResponse.json(option, { status: 201 });
}
