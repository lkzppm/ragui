"use client";

/**
 * The lab's state: the sandbox that is open, its documents and index, the
 * traces of the last runs, the answer, the questions asked, and the
 * transport. The pipeline functions are pure; this file is where they meet
 * the browser (the embedding worker, fetch, storage, the frame clock).
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
import { DEFAULT_SETTINGS, type Settings } from "@/lib/rag/settings";
import { timed } from "@/lib/rag/timing";
import { stepOf, type DocType, type Embedded, type Embedder, type Index, type IngestTrace, type QueryTrace, type RawDoc, type StageId, type Usage } from "@/lib/rag/types";
import { normalizeCitations, verify } from "@/lib/rag/verify";
import { PRESETS } from "@/lib/sandbox/presets";
import { loadSandbox, saveSandbox } from "@/lib/sandbox/storage";
import type { HistoryEntry, Sandbox, StoredSandbox } from "@/lib/sandbox/types";
import { rememberLab } from "./last-lab";
import { cursor, INGEST_SLOTS, SLOT_SECONDS, SLOTS, slotOf } from "./playhead";

export type Phase =
  | "idle"
  | "loading"
  | "model"
  | "indexing"
  | "ready"
  /** Open, with no documents yet. */
  | "empty"
  /** No sandbox with this id in this browser. */
  | "missing"
  | "error";

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
  /** Which try at loading the model this is; above 1 after a download that stopped. */
  attempt: number;
  embedding: { done: number; total: number } | null;
  docs: RawDoc[];
  index: Index | null;
  ingestTrace: IngestTrace;
  question: string;
  queryTrace: QueryTrace | null;
  answer: AnswerState;
  tests: Record<string, TestResult>;
  /** The questions asked of this sandbox, the latest first. */
  history: HistoryEntry[];
  generation: GenerationInfo | null;

  /** The slot the cursor is in (a whole number), mirrored from the motion value when it changes. */
  reached: number;
  /** The cursor may not pass this: nothing beyond it has been computed. */
  limit: number;
  playing: boolean;
  /** A chunk under the pointer somewhere, lit everywhere. */
  hovered: number | null;

  /** Opens a sandbox by id: a preset, or one stored in this browser. */
  open: (id: string) => Promise<void>;
  /** Leaving the lab: what is unsaved is written. What is in flight carries on, to be found done on return. */
  close: () => void;
  /** Opens the same sandbox again, after a failure. */
  retry: () => void;
  update: (patch: DeepPartial<Settings>) => void;
  addFiles: (files: File[]) => Promise<void>;
  removeDoc: (name: string) => void;
  ask: (question: string, locale: PromptLocale) => Promise<void>;
  regenerate: (locale: PromptLocale) => void;
  forget: (question: string) => void;
  clearHistory: () => void;
  setPlaying: (playing: boolean) => void;
  seek: (position: number) => void;
  step: (direction: 1 | -1) => void;
  replay: () => void;
  focus: (stage: StageId) => void;
  hover: (chunk: number | null) => void;
}

// What does not belong in state: the worker, its cache, what is in flight and what waits to be saved.
let embedder: (Embedder & { dispose: () => void }) | null = null;
let embedderKey = "";
let embedderJob: { key: string; promise: Promise<void> } | null = null;
const cache = new Map<string, Embedded>();
let openRun = 0;
let indexRun = 0;
let askRun = 0;
let abort: AbortController | null = null;
let reindexTimer: ReturnType<typeof setTimeout> | null = null;
let lastLocale: PromptLocale = "pt";
let generationAsked = false;
/** The sandbox the address asks for, and the one whose documents are in state (null while it loads). */
let currentId = "";
let loadedId: string | null = null;
let createdAt = 0;
let unsaved: StoredSandbox | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

/** Tries at downloading the model before the failure is shown. */
export const ATTEMPTS = 3;
const HISTORY_LIMIT = 50;

let resolution: number | null = null;

/** The smallest step this browser's clock shows, found once by watching it for a few milliseconds. */
function clockResolution(): number {
  if (resolution !== null) return resolution;
  let smallest = Infinity;
  let previous = performance.now();
  const until = previous + 4;
  for (;;) {
    const now = performance.now();
    if (now > previous) {
      smallest = Math.min(smallest, now - previous);
      previous = now;
    }
    if (now >= until) break;
  }
  resolution = Number.isFinite(smallest) ? smallest : 1;
  return resolution;
}

/** For a run that is shown: stages too short for the clock are timed over repeats. */
const runtime = () => ({ embedder: embedder as Embedder, now: () => performance.now(), cache, resolution: clockResolution() });
/** For a run nobody watches (the tests): no repeats. */
const quiet = () => ({ embedder: embedder as Embedder, now: () => performance.now(), cache });

