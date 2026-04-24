import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const include = {
  contact: { select: { id: true, field_values: true } },
  deal: { select: { id: true, field_values: true } },
  user: { select: { id: true, name: true } },
};

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const event = await prisma.calendarEvent.update({
      where: { id },
      data: {
        ...(body.title !== undefined && { title: body.title.trim() }),
        ...(body.description !== undefined && { description: body.description?.trim() || null }),
        ...(body.start_at !== undefined && { start_at: new Date(body.start_at) }),
        ...(body.end_at !== undefined && { end_at: new Date(body.end_at) }),
        ...(body.all_day !== undefined && { all_day: body.all_day }),
        ...(body.color !== undefined && { color: body.color }),
        ...(body.contact_id !== undefined && { contact_id: body.contact_id || null }),
        ...(body.deal_id   !== undefined && { deal_id:   body.deal_id   || null }),
        ...(body.completed !== undefined && { completed: Boolean(body.completed) }),
        updated_at: new Date(),
      },
      include,
    });
    return NextResponse.json(event);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.calendarEvent.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
