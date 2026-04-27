import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getPlatformId } from "@/lib/platform";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
    const platformId = await getPlatformId(slug) ?? null;

    const { id } = await params;
    const existing = await prisma.emailSignature.findFirst({ where: { id, platform_id: platformId } });
    if (!existing) return NextResponse.json({ error: "Signature not found" }, { status: 404 });

    const body = await req.json();
    const { name, body: signatureBody } = body;

    const data: Record<string, string> = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim() === "") {
        return NextResponse.json({ error: "name must be a non-empty string" }, { status: 400 });
      }
      data.name = name.trim();
    }
    if (signatureBody !== undefined) {
      if (typeof signatureBody !== "string" || signatureBody.trim() === "") {
        return NextResponse.json({ error: "body must be a non-empty string" }, { status: 400 });
      }
      data.body = signatureBody.trim();
    }

    const signature = await prisma.emailSignature.update({
      where: { id },
      data,
    });
    return NextResponse.json(signature);
  } catch (err) {
    console.error("[PUT /api/email-signatures/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
    const platformId = await getPlatformId(slug) ?? null;

    const { id } = await params;

    const existing = await prisma.emailSignature.findFirst({ where: { id, platform_id: platformId } });
    if (!existing) {
      return NextResponse.json({ error: "Signature not found" }, { status: 404 });
    }

    await prisma.emailSignature.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/email-signatures/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
