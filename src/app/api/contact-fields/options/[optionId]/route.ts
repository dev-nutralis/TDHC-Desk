import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncContactFieldToDeals } from "@/lib/sync-lead-to-contact-field";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ optionId: string }> }
) {
  const { optionId } = await params;
  const { label, value, sort_order } = await req.json();

  const existing = await prisma.contactFieldOption.findUnique({
    where: { id: optionId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const option = await prisma.contactFieldOption.update({
    where: { id: optionId },
    data: {
      ...(label !== undefined && { label: label.trim() }),
      ...(value !== undefined && { value: value.trim() }),
      ...(sort_order !== undefined && { sort_order }),
    },
  });

  syncContactFieldToDeals(existing.field_id).catch(console.error);
  return NextResponse.json(option);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ optionId: string }> }
) {
  const { optionId } = await params;

  const existing = await prisma.contactFieldOption.findUnique({
    where: { id: optionId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.contactFieldOption.delete({ where: { id: optionId } });
  syncContactFieldToDeals(existing.field_id).catch(console.error);
  return NextResponse.json({ success: true });
}
