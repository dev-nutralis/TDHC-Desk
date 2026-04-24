import { NextResponse } from "next/server";
import { syncInbox } from "@/lib/imap-sync";

export async function POST() {
  try {
    const result = await syncInbox();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[POST /api/email-sync]", err);
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
