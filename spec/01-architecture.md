# 01 — Architecture

Status on 2026-11-11: **built and running locally**: every stage of the pipeline, the embedder in a Web Worker, the answer route, the lab that replays a run, the landing page, and datasets kept in the browser. What is described before "As built" is the design; where the code went another way, "As built" and "Changed on 2026-11-11" (the last section) say so.

## What runs where

```
BROWSER                                                         VERCEL
┌───────────────────────────────────────────────────────┐      ┌─────────────────────┐
│ files / pasted text                                   │      │ POST /api/answer    │
│   └─ load ─ clean ─ chunk ─┐                          │      │  fixed prompt       │
│                            ├─ embed (Web Worker,      │      │  template + caps    │
│ question ──────────────────┘   transformers.js)       │      │  streamText → Groq  │
│   └─ dense search ┐                                   │      └──────────▲──────────┘
│   └─ sparse search├─ fuse ─ diversify ─ gate ─ assemble ── question + sources ──┘
│                                                       │◀──── answer, streamed ────
│ IndexedDB: documents, chunks, vectors, settings       │
│ Trace ──▶ <Pipeline> <Retriever> <Answer>             │
└───────────────────────────────────────────────────────┘
```

- **The browser does the RAG.** Parsing, chunking, embedding, both searches, fusion, diversity, the gate and the context assembly are pure TypeScript in `src/lib/rag/`. The embedding model runs in a Web Worker with `@huggingface/transformers` so the page never freezes.
- **The server does one thing**: `POST /api/answer` takes the question and the already selected sources, builds the prompt from a fixed template, and streams the answer from Groq through the AI SDK. It holds the key and nothing else. No database, no session, no vector store.
- **Why not embed on the server** (Decided by the facts, 2026-11-10): Groq's model list has no embedding model (`04-stack-and-versions.md`), so a server embedder would mean a second provider and a second key, or a 23 to 118 MB model loaded inside a serverless function on every cold start. In the browser the model is downloaded once and cached, retrieval costs nothing, and the vectors are right there to draw.
- **Why no vector database**: a corpus of a few thousand chunks at 384 dimensions is a few megabytes and a brute-force scan of it takes milliseconds. Exact search is also the one that can be explained on screen without caveats.

## The trace

The idea the whole interface hangs on, taken from Debait's event log.

Every run of the pipeline returns a `Trace`: an ordered list of steps. A step is plain data with a `kind`, its inputs, its outputs and how long it took.

```ts
type Step =
  | { kind: "load";      doc: DocRef; chars: number; ms: number }
  | { kind: "clean";     doc: DocRef; removed: number; ms: number }
  | { kind: "chunk";     doc: DocRef; strategy: ChunkSettings; chunks: ChunkRef[]; ms: number }
  | { kind: "embed";     model: ModelRef; embedded: ChunkRef[]; cached: ChunkRef[]; ms: number }
  | { kind: "index";     chunks: number; dims: number; projection: Projection; ms: number }
  | { kind: "query";     text: string; tokens: number; vector: Float32Array; ms: number }
  | { kind: "dense";     hits: Hit[]; scanned: number; ms: number }
  | { kind: "sparse";    terms: TermStat[]; hits: Hit[]; ms: number }
  | { kind: "fuse";      method: "rrf"; k: number; hits: FusedHit[]; ms: number }
  | { kind: "diversify"; lambda: number; kept: Hit[]; dropped: DroppedHit[]; ms: number }
  | { kind: "gate";      best: number; threshold: number; pass: boolean }
  | { kind: "assemble";  sources: Source[]; tokens: number; budget: number; left_out: Hit[] }
  | { kind: "generate";  model: string; usage: Usage | null; ms: number }
  | { kind: "verify";    citations: CitationCheck[]; uncited: number[] };
```

(The exact fields are settled when the code is written; the shape is the point.)

- There are two traces: the **ingestion trace** (load to index), produced when the corpus or the chunk settings change, and the **query trace** (query to verify), produced on each question.
- The pipeline computes in milliseconds; the interface **replays** the trace at a speed a person can follow. A playhead (a step index plus a progress within the step) is the only animation state. Play, pause, step forward and back, scrub and speed all move the playhead.
- A component receives `(trace, playhead)` and draws. It keeps no pipeline state of its own. To add a stage: add a step kind, the function that produces it, and its view.
- Generation is the one step that is live instead of replayed: its tokens arrive as they are streamed.