function docType(name: string): DocType {
  const lower = name.toLowerCase();
  return lower.endsWith(".pdf") ? "pdf" : lower.endsWith(".md") || lower.endsWith(".markdown") ? "markdown" : "text";
}

async function readDoc(name: string, type: DocType, bytes: Uint8Array, started: number): Promise<RawDoc> {
  const text = type === "pdf" ? (await pdfText(bytes)).text : new TextDecoder().decode(bytes);
  return { name, type, text, ms: performance.now() - started };
}

/** Settings stored by an older version may lack a field added since. */
function withDefaults(stored: Partial<Settings> | undefined): Settings {
  return {
    chunk: { ...DEFAULT_SETTINGS.chunk, ...stored?.chunk },
    embed: { ...DEFAULT_SETTINGS.embed, ...stored?.embed },
    retrieve: { ...DEFAULT_SETTINGS.retrieve, ...stored?.retrieve },
    context: { ...DEFAULT_SETTINGS.context, ...stored?.context },
    generate: { ...DEFAULT_SETTINGS.generate, ...stored?.generate },
  };
}

const blankSandbox = (id: string): Sandbox => ({ id, preset: false, name: "", documents: [], settings: DEFAULT_SETTINGS, golden: [], examples: [] });

function flushSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  const record = unsaved;
  unsaved = null;
  if (record) void saveSandbox(record).catch(() => undefined);
}

/** A sandbox was deleted: if it is the one in memory, it is let go, so nothing writes it back. */
export function forgetSandbox(id: string) {
  if (unsaved?.id === id) unsaved = null;
  if (loadedId === id) loadedId = null;
}

