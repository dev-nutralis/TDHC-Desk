import { prisma } from "@/lib/prisma";

const YEASTAR_HOST = process.env.YEASTAR_HOST ?? "";
const CLIENT_ID = process.env.YEASTAR_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.YEASTAR_CLIENT_SECRET ?? "";
const LINKUS_ID = process.env.YEASTAR_LINKUS_ACCESS_ID ?? "";
const LINKUS_KEY = process.env.YEASTAR_LINKUS_ACCESS_KEY ?? "";

// In-memory cache for current function instance
const memCache: Record<string, { token: string; expiresAt: number }> = {};

async function getToken(username: string, password: string, cacheKey: string): Promise<string> {
  // 1. In-memory cache (within same serverless invocation)
  const mem = memCache[cacheKey];
  if (mem && Date.now() < mem.expiresAt - 60_000) return mem.token;

  // 2. DB cache (shared across Vercel instances — prevents MAX LIMITATION EXCEEDED)
  const stored = await prisma.yeastarToken.findUnique({ where: { id: cacheKey } });
  if (stored && stored.expires_at.getTime() > Date.now() + 60_000) {
    memCache[cacheKey] = { token: stored.token, expiresAt: stored.expires_at.getTime() };
    return stored.token;
  }

  // 3. Fetch new token from Yeastar
  const res = await fetch(`https://${YEASTAR_HOST}/openapi/v1.0/get_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) throw new Error(`Yeastar get_token error: ${res.status}`);
  const data = await res.json();
  if (!data.access_token) throw new Error(`Yeastar: no access_token. Raw: ${JSON.stringify(data)}`);

  const expiresAt = Date.now() + (data.access_token_expire_time ?? 1800) * 1000;

  // Cache in memory
  memCache[cacheKey] = { token: data.access_token, expiresAt };

  // Cache in DB
  await prisma.yeastarToken.upsert({
    where: { id: cacheKey },
    create: { id: cacheKey, token: data.access_token, expires_at: new Date(expiresAt) },
    update: { token: data.access_token, expires_at: new Date(expiresAt) },
  });

  return data.access_token;
}

async function getLinkusToken(): Promise<string> {
  if (LINKUS_ID && LINKUS_KEY) return getToken(LINKUS_ID, LINKUS_KEY, "linkus");
  return getToken(CLIENT_ID, CLIENT_SECRET, "general");
}

export async function getYeastarSignCredentials(sipUser: string): Promise<{ sign: string }> {
  const token = await getLinkusToken();
  const res = await fetch(
    `https://${YEASTAR_HOST}/openapi/v1.0/sign/create?access_token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: sipUser, sign_type: "sdk", expire_time: 0 }),
    },
  );

  if (!res.ok) throw new Error(`Yeastar sign error: ${res.status}`);
  const data = await res.json();

  const sign = data?.data?.sign ?? data?.sign ?? data?.data?.access_token ?? data?.access_token ?? null;
  if (!sign) throw new Error(`Yeastar: no sign in response. Raw: ${JSON.stringify(data)}`);
  return { sign };
}

export async function downloadRecording(filename: string): Promise<Buffer> {
  const token = await getLinkusToken();
  const urlRes = await fetch(
    `https://${YEASTAR_HOST}/openapi/v1.0/recording/download?file=${encodeURIComponent(filename)}&access_token=${token}`,
  );
  if (!urlRes.ok) throw new Error(`Yeastar recording URL error: ${urlRes.status}`);
  const data = await urlRes.json();
  const downloadUrl: string = data?.download_resource_url ?? data?.url ?? "";
  if (!downloadUrl) throw new Error(`No download URL in response: ${JSON.stringify(data)}`);

  const audioRes = await fetch(downloadUrl);
  if (!audioRes.ok) throw new Error(`Recording download error: ${audioRes.status}`);
  return Buffer.from(await audioRes.arrayBuffer());
}

export function isYeastarConfigured(): boolean {
  return Boolean(YEASTAR_HOST && CLIENT_ID && CLIENT_SECRET);
}

export function getYeastarWsUrl(accessToken: string): string {
  return `wss://${YEASTAR_HOST}/openapi/v1.0/subscribe?access_token=${encodeURIComponent(accessToken)}`;
}
