import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail } from "mailparser";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPlatformId } from "@/lib/platform";

function parseSenderName(rawName: string | undefined | null): { first_name: string; last_name: string } {
  if (!rawName) return { first_name: "", last_name: "" };
  const cleaned = rawName.replace(/^["']|["']$/g, "").trim();
  if (!cleaned) return { first_name: "", last_name: "" };
  if (cleaned.includes(",")) {
    const [last, first] = cleaned.split(",").map((s) => s.trim());
    return { first_name: first ?? "", last_name: last ?? "" };
  }
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) return { first_name: parts[0], last_name: "" };
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") };
}

export async function POST() {
  try {
    const cookieStore = await cookies();
    const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
    const platformId = await getPlatformId(slug);
    if (!platformId) return NextResponse.json({ error: "Platform not found" }, { status: 404 });

    const platform = await prisma.platform.findUnique({
      where: { id: platformId },
      select: { imap_host: true, imap_port: true, imap_user: true, imap_pass: true, imap_enabled: true },
    });

    if (!platform?.imap_enabled || !platform.imap_host || !platform.imap_user || !platform.imap_pass) {
      return NextResponse.json({ error: "IMAP not configured" }, { status: 400 });
    }

    // Load all contacts for this platform
    const allContacts = await prisma.contact.findMany({
      where: { platform_id: platformId },
      select: { id: true, field_values: true },
    });

    const emailToContact = new Map<string, { id: string; field_values: Record<string, unknown> }>();
    for (const c of allContacts) {
      const fv = (c.field_values as Record<string, unknown> | null) ?? {};
      const emails = fv.emails as { address: string }[] | undefined;
      if (emails) {
        for (const e of emails) {
          if (e.address) emailToContact.set(e.address.toLowerCase(), { id: c.id, field_values: fv });
        }
      }
    }

    const client = new ImapFlow({
      host: platform.imap_host,
      port: platform.imap_port ?? 993,
      secure: true,
      auth: { user: platform.imap_user.toLowerCase(), pass: platform.imap_pass },
      logger: false,
    });

    let scanned = 0;
    let updated = 0;
    let errors = 0;

    await client.connect();
    try {
      const lock = await client.getMailboxLock("INBOX");
      try {
        // Scan last 90 days
        const since = new Date();
        since.setDate(since.getDate() - 90);
        const uids = await client.search({ since }, { uid: true });
        if (!uids || uids.length === 0) {
          return NextResponse.json({ scanned: 0, updated: 0, errors: 0 });
        }

        // Limit to last 500 to avoid huge runs
        const batch = uids.slice(-500);

        for await (const msg of client.fetch(batch, { source: true, envelope: true }, { uid: true })) {
          try {
            scanned++;
            if (!msg.source) continue;
            const parsed: ParsedMail = await (simpleParser as (s: Buffer) => Promise<ParsedMail>)(msg.source);
            const fromAddr = (parsed.from?.value?.[0]?.address ?? "").toLowerCase();
            if (!fromAddr) continue;

            const contact = emailToContact.get(fromAddr);
            if (!contact) continue;

            const senderName = parsed.from?.value?.[0]?.name ?? "";
            const { first_name, last_name } = parseSenderName(senderName);

            const updates: Record<string, unknown> = {};
            if (first_name && !contact.field_values.first_name) updates.first_name = first_name;
            if (last_name && !contact.field_values.last_name) updates.last_name = last_name;
            if (Object.keys(updates).length === 0) continue;

            const newFv = { ...contact.field_values, ...updates };
            await prisma.contact.update({
              where: { id: contact.id },
              data: { field_values: newFv as Prisma.InputJsonValue },
            });
            contact.field_values = newFv;
            updated++;
          } catch (err) {
            console.error("[backfill-names] message error:", err);
            errors++;
          }
        }
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }

    return NextResponse.json({ scanned, updated, errors });
  } catch (err) {
    console.error("[POST /api/email-sync/backfill-names]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Backfill failed" }, { status: 500 });
  }
}
