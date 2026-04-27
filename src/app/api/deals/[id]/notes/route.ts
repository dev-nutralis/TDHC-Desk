import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getPlatformId } from "@/lib/platform";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
  const platformId = await getPlatformId(slug) ?? null;

  const { id } = await params;
  const deal = await prisma.deal.findFirst({ where: { id, platform_id: platformId } });
  if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const notes = await prisma.dealNote.findMany({
    where: { deal_id: id },
    include: { user: { select: { id: true, first_name: true, last_name: true } } },
    orderBy: { created_at: "desc" },
  });
  return NextResponse.json(notes);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
  const platformId = await getPlatformId(slug) ?? null;

  const { id } = await params;
  const deal = await prisma.deal.findFirst({ where: { id, platform_id: platformId } });
  if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { content, user_id } = await req.json();
  if (!content?.trim()) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }
  const note = await prisma.dealNote.create({
    data: { deal_id: id, user_id, content: content.trim() },
    include: { user: { select: { id: true, first_name: true, last_name: true } } },
  });
  return NextResponse.json(note, { status: 201 });
}
