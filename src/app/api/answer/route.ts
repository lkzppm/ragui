import { z } from "zod";
import { answer, answerModel, generationReady } from "@/lib/answer/groq";
import { TRAILER } from "@/lib/answer/protocol";
import { buildPrompt, LIMITS } from "@/lib/rag/prompt";
import { DEFAULT_SETTINGS } from "@/lib/rag/settings";

/**
 * The only server code. The browser has already chosen the sources; this
 * builds the prompt from them with the same function the prompt inspector
 * uses, calls the model and streams the text back. It keeps no state, and
 * it enforces its own limits whatever the client sends.
 *
 * The response is the answer as plain text, then a record separator
 * (U+001E) and one JSON object: the model, its token usage and why it
 * stopped, or the error that cut it short.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";


const body = z.object({
  question: z.string().trim().min(1).max(LIMITS.question),
  locale: z.enum(["en", "pt"]),
  instructions: z.string().max(LIMITS.instructions).optional(),
  sources: z
    .array(z.object({ n: z.number().int().min(1).max(99), title: z.string().max(200).nullable(), text: z.string().min(1).max(LIMITS.sourceChars) }))
    .min(1)
    .max(LIMITS.sources),
});

function allowed(request: Request): boolean {
  const code = process.env.ACCESS_CODE?.trim();
  return !code || request.headers.get("x-access-code") === code;
}

/** Whether generation is available, and with which model. Never the key. */
export function GET() {
  return Response.json({ ready: generationReady(), model: answerModel(DEFAULT_SETTINGS.generate.model), locked: Boolean(process.env.ACCESS_CODE?.trim()) });
}

export async function POST(request: Request) {
  if (!generationReady()) return Response.json({ error: "no_key" }, { status: 503 });
  if (!allowed(request)) return Response.json({ error: "locked" }, { status: 401 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad_request" }, { status: 400 });

  const prompt = buildPrompt(parsed.data);
  const result = answer({ system: prompt.system, user: prompt.user, settings: DEFAULT_SETTINGS.generate, signal: request.signal });
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let trailer: Record<string, unknown>;
      try {
        for await (const delta of result.textStream) controller.enqueue(encoder.encode(delta));
        const usage = await result.usage;
        trailer = { model: result.model, inputTokens: usage.inputTokens ?? null, outputTokens: usage.outputTokens ?? null, finishReason: await result.finishReason };
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        trailer = { model: result.model, error: status === 429 ? "rate_limited" : status === 401 ? "bad_key" : "failed" };
        if (status !== 429) console.error("[answer]", error);
      }
      controller.enqueue(encoder.encode(TRAILER + JSON.stringify(trailer)));
      controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" } });
}
