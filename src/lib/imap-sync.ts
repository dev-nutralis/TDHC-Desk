import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail } from "mailparser";
import { prisma } from "./prisma";

export interface SyncResult {
  synced: number;
  skipped: number;
  errors: number;
  throttled?: boolean;
}

function stripQuotedReply(text: string): string {
  let clean = text.replace(/\nOn [\s\S]+?wrote:\s*\n(>.*\n?)*/gi, "");
  clean = clean
    .split("\n")
    .filter((line) => !line.trimStart().startsWith(">"))
    .join("\n");
  clean = clean.replace(/\n[-]{2,}\s*(Original Message|Forwarded message)[\s\S]*/i, "");
  return clean.trim() || text.trim();
}

export async function syncInbox(platformId: string): Promise<SyncResult> {
  const platform = await prisma.platform.findUnique({
    where: { id: platformId },
    select: {
      imap_host: true,
      imap_port: true,
      imap_user: true,
      imap_pass: true,
      imap_enabled: true,
      imap_last_sync: true,
      email_auto_contact_source_id: true,
    },
  });

  if (
    !platform?.imap_enabled ||
    !platform.imap_host ||
    !platform.imap_user ||
    !platform.imap_pass
  ) {
    return { synced: 0, skipped: 0, errors: 0 };
  }

  // Throttle: skip if synced within last 60 seconds
  if (platform.imap_last_sync) {
    const elapsed = Date.now() - platform.imap_last_sync.getTime();
    if (elapsed < 60_000) return { synced: 0, skipped: 0, errors: 0, throttled: true };
  }

  // Fix N+1: load all contacts for this platform once
  const allContacts = await prisma.contact.findMany({
    where: { platform_id: platformId },
    select: { id: true, field_values: true },
  });

  const emailToContactId = new Map<string, string>();
  for (const c of allContacts) {
    const fv = c.field_values as Record<string, unknown> | null;
    const emails = fv?.emails as { address: string }[] | undefined;
    if (emails) {
      for (const e of emails) {
        if (e.address) emailToContactId.set(e.address.toLowerCase(), c.id);
      }
    }
  }

  // Fix N+1: load all existing message IDs once
  const existingRows = await prisma.contactActivity.findMany({
    where: { email_message_id: { not: null } },
    select: { email_message_id: true },
  });
  const existingMessageIds = new Set(existingRows.map((r) => r.email_message_id!));

  const ownEmail = platform.imap_user.toLowerCase();
  const autoSourceId = platform.email_auto_contact_source_id ?? null;

  // Default owner for auto-created contacts: prefer an admin, fall back to first user
  let defaultOwnerId: string | null = null;
  if (autoSourceId) {
    const owner = await prisma.user.findFirst({ where: { role: { in: ["super_admin", "admin"] } } })
      ?? await prisma.user.findFirst();
    defaultOwnerId = owner?.id ?? null;
  }

  const client = new ImapFlow({
    host: platform.imap_host,
    port: platform.imap_port ?? 993,
    secure: true,
    auth: { user: ownEmail, pass: platform.imap_pass },
    logger: false,
  });

  await client.connect();

  let synced = 0;
  let skipped = 0;
  let errors = 0;

  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const uids = await client.search({ since }, { uid: true });

      if (!uids || uids.length === 0) return { synced, skipped, errors };

      const batch = uids.slice(-100);

      for await (const msg of client.fetch(batch, { source: true, envelope: true }, { uid: true })) {
        try {
          const messageId = msg.envelope?.messageId;
          if (!messageId || !msg.source) { skipped++; continue; }

          // O(1) lookup instead of DB query per email
          if (existingMessageIds.has(messageId)) { skipped++; continue; }

          const parsed: ParsedMail = await (simpleParser as (source: Buffer) => Promise<ParsedMail>)(msg.source);

          const fromAddr = (parsed.from?.value?.[0]?.address ?? "").toLowerCase();
          if (!fromAddr) { skipped++; continue; }

          const isOutbound = fromAddr === ownEmail;

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

          // O(1) lookup instead of findMany per email
          let contactId = emailToContactId.get(lookupAddr);

          // Auto-create contact for unknown inbound senders if configured
          if (!contactId) {
            if (isOutbound || !autoSourceId || !defaultOwnerId) {
              skipped++;
              continue;
            }
            const created = await prisma.contact.create({
              data: {
                platform_id: platformId,
                user_id: defaultOwnerId,
                source_id: autoSourceId,
                field_values: {
                  emails: [{ address: lookupAddr, is_main: true, note: "" }],
                },
              },
              select: { id: true },
            });
            contactId = created.id;
            emailToContactId.set(lookupAddr, contactId);
          }

          const rawText =
            parsed.text?.trim() ||
            (typeof parsed.html === "string"
              ? parsed.html.replace(/<[^>]*>/g, "").trim()
              : "");

          const bodyText = rawText ? stripQuotedReply(rawText) : "(no content)";

          const normalizedSubject = (parsed.subject ?? "").toLowerCase().replace(/^re:\s*/i, "").trim();
          const threadId = `${contactId}::${normalizedSubject}`;

          await prisma.contactActivity.create({
            data: {
              contact_id: contactId,
              platform_id: platformId,
              type: "email",
              direction: isOutbound ? "outbound" : "inbound",
              subject: parsed.subject ?? null,
              body: bodyText,
              email_message_id: messageId,
              is_read: isOutbound,
              is_draft: false,
              is_spam: false,
              thread_id: threadId,
              created_at: parsed.date ?? new Date(),
            },
          });

          existingMessageIds.add(messageId);
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

  await prisma.platform.update({
    where: { id: platformId },
    data: { imap_last_sync: new Date() },
  });

  return { synced, skipped, errors };
}
