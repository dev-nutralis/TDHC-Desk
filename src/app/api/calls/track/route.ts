import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, callId, direction, remoteNumber, contactId } = body;

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
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[calls/track] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
