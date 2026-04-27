import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getPlatformId } from "@/lib/platform";
import { syncContactFieldToDeals } from "@/lib/sync-lead-to-contact-field";

const includeOptions = {
  options: { orderBy: { sort_order: "asc" as const } },
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
  const platformId = await getPlatformId(slug) ?? null;

  const { id } = await params;

  const field = await prisma.contactField.findFirst({
    where: { id, platform_id: platformId },
    include: includeOptions,
  });

  if (!field) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(field);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
  const platformId = await getPlatformId(slug) ?? null;

  const { id } = await params;
  const { label, field_key, field_type, sort_order, is_required, is_active, is_filterable, config } =
    await req.json();

  const existing = await prisma.contactField.findFirst({ where: { id, platform_id: platformId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const field = await prisma.contactField.update({
    where: { id },
    data: {
      ...(label !== undefined && { label: label.trim() }),
      ...(field_key !== undefined && { field_key: field_key.trim() }),
      ...(field_type !== undefined && { field_type }),
      ...(sort_order !== undefined && { sort_order }),
      ...(is_required !== undefined && { is_required }),
      ...(is_active !== undefined && { is_active }),
      ...(is_filterable !== undefined && { is_filterable }),
      ...(config !== undefined && { config }),
    },
    include: includeOptions,
  });

  syncContactFieldToDeals(id).catch(console.error);
  return NextResponse.json(field);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
  const platformId = await getPlatformId(slug) ?? null;

  const { id } = await params;

  const existing = await prisma.contactField.findFirst({ where: { id, platform_id: platformId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.contactField.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