## Data model

All in the browser, in IndexedDB (documents and vectors are too large for `localStorage`). Settings and the last question go in `localStorage`.

| Store | Key | Value |
|---|---|---|
| `documents` | `docId` (hash of the content) | name, type, clean text, size, added at |
| `chunks` | `chunkId` | docId, start and end offsets, text, token count, the settings that produced it |
| `vectors` | `(modelId, dtype, textHash)` | `Float32Array(384)`, L2-normalised |
| `sandboxes` | id | a named RAG: its document ids, its settings, its test questions, its instructions (`Sandbox` in `src/lib/sandbox/types.ts`). The sample one is built into the code and is not stored |

- **Ids are content hashes**, never counters or random values, so the same input gives the same ids on any machine and a trace can be compared between runs. `chunkId = hash(docId, start, end)`.
- **Vectors are cached by the text they embed**, per model and dtype. Changing the chunk size re-embeds only the chunks whose text is new, and the embed step reports how many came from the cache.
- Views of the store used by the functions are plain arrays and typed arrays; `src/lib/rag/` never touches IndexedDB or the DOM.

## The server route

`POST /api/answer` (Node runtime, streaming).

- **Body**: `{ question, sources: [{ n, title, text }], locale }`.
- **Caps enforced on the server**, whatever the client sends: at most 8 sources, a character limit per source and for the question, `maxOutputTokens` set explicitly, `temperature: 0`, a fixed `seed`. The system prompt is a server-side template (`src/lib/rag/prompt.ts`, shared with the client so the prompt inspector shows exactly what is sent).
- **Source text is untrusted data.** A document may say "ignore your instructions"; the template wraps each source and says so (`02-rag-pipeline.md`).
- **No key**: the route answers 503 with a code the client turns into a labelled notice ("generation is off: no Groq key"). The rest of the app is unaffected. There is no mock answer.
- **Abuse** (open question in `05-roadmap.md`): the route is public and the key is on a free tier. Proposed first line of defence: the caps above plus an optional `ACCESS_CODE` env var that the client must send. A per-IP rate limit needs a store (Upstash, as in Debait) and is only worth adding if the app is shared widely.

## Folder tree (Proposed)

```
src/
  app/
    layout.tsx  globals.css  page.tsx        landing: name, one sentence, a live figure
    lab/page.tsx                             the app
    api/answer/route.ts                      the only server code
  lib/
    rag/                                     pure, no React, no DOM, no IndexedDB
      types.ts  hash.ts  tokenize.ts
      clean.ts  chunk.ts
      similarity.ts  dense.ts  bm25.ts
      rrf.ts  mmr.ts  gate.ts  assemble.ts
      prompt.ts  verify.ts  project.ts (PCA)
      run-ingest.ts  run-query.ts            compose the steps, return a Trace
      settings.ts  stages.ts                 every knob in one object; the stages as data
      eval.ts                                a sandbox's test questions, graded by code
    embed/
      worker.ts  client.ts  models.ts        transformers.js behind one async function
    sandbox/                                 the Sandbox type and the bundled sample (presets.ts)
    store/                                   IndexedDB + the zustand lab store
    brand.ts  utils.ts  use-theme.ts
  components/
    pipeline/                                the stage rail and its packets
    lab/                                     the lab page: panels, the stage inspector, the sandbox switcher
    retriever/                               embedding map, ranking race, fusion, context tray
    corpus/                                  drop zone, document list, chunk view, vector strip
    answer/                                  streamed answer, citations, prompt inspector
    transport/                               play, pause, step, scrub, speed
    site/                                    nav, footer, theme and language switches
    ui/                                      shadcn, generated: re-add, never hand-edit
  i18n/                                      en.tsx (schema), pt.tsx
scripts/                                     the pipeline in the terminal (tsx)
spec/  docs/
```

## Decisions

