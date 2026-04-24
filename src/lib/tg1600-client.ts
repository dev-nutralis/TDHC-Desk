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
    await fetch(url, { signal: AbortSignal.timeout(45_000) });
    return { success: true };
  } catch (err) {
    // TG1600 sends malformed HTTP (starts with \n\n\n before headers) but the SMS
    // is already queued. Node.js wraps this as TypeError with cause.code HPE_INVALID_HEADER_TOKEN.
    if (err instanceof TypeError) {
      const cause = (err as any).cause;
      if (cause?.code === "HPE_INVALID_HEADER_TOKEN") {
        return { success: true };
      }
    }
    // DOMException (timeout/abort) = TG1600 already queued on receipt, treat as success
    if (!(err instanceof TypeError)) {
      return { success: true };
    }
    return { success: false, error: err instanceof Error ? err.message : "Failed to send SMS" };
  }
}
