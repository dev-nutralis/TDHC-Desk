import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  let host: string, port: number, secure: boolean, user: string, pass: string;

  if (body.smtp_host && body.smtp_user && body.smtp_pass) {
    host   = body.smtp_host;
    port   = body.smtp_port ?? 465;
    secure = body.smtp_secure ?? true;
    user   = body.smtp_user;
    pass   = body.smtp_pass;
  } else {
    const platform = await prisma.platform.findUnique({
      where: { id },
      select: { smtp_host: true, smtp_port: true, smtp_user: true, smtp_pass: true, smtp_secure: true },
    });
    if (!platform?.smtp_host || !platform?.smtp_user || !platform?.smtp_pass) {
      return NextResponse.json({ ok: false, error: "SMTP not configured" }, { status: 400 });
    }
    host   = platform.smtp_host;
    port   = platform.smtp_port ?? 465;
    secure = platform.smtp_secure ?? true;
    user   = platform.smtp_user;
    pass   = platform.smtp_pass;
  }

  try {
    const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
    await transporter.verify();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Connection failed" });
  }
}
