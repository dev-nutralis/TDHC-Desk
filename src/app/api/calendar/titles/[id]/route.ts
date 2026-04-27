import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getPlatformId } from "@/lib/platform";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
    const platformId = await getPlatformId(slug) ?? null;

    const { id } = await params;
    const existing = await prisma.calendarEventTitle.findFirst({ where: { id, platform_id: platformId } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.calendarEventTitle.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
    const platformId = await getPlatformId(slug) ?? null;

    const { id } = await params;
    const existing = await prisma.calendarEventTitle.findFirst({ where: { id, platform_id: platformId } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
