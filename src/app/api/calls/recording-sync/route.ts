import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isYeastarConfigured } from "@/lib/yeastar-client";

const YEASTAR_HOST = process.env.YEASTAR_HOST ?? "";
const CLIENT_ID = process.env.YEASTAR_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.YEASTAR_CLIENT_SECRET ?? "";
const LISTEN_DURATION_MS = 55_000;
const WEBHOOK_SECRET = process.env.ARI_WEBHOOK_SECRET ?? process.env.SMS_WEBHOOK_SECRET ?? "";

interface CdrEvent {
  call_id: string;
  recording: string;
}

async function getAccessToken(): Promise<string> {
  // Check DB cache first
  const cached = await prisma.yeastarToken.findUnique({ where: { id: "general" } });
  if (cached && cached.expires_at.getTime() > Date.now() + 60_000) return cached.token;

  const res = await fetch(`https://${YEASTAR_HOST}/openapi/v1.0/get_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: CLIENT_ID, password: CLIENT_SECRET }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`No token: ${JSON.stringify(data)}`);

  const expiresAt = Date.now() + (data.access_token_expire_time ?? 1800) * 1000;
  await prisma.yeastarToken.upsert({
    where: { id: "general" },
    create: { id: "general", token: data.access_token, expires_at: new Date(expiresAt) },
    update: { token: data.access_token, expires_at: new Date(expiresAt) },
  });
  return data.access_token;
}

function listenForRecordings(token: string): Promise<CdrEvent[]> {
  return new Promise((resolve) => {
    const events: CdrEvent[] = [];
    let done = false;

    // Check if WebSocket is available
    const WS = (globalThis as any).WebSocket;
    if (!WS) {
      console.error("[recording-sync] WebSocket not available in this runtime");
      resolve(events);
      return;
    }

    function finish() {
      if (done) return;
      done = true;
      try { (ws as any).close?.(); } catch {}
      resolve(events);
    }

    const timer = setTimeout(finish, LISTEN_DURATION_MS);
    const wsUrl = `wss://${YEASTAR_HOST}/openapi/v1.0/subscribe?access_token=${encodeURIComponent(token)}`;
    console.log(`[recording-sync] Connecting to ${YEASTAR_HOST}...`);

    const ws = new WS(wsUrl) as WebSocket;

    ws.addEventListener("open", () => {
      console.log("[recording-sync] WS connected, subscribing to 30012...");
      ws.send(JSON.stringify({ topic_list: [30012] }));
    });

    ws.addEventListener("message", (event: MessageEvent) => {
      try {
        const envelope = JSON.parse(event.data as string);
        console.log(`[recording-sync] WS message type=${envelope.type}`);
        if (envelope.type !== 30012) return;
        let msg = envelope.msg;
        if (typeof msg === "string") { try { msg = JSON.parse(msg); } catch {} }
        if (msg?.call_id && msg?.recording) {
          console.log(`[recording-sync] Recording: call_id=${msg.call_id} file=${msg.recording}`);
          events.push({ call_id: msg.call_id, recording: msg.recording });
        }
      } catch {}
    });

    ws.addEventListener("error", (e: any) => {
      console.error("[recording-sync] WS error:", e?.message ?? e);
      clearTimeout(timer);
      finish();
    });

    ws.addEventListener("close", (e: any) => {
      console.log(`[recording-sync] WS closed code=${e?.code}`);
      clearTimeout(timer);
      finish();
    });
  });
}

export async function GET(req: NextRequest) {
  const userAgent = req.headers.get("user-agent") ?? "";
  const auth = req.headers.get("authorization") ?? "";
  const isVercelCron = userAgent.includes("vercel-cron");

  if (!isVercelCron && WEBHOOK_SECRET && auth !== `Bearer ${WEBHOOK_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (!isYeastarConfigured()) {
    return NextResponse.json({ ok: true, note: "Yeastar not configured" });
  }

  let token: string;
  try {
    token = await getAccessToken();
  } catch (err) {
    console.error("[recording-sync] Token error:", err);
    return NextResponse.json({ ok: true, note: "Token failed" });
  }

  const events = await listenForRecordings(token);
  console.log(`[recording-sync] ${events.length} recording events`);

  let synced = 0;
  for (const event of events) {
    // Find most recent answered call without a recording yet
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const call = await prisma.call.findFirst({
      where: {
        recording_id: null,
        started_at: { gte: tenMinutesAgo },
        status: { in: ["answered", "completed"] },
      },
      orderBy: { started_at: "desc" },
    });

    if (!call) continue;

    await prisma.call.update({
      where: { id: call.id },
      data: { recording_id: event.recording },
    });
    synced++;
    console.log(`[recording-sync] Linked recording ${event.recording} → call ${call.id}`);
  }

  return NextResponse.json({ ok: true, synced, total: events.length });
}
