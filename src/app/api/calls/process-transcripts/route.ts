import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { downloadRecording } from "@/lib/yeastar-client";
import { transcribeCallAudio } from "@/lib/gemini";
import { getPlatformSlug } from "@/lib/platform";

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
    take: 1,
    orderBy: { started_at: "asc" },
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
      let transcriptionLanguage: string | null = null;
      if (call.platform_id) {
        const platform = await prisma.platform.findUnique({ where: { id: call.platform_id } });
        transcriptionLanguage = platform?.transcription_language ?? null;
      }
      const result = await transcribeCallAudio(audioBuffer, transcriptionLanguage);

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
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[process-transcripts] failed for call ${call.id}:`, msg);
      // 429 = rate limit — retry next cron tick instead of marking as failed
      const isRateLimit = msg.includes("429");
      await prisma.call.update({
        where: { id: call.id },
        data: {
          transcript_status: isRateLimit ? "pending" : "failed",
          transcript: isRateLimit ? null : msg,
        },
      });
    }
  }

  return NextResponse.json({ processed });
}
