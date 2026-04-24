import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "admin@tdhc.com" },
    update: {},
    create: { name: "Admin", email: "admin@tdhc.com" },
  });

  const website = await prisma.source.upsert({
    where: { name: "Website" },
    update: {},
    create: {
      name: "Website",
      attribute_groups: {
        create: [
          { name: "General", sort_order: 0, items: { create: [
            { label: "Landing page visitor", sort_order: 0 },
            { label: "Blog reader", sort_order: 1 },
            { label: "Organic search", sort_order: 2 },
          ]}},
          { name: "Intent", sort_order: 1, items: { create: [
            { label: "Product inquiry", sort_order: 0 },
            { label: "Demo request", sort_order: 1 },
            { label: "Pricing info", sort_order: 2 },
          ]}},
          { name: "Options", sort_order: 2, items: { create: [
            { label: "Contact Form", sort_order: 0 },
            { label: "Live Chat", sort_order: 1 },
            { label: "Newsletter Signup", sort_order: 2 },
          ]}},
        ],
      },
    },
  });

  const referral = await prisma.source.upsert({
    where: { name: "Referral" },
    update: {},
    create: {
      name: "Referral",
      attribute_groups: {
        create: [
          { name: "General", sort_order: 0, items: { create: [
            { label: "Existing client", sort_order: 0 },
            { label: "Partner", sort_order: 1 },
          ]}},
          { name: "Intent", sort_order: 1, items: { create: [
            { label: "High trust", sort_order: 0 },
            { label: "Quick close", sort_order: 1 },
          ]}},
          { name: "Options", sort_order: 2, items: { create: [
            { label: "Client referral", sort_order: 0 },
            { label: "Partner referral", sort_order: 1 },
          ]}},
        ],
      },
    },
  });

  const leads = [
    { field_values: { first_name: "Marko", last_name: "Petrović" }, source_id: website.id },
    { field_values: { first_name: "Ana", last_name: "Jovanović" }, source_id: referral.id },
    { field_values: { first_name: "Stefan", last_name: "Nikolić" }, source_id: website.id },
    { field_values: { first_name: "Jelena", last_name: "Đorđević" }, source_id: referral.id },
    { field_values: { first_name: "Milan", last_name: "Stojanović" }, source_id: website.id },
  ];

  for (const lead of leads) {
    await prisma.lead.create({ data: { ...lead, user_id: user.id } });
  }

  console.log("Seed completed.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
