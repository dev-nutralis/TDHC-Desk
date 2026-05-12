import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const platform = await prisma.platform.findUnique({ where: { id } });
    if (!platform) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(platform);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const {
    name, logo_url, website_url, transcription_language, gsm_port,
    smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from, smtp_secure,
    imap_host, imap_port, imap_user, imap_pass, imap_enabled,
    email_auto_contact_source_id,
    lead_show_source, contact_show_source, deal_show_source,
    lead_source_sort_order, contact_source_sort_order, deal_source_sort_order,
  } = body;
  try {
    const platform = await prisma.platform.update({
      where: { id },
      data: {
        name:                    name                    || undefined,
        logo_url:                logo_url                ?? undefined,
        website_url:             website_url             ?? undefined,
        transcription_language:  transcription_language  !== undefined ? (transcription_language  || null) : undefined,
        gsm_port:                gsm_port                !== undefined ? (gsm_port                || null) : undefined,
        smtp_host:               smtp_host               !== undefined ? (smtp_host               || null) : undefined,
        smtp_port:               smtp_port               !== undefined ? (smtp_port               ?? null) : undefined,
        smtp_user:               smtp_user               !== undefined ? (smtp_user               || null) : undefined,
        smtp_pass:               smtp_pass               !== undefined ? (smtp_pass               || null) : undefined,
        smtp_from:               smtp_from               !== undefined ? (smtp_from               || null) : undefined,
        smtp_secure:             smtp_secure             !== undefined ? smtp_secure               : undefined,
        imap_host:               imap_host               !== undefined ? (imap_host               || null) : undefined,
        imap_port:               imap_port               !== undefined ? (imap_port               ?? null) : undefined,
        imap_user:               imap_user               !== undefined ? (imap_user               || null) : undefined,
        imap_pass:               imap_pass               !== undefined ? (imap_pass               || null) : undefined,
        imap_enabled:            imap_enabled            !== undefined ? imap_enabled              : undefined,
        email_auto_contact_source_id: email_auto_contact_source_id !== undefined ? (email_auto_contact_source_id || null) : undefined,
        lead_show_source:    lead_show_source    !== undefined ? Boolean(lead_show_source)    : undefined,
        contact_show_source: contact_show_source !== undefined ? Boolean(contact_show_source) : undefined,
        deal_show_source:    deal_show_source    !== undefined ? Boolean(deal_show_source)    : undefined,
        lead_source_sort_order:    lead_source_sort_order    !== undefined ? Number(lead_source_sort_order)    : undefined,
        contact_source_sort_order: contact_source_sort_order !== undefined ? Number(contact_source_sort_order) : undefined,
        deal_source_sort_order:    deal_source_sort_order    !== undefined ? Number(deal_source_sort_order)    : undefined,
      },
    });
    return NextResponse.json(platform);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.platform.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
