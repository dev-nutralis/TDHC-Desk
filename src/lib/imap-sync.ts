import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail } from "mailparser";
import { prisma } from "./prisma";

export interface SyncResult {
  synced: number;
  skipped: number;
  errors: number;
}

// ── Strip quoted reply blocks ─────────────────────────────────────────────────
// Removes "On [date] ... wrote:\n> ..." blocks and bare ">"-prefixed lines
function stripQuotedReply(text: string): string {
  // 1. Remove "On <date>, <name> <email> wrote:\n> ..." (Gmail / Outlook style)
  let clean = text.replace(/\nOn [\s\S]+?wrote:\s*\n(>.*\n?)*/gi, "");

  // 2. Remove lines that start with ">" (quoted lines)
  clean = clean
    .split("\n")
    .filter((line) => !line.trimStart().startsWith(">"))
    .join("\n");

  // 3. Remove "---- Original Message ----" and everything after
  clean = clean.replace(/\n[-]{2,}\s*(Original Message|Forwarded message)[\s\S]*/i, "");

  return clean.trim() || text.trim();
}

// ── Main sync ─────────────────────────────────────────────────────────────────

export async function syncInbox(): Promise<SyncResult> {
  const ownEmail = (process.env.SMTP_USER ?? "").toLowerCase();
  const pass = (process.env.SMTP_PASS ?? "").replace(/\s/g, "");

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: ownEmail, pass },
    logger: false,
  });

  await client.connect();

  let synced = 0;
  let skipped = 0;
  let errors = 0;

  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      // Search messages from the last 30 days (seen or unseen)
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const uids = await client.search({ since }, { uid: true });

      if (!uids || uids.length === 0) return { synced, skipped, errors };

      // Process at most 100 messages per sync (newest first)
      const batch = uids.slice(-100);

      for await (const msg of client.fetch(batch, { source: true, envelope: true }, { uid: true })) {
        try {
          const messageId = msg.envelope?.messageId;
          if (!messageId || !msg.source) { skipped++; continue; }

          // Skip already ingested
          const exists = await prisma.contactActivity.findUnique({
            where: { email_message_id: messageId },
          });
          if (exists) { skipped++; continue; }

          // Parse raw source
          const parsed: ParsedMail = await (simpleParser as (source: Buffer) => Promise<ParsedMail>)(msg.source);

          const fromAddr = (parsed.from?.value?.[0]?.address ?? "").toLowerCase();
          if (!fromAddr) { skipped++; continue; }

          const isOutbound = fromAddr === ownEmail;

          // Resolve lookup address: outbound → To, inbound → From
          let lookupAddr = "";
          if (isOutbound) {
            const toField = parsed.to;
            if (toField && !Array.isArray(toField) && "value" in toField) {
              lookupAddr = (toField.value[0]?.address ?? "").toLowerCase();
            } else if (Array.isArray(toField) && toField.length > 0 && "value" in toField[0]) {
              lookupAddr = (toField[0].value[0]?.address ?? "").toLowerCase();
            }
          } else {
            lookupAddr = fromAddr;
          }

          if (!lookupAddr) { skipped++; continue; }

          // Find matching contact
          const allContacts = await prisma.contact.findMany({
            select: { id: true, field_values: true },
          });

          const matched = allContacts.find((c) => {
            const fv = c.field_values as Record<string, unknown> | null;
            const emails = fv?.emails as { address: string }[] | undefined;
            return emails?.some((e) => e.address.toLowerCase() === lookupAddr);
          });

          if (!matched) { skipped++; continue; }

          // Extract and clean body
          const rawText =
            parsed.text?.trim() ||
            (typeof parsed.html === "string"
              ? parsed.html.replace(/<[^>]*>/g, "").trim()
              : "");

          const bodyText = rawText ? stripQuotedReply(rawText) : "(no content)";

          await prisma.contactActivity.create({
            data: {
              contact_id: matched.id,
              type: "email",
              direction: isOutbound ? "outbound" : "inbound",
              subject: parsed.subject ?? null,
              body: bodyText,
              email_message_id: messageId,
              created_at: parsed.date ?? new Date(),
            },
          });

          synced++;
        } catch (msgErr) {
          console.error("[imap-sync] message error:", msgErr);
          errors++;
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  return { synced, skipped, errors };
}
