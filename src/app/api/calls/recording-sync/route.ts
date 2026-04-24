import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isYeastarConfigured } from "@/lib/yeastar-client";

const YEASTAR_HOST = process.env.YEASTAR_HOST ?? "";
const CLIENT_ID = process.env.YEASTAR_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.YEASTAR_CLIENT_SECRET ?? "";
const WEBHOOK_SECRET = process.env.ARI_WEBHOOK_SECRET ?? process.env.SMS_WEBHOOK_SECRET ?? "";

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

async function fetchCdrRecordings(token: string): Promise<{ recording: string; caller: string; callee: string }[]> {
  // Query CDR for last 10 minutes
  const now = Math.floor(Date.now() / 1000);
  const from = now - 10 * 60;

  const url = `https://${YEASTAR_HOST}/openapi/v1.0/call/cdr?access_token=${token}&start_time=${from}&end_time=${now}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) {
      console.log(`[recording-sync] CDR API ${res.status}: ${await res.text()}`);
      return [];
    }
    const data = await res.json();
    console.log(`[recording-sync] CDR response: ${JSON.stringify(data).slice(0, 300)}`);

    const records: any[] = data?.data ?? data?.cdr_list ?? data?.records ?? [];
    return records
      .filter((r: any) => r.recording || r.record_file || r.recordfile)
      .map((r: any) => ({
        recording: r.recording ?? r.record_file ?? r.recordfile,
        caller: r.caller ?? r.from ?? "",
        callee: r.callee ?? r.to ?? "",
      }));
  } catch (err) {
    console.error("[recording-sync] CDR fetch error:", err instanceof Error ? err.message : err);
    return [];
  }
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
    console.log("[recording-sync] Token OK, querying CDR...");
  } catch (err) {
    console.error("[recording-sync] Token error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: true, note: "Token failed" });
  }

  const cdrs = await fetchCdrRecordings(token);
  console.log(`[recording-sync] Found ${cdrs.length} CDRs with recordings`);

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
    console.log(`[recording-sync] Linked ${cdr.recording} → call ${call.id}`);
  }

  return NextResponse.json({ ok: true, synced, total: cdrs.length });
}
