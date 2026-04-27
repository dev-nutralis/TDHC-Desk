import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name, logo_url, website_url, transcription_language } = await req.json();
  try {
    const platform = await prisma.platform.update({
      where: { id },
      data: {
        name: name || undefined,
        logo_url: logo_url ?? undefined,
        website_url: website_url ?? undefined,
        transcription_language: transcription_language !== undefined ? (transcription_language || null) : undefined,
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
