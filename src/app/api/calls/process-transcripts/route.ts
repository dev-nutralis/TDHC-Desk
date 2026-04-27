import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { downloadRecording } from "@/lib/yeastar-client";
import { transcribeCallAudio } from "@/lib/gemini";

export const maxDuration = 60;

export async function GET() {
  await prisma.call.updateMany({
    where: {
      recording_id: { not: null },
      transcript_status: null,
    },
    data: { transcript_status: "pending" },
  });

  const pending = await prisma.call.findMany({
    where: { transcript_status: "pending" },
    take: 2,
    orderBy: { created_at: "asc" },
  });

  let processed = 0;

  for (const call of pending) {
    if (!call.recording_id) continue;

    await prisma.call.update({
      where: { id: call.id },
      data: { transcript_status: "processing" },
    });

    try {
      const audioBuffer = await downloadRecording(call.recording_id);
      const result = await transcribeCallAudio(audioBuffer);

      await prisma.call.update({
        where: { id: call.id },
        data: {
          transcript: result.transcript,
          summary: JSON.stringify(result.summary),
          transcript_status: "done",
        },
      });

      processed++;
    } catch (err) {
      await prisma.call.update({
        where: { id: call.id },
        data: { transcript_status: "failed" },
      });

      console.error(`[process-transcripts] failed for call ${call.id}:`, err);
    }
  }

  return NextResponse.json({ processed });
}
