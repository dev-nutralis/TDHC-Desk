import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.contactActivity.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if ("deal_id"  in body) data.deal_id  = body.deal_id  ?? null;
  if ("archived" in body) data.archived = Boolean(body.archived);

  const activity = await prisma.contactActivity.update({
    where: { id },
    data,
    include: {
      contact: { select: { id: true, field_values: true } },
      deal:    { select: { id: true, field_values: true } },
    },
  });

  return NextResponse.json(activity);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const existing = await prisma.contactActivity.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.contactActivity.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
