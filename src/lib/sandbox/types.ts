/**
 * A sandbox is one RAG someone is building: its documents, its settings and
 * the questions it is tested with. The app is a place to make these about
 * any subject; the assignment's contract is only the one that ships with it.
 */
import type { Settings } from "@/lib/rag/settings";
import type { RawDoc } from "@/lib/rag/types";

export interface SandboxDocument {
  name: string;
  type: "pdf" | "text" | "markdown";
  /** Where a bundled sample is served from. User documents live in the browser instead. */
  url: string | null;
}

/**
 * A question with a known answer. Retrieval is graded by code: it passes
 * when a retrieved chunk contains `expect` (and `near`, when the expected
 * text occurs in more than one place).
 */
export interface GoldenQuestion {
  id: string;
  question: string;
  expect: string;
  near?: string;
}

export interface Sandbox {
  id: string;
  /**
   * A bundled sample: its name and description come from the dictionary
   * (`presets[id]`). A sandbox made by the user carries its own name.
   */
  preset: boolean;
  /** The name its maker gave it. A preset has none. */
  name?: string;
  documents: SandboxDocument[];
  settings: Settings;
  golden: GoldenQuestion[];
  /** More questions to try, offered beside the tests. The last is one the documents cannot answer. */
  examples: string[];
}

/** A question that was asked, kept so it can be asked again. */
export interface HistoryEntry {
  question: string;
  /** When it was last asked, in epoch milliseconds. */
  at: number;
  /** Whether the gate let it through to the model. */
  pass: boolean;
}

/**
 * What the browser keeps of a sandbox between visits. One made by the
 * visitor is kept whole: the text of its documents, its settings, the
 * questions asked. A preset keeps only the questions asked: its documents
 * and settings come from the app each time.
 */
export interface StoredSandbox {
  id: string;
  name: string;
  preset: boolean;
  docs: RawDoc[];
  settings: Settings;
  history: HistoryEntry[];
  createdAt: number;
  updatedAt: number;
}
