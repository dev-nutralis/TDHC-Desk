import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const titles = await prisma.calendarEventTitle.findMany({
    orderBy: [{ sort_order: "asc" }, { label: "asc" }],
  });
  return NextResponse.json(titles);
}

export async function POST(req: NextRequest) {
  try {
    const { label } = await req.json();
    if (!label?.trim()) return NextResponse.json({ error: "Label required" }, { status: 400 });
    const existing = await prisma.calendarEventTitle.findUnique({ where: { label: label.trim() } });
    if (existing) return NextResponse.json(existing);
    const title = await prisma.calendarEventTitle.create({ data: { label: label.trim() } });
    return NextResponse.json(title, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
