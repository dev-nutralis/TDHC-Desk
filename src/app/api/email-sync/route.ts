import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPlatformId } from "@/lib/platform";
import { syncInbox } from "@/lib/imap-sync";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
    const platformId = await getPlatformId(slug);
    if (!platformId) return NextResponse.json({ error: "Platform not found" }, { status: 404 });

    const result = await syncInbox(platformId);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[POST /api/email-sync]", err);
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
