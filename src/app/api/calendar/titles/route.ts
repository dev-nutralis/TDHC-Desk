import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getPlatformId } from "@/lib/platform";

export async function GET() {
  const cookieStore = await cookies();
  const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
  const platformId = await getPlatformId(slug) ?? null;

  const titles = await prisma.calendarEventTitle.findMany({
    where: { platform_id: platformId },
    orderBy: [{ sort_order: "asc" }, { label: "asc" }],
  });
  return NextResponse.json(titles);
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
    const platformId = await getPlatformId(slug) ?? null;

    const { label } = await req.json();
    if (!label?.trim()) return NextResponse.json({ error: "Label required" }, { status: 400 });
    const existing = await prisma.calendarEventTitle.findFirst({ where: { label: label.trim(), platform_id: platformId } });
    if (existing) return NextResponse.json(existing);
    const title = await prisma.calendarEventTitle.create({ data: { label: label.trim(), platform_id: platformId } });
    return NextResponse.json(title, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
