const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const TRANSCRIPTION_PROMPT = `You are analyzing a phone sales call recording. The call may be in any language — detect it automatically.
Provide your response as JSON with exactly this structure:
{
  "transcript": "Full verbatim transcript with speaker labels. Format each line as 'Agent: ...' or 'Customer: ...'",
  "summary": {
    "outcome": "One sentence describing what was decided/agreed",
    "followUps": ["action item 1", "action item 2"],
    "sentiment": "positive|neutral|negative",
    "topics": ["topic1", "topic2"]
  }
}
Return ONLY valid JSON, no markdown, no explanation.`;

export async function transcribeCallAudio(audioBuffer: Buffer): Promise<{
  transcript: string;
  summary: {
    outcome: string;
    followUps: string[];
    sentiment: "positive" | "neutral" | "negative";
    topics: string[];
  };
}> {
  const apiKey = process.env.GEMINI_API_KEY ?? "";
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  // Validate audio — reject if it looks like a JSON error response from Yeastar
  if (audioBuffer.length < 100) {
    throw new Error(`Audio buffer too small (${audioBuffer.length} bytes) — likely a Yeastar API error`);
  }
  const magic = audioBuffer.slice(0, 4).toString("ascii");
  if (magic !== "RIFF") {
    throw new Error(`Audio is not a WAV file (got: ${magic}) — Yeastar may have returned an error`);
  }

  const base64Audio = audioBuffer.toString("base64");

  const payload = JSON.stringify({
    contents: [{
      parts: [
        { text: TRANSCRIPTION_PROMPT },
        { inline_data: { mime_type: "audio/wav", data: base64Audio } },
      ],
    }],
    generationConfig: { response_mime_type: "application/json" },
  });

  const res = await fetch(`${GEMINI_BASE}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const rawText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  if (!rawText) {
    throw new Error(`Gemini returned empty response. Full response: ${JSON.stringify(data)}`);
  }

  let parsed: ReturnType<typeof JSON.parse>;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error(`Gemini response is not valid JSON. Raw text: ${rawText.slice(0, 500)}`);
  }

  if (!parsed.transcript || !parsed.summary) {
    throw new Error(`Gemini JSON missing required fields. Parsed: ${JSON.stringify(parsed).slice(0, 500)}`);
  }

  return {
    transcript: parsed.transcript,
    summary: {
      outcome: parsed.summary.outcome ?? "",
      followUps: Array.isArray(parsed.summary.followUps) ? parsed.summary.followUps : [],
      sentiment: ["positive", "neutral", "negative"].includes(parsed.summary.sentiment)
        ? parsed.summary.sentiment
        : "neutral",
      topics: Array.isArray(parsed.summary.topics) ? parsed.summary.topics : [],
    },
  };
}
