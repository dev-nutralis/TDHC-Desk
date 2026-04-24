import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/calls — recent call history
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit = 50;
    const skip = (page - 1) * limit;

    const [calls, total] = await Promise.all([
      prisma.call.findMany({
        orderBy: { started_at: "desc" },
        skip,
        take: limit,
      }),
      prisma.call.count(),
    ]);

    return NextResponse.json({ calls, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("[calls] GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
