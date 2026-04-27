import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getPlatformId } from "@/lib/platform";

const include = {
  contact: { select: { id: true, field_values: true } },
  deal: { select: { id: true, field_values: true } },
  user: { select: { id: true, first_name: true, last_name: true } },
};

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
    const platformId = await getPlatformId(slug) ?? null;

    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    const events = await prisma.calendarEvent.findMany({
      where: {
        platform_id: platformId,
        ...(start && end ? {
          OR: [
            { start_at: { gte: new Date(start), lte: new Date(end) } },
            { end_at: { gte: new Date(start), lte: new Date(end) } },
            { AND: [{ start_at: { lte: new Date(start) } }, { end_at: { gte: new Date(end) } }] },
          ]
        } : {}),
      },
      include,
      orderBy: { start_at: "asc" },
    });
    return NextResponse.json(events);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
    const platformId = await getPlatformId(slug) ?? null;

    const { title, description, start_at, end_at, all_day, color, user_id, contact_id, deal_id } = await req.json();
    if (!title?.trim() || !start_at || !end_at || !user_id) {
      return NextResponse.json({ error: "title, start_at, end_at, user_id required" }, { status: 400 });
    }
    const event = await prisma.calendarEvent.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        start_at: new Date(start_at),
        end_at: new Date(end_at),
        all_day: all_day ?? false,
        color: color ?? "#038153",
        user_id,
        contact_id: contact_id || null,
        deal_id: deal_id || null,
        platform_id: platformId,
      },
      include,
    });
    return NextResponse.json(event, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
