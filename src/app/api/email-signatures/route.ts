import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getPlatformId } from "@/lib/platform";

export async function GET(_req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
    const platformId = await getPlatformId(slug) ?? null;

    const signatures = await prisma.emailSignature.findMany({
      where: { platform_id: platformId },
      orderBy: { created_at: "desc" },
    });
    return NextResponse.json(signatures);
  } catch (err) {
    console.error("[GET /api/email-signatures]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
    const platformId = await getPlatformId(slug) ?? null;

    const body = await req.json();
    const { name, body: signatureBody } = body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (!signatureBody || typeof signatureBody !== "string" || signatureBody.trim() === "") {
      return NextResponse.json({ error: "body is required" }, { status: 400 });
    }

    const signature = await prisma.emailSignature.create({
      data: {
        name: name.trim(),
        body: signatureBody.trim(),
        platform_id: platformId,
      },
    });
    return NextResponse.json(signature, { status: 201 });
  } catch (err) {
    console.error("[POST /api/email-signatures]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
