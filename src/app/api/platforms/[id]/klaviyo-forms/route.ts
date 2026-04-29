import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/platforms/[id]/klaviyo-forms
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const forms = await prisma.klaviyoForm.findMany({
      where: { platform_id: id },
      orderBy: { created_at: "desc" },
    });
    return NextResponse.json({ forms });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// POST /api/platforms/[id]/klaviyo-forms
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { name } = await req.json();
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const token = crypto.randomUUID();

    const form = await prisma.klaviyoForm.create({
      data: {
        platform_id: id,
        name,
        token,
      },
    });

    return NextResponse.json(form, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
