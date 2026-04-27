import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getPlatformId } from "@/lib/platform";

const include = {
  contact: { select: { id: true, field_values: true } },
  deal: { select: { id: true, field_values: true } },
  user: { select: { id: true, name: true } },
};

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
    const platformId = await getPlatformId(slug) ?? null;

    const { id } = await params;
    const existing = await prisma.calendarEvent.findFirst({ where: { id, platform_id: platformId } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
    const cookieStore = await cookies();
    const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
    const platformId = await getPlatformId(slug) ?? null;

    const { id } = await params;
    const existing = await prisma.calendarEvent.findFirst({ where: { id, platform_id: platformId } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.calendarEvent.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
