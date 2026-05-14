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

    // Verify all contacts belong to this platform before deleting
    const count = await prisma.contact.count({
      where: { id: { in: ids }, platform_id: platformId },
    });
    if (count !== ids.length)
      return NextResponse.json({ error: "Some contacts not found or not accessible" }, { status: 403 });

    await prisma.$transaction(async (tx) => {
      // Delete deal notes first (not cascade from contact)
      const deals = await tx.deal.findMany({
        where: { contact_id: { in: ids } },
        select: { id: true },
      });
      const dealIds = deals.map((d) => d.id);

      if (dealIds.length > 0) {
        await tx.dealNote.deleteMany({ where: { deal_id: { in: dealIds } } });
        await tx.deal.deleteMany({ where: { id: { in: dealIds } } });
      }

      // ContactActivity cascades from Contact (onDelete: Cascade in schema)
      await tx.contact.deleteMany({ where: { id: { in: ids } } });
    });

    return NextResponse.json({ deleted: ids.length });
  } catch (err) {
    console.error("[POST /api/contacts/bulk-delete]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
