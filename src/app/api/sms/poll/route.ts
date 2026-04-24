import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const POLL_SECRET = process.env.SMS_POLL_SECRET ?? process.env.SMS_WEBHOOK_SECRET ?? "";

export async function GET(req: NextRequest) {
  // Secure the cron endpoint
  const auth = req.headers.get("authorization") ?? "";
  if (POLL_SECRET && auth !== `Bearer ${POLL_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const base = process.env.TG1600_HTTP_URL;
  const user = process.env.TG1600_API_USER;
  const pass = process.env.TG1600_API_PASS;

  if (!base || !user || !pass) {
    return NextResponse.json({ error: "TG1600 not configured" }, { status: 500 });
  }

  // TG1600 HTTP API — receive SMS (code 1500102)
  const inner = new URLSearchParams({ account: user, password: pass });
  const url = `${base}/cgi/WebCGI?1500102=${inner.toString()}`;

  let rawResponse = "";
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    rawResponse = await res.text();
  } catch (err) {
    // Log timeout but don't fail — device might be slow
    console.log("[sms/poll] TG1600 fetch error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: true, synced: 0, note: "TG1600 unreachable" });
  }

  console.log("[sms/poll] Raw response:", rawResponse.slice(0, 500));

  // Parse TG1600 response — format varies by firmware
  // Typical format: multiple blocks separated by blank lines
  // Port: X\nSender: +386...\nContent: message\n
  const messages = parseTg1600Response(rawResponse);
  console.log(`[sms/poll] Parsed ${messages.length} messages`);

  let synced = 0;
  for (const msg of messages) {
    if (!msg.sender || !msg.content) continue;

    // Dedup: check if we already have this message (same phone + body + recent)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const existing = await prisma.contactActivity.findFirst({
      where: {
        type: "sms",
        direction: "inbound",
        subject: msg.sender,
        body: msg.content,
        created_at: { gte: fiveMinutesAgo },
      },
    });
    if (existing) continue;

    // Find contact by phone number
    const contacts = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Contact"
      WHERE field_values::text ILIKE ${"%" + msg.sender.replace("+", "") + "%"}
      LIMIT 1
    `;
    const contactId = contacts[0]?.id ?? null;

    if (contactId) {
      await prisma.contactActivity.create({
        data: {
          contact_id: contactId,
          type: "sms",
          direction: "inbound",
          subject: msg.sender,
          body: msg.content,
        },
      });
      synced++;
    }
  }

  return NextResponse.json({ ok: true, synced, total: messages.length });
}

function parseTg1600Response(raw: string): { sender: string; content: string; port?: string }[] {
  const messages: { sender: string; content: string; port?: string }[] = [];
  if (!raw || raw.toLowerCase().includes("no message")) return messages;

  // Split by blank lines or "---" separators
  const blocks = raw.split(/\n\s*\n|---+/).filter(b => b.trim());

  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let sender = "";
    let content = "";
    let port = "";

    for (const line of lines) {
      if (line.toLowerCase().startsWith("sender:")) sender = line.slice(7).trim();
      else if (line.toLowerCase().startsWith("from:")) sender = line.slice(5).trim();
      else if (line.toLowerCase().startsWith("content:")) content = line.slice(8).trim();
      else if (line.toLowerCase().startsWith("message:")) content = line.slice(8).trim();
      else if (line.toLowerCase().startsWith("port:")) port = line.slice(5).trim();
    }

    if (sender && content) {
      messages.push({ sender, content: content.replace(/\+/g, " "), port });
    }
  }

  return messages;
}
