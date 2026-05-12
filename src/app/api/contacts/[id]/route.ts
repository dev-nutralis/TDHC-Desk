import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getPlatformId } from "@/lib/platform";
import { syncContactValuesToDeal } from "@/lib/sync-field-values";

const includeSource = {
  source: {
    include: {
      attribute_groups: {
        orderBy: { sort_order: "asc" as const },
        include: { items: { orderBy: { sort_order: "asc" as const } } },
      },
    },
  },
  user: { select: { id: true, first_name: true, last_name: true } },
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
    const platformId = await getPlatformId(slug) ?? null;

    const { id } = await params;
    const contact = await prisma.contact.findFirst({ where: { id, platform_id: platformId }, include: includeSource });
    if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(contact);
  } catch (err) {
    console.error("[GET /api/contacts/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
    const platformId = await getPlatformId(slug) ?? null;

    const { id } = await params;
    const { field_values, source_id, attribute_ids, user_id } = await req.json();

    const existing = await prisma.contact.findFirst({ where: { id, platform_id: platformId } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const newAttributeIds = Array.isArray(attribute_ids) ? JSON.stringify(attribute_ids) : (attribute_ids ?? null);
    const newSourceId = source_id || null;
    const sourceChanged =
      (source_id !== undefined && newSourceId !== existing.source_id) ||
      (attribute_ids !== undefined && newAttributeIds !== existing.attribute_ids);

    const contact = await prisma.contact.update({
      where: { id },
      data: {
        field_values: field_values ?? undefined,
        source_id: newSourceId,
        attribute_ids: newAttributeIds,
        user_id,
      },
      include: includeSource,
    });

    if (field_values) {
      syncContactValuesToDeal(id, field_values as Record<string, unknown>).catch(console.error);
    }

    // Propagate source change down to all linked deals
    if (sourceChanged) {
      await prisma.deal.updateMany({
        where: { contact_id: id },
        data: {
          ...(source_id !== undefined && { source_id: newSourceId }),
          ...(attribute_ids !== undefined && { attribute_ids: newAttributeIds }),
        },
      });
    }

    return NextResponse.json(contact);
  } catch (err) {
    console.error("[PUT /api/contacts/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
    const platformId = await getPlatformId(slug) ?? null;

    const { id } = await params;
    const existing = await prisma.contact.findFirst({ where: { id, platform_id: platformId } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.contact.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/contacts/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
