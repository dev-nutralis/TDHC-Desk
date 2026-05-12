import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getPlatformId } from "@/lib/platform";
import { randomUUID } from "crypto";
import { waitUntil } from "@vercel/functions";

const YEASTAR_HOST = process.env.YEASTAR_HOST ?? "";
const CLIENT_ID = process.env.YEASTAR_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.YEASTAR_CLIENT_SECRET ?? "";

async function fetchRecordingForCall(callId: string): Promise<void> {
  if (!YEASTAR_HOST || !CLIENT_ID || !CLIENT_SECRET) return;

  try {
    // Wait for Yeastar to finalize the recording
    await new Promise(r => setTimeout(r, 5_000));

    // Get token
    const cached = await prisma.yeastarToken.findUnique({ where: { id: "general" } });
    let token = cached?.token ?? "";
    if (!token || (cached && cached.expires_at.getTime() < Date.now() + 60_000)) {
      const res = await fetch(`https://${YEASTAR_HOST}/openapi/v1.0/get_token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: CLIENT_ID, password: CLIENT_SECRET }),
      });
      const data = await res.json();
      if (data.access_token) {
        token = data.access_token;
        const expiresAt = Date.now() + (data.access_token_expire_time ?? 1800) * 1000;
        await prisma.yeastarToken.upsert({
          where: { id: "general" },
          create: { id: "general", token, expires_at: new Date(expiresAt) },
          update: { token, expires_at: new Date(expiresAt) },
        });
      }
    }
    if (!token) return;

    // Listen for 30012 CDR event via WebSocket
    const { default: WebSocket } = await import("ws");
    const recording = await new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), 30_000);
      const wsUrl = `wss://${YEASTAR_HOST}/openapi/v1.0/subscribe?access_token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(wsUrl);

      ws.on("open", () => ws.send(JSON.stringify({ topic_list: [30012] })));

      ws.on("message", (data) => {
        try {
          const envelope = JSON.parse(data.toString());
          if (envelope.type !== 30012) return;
          let msg = envelope.msg;
          if (typeof msg === "string") { try { msg = JSON.parse(msg); } catch {} }
          if (msg?.recording) {
            clearTimeout(timer);
            ws.terminate();
            resolve(msg.recording);
          }
        } catch {}
      });

      ws.on("error", () => { clearTimeout(timer); resolve(null); });
      ws.on("close", () => { clearTimeout(timer); resolve(null); });
    });

    if (recording) {
      await prisma.call.update({
        where: { id: callId },
        data: { recording_id: recording, transcript_status: "pending" },
      });
      console.log(`[calls/track] Recording saved: ${recording} → ${callId}`);
    }
  } catch (err) {
    console.error("[calls/track] recording fetch error:", err instanceof Error ? err.message : err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, callId, direction, remoteNumber, contactId } = body;

    const cookieStore = await cookies();
    const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
    const platformId = await getPlatformId(slug) ?? null;

    const user = await prisma.user.findFirst();
    const sipAccount = user
      ? await prisma.sipAccount.findUnique({ where: { user_id: user.id } })
      : null;

    if (action === "start") {
      const call = await prisma.call.create({
        data: {
          unique_id: randomUUID(),
          direction: direction ?? "outbound",
          caller_number: direction === "inbound" ? (remoteNumber ?? "") : (sipAccount?.extension ?? ""),
          callee_number: direction === "inbound" ? (sipAccount?.extension ?? "") : (remoteNumber ?? ""),
          status: "ringing",
          contact_id: contactId ?? null,
          sip_account_id: sipAccount?.id ?? null,
          user_id: user?.id ?? null,
          platform_id: platformId,
        },
      });
      return NextResponse.json({ callId: call.id });
    }

    if (action === "answer") {
      if (!callId) return NextResponse.json({ error: "callId required" }, { status: 400 });
      await prisma.call.update({
        where: { id: callId },
        data: { status: "answered", answered_at: new Date() },
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "end") {
      if (!callId) return NextResponse.json({ error: "callId required" }, { status: 400 });
      const call = await prisma.call.findUnique({ where: { id: callId } });
      if (!call) return NextResponse.json({ ok: true });

      const now = new Date();
      const durationSec = call.answered_at
        ? Math.round((now.getTime() - call.answered_at.getTime()) / 1000)
        : null;

      const status =
        call.status === "answered" ? "completed" :
        call.status === "ringing" && call.direction === "inbound" ? "missed" : "failed";

      await prisma.call.update({
        where: { id: callId },
        data: { status, ended_at: now, duration_sec: durationSec },
      });

      // Kick off recording fetch in background (non-blocking)
      if (status === "completed" && durationSec && durationSec > 5) {
        waitUntil(fetchRecordingForCall(callId));
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[calls/track] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
