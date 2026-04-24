import { prisma } from "@/lib/prisma";

type FV = Record<string, unknown>;

/**
 * Called after a Deal's field_values are updated.
 * Propagates any linked field values to the deal's Contact.
 */
export async function syncDealValuesToContact(
  dealId: string,
  newFieldValues: FV
): Promise<void> {
  const deal = await prisma.deal.findUnique({ where: { id: dealId } });
  if (!deal?.contact_id) return;

  // Which of the changed keys belong to linked DealFields?
  const linkedFields = await prisma.dealField.findMany({
    where: {
      source_module: { not: null },
      field_key: { in: Object.keys(newFieldValues) },
    },
    select: { field_key: true, source_module: true },
  });
  if (!linkedFields.length) return;

  // Build patch — only keys that appear in linked fields
  const patch: FV = {};
  for (const f of linkedFields) {
    if (newFieldValues[f.field_key] !== undefined) {
      patch[f.field_key] = newFieldValues[f.field_key];
    }
  }
  if (!Object.keys(patch).length) return;

  const contact = await prisma.contact.findUnique({ where: { id: deal.contact_id } });
  if (!contact) return;

  await prisma.contact.update({
    where: { id: deal.contact_id },
    data: { field_values: { ...((contact.field_values as FV) ?? {}), ...patch } },
  });
}

/**
 * Called after a Contact's field_values are updated.
 * Propagates changed values to all Deals that belong to this contact,
 * but only for field keys that are linked from contacts in DealField.
 */
export async function syncContactValuesToDeal(
  contactId: string,
  newFieldValues: FV
): Promise<void> {
  const changedKeys = Object.keys(newFieldValues);
  if (!changedKeys.length) return;

  // Which of the changed keys are linked from contacts in DealField?
  const linkedFields = await prisma.dealField.findMany({
    where: {
      source_module: "contacts",
      field_key: { in: changedKeys },
    },
    select: { field_key: true },
  });
  if (!linkedFields.length) return;

  const patch: FV = {};
  for (const f of linkedFields) {
    patch[f.field_key] = newFieldValues[f.field_key];
  }

  const deals = await prisma.deal.findMany({ where: { contact_id: contactId } });
  if (!deals.length) return;

  await Promise.all(
    deals.map(deal =>
      prisma.deal.update({
        where: { id: deal.id },
        data: { field_values: { ...((deal.field_values as FV) ?? {}), ...patch } },
      })
    )
  );
}