| Date | Decision | Why |
|---|---|---|
| 2026-11-10 | Retrieval runs in the browser; the server only generates | Lucas wants the deterministic part to be the subject; no embedding model on Groq; nothing to pay or protect for retrieval; the data to animate is already on the client |
| 2026-11-10 | Exact brute-force search, no approximate index | Deterministic and explainable; fast enough at this size |
| 2026-11-10 | The interface is a replay of a trace | Makes "show what is happening" literal and keeps animation state out of the pipeline |
| 2026-11-10 | Content-hash ids, vectors cached by text | Reproducible runs; cheap re-chunking |
| 2026-11-10 | One stateless route, no database | Fits Vercel's free plan; nothing to operate |
| 2026-11-10 | The assignment's contract is the preloaded corpus and its four questions a golden set graded by code | The statement fixes both; it gives retrieval a pass or fail that needs no model |
| 2026-11-10 | The default context is smaller than the document | The contract fits in a prompt whole; otherwise retrieval would decide nothing |
| 2026-11-10 | The unit of the app is a sandbox; the contract is a preset | Lucas: generic use, "like a sandbox". Keeps everything about the assignment in one file |
| 2026-11-10 | All settings in one plain object owned by the sandbox (`Settings`) | The pipeline reads nothing else, so a sandbox can be exported and a run reproduced |
| 2026-11-10 | The stages are data (`STAGES`, `RAIL` in `stages.ts`) | The rail, the inspector and later the replay read one list; a stage is added in one place |

## As built (2026-11-10)

### The pipeline (`src/lib/rag/`, pure)

- `types.ts`: the trace and everything it refers to. Ingest steps are aggregated over the documents (one `load`, one `clean`, one `chunk`), not one per document as first sketched. `Runtime` hands the functions what they may not have themselves: the embedder, a clock and the vector cache.
- `clean.ts`, `chunk.ts`, `tokenize.ts`, `bm25.ts`, `dense.ts`, `rrf.ts`, `mmr.ts`, `assemble.ts`, `prompt.ts`, `verify.ts`, `project.ts` (PCA), `eval.ts` (grades a query against a test question), `hash.ts`, `similarity.ts`.
- `run-ingest.ts` and `run-query.ts` compose them and return the trace. The query trace ends at `assemble` (or at `gate` when it closes); the lab appends `generate` and `verify` once the answer has arrived.
- `settings.ts`: `Settings`, `DEFAULT_SETTINGS` (where a new sandbox starts) and `RANGES` (what each control may be set to). `stages.ts`: the 14 stages and the rail's 13 slots.

### Around it

- `src/lib/embed/`: `core.ts` (load the model, embed, count tokens; shared), `worker.ts` + `browser.ts` (the Web Worker and its promise-based client), `node.ts` (the same model in-process for the scripts), `models.ts` (dimensions, token limits, the E5 prefixes).
- `src/lib/load/pdf.ts`: text out of a PDF with `unpdf`, in the browser and in Node.
- `src/lib/answer/`: `groq.ts` (the one model call, server only), `protocol.ts` (what the route streams: the text, then U+001E, then one JSON object with the model, the token usage and why it stopped, or the error).
- `src/app/api/answer/route.ts`: `GET` says whether generation is available and with which model; `POST` validates with zod, builds the prompt with `buildPrompt` and streams. Generation settings are the server's, never the client's.
- `src/lib/sandbox/`: `Sandbox`, and the `lease` preset with its measured settings, the statement's four questions and three more examples.
- `scripts/rag.mts`: `pnpm rag ingest | eval | ask | figure`.

### The replay (`src/lib/store/`)

