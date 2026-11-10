"use client";

/**
 * The lab's state: one sandbox, its documents and index, the traces of the
 * last runs, the answer, and the transport. The pipeline functions are
 * pure; this file is where they meet the browser (the embedding worker,
 * fetch, the frame clock).
 */
import { create } from "zustand";
import { TRAILER, type AnswerError, type AnswerTrailer, type GenerationInfo } from "@/lib/answer/protocol";
import { browserEmbedder } from "@/lib/embed/browser";
import { modelOf } from "@/lib/embed/models";
import { pdfText } from "@/lib/load/pdf";
import { grade, type TestResult } from "@/lib/rag/eval";
import type { PromptLocale } from "@/lib/rag/prompt";
import { ingest } from "@/lib/rag/run-ingest";
import { query } from "@/lib/rag/run-query";
import type { Settings } from "@/lib/rag/settings";
import { stepOf, type DocType, type Embedded, type Embedder, type Index, type IngestTrace, type QueryTrace, type RawDoc, type StageId, type Usage } from "@/lib/rag/types";
import { normalizeCitations, verify } from "@/lib/rag/verify";
import { DEFAULT_PRESET } from "@/lib/sandbox/presets";
import type { Sandbox } from "@/lib/sandbox/types";
import { cursor, INGEST_SLOTS, SLOT_SECONDS, SLOTS, slotOf } from "./playhead";

export type Phase = "idle" | "loading" | "model" | "indexing" | "ready" | "error";

export type AnswerStatus =
  | "idle"
  /** The gate closed: nothing close enough, the model was not called. */
  | "skipped"
  /** No key on the server: retrieval works, generation is off. */
  | "off"
  | "pending"
  | "streaming"
  | "done"
  | "error"
  /** The context changed after this was written. */
  | "stale";

export interface AnswerState {
  status: AnswerStatus;
  text: string;
  model: string | null;
  usage: Usage | null;
  error: AnswerError | null;
}

const NO_ANSWER: AnswerState = { status: "idle", text: "", model: null, usage: null, error: null };

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object | null ? Partial<NonNullable<T[K]>> : T[K] };

interface LabState {
  sandbox: Sandbox;
  settings: Settings;
  phase: Phase;
  /** What went wrong, as a message for the screen. */
  failure: string | null;
  /** Bytes of the embedding model fetched so far, on a first visit. */
  download: { loaded: number; total: number } | null;
  embedding: { done: number; total: number } | null;
  docs: RawDoc[];
  index: Index | null;
  ingestTrace: IngestTrace;
  question: string;
  queryTrace: QueryTrace | null;
  answer: AnswerState;
  tests: Record<string, TestResult>;
  generation: GenerationInfo | null;

  /** The slot the cursor is in (a whole number), mirrored from the motion value when it changes. */
  reached: number;
  /** The cursor may not pass this: nothing beyond it has been computed. */
  limit: number;
  playing: boolean;
  /** 0.5, 1, 2, or Infinity for "instant". */
  speed: number;
  /** A chunk under the pointer somewhere, lit everywhere. */
  hovered: number | null;

  boot: () => Promise<void>;
  update: (patch: DeepPartial<Settings>) => void;
  addFiles: (files: File[]) => Promise<void>;
  removeDoc: (name: string) => void;
  ask: (question: string, locale: PromptLocale) => Promise<void>;
  regenerate: (locale: PromptLocale) => void;
  setPlaying: (playing: boolean) => void;
  setSpeed: (speed: number) => void;
  seek: (position: number) => void;
  step: (direction: 1 | -1) => void;
  replay: () => void;
  focus: (stage: StageId) => void;
  hover: (chunk: number | null) => void;
}

// What does not belong in state: the worker, its cache, and what is in flight.
let embedder: (Embedder & { dispose: () => void }) | null = null;
const cache = new Map<string, Embedded>();
let indexRun = 0;
let askRun = 0;
let abort: AbortController | null = null;
let reindexTimer: ReturnType<typeof setTimeout> | null = null;
let lastLocale: PromptLocale = "pt";

