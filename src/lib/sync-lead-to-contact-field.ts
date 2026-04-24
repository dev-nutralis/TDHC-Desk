import { prisma } from "@/lib/prisma";

/**
 * Propagates lead field changes to all Contact AND Deal fields linked via source_field_id.
 * Syncs: label, field_type, config, and options (full replace).
 */
export async function syncLeadFieldToContacts(leadFieldId: string): Promise<void> {
  const leadField = await prisma.leadField.findUnique({
    where: { id: leadFieldId },
    include: { options: { orderBy: { sort_order: "asc" } } },
  });
  if (!leadField) return;

  await Promise.all([
    syncToContactFields(leadFieldId, leadField),
    syncToDealFields("leads", leadFieldId, leadField),
  ]);
}

/**
 * Propagates contact field changes to all Deal fields linked via source_field_id.
 */
export async function syncContactFieldToDeals(contactFieldId: string): Promise<void> {
  const contactField = await prisma.contactField.findUnique({
    where: { id: contactFieldId },
    include: { options: { orderBy: { sort_order: "asc" } } },
  });
  if (!contactField) return;

  await syncToDealFields("contacts", contactFieldId, contactField);
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function syncToContactFields(
  sourceFieldId: string,
  source: { label: string; field_type: string; config: string | null; options: { label: string; value: string; sort_order: number }[] }
): Promise<void> {
  const linked = await prisma.contactField.findMany({
    where: { source_field_id: sourceFieldId },
    select: { id: true },
  });
  if (!linked.length) return;

  for (const { id: cfId } of linked) {
    await prisma.contactField.update({
      where: { id: cfId },
      data: { label: source.label, field_type: source.field_type, config: source.config ?? null },
    });
    await prisma.contactFieldOption.deleteMany({ where: { field_id: cfId } });
    if (source.options.length > 0) {
      await prisma.contactFieldOption.createMany({
        data: source.options.map(opt => ({ field_id: cfId, label: opt.label, value: opt.value, sort_order: opt.sort_order })),
      });
    }
  }
}

async function syncToDealFields(
  sourceModule: string,
  sourceFieldId: string,
  source: { label: string; field_type: string; config: string | null; options: { label: string; value: string; sort_order: number }[] }
): Promise<void> {
  const linked = await prisma.dealField.findMany({
    where: { source_module: sourceModule, source_field_id: sourceFieldId },
    select: { id: true },
  });
  if (!linked.length) return;

  for (const { id: dfId } of linked) {
    await prisma.dealField.update({
      where: { id: dfId },
      data: { label: source.label, field_type: source.field_type, config: source.config ?? null },
    });
    await prisma.dealFieldOption.deleteMany({ where: { field_id: dfId } });
    if (source.options.length > 0) {
      await prisma.dealFieldOption.createMany({
        data: source.options.map(opt => ({ field_id: dfId, label: opt.label, value: opt.value, sort_order: opt.sort_order })),
      });
    }
  }
}
