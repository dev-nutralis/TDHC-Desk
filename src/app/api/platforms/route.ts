import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const platforms = await prisma.platform.findMany({ orderBy: { created_at: "asc" } });
  return NextResponse.json({ platforms });
}

export async function POST(req: NextRequest) {
  const { name, slug, logo_url, website_url } = await req.json();
  if (!name || !slug) return NextResponse.json({ error: "name and slug required" }, { status: 400 });
  if (!/^[a-z0-9-]+$/.test(slug)) return NextResponse.json({ error: "slug must be lowercase alphanumeric with hyphens" }, { status: 400 });
  try {
    const platform = await prisma.platform.create({ data: { name, slug, logo_url: logo_url || null, website_url: website_url || null } });
    return NextResponse.json(platform, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "Slug already in use" }, { status: 409 });
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
