import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncDealValuesToContact } from "@/lib/sync-field-values";

const includeContact = {
  contact: { select: { id: true, field_values: true } },
  user: { select: { id: true, name: true } },
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deal = await prisma.deal.findUnique({ where: { id }, include: includeContact });
  if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(deal);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { contact_id, field_values, user_id } = await req.json();

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
  const { id } = await params;
  await prisma.deal.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
