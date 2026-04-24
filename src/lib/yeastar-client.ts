const YEASTAR_HOST = process.env.YEASTAR_HOST ?? "";
const CLIENT_ID = process.env.YEASTAR_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.YEASTAR_CLIENT_SECRET ?? "";
const LINKUS_ID = process.env.YEASTAR_LINKUS_ACCESS_ID ?? "";
const LINKUS_KEY = process.env.YEASTAR_LINKUS_ACCESS_KEY ?? "";

type TokenCache = { token: string; expiresAt: number };
let generalTokenCache: TokenCache | null = null;
let linkusTokenCache: TokenCache | null = null;

async function getToken(username: string, password: string, cache: { current: TokenCache | null }): Promise<string> {
  if (cache.current && Date.now() < cache.current.expiresAt - 60_000) {
    return cache.current.token;
  }

  const url = `https://${YEASTAR_HOST}/openapi/v1.0/get_token`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) throw new Error(`Yeastar get_token error: ${res.status}`);
  const data = await res.json();
  if (!data.access_token) throw new Error(`Yeastar: no access_token. Raw: ${JSON.stringify(data)}`);

  cache.current = {
    token: data.access_token,
    expiresAt: Date.now() + (data.access_token_expire_time ?? 1800) * 1000,
  };
  return cache.current.token;
}

const generalCache = { current: generalTokenCache };
const linkusCache = { current: linkusTokenCache };

async function getGeneralToken(): Promise<string> {
  return getToken(CLIENT_ID, CLIENT_SECRET, generalCache);
}

async function getLinkusToken(): Promise<string> {
  // Use LINKUS credentials if available, fall back to general
  if (LINKUS_ID && LINKUS_KEY) {
    return getToken(LINKUS_ID, LINKUS_KEY, linkusCache);
  }
  return getGeneralToken();
}

export async function getYeastarSignCredentials(sipUser: string): Promise<{ sign: string }> {
  const token = await getLinkusToken();
  const url = `https://${YEASTAR_HOST}/openapi/v1.0/sign/create?access_token=${token}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: sipUser, sign_type: "sdk", expire_time: 0 }),
  });

  if (!res.ok) throw new Error(`Yeastar sign error: ${res.status}`);
  const data = await res.json();

  const sign =
    data?.data?.sign ??
    data?.sign ??
    data?.data?.access_token ??
    data?.access_token ?? null;

  if (!sign) {
    throw new Error(`Yeastar: no sign in response. Raw: ${JSON.stringify(data)}`);
  }
  return { sign };
}

export function isYeastarConfigured(): boolean {
  return Boolean(YEASTAR_HOST && CLIENT_ID && CLIENT_SECRET);
}
