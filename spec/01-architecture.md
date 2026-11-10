# 01 — Architecture

Status on 2026-11-10: **nothing built**. Everything here is Proposed unless marked Decided.

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
| `corpora` | id | a named set of documents with its settings (one corpus at first; several is an idea) |

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
    embed/
      worker.ts  client.ts  models.ts        transformers.js behind one async function
    store/                                   IndexedDB + the zustand lab store
    brand.ts  utils.ts
  components/
    pipeline/                                the stage rail and its packets
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
