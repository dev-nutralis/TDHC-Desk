import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getPlatformId } from "@/lib/platform";
import { syncDealValuesToContact } from "@/lib/sync-field-values";

const includeContact = {
  contact: { select: { id: true, field_values: true } },
  user: { select: { id: true, name: true } },
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
  const platformId = await getPlatformId(slug) ?? null;

  const { id } = await params;
  const deal = await prisma.deal.findFirst({ where: { id, platform_id: platformId }, include: includeContact });
  if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(deal);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
  const platformId = await getPlatformId(slug) ?? null;

  const { id } = await params;
  const { contact_id, field_values, user_id } = await req.json();

  const existing = await prisma.deal.findFirst({ where: { id, platform_id: platformId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const deal = await prisma.deal.update({
    where: { id },
    data: {
      ...(contact_id !== undefined && { contact_id }),
      ...(field_values !== undefined && { field_values }),
      ...(user_id !== undefined && { user_id }),
      updated_at: new Date(),
    },
    include: includeContact,
  });

  if (field_values !== undefined) {
    syncDealValuesToContact(id, field_values as Record<string, unknown>).catch(console.error);
  }
  return NextResponse.json(deal);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
  const platformId = await getPlatformId(slug) ?? null;

  const { id } = await params;
  const existing = await prisma.deal.findFirst({ where: { id, platform_id: platformId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.deal.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
