import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, subject, body: templateBody } = body;

    const data: Record<string, string | null> = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim() === "") {
        return NextResponse.json({ error: "name must be a non-empty string" }, { status: 400 });
      }
      data.name = name.trim();
    }
    if (subject !== undefined) {
      data.subject = subject && typeof subject === "string" ? subject.trim() : null;
    }
    if (templateBody !== undefined) {
      if (typeof templateBody !== "string" || templateBody.trim() === "") {
        return NextResponse.json({ error: "body must be a non-empty string" }, { status: 400 });
      }
      data.body = templateBody.trim();
    }

    const template = await prisma.emailTemplate.update({
      where: { id },
      data,
    });
    return NextResponse.json(template);
  } catch (err) {
    console.error("[PUT /api/email-templates/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const existing = await prisma.emailTemplate.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    await prisma.emailTemplate.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/email-templates/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
