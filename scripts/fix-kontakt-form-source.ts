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
  const forms = await prisma.klaviyoForm.findMany({
    select: { id: true, name: true, mappings: true },
  });

  let updated = 0;

  for (const form of forms) {
    type Mapping = { klaviyo_field: string; contact_field_key: string; static_value?: string; static_attribute_ids?: string[]; transform?: string };
    const mappings = (form.mappings as Mapping[]) ?? [];
    let changed = false;

    const newMappings = mappings.map((m) => {
      // Replace static source mapping with dynamic properties.form_name
      if (m.contact_field_key === "__source__" && m.static_value) {
        changed = true;
        const { static_value, static_attribute_ids, ...rest } = m;
        void static_value; void static_attribute_ids;
        return { ...rest, klaviyo_field: "properties.form_name" };
      }
      return m;
    });

    if (changed) {
      await prisma.klaviyoForm.update({
        where: { id: form.id },
        data: { mappings: newMappings as never },
      });
      console.log(`Updated form "${form.name}" (${form.id})`);
      updated++;
    }
  }

  console.log(`\nDone. Updated ${updated} form(s).`);
  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
