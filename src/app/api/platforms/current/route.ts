import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const cookieStore = await cookies();
  const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
  const platform = await prisma.platform.findUnique({ where: { slug } });
  if (!platform) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(platform);
}
