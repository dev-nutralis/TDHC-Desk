import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getPlatformId } from "@/lib/platform";

export async function GET(_req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
    const platformId = await getPlatformId(slug) ?? null;

    const templates = await prisma.emailTemplate.findMany({
      where: { platform_id: platformId },
      orderBy: { created_at: "desc" },
    });
    return NextResponse.json(templates);
  } catch (err) {
    console.error("[GET /api/email-templates]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
    const platformId = await getPlatformId(slug) ?? null;

    const body = await req.json();
    const { name, subject, body: templateBody } = body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (!templateBody || typeof templateBody !== "string" || templateBody.trim() === "") {
      return NextResponse.json({ error: "body is required" }, { status: 400 });
    }

    const template = await prisma.emailTemplate.create({
      data: {
        name: name.trim(),
        subject: subject && typeof subject === "string" ? subject.trim() : null,
        body: templateBody.trim(),
        platform_id: platformId,
      },
    });
    return NextResponse.json(template, { status: 201 });
  } catch (err) {
    console.error("[POST /api/email-templates]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
