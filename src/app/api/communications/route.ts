import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getPlatformId } from "@/lib/platform";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
  const platformId = await getPlatformId(slug) ?? null;

  const { searchParams } = new URL(req.url);
  const page   = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit  = 50;
  const offset = (page - 1) * limit;
  const search = searchParams.get("search")?.trim() ?? "";
  const tab    = searchParams.get("tab") ?? "inbox";

  const directionFilter =
    tab === "inbox"    ? { direction: "inbound",  archived: false } :
    tab === "sent"     ? { direction: "outbound", archived: false } :
    /* archived */       { archived: true };

  const where = {
    type: "email",
    platform_id: platformId,
    ...directionFilter,
    ...(search ? {
      OR: [
        { subject: { contains: search, mode: "insensitive" as const } },
        { contact: { field_values: { path: ["first_name"], string_contains: search } } },
      ],
    } : {}),
  };

  const [activities, total] = await Promise.all([
    prisma.contactActivity.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: offset,
      take: limit,
      include: {
        contact: { select: { id: true, field_values: true } },
        deal:    { select: { id: true, field_values: true } },
      },
    }),
    prisma.contactActivity.count({ where }),
  ]);

  return NextResponse.json({ activities, total, page, pages: Math.ceil(total / limit) });
}
