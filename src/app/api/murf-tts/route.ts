import { NextRequest, NextResponse } from "next/server";

// Falcon streaming endpoint — PCM for real-time chunk playback
const MURF_STREAM_URL = "https://us-east.api.murf.ai/v1/speech/stream";
const MURF_MAX_CHARS = 2900;

function cleanTextForSpeech(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, "") // headers
    .replace(/\*\*(.*?)\*\*/g, "$1") // bold
    .replace(/\*(.*?)\*/g, "$1") // italic
    .replace(/`{1,3}[^`]*`{1,3}/g, "") // code blocks
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
    .replace(/^\s*[-*+]\s+/gm, "") // list markers
    .replace(/^\s*\d+\.\s+/gm, "") // numbered lists
    .replace(/\|[^|]*\|/g, "") // table cells
    .replace(/---+/g, "") // horizontal rules
    .replace(/\n{3,}/g, "\n\n") // excess newlines
    .replace(/\[\d+\]/g, "") // citation markers [1], [2]
    .trim();
}

function truncateForVoice(text: string, maxSentences = 3): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const limited = sentences.slice(0, maxSentences).join(" ").trim();
  if (limited.length <= MURF_MAX_CHARS) return limited;
  const truncated = limited.slice(0, MURF_MAX_CHARS);
  const lastSentence = truncated.lastIndexOf(". ");
  return lastSentence > MURF_MAX_CHARS / 2
    ? truncated.slice(0, lastSentence + 1)
    : truncated;
}

export async function POST(req: NextRequest) {
  try {
    const { text, voiceId } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const apiKey = process.env.MURF_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "MURF_API_KEY not configured" },
        { status: 500 }
      );
    }

    const cleanText = truncateForVoice(cleanTextForSpeech(text));
    if (!cleanText) {
      return NextResponse.json({ error: "No speakable text after cleaning" }, { status: 400 });
    }

    const t0 = Date.now();
    console.log(`[TTS] Requesting Falcon PCM stream (${cleanText.length} chars)...`);

    const streamResponse = await fetch(MURF_STREAM_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        text: cleanText,
        voiceId: voiceId || "en-US-natalie",
        model: "FALCON",
        format: "PCM",
        sampleRate: 24000,
        channelType: "MONO",
      }),
    });

    console.log(`[TTS] Falcon responded in ${Date.now() - t0}ms (status: ${streamResponse.status})`);

    if (!streamResponse.ok) {
      const errorBody = await streamResponse.text().catch(() => "");
      console.error(`[TTS] Falcon error:`, errorBody.slice(0, 300));
      return NextResponse.json(
        { error: `Murf API error: ${streamResponse.status}` },
        { status: streamResponse.status }
      );
    }

    if (!streamResponse.body) {
      return NextResponse.json({ error: "No stream body" }, { status: 500 });
    }

    // Pipe PCM stream directly to client — no buffering
    return new NextResponse(streamResponse.body, {
      status: 200,
      headers: {
        "Content-Type": "audio/pcm",
        "Transfer-Encoding": "chunked",
        "X-Sample-Rate": "24000",
        "X-Channels": "1",
      },
    });
  } catch (error: any) {
    console.error("Murf TTS error:", error);
    return NextResponse.json({ error: error.message || "TTS generation failed" }, { status: 500 });
  }
}
