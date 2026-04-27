import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { downloadRecording } from "@/lib/yeastar-client";
import { transcribeCallAudio } from "@/lib/gemini";

export const maxDuration = 60;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: callId } = await params;

  const call = await prisma.call.findUnique({ where: { id: callId } });
  if (!call) {
    return NextResponse.json({ error: "Call not found" }, { status: 404 });
  }
  if (!call.recording_id) {
    return NextResponse.json({ error: "Call has no recording" }, { status: 400 });
  }

  await prisma.call.update({
    where: { id: callId },
    data: { transcript_status: "processing" },
  });

  try {
    const audioBuffer = await downloadRecording(call.recording_id);
    let transcriptionLanguage: string | null = null;
    if (call.platform_id) {
      const platform = await prisma.platform.findUnique({ where: { id: call.platform_id } });
      transcriptionLanguage = platform?.transcription_language ?? null;
    }
    const callInfo = (call.direction && call.caller_number && call.callee_number)
      ? { direction: call.direction, caller_number: call.caller_number, callee_number: call.callee_number }
      : null;
    const result = await transcribeCallAudio(audioBuffer, transcriptionLanguage, callInfo);

    await prisma.call.update({
      where: { id: callId },
      data: {
        transcript: result.transcript,
        summary: JSON.stringify(result.summary),
        transcript_status: "done",
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    await prisma.call.update({
      where: { id: callId },
      data: { transcript_status: "failed" },
    });

    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
