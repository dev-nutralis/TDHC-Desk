import { prisma } from "@/lib/prisma";
import type { InputJsonValue } from "@prisma/client/runtime/library";

type FV = Record<string, unknown>;

export async function syncDealValuesToContact(
  dealId: string,
  newFieldValues: FV
): Promise<void> {
  const deal = await prisma.deal.findUnique({ where: { id: dealId } });
  if (!deal?.contact_id) return;

  const linkedFields = await prisma.dealField.findMany({
    where: { source_module: { not: null }, field_key: { in: Object.keys(newFieldValues) } },
    select: { field_key: true, source_module: true },
  });
  if (!linkedFields.length) return;

  const patch: FV = {};
  for (const f of linkedFields) {
    if (newFieldValues[f.field_key] !== undefined) patch[f.field_key] = newFieldValues[f.field_key];
  }
  if (!Object.keys(patch).length) return;

  const contact = await prisma.contact.findUnique({ where: { id: deal.contact_id } });
  if (!contact) return;

  const merged = { ...((contact.field_values as FV) ?? {}), ...patch };
  await prisma.contact.update({
    where: { id: deal.contact_id },
    data: { field_values: merged as InputJsonValue },
  });
}

export async function syncContactValuesToDeal(
  contactId: string,
  newFieldValues: FV
): Promise<void> {
  const changedKeys = Object.keys(newFieldValues);
  if (!changedKeys.length) return;

  const linkedFields = await prisma.dealField.findMany({
    where: { source_module: "contacts", field_key: { in: changedKeys } },
    select: { field_key: true },
  });
  if (!linkedFields.length) return;

  const patch: FV = {};
  for (const f of linkedFields) patch[f.field_key] = newFieldValues[f.field_key];

  const deals = await prisma.deal.findMany({ where: { contact_id: contactId } });
  if (!deals.length) return;

  await Promise.all(
    deals.map(deal => {
      const merged = { ...((deal.field_values as FV) ?? {}), ...patch };
      return prisma.deal.update({
        where: { id: deal.id },
        data: { field_values: merged as InputJsonValue },
      });
    })
  );
}
