import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const include = {
  contact: { select: { id: true, field_values: true } },
  deal:    { select: { id: true, field_values: true } },
  user:    { select: { id: true, name: true } },
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tab = searchParams.get("tab") ?? "today"; // "today" | "overdue" | "completed"

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const where =
      tab === "today"
        ? { completed: false, start_at: { gte: todayStart, lte: todayEnd } }
        : tab === "overdue"
        ? { completed: false, start_at: { lt: todayStart } }
        : { completed: true };

    const events = await prisma.calendarEvent.findMany({
      where,
      include,
      orderBy: { start_at: tab === "completed" ? "desc" : "asc" },
    });

    return NextResponse.json(events);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
