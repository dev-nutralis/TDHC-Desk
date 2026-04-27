import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const fields = [
  {
    label: "First Name",
    field_key: "first_name",
    field_type: "text",
    sort_order: 0,
    is_required: true,
    options: [],
  },
  {
    label: "Last Name",
    field_key: "last_name",
    field_type: "text",
    sort_order: 1,
    is_required: false,
    options: [],
  },
  {
    label: "Mobile Numbers",
    field_key: "mobile_numbers",
    field_type: "multi_phone",
    sort_order: 2,
    is_required: false,
    options: [],
  },
  {
    label: "Emails",
    field_key: "emails",
    field_type: "multi_email",
    sort_order: 3,
    is_required: false,
    options: [],
  },
  {
    label: "Created At",
    field_key: "created_at_override",
    field_type: "date",
    sort_order: 4,
    is_required: false,
    options: [],
  },
  {
    label: "Gender",
    field_key: "gender",
    field_type: "radio",
    sort_order: 5,
    is_required: false,
    options: [
      { label: "Male", value: "male", sort_order: 0 },
      { label: "Female", value: "female", sort_order: 1 },
    ],
  },
  {
    label: "Portal Assignment",
    field_key: "portal_assignment",
    field_type: "radio",
    sort_order: 6,
    is_required: false,
    options: [
      { label: "Option 1", value: "option_1", sort_order: 0 },
      { label: "Option 2", value: "option_2", sort_order: 1 },
    ],
  },
  {
    label: "Course Assignment",
    field_key: "course_assignment",
    field_type: "radio",
    sort_order: 7,
    is_required: false,
    options: [
      { label: "Option 1", value: "option_1", sort_order: 0 },
      { label: "Option 2", value: "option_2", sort_order: 1 },
    ],
  },
  {
    label: "Exams",
    field_key: "exams",
    field_type: "radio",
    sort_order: 8,
    is_required: false,
    options: [
      { label: "Option 1", value: "option_1", sort_order: 0 },
      { label: "Option 2", value: "option_2", sort_order: 1 },
    ],
  },
  {
    label: "AFP Client",
    field_key: "afp_client",
    field_type: "boolean",
    sort_order: 9,
    is_required: false,
    options: [],
  },
  {
    label: "Blacklisted",
    field_key: "blacklisted",
    field_type: "boolean",
    sort_order: 10,
    is_required: false,
    options: [],
  },
  {
    label: "Blacklist Reason",
    field_key: "blacklist_reason",
    field_type: "conditional_select",
    sort_order: 11,
    is_required: false,
    config: JSON.stringify({ depends_on: "blacklisted", show_when: "true" }),
    options: [
      { label: "Option 1", value: "option_1", sort_order: 0 },
      { label: "Option 2", value: "option_2", sort_order: 1 },
    ],
  },
];

async function main() {
  for (const field of fields) {
    const { options, config, ...fieldData } = field as typeof field & { config?: string };
    const existing = await prisma.contactField.findFirst({ where: { field_key: fieldData.field_key } });
    if (!existing) {
      await prisma.contactField.create({
        data: {
          ...fieldData,
          ...(config ? { config } : {}),
          options: options.length ? { create: options } : undefined,
        },
      });
      console.log(`Created field: ${fieldData.label}`);
    } else {
      console.log(`Skipped (exists): ${fieldData.label}`);
    }
  }
  console.log("Contact fields seed completed.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
