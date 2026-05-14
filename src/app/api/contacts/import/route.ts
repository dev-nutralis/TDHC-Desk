import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getPlatformId } from "@/lib/platform";
import { Prisma } from "@prisma/client";

interface ImportRow {
  full_name: string;
  email: string;
  created_at: string;
  mobile: string;
  contact_id: string;
  date_of_birth: string;
  additional_email: string;
  gender: string;
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
    const platformId = await getPlatformId(slug) ?? null;

    const { rows, user_id } = await req.json();

    if (!user_id)
      return NextResponse.json({ error: "user_id required" }, { status: 400 });
    if (!Array.isArray(rows) || rows.length === 0)
      return NextResponse.json({ error: "rows required" }, { status: 400 });

    // Fetch all active contact fields to identify field_keys by type/name
    const contactFields = await prisma.contactField.findMany({
      where: { platform_id: platformId, is_active: true },
      select: { field_key: true, field_type: true },
    });

    const emailFieldKey = contactFields.find(f => f.field_type === "multi_email")?.field_key;
    const phoneFieldKey = contactFields.find(f => f.field_type === "multi_phone")?.field_key;
    const serialIdFieldKey = contactFields.find(f => f.field_type === "serial_id")?.field_key;
    const dobFieldKey = contactFields.find(f =>
      f.field_key === "date_of_birth" ||
      f.field_key.includes("birth") ||
      f.field_key === "dob"
    )?.field_key;
    const genderFieldKey = contactFields.find(f =>
      f.field_key === "gender" ||
      f.field_key === "spol" ||
      f.field_key.includes("gender") ||
      f.field_key.includes("sex")
    )?.field_key;

    const results = {
      created: 0,
      skipped: 0,
      errors: [] as Array<{ row: number; message: string }>,
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as ImportRow;
      try {
        const fv: Record<string, unknown> = {};

        // Name split: first word = first_name, rest = last_name
        const nameParts = (row.full_name ?? "").trim().split(/\s+/).filter(Boolean);
        fv.first_name = nameParts[0] ?? "";
        fv.last_name = nameParts.slice(1).join(" ");

        // Emails (main + additional)
        if (emailFieldKey) {
          const emails: { address: string; is_main: boolean }[] = [];
          if (row.email?.trim()) {
            emails.push({ address: row.email.trim(), is_main: true });
          }
          if (row.additional_email?.trim()) {
            emails.push({ address: row.additional_email.trim(), is_main: emails.length === 0 });
          }
          if (emails.length > 0) fv[emailFieldKey] = emails;
        }

        // Mobile — strip leading apostrophe (Excel artifact)
        if (phoneFieldKey && row.mobile?.trim()) {
          const mobile = row.mobile.trim().replace(/^'+/, "");
          if (mobile) fv[phoneFieldKey] = [{ number: mobile, note: "" }];
        }

        // Date of birth
        if (dobFieldKey && row.date_of_birth?.trim()) {
          fv[dobFieldKey] = row.date_of_birth.trim();
        }

        // Gender: Z = female, M = male
        if (genderFieldKey && row.gender?.trim()) {
          const g = row.gender.trim().toUpperCase();
          fv[genderFieldKey] = g === "Z" ? "female" : g === "M" ? "male" : g.toLowerCase();
        }

        // Serial ID from CSV (do not auto-generate)
        if (serialIdFieldKey && row.contact_id?.trim()) {
          fv[serialIdFieldKey] = row.contact_id.trim();
        }

        // created_at from CSV
        let createdAt: Date | undefined;
        if (row.created_at?.trim()) {
          const d = new Date(row.created_at.trim());
          if (!isNaN(d.getTime())) createdAt = d;
        }

        await prisma.contact.create({
          data: {
            field_values: fv as Prisma.InputJsonValue,
            user_id,
            platform_id: platformId,
            ...(createdAt ? { created_at: createdAt } : {}),
          },
        });
        results.created++;
      } catch (err) {
        results.errors.push({
          row: i + 1,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return NextResponse.json(results);
  } catch (err) {
    console.error("[POST /api/contacts/import]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
