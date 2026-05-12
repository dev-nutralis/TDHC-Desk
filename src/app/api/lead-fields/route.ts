import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getPlatformId } from "@/lib/platform";

const includeOptions = {
  options: { orderBy: { sort_order: "asc" as const } },
};

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
  const platformId = await getPlatformId(slug) ?? null;

  const { searchParams } = new URL(req.url);
  const active = searchParams.get("active");

  const platform = platformId
    ? await prisma.platform.findUnique({ where: { id: platformId }, select: { lead_show_source: true } })
    : null;
  const sourceEnabled = platform?.lead_show_source ?? true;

  const where = {
    platform_id: platformId,
    ...(active === "true" ? { is_active: true } : {}),
    ...(sourceEnabled ? {} : { field_type: { not: "source_select" } }),
  };

  const fields = await prisma.leadField.findMany({
    where,
    include: includeOptions,
    orderBy: { sort_order: "asc" },
  });

  return NextResponse.json(fields);
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
  const platformId = await getPlatformId(slug) ?? null;

  const { label, field_key, field_type, sort_order, is_required, config } =
    await req.json();

  if (!label?.trim())
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  if (!field_key?.trim())
    return NextResponse.json({ error: "field_key is required" }, { status: 400 });

  const field = await prisma.leadField.create({
    data: {
      label: label.trim(),
      field_key: field_key.trim(),
      field_type: field_type ?? "text",
      sort_order: sort_order ?? 0,
      is_required: is_required ?? false,
      config: config ?? null,
      platform_id: platformId,
    },
    include: includeOptions,
  });

  return NextResponse.json(field, { status: 201 });
}
