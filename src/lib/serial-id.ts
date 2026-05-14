import { prisma } from "./prisma";

const START_VALUE = 100000001; // first issued ID (9-digit)

type Module = "contact" | "lead" | "deal";

interface FieldRow { field_key: string; }

/**
 * Get all serial_id field keys defined for the given module.
 */
export async function getSerialIdFieldKeys(module: Module, platformId: string | null): Promise<string[]> {
  let rows: FieldRow[] = [];
  if (module === "contact") {
    rows = await prisma.contactField.findMany({
      where: { field_type: "serial_id", platform_id: platformId },
      select: { field_key: true },
    });
  } else if (module === "lead") {
    rows = await prisma.leadField.findMany({
      where: { field_type: "serial_id", platform_id: platformId },
      select: { field_key: true },
    });
  } else if (module === "deal") {
    rows = await prisma.dealField.findMany({
      where: { field_type: "serial_id", platform_id: platformId },
      select: { field_key: true },
    });
  }
  return rows.map(r => r.field_key);
}

/**
 * Compute the next serial number for the given module + field_key + platform.
 * Reads max((field_values->>'<key>')::bigint) and returns max+1, or START_VALUE if empty.
 */
export async function getNextSerial(module: Module, fieldKey: string, platformId: string | null): Promise<string> {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(fieldKey)) throw new Error("invalid field_key");

  const table = module === "contact" ? "Contact" : module === "lead" ? "Lead" : "Deal";
  const sql = `SELECT COALESCE(MAX(NULLIF(field_values->>'${fieldKey}', '')::bigint), $1::bigint) AS max FROM "${table}" WHERE platform_id = $2`;
  const rows = await prisma.$queryRawUnsafe<{ max: bigint }[]>(sql, START_VALUE - 1, platformId);
  const max = rows[0]?.max ?? BigInt(START_VALUE - 1);
  const next = max + BigInt(1);
  return String(next);
}

/**
 * Apply serial IDs for all serial_id fields of this module to the given field_values object.
 * Returns the augmented field_values (does not overwrite existing values).
 */
export async function applySerialIds<T extends Record<string, unknown>>(
  module: Module,
  platformId: string | null,
  fieldValues: T,
): Promise<T> {
  const keys = await getSerialIdFieldKeys(module, platformId);
  if (keys.length === 0) return fieldValues;
  const fv = { ...fieldValues } as Record<string, unknown>;
  for (const key of keys) {
    if (!fv[key]) {
      fv[key] = await getNextSerial(module, key, platformId);
    }
  }
  return fv as T;
}

/**
 * Backfill the given serial_id field on all existing records of the module that lack it.
 * Used immediately after a new serial_id field is created.
 */
export async function backfillSerialId(module: Module, fieldKey: string, platformId: string | null): Promise<number> {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(fieldKey)) throw new Error("invalid field_key");

  let records: { id: string; field_values: unknown }[] = [];
  if (module === "contact") {
    records = await prisma.contact.findMany({
      where: { platform_id: platformId },
      select: { id: true, field_values: true },
      orderBy: { created_at: "asc" },
    });
  } else if (module === "lead") {
    records = await prisma.lead.findMany({
      where: { platform_id: platformId },
      select: { id: true, field_values: true },
      orderBy: { created_at: "asc" },
    });
  } else if (module === "deal") {
    records = await prisma.deal.findMany({
      where: { platform_id: platformId },
      select: { id: true, field_values: true },
      orderBy: { created_at: "asc" },
    });
  }

  // Find current max
  let next = BigInt(START_VALUE);
  for (const r of records) {
    const fv = (r.field_values as Record<string, unknown> | null) ?? {};
    const v = fv[fieldKey];
    if (v !== undefined && v !== null && v !== "") {
      const n = BigInt(String(v));
      if (n >= next) next = n + BigInt(1);
    }
  }

  let updated = 0;
  for (const r of records) {
    const fv = (r.field_values as Record<string, unknown> | null) ?? {};
    if (fv[fieldKey]) continue;
    const newFv = { ...fv, [fieldKey]: String(next) };
    next = next + BigInt(1);
    if (module === "contact") {
      await prisma.contact.update({ where: { id: r.id }, data: { field_values: newFv as never } });
    } else if (module === "lead") {
      await prisma.lead.update({ where: { id: r.id }, data: { field_values: newFv as never } });
    } else if (module === "deal") {
      await prisma.deal.update({ where: { id: r.id }, data: { field_values: newFv as never } });
    }
    updated++;
  }
  return updated;
}
