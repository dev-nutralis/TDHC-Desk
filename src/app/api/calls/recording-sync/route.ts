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

async function tryEndpoint(url: string): Promise<{ recording: string }[] | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6_000) });
    const data = await res.json();
    console.log(`[recording-sync] ${url.split("?")[0].split("/v1.0/")[1]}: errcode=${data.errcode} keys=${Object.keys(data).join(",")}`);

    if (data.errcode !== 0) return null;

    const records: any[] = data?.data ?? data?.cdr_list ?? data?.records ?? data?.list ?? [];
    return records
      .filter((r: any) => r.recording || r.record_file || r.recordfile || r.file)
      .map((r: any) => ({ recording: r.recording ?? r.record_file ?? r.recordfile ?? r.file }));
  } catch {
    return null;
  }
}

async function fetchRecordings(token: string): Promise<{ recording: string }[]> {
  const base = `https://${YEASTAR_HOST}/openapi/v1.0`;
  const t = `access_token=${token}`;

  // Try known Yeastar P-Series CDR endpoints
  const attempts = [
    `${base}/call/cdr?${t}&page=1&pagesize=20`,
    `${base}/pbx/record?${t}&page=1&pagesize=20`,
    `${base}/call/record?${t}&page=1&pagesize=20`,
    `${base}/cdr?${t}&page=1&pagesize=20`,
  ];

  for (const url of attempts) {
    const result = await tryEndpoint(url);
    if (result !== null) return result;
  }

  console.log("[recording-sync] No working CDR endpoint — check Yeastar API docs");
  return [];
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
  } catch (err) {
    console.error("[recording-sync] Token error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: true, note: "Token failed" });
  }

  const cdrs = await fetchRecordings(token);
  console.log(`[recording-sync] Found ${cdrs.length} recordings`);

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
