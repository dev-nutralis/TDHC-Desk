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
    const { mappings, create_deal, create_deal_new_only, deal_mappings } = body as {
      mappings?: { klaviyo_field: string; contact_field_key: string; transform?: string }[];
      create_deal?: boolean;
      create_deal_new_only?: boolean;
      deal_mappings?: { klaviyo_field: string; contact_field_key: string; transform?: string }[];
    };

    if (mappings !== undefined && !Array.isArray(mappings)) {
      return NextResponse.json({ error: "mappings must be an array" }, { status: 400 });
    }
    if (deal_mappings !== undefined && !Array.isArray(deal_mappings)) {
      return NextResponse.json({ error: "deal_mappings must be an array" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (mappings !== undefined) data.mappings = mappings;
    if (create_deal !== undefined) data.create_deal = create_deal;
    if (create_deal_new_only !== undefined) data.create_deal_new_only = create_deal_new_only;
    if (deal_mappings !== undefined) data.deal_mappings = deal_mappings;

    const updatedForm = await prisma.klaviyoForm.update({
      where: { id: formId },
      data,
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
