import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { downloadRecording } from "@/lib/yeastar-client";

// G.711 μ-law → 16-bit linear PCM
function ulawDecode(u: number): number {
  u = (~u) & 0xFF;
  const sign = u & 0x80;
  const exp = (u >> 4) & 0x07;
  const mantissa = u & 0x0F;
  let s = (((mantissa << 3) + 132) << exp) - 132;
  return sign ? -s : s;
}

// G.711 a-law → 16-bit linear PCM
function alawDecode(a: number): number {
  a ^= 0x55;
  const sign = a & 0x80;
  const exp = (a >> 4) & 0x07;
  const mantissa = a & 0x0F;
  let s = exp === 0
    ? (mantissa << 1) | 1
    : ((mantissa | 0x10) << exp) | (1 << (exp - 1));
  return sign ? s : -s;
}

function convertG711ToPcm(input: Buffer): Buffer {
  // Validate RIFF/WAVE header
  if (input.length < 44) return input;
  if (input.toString("ascii", 0, 4) !== "RIFF") return input;
  if (input.toString("ascii", 8, 12) !== "WAVE") return input;

  const audioFormat = input.readUInt16LE(20);
  // 1 = PCM (already fine), 6 = a-law, 7 = μ-law
  if (audioFormat === 1) return input;
  if (audioFormat !== 6 && audioFormat !== 7) return input;

  const numChannels  = input.readUInt16LE(22);
  const sampleRate   = input.readUInt32LE(24);
  const bitsPerSample = 8; // G.711 is always 8-bit

  // Find "data" chunk
  let pos = 12;
  while (pos + 8 <= input.length) {
    const id   = input.toString("ascii", pos, pos + 4);
    const size = input.readUInt32LE(pos + 4);
    if (id === "data") {
      const samples = input.slice(pos + 8, pos + 8 + size);
      const pcm16 = Buffer.allocUnsafe(samples.length * 2);
      const decode = audioFormat === 7 ? ulawDecode : alawDecode;

      for (let i = 0; i < samples.length; i++) {
        const v = Math.max(-32768, Math.min(32767, decode(samples[i])));
        pcm16.writeInt16LE(v, i * 2);
      }

      // Build standard PCM WAV header
      const dataSize  = pcm16.length;
      const byteRate  = sampleRate * numChannels * 2;
      const blockAlign = numChannels * 2;
      const header = Buffer.allocUnsafe(44);
      header.write("RIFF",             0, "ascii");
      header.writeUInt32LE(36 + dataSize, 4);
      header.write("WAVE",             8, "ascii");
      header.write("fmt ",            12, "ascii");
      header.writeUInt32LE(16,        16); // chunk size
      header.writeUInt16LE(1,         20); // PCM
      header.writeUInt16LE(numChannels, 22);
      header.writeUInt32LE(sampleRate,  24);
      header.writeUInt32LE(byteRate,    28);
      header.writeUInt16LE(blockAlign,  32);
      header.writeUInt16LE(16,          34); // 16-bit PCM
      header.write("data",             36, "ascii");
      header.writeUInt32LE(dataSize,    40);

      return Buffer.concat([header, pcm16]);
    }
    pos += 8 + (size % 2 === 0 ? size : size + 1); // RIFF chunks are word-aligned
  }

  return input; // data chunk not found, return original
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const call = await prisma.call.findUnique({ where: { id } });
  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });
  if (!call.recording_id) return NextResponse.json({ error: "No recording" }, { status: 404 });

  try {
    const raw = await downloadRecording(call.recording_id);

    // Debug: log WAV header info
    if (raw.length >= 36) {
      const riff     = raw.toString("ascii", 0, 4);
      const wave     = raw.toString("ascii", 8, 12);
      const fmt      = raw.toString("ascii", 12, 16);
      const fmtCode  = raw.length > 21 ? raw.readUInt16LE(20) : -1;
      const channels = raw.length > 23 ? raw.readUInt16LE(22) : -1;
      const sr       = raw.length > 27 ? raw.readUInt32LE(24) : -1;
      const bps      = raw.length > 35 ? raw.readUInt16LE(34) : -1;
      console.log(`[recording] size=${raw.length} riff=${riff} wave=${wave} fmt=${fmt} fmtCode=${fmtCode} ch=${channels} sr=${sr} bps=${bps}`);
      console.log(`[recording] header hex: ${raw.slice(0, 44).toString("hex")}`);
    }

    const buffer = convertG711ToPcm(raw);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[calls/recording] Download error:", err);
    return NextResponse.json({ error: "Failed to fetch recording" }, { status: 502 });
  }
}
