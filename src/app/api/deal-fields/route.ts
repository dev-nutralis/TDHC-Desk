import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getPlatformId } from "@/lib/platform";

const includeOptions = { options: { orderBy: { sort_order: "asc" as const } } };

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
  const platformId = await getPlatformId(slug) ?? null;

  const { searchParams } = new URL(req.url);
  const active = searchParams.get("active");

  const where = {
    platform_id: platformId,
    ...(active === "true" ? { is_active: true } : {}),
  };

  const fields = await prisma.dealField.findMany({ where, include: includeOptions, orderBy: { sort_order: "asc" } });
  return NextResponse.json(fields);
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
  const platformId = await getPlatformId(slug) ?? null;

  const { label, field_key, field_type, sort_order, is_required, config, options, source_module, source_field_id } = await req.json();

  if (!label?.trim()) return NextResponse.json({ error: "label is required" }, { status: 400 });
  if (!field_key?.trim()) return NextResponse.json({ error: "field_key is required" }, { status: 400 });

  const field = await prisma.dealField.create({
    data: {
      label: label.trim(),
      field_key: field_key.trim(),
      field_type: field_type ?? "text",
      sort_order: sort_order ?? 0,
      is_required: is_required ?? false,
      config: config ?? null,
      source_module: source_module ?? null,
      source_field_id: source_field_id ?? null,
      platform_id: platformId,
      options: Array.isArray(options) && options.length > 0
        ? { create: options.map((o: { label: string; value: string; sort_order?: number }) => ({ label: o.label, value: o.value, sort_order: o.sort_order ?? 0 })) }
        : undefined,
    },
    include: includeOptions,
  });

  return NextResponse.json(field, { status: 201 });
}