/** Writes what is waiting to be saved, now. For when the page is about to go away. */
export function saveNow() {
  flushSave();
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

  /**
   * Keeps the open sandbox for the next visit. The record is made now, from
   * what is on screen, and written a moment later, so a slider being
   * dragged is one write. A preset only keeps its questions.
   */
  const persist = (what: "content" | "history") => {
    const { sandbox, docs, settings, history } = get();
    if (loadedId !== sandbox.id || (sandbox.preset && what !== "history")) return;
    unsaved = { id: sandbox.id, name: sandbox.name ?? "", preset: sandbox.preset, docs: sandbox.preset ? [] : docs, settings: sandbox.preset ? sandbox.settings : settings, history, createdAt, updatedAt: Date.now() };
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, 300);
  };

  /**
   * The embedding model in its worker, loaded once and kept between
   * sandboxes. A download that stops is started again, a few times, before
   * the failure is shown: the files already fetched are in the browser's
   * cache, so a new try only repeats the one that broke.
   */
  const ensureEmbedder = (): Promise<void> => {
    const model = modelOf(get().settings.embed);
    const key = `${model.id}|${model.dtype}|${model.device}`;
    if (embedder && embedderKey === key) return Promise.resolve();
    if (embedderJob?.key === key) return embedderJob.promise;
    const promise = (async () => {
      embedder?.dispose();
      embedder = null;
      for (let attempt = 1; ; attempt++) {
        set({ attempt, download: null });
        try {
          embedder = await browserEmbedder(model, (loaded, total) => set({ download: { loaded, total } }));
          embedderKey = key;
          set({ download: null, attempt: 1 });
          return;
        } catch (error) {
          if (attempt >= ATTEMPTS) throw error;
          await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
        }
      }
    })().finally(() => {
      embedderJob = null;
    });
    embedderJob = { key, promise };
    return promise;
  };

  const remember = (question: string, pass: boolean) => {
    set((state) => ({ history: [{ question, at: Date.now(), pass }, ...state.history.filter((entry) => entry.question !== question)].slice(0, HISTORY_LIMIT) }));
    persist("history");
  };

  /** Runs every test question through retrieval. No model call: it only checks whether each answer was found. */
  const runTests = async (index: Index) => {
    const { sandbox, settings } = get();
    const tests: Record<string, TestResult> = {};
    for (const test of sandbox.golden) {
      const trace = await query(index, test.question, { ...settings, retrieve: { ...settings.retrieve, threshold: null } }, quiet(), { locale: lastLocale });
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
    if (!docs.length) {
      set({ phase: "empty", index: null, ingestTrace: [], embedding: null, failure: null, question: "", queryTrace: null, tests: {}, answer: NO_ANSWER, limit: 0 });
      move(0);
      return;
    }
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
        steps.push({ kind: "generate", model: trailer?.model ?? generation.model, usage: answer.usage, finishReason: trailer?.finishReason ?? null, ms: performance.now() - started });
        const check = timed(runtime(), () => verify(text, assembled.sources));
        steps.push({ kind: "verify", ...check.value, ms: check.ms });
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
      remember(question, open);
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

  /** Everything that belongs to one sandbox, as it is before any is open. */
  const blank = {
    failure: null,
    download: null,
    attempt: 1,
    embedding: null,
    docs: [] as RawDoc[],
    index: null,
    ingestTrace: [] as IngestTrace,
    question: "",
    queryTrace: null,
    answer: NO_ANSWER,
    tests: {},
    history: [] as HistoryEntry[],
    reached: 0,
    limit: 0,
    playing: true,
    hovered: null,
  };

  return {
    sandbox: blankSandbox(""),
    settings: DEFAULT_SETTINGS,
    phase: "idle",
    generation: null,
    ...blank,

    open: async (id) => {
      // Coming back to the sandbox that is already here: everything is as it was left.
      if (loadedId === id && get().sandbox.id === id && get().phase !== "error") return;
      flushSave();
      const run = ++openRun;
      indexRun++;
      askRun++;
      abort?.abort();
      if (reindexTimer) clearTimeout(reindexTimer);
      currentId = id;
      loadedId = null;
      const preset = PRESETS.find((candidate) => candidate.id === id) ?? null;
      set({ ...blank, sandbox: preset ?? blankSandbox(id), settings: preset?.settings ?? DEFAULT_SETTINGS, phase: "loading" });
      cursor.set(0);
      if (!generationAsked) {
        generationAsked = true;
        void fetch("/api/answer")
          .then((response) => response.json() as Promise<GenerationInfo>)
          .then((generation) => set({ generation }))
          .catch(() => set({ generation: { ready: false, model: "", locked: false } }));
      }
      try {
        const stored = await loadSandbox(id).catch(() => null);
        if (run !== openRun) return;
        if (!preset && !stored) {
          set({ phase: "missing" });
          rememberLab("/lab");
          return;
        }
        const sandbox: Sandbox = preset ?? { ...blankSandbox(id), name: stored!.name, settings: withDefaults(stored!.settings) };
        createdAt = stored?.createdAt ?? Date.now();
        set({ sandbox, settings: sandbox.settings, history: stored?.history ?? [] });
        let docs: RawDoc[] = preset ? [] : stored!.docs;
        for (const document of preset?.documents ?? []) {
          if (!document.url) continue;
          const started = performance.now();
          const response = await fetch(document.url);
          if (!response.ok) throw new Error(`${document.name}: ${response.status}`);
          docs = [...docs, await readDoc(document.name, document.type, new Uint8Array(await response.arrayBuffer()), started)];
        }
        if (run !== openRun) return;
        set({ docs });
        loadedId = id;
        if (!embedder || embedderJob) set({ phase: "model" });
        await ensureEmbedder();
        if (run !== openRun) return;
        await reindex();
      } catch (error) {
        if (run !== openRun) return;
        set({ phase: "error", failure: error instanceof Error ? error.message : String(error) });
      }
    },

    close: () => flushSave(),

    retry: () => void get().open(currentId),

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
      persist("content");
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
      const id = get().sandbox.id;
      if (loadedId !== id) return;
      const added: RawDoc[] = [];
      for (const file of files) {
        const started = performance.now();
        const doc = await readDoc(file.name, docType(file.name), new Uint8Array(await file.arrayBuffer()), started);
        if (doc.text.trim()) added.push(doc);
      }
      if (!added.length || loadedId !== id) return;
      const names = new Set(added.map((doc) => doc.name));
      set((state) => ({ docs: [...state.docs.filter((doc) => !names.has(doc.name)), ...added] }));
      persist("content");
      // While the model is still loading, opening the sandbox indexes whatever is here when it arrives.
      await reindex();
    },

    removeDoc: (name) => {
      if (loadedId !== get().sandbox.id) return;
      set((state) => ({ docs: state.docs.filter((doc) => doc.name !== name) }));
      persist("content");
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

    forget: (question) => {
      set((state) => ({ history: state.history.filter((entry) => entry.question !== question) }));
      persist("history");
    },
    clearHistory: () => {
      set({ history: [] });
      persist("history");
    },

    setPlaying: (playing) => {
      // Play from the end starts the question over.
      if (playing && cursor.get() >= get().limit - 0.001 && get().queryTrace) move(INGEST_SLOTS);
      set({ playing });
    },
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
 * limit, one slot every `SLOT_SECONDS`. Runs for as long as the lab is on screen.
 */
export function startPlayback(): () => void {
  let frame = 0;
  let last = performance.now();
  const tick = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const { playing, limit, reached } = useLab.getState();
    const position = cursor.get();
    if (playing && position < limit) {
      const next = Math.min(limit, position + dt / SLOT_SECONDS);
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
