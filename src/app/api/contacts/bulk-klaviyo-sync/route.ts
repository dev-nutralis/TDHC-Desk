import { NextRequest, NextResponse } from "next/server";
import { syncContactToKlaviyo } from "@/lib/klaviyo-sync";

export async function POST(req: NextRequest) {
  const { ids } = await req.json() as { ids: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "No ids provided" }, { status: 400 });
  }

  // Sync sequentially to avoid Klaviyo rate limits
  let synced = 0;
  for (const id of ids) {
    await syncContactToKlaviyo(id);
    synced++;
  }

  return NextResponse.json({ ok: true, synced });
}
