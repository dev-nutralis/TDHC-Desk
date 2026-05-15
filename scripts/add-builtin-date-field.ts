import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
import { PrismaPg } from "@prisma/adapter-pg";
import pkg from "pg";
const { Pool } = pkg;
import { PrismaClient } from "@prisma/client";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as never);

async function main() {
  const platforms = await prisma.platform.findMany({ select: { id: true, name: true, slug: true } });

  for (const platform of platforms) {
    const existing = await prisma.contactField.findFirst({
      where: { field_key: "__added_on__", platform_id: platform.id },
    });

    if (existing) {
      console.log(`Platform "${platform.name}": __added_on__ already exists (${existing.id}), skipped.`);
      continue;
    }

    // Get current max sort_order to place at the end
    const maxField = await prisma.contactField.findFirst({
      where: { platform_id: platform.id },
      orderBy: { sort_order: "desc" },
      select: { sort_order: true },
    });
    const nextOrder = (maxField?.sort_order ?? 0) + 1;

    const field = await prisma.contactField.create({
      data: {
        field_key: "__added_on__",
        label: "Created",
        field_type: "builtin_date",
        sort_order: nextOrder,
        is_required: false,
        is_active: true,
        is_filterable: true,
        platform_id: platform.id,
      },
    });

    console.log(`Platform "${platform.name}": created __added_on__ field (${field.id}), sort_order=${nextOrder}`);
  }

  await prisma.$disconnect();
  await pool.end();
}
main().catch(console.error);
