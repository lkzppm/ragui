/**
 * The one place the model is called. Server only: it reads the key.
 * The caller hands over the finished prompt; this adds nothing to it.
 */
import { createGroq } from "@ai-sdk/groq";
import { streamText } from "ai";
import type { Settings } from "@/lib/rag/settings";

export function generationReady(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}

/** The model that answers: the server's `GROQ_MODEL` when set, else the sandbox's. */
export function answerModel(fallback: string): string {
  return process.env.GROQ_MODEL?.trim() || fallback;
}

export function answer(input: { system: string; user: string; settings: Settings["generate"]; signal?: AbortSignal }) {
  const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
  const model = answerModel(input.settings.model);
  const result = streamText({
    model: groq(model),
    instructions: input.system,
    prompt: input.user,
    temperature: input.settings.temperature,
    seed: input.settings.seed,
    maxOutputTokens: input.settings.maxOutputTokens,
    abortSignal: input.signal,
    // gpt-oss spends output tokens on reasoning; "low" keeps that small. Other models do not take the option.
    providerOptions: model.includes("gpt-oss") ? { groq: { reasoningEffort: "low" } } : undefined,
    // Errors are read from the stream below; this only keeps the SDK from logging them twice.
    onError: () => {},
  });
  // The text as it arrives. A provider error (a rate limit, a bad key) ends it with a throw instead of a silent stop.
  async function* textStream(): AsyncGenerator<string> {
    for await (const part of result.fullStream) {
      if (part.type === "text-delta") yield part.text;
      else if (part.type === "error") throw part.error instanceof Error ? part.error : new Error(String(part.error));
    }
  }
  return { model, textStream: textStream(), usage: result.usage, finishReason: result.finishReason };
}
