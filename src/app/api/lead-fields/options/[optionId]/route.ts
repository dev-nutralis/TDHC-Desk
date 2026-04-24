import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncLeadFieldToContacts } from "@/lib/sync-lead-to-contact-field";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ optionId: string }> }
) {
  const { optionId } = await params;
  const { label, value, sort_order } = await req.json();

  const existing = await prisma.leadFieldOption.findUnique({
    where: { id: optionId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const option = await prisma.leadFieldOption.update({
    where: { id: optionId },
    data: {
      ...(label !== undefined && { label: label.trim() }),
      ...(value !== undefined && { value: value.trim() }),
      ...(sort_order !== undefined && { sort_order }),
    },
  });

  syncLeadFieldToContacts(existing.field_id).catch(console.error);
  return NextResponse.json(option);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ optionId: string }> }
) {
  const { optionId } = await params;

  const existing = await prisma.leadFieldOption.findUnique({
    where: { id: optionId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.leadFieldOption.delete({ where: { id: optionId } });
  syncLeadFieldToContacts(existing.field_id).catch(console.error);
  return NextResponse.json({ success: true });
}
