import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config({ path: ".env.local" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  const firstName = process.argv[4] ?? "Super";
  const lastName = process.argv[5] ?? "Admin";

  if (!email || !password) {
    console.error("Usage: npx tsx scripts/create-super-admin.ts <email> <password> [first_name] [last_name]");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.error(`User with email ${email} already exists.`);
    process.exit(1);
  }

  const password_hash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      first_name: firstName,
      last_name: lastName,
      email,
      password_hash,
      role: "super_admin",
    },
  });

  console.log(`Super admin created: ${user.first_name} ${user.last_name} <${user.email}> (id: ${user.id})`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => { prisma.$disconnect(); pool.end(); });
