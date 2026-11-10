/**
 * What `/api/answer` sends: the answer as plain text, then this separator
 * and one JSON object with how it ended. Shared by the route and the
 * browser, and free of server code.
 */
export const TRAILER = "\u001e";

export type AnswerError = "no_key" | "locked" | "bad_request" | "rate_limited" | "bad_key" | "failed" | "network";

export interface AnswerTrailer {
  model: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  finishReason?: string;
  error?: AnswerError;
}

export interface GenerationInfo {
  ready: boolean;
  model: string;
  locked: boolean;
}
