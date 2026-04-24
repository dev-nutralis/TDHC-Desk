import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isYeastarConfigured } from "@/lib/yeastar-client";
import WebSocket from "ws";

const YEASTAR_HOST = process.env.YEASTAR_HOST ?? "";
const CLIENT_ID = process.env.YEASTAR_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.YEASTAR_CLIENT_SECRET ?? "";
const WEBHOOK_SECRET = process.env.ARI_WEBHOOK_SECRET ?? process.env.SMS_WEBHOOK_SECRET ?? "";
const LISTEN_DURATION_MS = 50_000;

async function getToken(): Promise<string> {
  const cached = await prisma.yeastarToken.findUnique({ where: { id: "general" } });
  if (cached && cached.expires_at.getTime() > Date.now() + 60_000) return cached.token;

  const res = await fetch(`https://${YEASTAR_HOST}/openapi/v1.0/get_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: CLIENT_ID, password: CLIENT_SECRET }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Token error: ${JSON.stringify(data)}`);

  const expiresAt = Date.now() + (data.access_token_expire_time ?? 1800) * 1000;
  await prisma.yeastarToken.upsert({
    where: { id: "general" },
    create: { id: "general", token: data.access_token, expires_at: new Date(expiresAt) },
    update: { token: data.access_token, expires_at: new Date(expiresAt) },
  });
  return data.access_token;
}

function listenForCdr(token: string): Promise<{ call_id: string; recording: string }[]> {
  return new Promise((resolve) => {
    const events: { call_id: string; recording: string }[] = [];
    let done = false;

    function finish() {
      if (done) return;
      done = true;
      try { ws.terminate(); } catch {}
      resolve(events);
    }

    const timer = setTimeout(finish, LISTEN_DURATION_MS);
    const wsUrl = `wss://${YEASTAR_HOST}/openapi/v1.0/subscribe?access_token=${encodeURIComponent(token)}`;
    console.log(`[recording-sync] Connecting via ws package...`);

    const ws = new WebSocket(wsUrl);

    ws.on("open", () => {
      console.log("[recording-sync] Connected, subscribing to 30012...");
      ws.send(JSON.stringify({ topic_list: [30012] }));
    });

    ws.on("message", (data) => {
      try {
        const envelope = JSON.parse(data.toString());
        if (envelope.type !== 30012) return;
        let msg = envelope.msg;
        if (typeof msg === "string") { try { msg = JSON.parse(msg); } catch {} }
        if (msg?.call_id && msg?.recording) {
          console.log(`[recording-sync] CDR: call_id=${msg.call_id} recording=${msg.recording}`);
          events.push({ call_id: msg.call_id, recording: msg.recording });
        }
      } catch {}
    });

    ws.on("error", (err) => {
      console.error("[recording-sync] WS error:", err.message);
      clearTimeout(timer);
      finish();
    });

    ws.on("close", (code) => {
      console.log(`[recording-sync] WS closed code=${code}`);
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
    token = await getToken();
    console.log("[recording-sync] Token OK");
  } catch (err) {
    console.error("[recording-sync] Token error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: true, note: "Token failed" });
  }

  const cdrs = await listenForCdr(token);
  console.log(`[recording-sync] Collected ${cdrs.length} CDR events`);

  let synced = 0;
  for (const cdr of cdrs) {
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
      data: { recording_id: cdr.recording },
    });
    synced++;
    console.log(`[recording-sync] Saved recording ${cdr.recording} → call ${call.id}`);
  }

  return NextResponse.json({ ok: true, synced, total: cdrs.length });
}
