import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getPlatformId } from "@/lib/platform";
import { syncDealValuesToContact } from "@/lib/sync-field-values";

const includeContact = {
  contact: { select: { id: true, field_values: true } },
  source: { select: { id: true, name: true } },
  user: { select: { id: true, first_name: true, last_name: true } },
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
  const platformId = await getPlatformId(slug) ?? null;

  const { id } = await params;
  const deal = await prisma.deal.findFirst({ where: { id, platform_id: platformId }, include: includeContact });
  if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(deal);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
  const platformId = await getPlatformId(slug) ?? null;

  const { id } = await params;
  const { contact_id, field_values, user_id, source_id, attribute_ids } = await req.json();

  const existing = await prisma.deal.findFirst({ where: { id, platform_id: platformId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sourceChanged =
    (source_id !== undefined && source_id !== existing.source_id) ||
    (attribute_ids !== undefined && attribute_ids !== existing.attribute_ids);

  const deal = await prisma.deal.update({
    where: { id },
    data: {
      ...(contact_id !== undefined && { contact_id }),
      ...(field_values !== undefined && { field_values }),
      ...(user_id !== undefined && { user_id }),
      ...(source_id !== undefined && { source_id: source_id || null }),
      ...(attribute_ids !== undefined && { attribute_ids: attribute_ids || null }),
      updated_at: new Date(),
    },
    include: includeContact,
  });

  if (field_values !== undefined) {
    syncDealValuesToContact(id, field_values as Record<string, unknown>).catch(console.error);

    // Klaviyo sync if pipeline changed
    const oldPipeline = (existing.field_values as Record<string, unknown> | null)?.["pipeline"];
    const newPipeline = (field_values as Record<string, unknown>)["pipeline"];
    if (newPipeline !== undefined && newPipeline !== oldPipeline) {
      import("@/lib/klaviyo-sync").then(({ syncContactToKlaviyo }) =>
        syncContactToKlaviyo(deal.contact_id).catch(console.error)
      );
    }
  }

  // Propagate source change up to parent contact and sibling deals
  if (sourceChanged) {
    const parentContactId = deal.contact_id;
    await prisma.contact.update({
      where: { id: parentContactId },
      data: {
        ...(source_id !== undefined && { source_id: source_id || null }),
        ...(attribute_ids !== undefined && { attribute_ids: attribute_ids || null }),
      },
    });
    // Also sync to sibling deals of the same contact
    await prisma.deal.updateMany({
      where: { contact_id: parentContactId, id: { not: id } },
      data: {
        ...(source_id !== undefined && { source_id: source_id || null }),
        ...(attribute_ids !== undefined && { attribute_ids: attribute_ids || null }),
      },
    });
  }

  return NextResponse.json(deal);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
  const platformId = await getPlatformId(slug) ?? null;

  const { id } = await params;
  const existing = await prisma.deal.findFirst({ where: { id, platform_id: platformId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.deal.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
