import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getPlatformId } from "@/lib/platform";

const include = {
  contact: { select: { id: true, field_values: true } },
  deal:    { select: { id: true, field_values: true } },
  user:    { select: { id: true, name: true } },
};

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
    const platformId = await getPlatformId(slug) ?? null;

    const { searchParams } = new URL(req.url);
    const tab = searchParams.get("tab") ?? "today";

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const timeFilter =
      tab === "today"
        ? { completed: false, start_at: { gte: todayStart, lte: todayEnd } }
        : tab === "overdue"
        ? { completed: false, start_at: { lt: todayStart } }
        : { completed: true };

    const events = await prisma.calendarEvent.findMany({
      where: { platform_id: platformId, ...timeFilter },
      include,
      orderBy: { start_at: tab === "completed" ? "desc" : "asc" },
    });

    return NextResponse.json(events);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
