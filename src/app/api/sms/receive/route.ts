import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { timingSafeEqual } from "crypto";

function safeTokenEqual(a: string, b: string): boolean {
  try {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  // Bearer token auth
  const secret = process.env.SMS_WEBHOOK_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!safeTokenEqual(token, secret)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
  }

  let body: { phone?: string; port?: string; content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { phone, content } = body;

  if (!phone || !content) {
    return NextResponse.json({ error: "phone and content are required" }, { status: 400 });
  }

  // TG1600 encodes spaces as "+" in content
  const message = content.replace(/\+/g, " ").trim();
  const normalizedPhone = phone.trim();

  // Match last 8 digits to handle +386 vs 0 prefix differences
  const last8 = normalizedPhone.replace(/\D/g, "").slice(-8);
  const contacts = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Contact"
    WHERE field_values::text LIKE ${"%" + last8 + "%"}
    LIMIT 1
  `;

  const contactId = contacts[0]?.id ?? null;

  if (!contactId) {
    console.log(`[sms/receive] No contact found for phone ${normalizedPhone} — storing without contact`);
  }

  if (contactId) {
    await prisma.contactActivity.create({
      data: {
        contact_id: contactId,
        type: "sms",
        direction: "inbound",
        subject: normalizedPhone,
        body: message,
      },
    });
  }

  console.log(`[sms/receive] ${normalizedPhone}: ${message.slice(0, 50)}${message.length > 50 ? "..." : ""}`);
  return NextResponse.json({ ok: true });
}
