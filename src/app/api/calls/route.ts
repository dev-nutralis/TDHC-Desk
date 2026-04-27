import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getPlatformId } from "@/lib/platform";

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
    const platformId = await getPlatformId(slug) ?? null;

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit = 50;
    const skip = (page - 1) * limit;

    const [calls, total] = await Promise.all([
      prisma.call.findMany({
        where: { platform_id: platformId },
        orderBy: { started_at: "desc" },
        skip,
        take: limit,
      }),
      prisma.call.count({ where: { platform_id: platformId } }),
    ]);

    return NextResponse.json({ calls, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("[calls] GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
