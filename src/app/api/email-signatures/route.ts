import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest) {
  try {
    const signatures = await prisma.emailSignature.findMany({
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
      },
    });
    return NextResponse.json(signature, { status: 201 });
  } catch (err) {
    console.error("[POST /api/email-signatures]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
