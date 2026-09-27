import { verifyNovaVoice } from "@/lib/novaVoiceToken";
import { isSpeakableNovaText, MAX_NOVA_TEXT_LENGTH } from "@/lib/novaMessages";

export const runtime = "nodejs";
const errorResponse = (error: string, status: number) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return errorResponse("Send Nova's message as JSON.", 415);
  }
  // Bound the body as it arrives, not only the client-supplied Content-Length.
  const reader = request.body?.getReader();
  if (!reader) return errorResponse("A text message is required.", 400);
  let input: unknown;
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) {
        await reader.cancel();
        return errorResponse("The voice request is too large.", 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    input = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return errorResponse("Invalid JSON voice request.", 400);
  } finally { reader.releaseLock(); }

  if (!input || typeof input !== "object" || Array.isArray(input) ||
      Object.keys(input).some(key => key !== "text" && key !== "voiceToken") || !("text" in input) || typeof input.text !== "string") {
    return errorResponse("Provide only a text message.", 400);
  }
  const text = input.text.trim();
  if (!text || text.length > ("voiceToken" in input ? 1200 : MAX_NOVA_TEXT_LENGTH)) {
    return errorResponse(`Text must contain 1–${MAX_NOVA_TEXT_LENGTH} characters.`, 400);
  }
  if (!isSpeakableNovaText(text) && !verifyNovaVoice(text, "voiceToken" in input ? input.voiceToken : undefined)) return errorResponse("Only Nova's built-in session messages can be spoken.", 400);

  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim();
  if (!apiKey || !voiceId) return errorResponse("Nova voice is not configured. Text guidance remains available.", 503);

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
      cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(15000)]),
    });
    // Never forward upstream error bodies, headers, or account information.
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 429) return errorResponse("Nova voice is busy. Please try again later.", 429);
      if (response.status === 401 || response.status === 403 || response.status === 404) {
        return errorResponse("Nova voice configuration is unavailable. Text guidance remains available.", 503);
      }
      return errorResponse("Nova voice could not generate audio. Please try again later.", 502);
    }
    const audio = await response.arrayBuffer();
    if (!audio.byteLength || !response.headers.get("content-type")?.startsWith("audio/")) {
      return errorResponse("Nova voice returned no playable audio.", 502);
    }
    return new Response(audio, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return errorResponse("Nova voice timed out or is unavailable. Text guidance remains available.", 504);
  }
}
