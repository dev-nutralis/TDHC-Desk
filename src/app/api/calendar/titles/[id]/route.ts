import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.calendarEventTitle.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { label, sort_order } = await req.json();
    const title = await prisma.calendarEventTitle.update({
      where: { id },
      data: {
        ...(label !== undefined && { label: label.trim() }),
        ...(sort_order !== undefined && { sort_order }),
      },
    });
    return NextResponse.json(title);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
