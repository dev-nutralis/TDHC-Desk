import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getPlatformId } from "@/lib/platform";
import { sendEmail } from "@/lib/mailer";
import { sendSms } from "@/lib/tg1600-client";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
    const platformId = await getPlatformId(slug) ?? null;

    const { id } = await params;
    const contact = await prisma.contact.findFirst({ where: { id, platform_id: platformId }, select: { field_values: true } });
    const fieldValues = contact?.field_values as Record<string, unknown> | null;

    // Scan all field_values for arrays with {number} entries (covers any field key)
    const rawPhones: string[] = fieldValues
      ? Object.values(fieldValues)
          .filter((v): v is { number: string }[] =>
            Array.isArray(v) && v.length > 0 && typeof (v as {number:string}[])[0]?.number === "string"
          )
          .flatMap(arr => arr.map(p => p.number?.trim()).filter(Boolean))
      : [];

    // Use last 8 digits for suffix match — handles country code differences
    // e.g. +38641234567 and 41234567 both end with "41234567"
    const phoneSuffixes = rawPhones
      .map(p => p.replace(/\D/g, "").slice(-8))
      .filter(s => s.length >= 6);

    const phoneConditions = phoneSuffixes.flatMap(suffix => [
      { caller_number: { endsWith: suffix } },
      { callee_number: { endsWith: suffix } },
    ]);

    const [activities, rawCalls] = await Promise.all([
      prisma.contactActivity.findMany({
        where: { contact_id: id },
        orderBy: { created_at: "asc" },
      }),
      prisma.call.findMany({
        where: {
          OR: [
            { contact_id: id },
            ...phoneConditions,
          ],
        },
        orderBy: { started_at: "asc" },
        select: {
          id: true,
          direction: true,
          status: true,
          caller_number: true,
          callee_number: true,
          duration_sec: true,
          started_at: true,
          ended_at: true,
          recording_id: true,
          transcript: true,
          summary: true,
          transcript_status: true,
        },
      }),
    ]);

    // Deduplicate (call may match both contact_id and phone suffix)
    const seen = new Set<string>();
    const calls = rawCalls.filter(c => { if (seen.has(c.id)) return false; seen.add(c.id); return true; });
    return NextResponse.json({ activities, calls });
  } catch (err) {
    console.error("[GET /api/contacts/:id/activities]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
    const platformId = await getPlatformId(slug) ?? null;

    const { id } = await params;
    const { type, subject, body, html, attachments, phone, thread_id } = await req.json();

    if (type !== "email" && type !== "note" && type !== "sms") {
      return NextResponse.json({ error: 'type must be "email", "note", or "sms"' }, { status: 400 });
    }
    if (!body || typeof body !== "string" || body.trim() === "") {
      return NextResponse.json({ error: "body must not be empty" }, { status: 400 });
    }

    const contact = await prisma.contact.findFirst({ where: { id, platform_id: platformId } });
    if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

    if (type === "email") {
      const fieldValues = contact.field_values as Record<string, unknown> | null;
      const emails = fieldValues?.emails as { address: string; is_main: boolean }[] | undefined;
      const recipient = emails?.find((e) => e.is_main)?.address ?? emails?.[0]?.address;

      if (!recipient) {
        return NextResponse.json(
          { error: "Contact has no email address. Add one before sending." },
          { status: 422 },
        );
      }

      const smtpPlatform = platformId
        ? await prisma.platform.findUnique({
            where: { id: platformId },
            select: {
              smtp_host: true, smtp_port: true, smtp_user: true,
              smtp_pass: true, smtp_from: true, smtp_secure: true,
            },
          })
        : null;

      if (!smtpPlatform?.smtp_host || !smtpPlatform?.smtp_user || !smtpPlatform?.smtp_pass) {
        return NextResponse.json(
          { error: "SMTP is not configured for this platform. Go to Settings → Platform to set it up." },
          { status: 422 },
        );
      }

      await sendEmail({
        to: recipient,
        subject: subject?.trim() || "(no subject)",
        text: body.trim(),
        ...(html ? { html: html.trim() } : {}),
        attachments: Array.isArray(attachments) ? attachments : [],
        smtp: {
          host: smtpPlatform.smtp_host,
          port: smtpPlatform.smtp_port ?? 465,
          secure: smtpPlatform.smtp_secure ?? true,
          user: smtpPlatform.smtp_user,
          pass: smtpPlatform.smtp_pass,
          from: smtpPlatform.smtp_from ?? smtpPlatform.smtp_user,
        },
      });
    }

    if (type === "sms") {
      if (!phone || typeof phone !== "string" || !phone.trim()) {
        return NextResponse.json({ error: "phone number is required for SMS" }, { status: 400 });
      }

      const platform = platformId ? await prisma.platform.findUnique({ where: { id: platformId }, select: { gsm_port: true } }) : null;
      const gsmPort = platform?.gsm_port ? Number(platform.gsm_port) : undefined;

      const result = await sendSms(phone.trim(), body.trim(), gsmPort);
      if (!result.success) {
        return NextResponse.json({ error: result.error ?? "Failed to send SMS" }, { status: 502 });
      }
    }

    // Resolve thread_id for emails+notes (group by contact + normalized subject)
    const normalizedSubject = (subject ?? "").toLowerCase().replace(/^re:\s*/i, "").trim();
    const resolvedThreadId = thread_id
      ?? (type === "email" || type === "note" ? `${id}::${normalizedSubject}` : null);

    const activity = await prisma.contactActivity.create({
      data: {
        contact_id: id,
        platform_id: platformId,
        type,
        direction: "outbound",
        subject: type === "sms" ? phone?.trim() ?? null : subject?.trim() ?? null,
        body: type === "sms" ? body.trim() : (html?.trim() || body.trim()),
        thread_id: resolvedThreadId,
        is_read: true,
      },
    });

    return NextResponse.json(activity, { status: 201 });
  } catch (err) {
    console.error("[POST /api/contacts/:id/activities]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
