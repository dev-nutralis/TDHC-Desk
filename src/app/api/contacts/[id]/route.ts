import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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
  user: { select: { id: true, name: true } },
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const contact = await prisma.contact.findUnique({ where: { id }, include: includeSource });
    if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(contact);
  } catch (err) {
    console.error("[GET /api/contacts/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { field_values, source_id, attribute_ids, user_id } = await req.json();

    const contact = await prisma.contact.update({
      where: { id },
      data: {
        field_values: field_values ?? undefined,
        source_id: source_id || null,
        attribute_ids: Array.isArray(attribute_ids) ? JSON.stringify(attribute_ids) : (attribute_ids ?? null),
        user_id,
      },
      include: includeSource,
    });

    if (field_values) {
      syncContactValuesToDeal(id, field_values as Record<string, unknown>).catch(console.error);
    }
    return NextResponse.json(contact);
  } catch (err) {
    console.error("[PUT /api/contacts/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.contact.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/contacts/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
