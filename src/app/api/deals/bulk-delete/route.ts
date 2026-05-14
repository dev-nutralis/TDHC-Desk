import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getPlatformId } from "@/lib/platform";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
    const platformId = await getPlatformId(slug) ?? null;

    const { ids } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0)
      return NextResponse.json({ error: "ids array is required" }, { status: 400 });

    const count = await prisma.deal.count({
      where: { id: { in: ids }, platform_id: platformId },
    });
    if (count !== ids.length)
      return NextResponse.json({ error: "Some deals not found or not accessible" }, { status: 403 });

    // DealNotes cascade automatically; ContactActivity.deal_id set to null via onDelete: SetNull
    await prisma.deal.deleteMany({ where: { id: { in: ids } } });

    return NextResponse.json({ deleted: ids.length });
  } catch (err) {
    console.error("[POST /api/deals/bulk-delete]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
