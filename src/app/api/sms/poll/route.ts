import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as net from "net";

const TG1600_HOST = process.env.TG1600_TCP_HOST ?? "212.85.174.16";
const TG1600_AMI_PORT = Number(process.env.TG1600_TCP_PORT ?? "5038");
const TG1600_USER = process.env.TG1600_API_USER ?? "smsapi";
const TG1600_PASS = process.env.TG1600_API_PASS ?? "";

const POLL_SECRET = process.env.SMS_WEBHOOK_SECRET ?? "";
const LISTEN_DURATION_MS = 50_000; // listen for 50s per cron tick

interface SmsEvent {
  phone: string;
  content: string;
  port?: string;
}

function listenForSms(): Promise<SmsEvent[]> {
  return new Promise((resolve) => {
    const messages: SmsEvent[] = [];
    let buffer = "";
    const socket = new net.Socket();
    let done = false;

    function finish() {
      if (done) return;
      done = true;
      try { socket.destroy(); } catch {}
      resolve(messages);
    }

    // Stop after LISTEN_DURATION_MS
    const timer = setTimeout(finish, LISTEN_DURATION_MS);

    socket.connect(TG1600_AMI_PORT, TG1600_HOST, () => {
      socket.write(`Action: Login\r\nUsername: ${TG1600_USER}\r\nSecret: ${TG1600_PASS}\r\n\r\n`);
    });

    socket.on("data", (data) => {
      buffer += data.toString();
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() ?? "";

      for (const block of blocks) {
        if (!block.trim()) continue;
        const fields: Record<string, string> = {};
        for (const line of block.split(/\r?\n/)) {
          const idx = line.indexOf(":");
          if (idx > 0) fields[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
        }

        if (fields.Event !== "ReceivedSMS") continue;

        const phone = fields.Sender ?? "";
        const content = (fields.Content ?? "").replace(/\+/g, " ").trim();
        const rawPort = fields.GsmSpan ?? fields.GsmPort ?? fields.Port ?? "";
        const portNum = parseInt(rawPort, 10);
        const port = Number.isFinite(portNum) && portNum > 0 ? String(portNum) : "";

        if (phone && content) {
          messages.push({ phone, content, port });
          console.log(`[sms/poll] Received SMS from ${phone}: ${content.slice(0, 60)}`);
        }
      }
    });

    socket.on("error", (err) => {
      console.error("[sms/poll] AMI error:", err.message);
      clearTimeout(timer);
      finish();
    });

    socket.on("close", () => {
      clearTimeout(timer);
      finish();
    });
  });
}

export async function GET(req: NextRequest) {
  const userAgent = req.headers.get("user-agent") ?? "";
  const auth = req.headers.get("authorization") ?? "";
  const isVercelCron = userAgent.includes("vercel-cron");

  if (!isVercelCron && POLL_SECRET && auth !== `Bearer ${POLL_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (!TG1600_PASS) {
    return NextResponse.json({ error: "TG1600_API_PASS not configured" }, { status: 500 });
  }

  const messages = await listenForSms();
  console.log(`[sms/poll] Collected ${messages.length} SMS events`);

  let synced = 0;
  for (const msg of messages) {
    // Dedup: skip if same message received within last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const existing = await prisma.contactActivity.findFirst({
      where: {
        type: "sms",
        direction: "inbound",
        subject: msg.phone,
        body: msg.content,
        created_at: { gte: fiveMinutesAgo },
      },
    });
    if (existing) continue;

    // Find contact by phone number — match last 8 digits to handle +386 vs 0 prefix
    const normalized = msg.phone.replace(/\D/g, "").slice(-8);
    console.log(`[sms/poll] Searching for phone last8="${normalized}" from "${msg.phone}"`);

    const contacts = await prisma.$queryRaw<{ id: string; field_values: unknown }[]>`
      SELECT id, field_values FROM "Contact"
      WHERE field_values::text LIKE ${"%" + normalized + "%"}
      LIMIT 1
    `;
    console.log(`[sms/poll] Found ${contacts.length} contacts for "${normalized}"`);

    // Debug: also log a sample contact's phone data
    if (contacts.length === 0) {
      const sample = await prisma.$queryRaw<{ field_values: unknown }[]>`
        SELECT field_values FROM "Contact" WHERE field_values::text LIKE '%number%' LIMIT 1
      `;
      if (sample[0]) console.log(`[sms/poll] Sample contact field_values:`, JSON.stringify(sample[0].field_values).slice(0, 300));
    }

    const contactId = contacts[0]?.id ?? null;

    if (contactId) {
      await prisma.contactActivity.create({
        data: {
          contact_id: contactId,
          type: "sms",
          direction: "inbound",
          subject: msg.phone,
          body: msg.content,
        },
      });
      synced++;
      console.log(`[sms/poll] Saved SMS from ${msg.phone} for contact ${contactId}`);
    } else {
      console.log(`[sms/poll] No contact found for ${msg.phone}`);
    }
  }

  return NextResponse.json({ ok: true, synced, total: messages.length });
}
