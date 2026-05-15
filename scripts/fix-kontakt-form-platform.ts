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
  // Move "Kontakt forma" from Evalley HR to Evalley SI
  const evalleySI = await prisma.platform.findFirst({
    where: { slug: "evalley" },
    select: { id: true, name: true },
  });

  if (!evalleySI) {
    console.error("Evalley SI platform not found");
    process.exit(1);
  }

  console.log(`Moving to platform: "${evalleySI.name}" (${evalleySI.id})`);

  const updated = await prisma.klaviyoForm.updateMany({
    where: { token: "19c61312-ab3d-4188-99a2-43e9dee6c733" },
    data: { platform_id: evalleySI.id },
  });

  console.log(`Updated ${updated.count} form(s).`);

  // Verify
  const form = await prisma.klaviyoForm.findFirst({
    where: { token: "19c61312-ab3d-4188-99a2-43e9dee6c733" },
    include: { platform: true },
  });
  console.log(`\nVerification: "${form?.name}" → platform "${form?.platform?.slug}" (${form?.platform_id})`);

  await prisma.$disconnect();
  await pool.end();
}
main().catch(console.error);
