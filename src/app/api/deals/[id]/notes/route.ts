import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const notes = await prisma.dealNote.findMany({
    where: { deal_id: id },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { created_at: "desc" },
  });
  return NextResponse.json(notes);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { content, user_id } = await req.json();
  if (!content?.trim()) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }
  const note = await prisma.dealNote.create({
    data: { deal_id: id, user_id, content: content.trim() },
    include: { user: { select: { id: true, name: true } } },
  });
  return NextResponse.json(note, { status: 201 });
}
