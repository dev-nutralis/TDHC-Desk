import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/klaviyo-forms/[formId]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  const { formId } = await params;
  try {
    const body = await req.json();
    const { mappings } = body as {
      mappings?: { klaviyo_field: string; contact_field_key: string }[];
    };

    if (!Array.isArray(mappings)) {
      return NextResponse.json(
        { error: "mappings must be an array" },
        { status: 400 }
      );
    }

    const updatedForm = await prisma.klaviyoForm.update({
      where: { id: formId },
      data: { mappings },
    });

    return NextResponse.json({ ok: true, form: updatedForm });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// DELETE /api/klaviyo-forms/[formId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  const { formId } = await params;
  try {
    await prisma.klaviyoForm.delete({ where: { id: formId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
