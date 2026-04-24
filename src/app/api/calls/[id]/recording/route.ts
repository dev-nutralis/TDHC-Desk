import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { downloadRecording } from "@/lib/yeastar-client";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const call = await prisma.call.findUnique({ where: { id } });
  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });
  if (!call.recording_id) return NextResponse.json({ error: "No recording" }, { status: 404 });

  try {
    const buffer = await downloadRecording(call.recording_id);
    const ext = call.recording_id.split(".").pop()?.toLowerCase() ?? "wav";
    const contentType =
      ext === "mp3" ? "audio/mpeg" :
      ext === "ogg" ? "audio/ogg" :
      "audio/wav";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[calls/recording] Download error:", err);
    return NextResponse.json({ error: "Failed to fetch recording" }, { status: 502 });
  }
}
