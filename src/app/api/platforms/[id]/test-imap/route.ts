import { NextRequest, NextResponse } from "next/server";
import { ImapFlow } from "imapflow";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  let host: string, port: number, user: string, pass: string;

  if (body.imap_host && body.imap_user && body.imap_pass) {
    host = body.imap_host;
    port = body.imap_port ?? 993;
    user = body.imap_user;
    pass = body.imap_pass;
  } else {
    const platform = await prisma.platform.findUnique({
      where: { id },
      select: { imap_host: true, imap_port: true, imap_user: true, imap_pass: true },
    });
    if (!platform?.imap_host || !platform?.imap_user || !platform?.imap_pass) {
      return NextResponse.json({ ok: false, error: "IMAP not configured" }, { status: 400 });
    }
    host = platform.imap_host;
    port = platform.imap_port ?? 993;
    user = platform.imap_user;
    pass = platform.imap_pass;
  }

  const client = new ImapFlow({ host, port, secure: true, auth: { user, pass }, logger: false });
  try {
    await client.connect();
    await client.logout();
    return NextResponse.json({ ok: true });
  } catch (err) {
    try { await client.logout(); } catch { /* ignore */ }
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Connection failed" });
  }
}
