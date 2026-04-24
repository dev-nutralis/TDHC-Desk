export async function sendSms(
  to: string,
  content: string,
  outboundPort?: number,
): Promise<{ success: boolean; error?: string }> {
  const base = process.env.TG1600_HTTP_URL;
  const user = process.env.TG1600_API_USER;
  const pass = process.env.TG1600_API_PASS;
  const resolvedPort = outboundPort?.toString() ?? process.env.TG1600_GSM_PORT ?? "5";

  if (!base || !user || !pass) {
    return { success: false, error: "TG1600 is not configured" };
  }

  // GET /cgi/WebCGI?1500101=account=USER&password=PASS&port=PORT&destination=NUMBER&content=MSG
  const inner = new URLSearchParams({ account: user, password: pass, port: resolvedPort, destination: to, content });
  const url = `${base}/cgi/WebCGI?1500101=${inner.toString()}`;

  try {
    // TG1600 queues the SMS immediately on receiving the HTTP request.
    // The response is either malformed HTTP or a timeout — both mean success.
    // Only a refused connection (ECONNREFUSED) means the device is unreachable.
    await fetch(url, { signal: AbortSignal.timeout(8_000) });
  } catch (err) {
    const isConnectionRefused =
      err instanceof TypeError &&
      (err.message.includes("ECONNREFUSED") || err.message.includes("fetch failed") &&
        (err as any).cause?.code === "ECONNREFUSED");

    if (isConnectionRefused) {
      return { success: false, error: "TG1600 device unreachable (connection refused)" };
    }
    // Any other error (malformed response, timeout, etc.) = SMS was queued
  }
  return { success: true };
}