const runtime = () => ({ embedder: embedder as Embedder, now: () => performance.now(), cache });

function docType(name: string): DocType {
  const lower = name.toLowerCase();
  return lower.endsWith(".pdf") ? "pdf" : lower.endsWith(".md") || lower.endsWith(".markdown") ? "markdown" : "text";
}

async function readDoc(name: string, type: DocType, bytes: Uint8Array): Promise<RawDoc> {
  const text = type === "pdf" ? (await pdfText(bytes)).text : new TextDecoder().decode(bytes);
  return { name, type, text };
}

export const useLab = create<LabState>((set, get) => {
  /** Moves the cursor's ceiling, and lets playback carry on up to it. */
  const allow = (limit: number) => set({ limit });

  const move = (position: number) => {
    const clamped = Math.max(0, Math.min(get().limit, position));
    cursor.set(clamped);
    const reached = Math.min(SLOTS.length, Math.floor(clamped));
    if (reached !== get().reached) set({ reached });
  };

  /** Runs every test question through retrieval. No model call: it only checks whether each answer was found. */
  const runTests = async (index: Index) => {
    const { sandbox, settings } = get();
    const tests: Record<string, TestResult> = {};
    for (const test of sandbox.golden) {
      const trace = await query(index, test.question, { ...settings, retrieve: { ...settings.retrieve, threshold: null } }, runtime(), { locale: lastLocale });
      tests[test.id] = grade(index, test, trace);
    }
    if (get().index === index) set({ tests });
  };

  const reindex = async () => {
    if (!embedder) return;
    const run = ++indexRun;
    askRun++;
    abort?.abort();
    const { docs, settings, question } = get();
    set({ phase: "indexing", ingestTrace: [], embedding: null, failure: null, queryTrace: null, tests: {}, answer: get().answer.text ? { ...get().answer, status: "stale" } : NO_ANSWER, playing: true, limit: 0 });
    move(0);
    try {
      const result = await ingest(docs, settings, runtime(), {
        step: (step) => {
          if (run !== indexRun) return;
          set((state) => ({ ingestTrace: [...state.ingestTrace, step] as IngestTrace }));
          allow(get().ingestTrace.length);
        },
        embed: (done, total) => run === indexRun && set({ embedding: { done, total } }),
      });
      if (run !== indexRun) return;
      set({ index: result.index, phase: "ready", embedding: null });
      allow(INGEST_SLOTS);
      void runTests(result.index);
      // A question already on screen is asked again of the new index, without calling the model.
      if (question) void retrieve(question, lastLocale, false);
    } catch (error) {
      if (run !== indexRun) return;
      set({ phase: "error", failure: error instanceof Error ? error.message : String(error) });
    }
  };

  /** Streams the answer for the context of the current query trace. */
  const generate = async (locale: PromptLocale, run: number) => {
    const { queryTrace, question, generation } = get();
    const assembled = stepOf(queryTrace, "assemble");
    if (!assembled) return;
    const generateSlot = slotOf("generate");
    if (!generation?.ready) {
      set({ answer: { ...NO_ANSWER, status: "off" } });
      allow(generateSlot);
      return;
    }
    abort?.abort();
    abort = new AbortController();
    const started = performance.now();
    set({ answer: { ...NO_ANSWER, status: "pending", model: generation.model } });
    // The cursor may enter the generate slot and waits there for the stream to end.
    allow(generateSlot + 0.92);
    const finish = (answer: AnswerState, trailer?: AnswerTrailer) => {
      if (run !== askRun) return;
      const text = normalizeCitations(answer.text);
      const steps: QueryTrace = [...(get().queryTrace ?? []).filter((step) => step.kind !== "generate" && step.kind !== "verify")];
      if (answer.status === "done") {
        const checkStarted = performance.now();
        const check = verify(text, assembled.sources);
        steps.push({ kind: "generate", model: trailer?.model ?? generation.model, usage: answer.usage, finishReason: trailer?.finishReason ?? null, ms: performance.now() - started });
        steps.push({ kind: "verify", ...check, ms: performance.now() - checkStarted });
      }
      set({ answer: { ...answer, text }, queryTrace: steps });
      allow(answer.status === "done" ? SLOTS.length : generateSlot + 0.92);
    };
    try {
      const response = await fetch("/api/answer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: abort.signal,
        body: JSON.stringify({ question, locale, sources: assembled.sources.map(({ n, title, text }) => ({ n, title, text })) }),
      });
      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as { error?: AnswerError } | null;
        return finish({ ...NO_ANSWER, status: "error", error: body?.error ?? "failed", model: generation.model });
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let received = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        received += decoder.decode(value, { stream: true });
        if (run !== askRun) return;
        const text = received.split(TRAILER)[0];
        set({ answer: { status: "streaming", text: normalizeCitations(text), model: generation.model, usage: null, error: null } });
      }
      const [text, tail] = received.split(TRAILER);
      const trailer = tail ? (JSON.parse(tail) as AnswerTrailer) : null;
      if (!trailer || trailer.error) return finish({ status: "error", text, model: trailer?.model ?? generation.model, usage: null, error: trailer?.error ?? "failed" });
      finish({ status: "done", text, model: trailer.model, usage: { inputTokens: trailer.inputTokens ?? null, outputTokens: trailer.outputTokens ?? null }, error: null }, trailer);
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      finish({ ...NO_ANSWER, status: "error", error: "network", model: generation.model });
    }
  };

  /** Runs retrieval for a question; `fresh` also plays it from the start and asks the model. */
  const retrieve = async (question: string, locale: PromptLocale, fresh: boolean) => {
    const { index, settings } = get();
    if (!index || !embedder) return;
    const run = ++askRun;
    abort?.abort();
    const trace = await query(index, question, settings, runtime(), { locale });
    if (run !== askRun) return;
    const gate = stepOf(trace, "gate");
    const open = gate?.pass ?? false;
    const ceiling = open ? slotOf("assemble") + 1 : slotOf("gate") + 1;
    if (fresh) {
      set({ question, queryTrace: trace, answer: open ? NO_ANSWER : { ...NO_ANSWER, status: "skipped" }, playing: true });
      allow(ceiling);
      move(INGEST_SLOTS);
      if (open) void generate(locale, run);
    } else {
      // Same question, new settings: the trace is replaced in place and the old answer is marked.
      const previous = get().answer;
      set({ queryTrace: trace, answer: !open ? { ...NO_ANSWER, status: "skipped" } : previous.text ? { ...previous, status: "stale" } : previous.status === "off" ? previous : NO_ANSWER });
      allow(ceiling);
      move(Math.min(cursor.get(), ceiling));
      if (cursor.get() < INGEST_SLOTS) move(ceiling);
    }
  };

  return {
    sandbox: DEFAULT_PRESET,
    settings: DEFAULT_PRESET.settings,
    phase: "idle",
    failure: null,
    download: null,
    embedding: null,
    docs: [],
    index: null,
    ingestTrace: [],
    question: "",
    queryTrace: null,
    answer: NO_ANSWER,
    tests: {},
    generation: null,
    reached: 0,
    limit: 0,
    playing: true,
    speed: 1,
    hovered: null,

    boot: async () => {
      if (get().phase !== "idle") return;
      set({ phase: "loading" });
      try {
        void fetch("/api/answer")
          .then((response) => response.json() as Promise<GenerationInfo>)
          .then((generation) => set({ generation }))
          .catch(() => set({ generation: { ready: false, model: "", locked: false } }));
        const { sandbox, settings } = get();
        const docs: RawDoc[] = [];
        for (const document of sandbox.documents) {
          if (!document.url) continue;
          const response = await fetch(document.url);
          if (!response.ok) throw new Error(`${document.name}: ${response.status}`);
          docs.push(await readDoc(document.name, document.type, new Uint8Array(await response.arrayBuffer())));
        }
        set({ docs, phase: "model" });
        embedder = await browserEmbedder(modelOf(settings.embed), (loaded, total) => set({ download: { loaded, total } }));
        set({ download: null });
        await reindex();
      } catch (error) {
        set({ phase: "error", failure: error instanceof Error ? error.message : String(error) });
      }
    },

    update: (patch) => {
      const before = get().settings;
      const settings: Settings = {
        chunk: { ...before.chunk, ...patch.chunk },
        embed: { ...before.embed, ...patch.embed },
        retrieve: { ...before.retrieve, ...patch.retrieve },
        context: { ...before.context, ...patch.context },
        generate: { ...before.generate, ...patch.generate },
      };
      set({ settings });
      if (patch.chunk) {
        // A slider being dragged sends many values; index once it rests.
        if (reindexTimer) clearTimeout(reindexTimer);
        reindexTimer = setTimeout(() => void reindex(), 280);
        return;
      }
      const { index, question } = get();
      if (!index) return;
      void runTests(index);
      if (question) void retrieve(question, lastLocale, false);
    },

    addFiles: async (files) => {
      const added: RawDoc[] = [];
      for (const file of files) {
        const doc = await readDoc(file.name, docType(file.name), new Uint8Array(await file.arrayBuffer()));
        if (doc.text.trim()) added.push(doc);
      }
      if (!added.length) return;
      const names = new Set(added.map((doc) => doc.name));
      set((state) => ({ docs: [...state.docs.filter((doc) => !names.has(doc.name)), ...added] }));
      await reindex();
    },

    removeDoc: (name) => {
      set((state) => ({ docs: state.docs.filter((doc) => doc.name !== name) }));
      void reindex();
    },

    ask: async (question, locale) => {
      const text = question.trim();
      if (!text) return;
      lastLocale = locale;
      await retrieve(text, locale, true);
    },

    regenerate: (locale) => {
      lastLocale = locale;
      void generate(locale, askRun);
    },

    setPlaying: (playing) => {
      // Play from the end starts the question over.
      if (playing && cursor.get() >= get().limit - 0.001 && get().queryTrace) move(INGEST_SLOTS);
      set({ playing });
    },
    setSpeed: (speed) => set({ speed }),
    seek: (position) => {
      set({ playing: false });
      move(position);
    },
    step: (direction) => {
      set({ playing: false });
      const position = cursor.get();
      const whole = Math.round(position);
      // Forward lands on the end of the next slot; back, on the end of the one before.
      move(direction > 0 ? (Math.abs(position - whole) < 0.01 ? whole + 1 : Math.ceil(position)) : Math.abs(position - whole) < 0.01 ? whole - 1 : Math.floor(position));
    },
    replay: () => {
      move(get().queryTrace ? INGEST_SLOTS : 0);
      set({ playing: true });
    },
    focus: (stage) => {
      const slot = slotOf(stage);
      if (slot + 1 > get().limit + 0.5) return;
      set({ playing: false });
      move(slot + 1);
    },
    hover: (chunk) => get().hovered !== chunk && set({ hovered: chunk }),
  };
});

/**
 * The clock of the replay: while playing, moves the cursor toward the
 * limit at the chosen speed. Runs for as long as the lab is on screen.
 */
export function startPlayback(): () => void {
  let frame = 0;
  let last = performance.now();
  const tick = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const { playing, speed, limit, reached } = useLab.getState();
    const position = cursor.get();
    if (playing && position < limit) {
      const next = Number.isFinite(speed) ? Math.min(limit, position + (dt * speed) / SLOT_SECONDS) : limit;
      cursor.set(next);
      const slot = Math.min(SLOTS.length, Math.floor(next));
      if (slot !== reached) useLab.setState({ reached: slot });
    } else if (playing && position >= SLOTS.length) {
      useLab.setState({ playing: false });
    }
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}