- `playhead.ts`: `cursor`, a motion value, is a position along the 13 slots (a slot's number plus how far into it). It is the only animation state.
- `lab.ts` (zustand): the sandbox, its documents and index, both traces, the answer, the test results, and the transport (`limit` is how far the cursor may go: nothing beyond it has been computed). `startPlayback()` is the frame loop that moves the cursor toward the limit at the chosen speed.
- `use-cursor.ts`: `useCursor` derives a number or a boolean from the cursor and re-renders only when it changes (`useSyncExternalStore`); `useRevealed(slot, total)` is "how many of these rows has this stage shown so far". Views are built from these two.
- Indexing is followed live (the limit rises as each step completes, so no stage is shown before it has happened, and each is on screen for at least its slot's time). A question is computed at once (milliseconds) and then replayed; the model is called in parallel, and the cursor waits inside the generate slot until the stream ends.
- A setting that changes the chunks re-indexes after the control rests for 280 ms; vectors are cached by text, so only new passages are embedded. Any other setting re-runs the search on the spot. Either way the tests are graded again and an answer already on screen is marked as written for an earlier context instead of being silently replaced.

### Interface

`components/pipeline/` (the rail), `components/lab/` (the screen, the sidebar, the stage, the answer panel, the bottom bar), `components/corpus/` (the document with its passages, vector strips), `components/retriever/` (the map, the three rankings, the context tray), `components/field/` (the landing page's WebGPU background), `components/site/` (top bar, footer, landing page and its figure). `03-ui-design.md` describes them.

### Decisions made while building

| Date | Decision | Why |
|---|---|---|
| 2026-11-10 | Ingest steps aggregated over documents | The rail shows one number per stage; per-document steps added nothing on screen |
| 2026-11-10 | The cursor is a motion value outside React; views subscribe to derived values | The cursor changes every frame; a count of revealed rows changes a few times a second |
| 2026-11-10 | The model is called as soon as the context is known, not when the replay reaches that stage | The replay then hides the network wait instead of adding to it |
| 2026-11-10 | The test questions run with the gate off | They grade retrieval; a threshold set too high would hide what the search found |
| 2026-11-10 | Generation settings live on the server | A public route must not let a client raise the output limit or change the model |
| 2026-11-10 | Dependencies load lazily (`@huggingface/transformers` and `unpdf` behind dynamic imports) | Neither is in the landing page's bundle or in the server's |

## Changed on 2026-11-11: datasets, storage, timing

**Routes.** `/lab` is the list of datasets (`components/lab/explorer.tsx`); `/lab/[id]` is the lab on one (`app/lab/[id]/page.tsx` hands the id to `<Lab id>`). An id is a preset's (`lease`) or eight characters of a UUID made in the browser. The server cannot know whether an id exists: the page always renders, and the store answers `missing` when the browser has no such dataset.

**Storage** (`src/lib/sandbox/storage.ts`): one IndexedDB database `ragui`, one object store `sandboxes` keyed by id, holding `StoredSandbox { id, name, preset, docs, settings, history, createdAt, updatedAt }`. A dataset made by a visitor is stored whole (the text of its documents, not the files). A preset stores only its history: its documents and settings come from the app on every open. Without IndexedDB the same functions work on a `Map` for the life of the tab. **Vectors are not stored**: opening a dataset after a reload embeds it again (about a second for the contract; a large dataset would want the cache persisted, which is not built).

**The store** (`src/lib/store/lab.ts`): `open(id)` replaces `boot()`. It resets what belongs to one dataset, reads the record or the preset, loads the embedder if it is not there, and indexes; a dataset with no documents rests in the phase `empty`. Opening the dataset that is already loaded returns at once, so leaving the lab and coming back finds the same run, answer and cursor. `close()` only writes what is unsaved; a stream in flight is left to finish. Saving is debounced (300 ms) and also runs on `pagehide`. `history` is the questions asked, the latest first, at most 50, each with whether the gate let it through. `retry()` opens the same dataset again after a failure.

**The embedder** is loaded once and kept between datasets (`ensureEmbedder`). A download that stops is started again, three tries in all, before the failure is shown with a button to try again; a failed load terminates its worker. Measured in the browser on 2026-11-11: the first visit fetches 135 MB (118 of weights, 17 of tokenizer).

**Timing** (`src/lib/rag/timing.ts`): see `02-rag-pipeline.md`, "Timing". `Runtime` gained `resolution`; `RawDoc` gained `ms` (how long reading it took, measured by whoever read it, which is what the load stage reports); the `query` step gained `cached`.

**Where the visitor was** (`src/lib/store/last-lab.ts`): the last address inside the lab, in memory and in `sessionStorage`. The nav's Lab link points at it.

**New in `src/lib/rag/`**: `neighbours.ts` (`neighboursOf`, `mesh`), pure, used by the map to draw the corpus as a graph.
