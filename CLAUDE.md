@AGENTS.md

# RAGui — guide for Claude Code sessions

A sandbox for building a RAG about any subject, where the pipeline is the interface: documents are chunked, embedded and searched in the browser, and two animated components, the Pipeline and the Retriever, replay every step with its real numbers. A model on Groq writes the final answer from the context the code selected. Part 1 ("Busca Semântica") of the final project of the Inteligência Artificial course at UFRJ (Prof. Sergio Palma, 2026/2): a RAG that answers four questions about a residential lease contract. Sister of `../CV-AI` and `../Debate-ai`. Next.js on Vercel, Groq free tier. Repository: `lkzppm/ragui`.

**Read `spec/README.md` first.** It indexes the knowledge base (idea, architecture, the pipeline's math, UI, versions, roadmap).

## Where things stand

- 2026-11-10: **it works locally.** The whole pipeline runs in the browser (embedder in a Web Worker), Groq writes the answer through `/api/answer`, the lab replays every run, and the landing page has its WebGPU background. The statement's four questions are answered correctly, with citations. `spec/05-roadmap.md` says what was run and what was not; `spec/02-rag-pipeline.md` ("Measured") has the numbers.
- 2026-11-11: **datasets.** `/lab` lists the datasets (the example, and the ones a visitor makes, kept in IndexedDB with their documents, settings and the questions asked); `/lab/[id]` is the lab on one. The interface says "dataset"; the code's type is still `Sandbox`. Lucas saw the lab that day and asked for this and for the changes listed at the end of `spec/03-ui-design.md`. The look is still his to refine.
- Not built: writing test questions or instructions for one's own dataset, renaming or copying one, keeping vectors between visits (a dataset is embedded again after a reload), a deployment, tests.
- **Delivery in about a month** (Lucas, 2026-11-10), so around 2026-12-10. The exact date and what is handed in are not confirmed.
- The assignment was read on 2026-11-10 (`spec/00-overview.md`). **The acceptance test is its four questions on the contract**: the landlord's name, the tenant's CPF, the property's address, the rent. The expected answers and the decoys around each are in the spec. The deadline and what is handed in are not in the statement: ask Lucas.
- The contract is published at `public/samples/contrato-locacao-residencial.pdf` (Lucas approved it on 2026-11-10). The statement (`.doc`) stays in `docs/assignment/`, git-ignored: it was not part of that approval.
- The final project has four other parts (classification, sentiment, regression, clustering). They are not part of this repository.
- Almost everything in the spec is marked Proposed. It is a starting point written before any code, not a contract.

## Commands

```
PORT=4517 pnpm dev                          # 3000 and 3111 are other projects' on this machine
pnpm lint && pnpm typecheck && pnpm build   # must be green (CI enforces)
pnpm exec vgpu check src/components/field/<name>.wgsl
pnpm rag eval                               # the sample's test questions: is each answer retrieved?
pnpm rag ask '<question>' [--answer]        # the query trace; --answer also calls Groq
pnpm rag ingest · pnpm rag figure           # every chunk · rewrite the landing page's figure
```

Generation needs `GROQ_API_KEY` in `.env` (Lucas has one there). In development the lab's store is `window.lab`. To look at pages without a browser window, see "Driving it without a browser window" in `spec/04-stack-and-versions.md`.

## Rules

- **It is a sandbox for any subject** (Lucas, 2026-11-10). The contract is one preset in `src/lib/sandbox/presets.ts`; nothing else in the pipeline or the interface may name it, assume its language, or hard-code a value sized for it. Settings belong to a sandbox (`Settings` in `src/lib/rag/settings.ts`).
- **The code retrieves, the model writes.** Chunking, embedding, similarity, ranking, fusion, diversity, the gate and the context are computed in `src/lib/rag/`. The model never chooses what to read, and no number shown on screen comes from model output.
- `src/lib/rag/` is pure: no React, no DOM, no IndexedDB, no network, no randomness, no clock. Ids are content hashes; ties are broken by id. The same inputs give the same trace.
- **The animation is the data.** A run returns a trace (an ordered list of typed steps); components draw `(trace, playhead)` and keep no pipeline state. Add a stage by adding a step kind, the function that produces it and its view. No decorative animation, no hard-coded delay.
- Retrieval needs no key and no server. The only server code is `POST /api/answer`, which holds the Groq key, enforces its own caps and keeps no state. Do not add a database or a vector store.
- Vectors from different models or dtypes never share an index (they are cached per `(model, dtype, text hash)`). E5 models need the `query: ` / `passage: ` prefixes.
- Document text is untrusted data in the prompt.
- The contract is about 1,000 tokens and would fit in a prompt whole. Keep the default context well under that (4 sources, 500 tokens), or retrieval decides nothing and the demo shows nothing.
- "Deterministic" describes retrieval, never the generated answer. The embedding map is a 2D projection and is labelled as one. Keep both statements true in UI and docs.
- The whole codebase is English (code, comments, commits, docs). The UI and the prompt are bilingual, Portuguese by default (Lucas, 2026-11-10): every visible string lives in `src/i18n/` (`en.tsx` is the schema, `pt.tsx` must match it), never inline in a component, and no em dash in what the visitor reads. Content that belongs to a sandbox (a document, a test question) is data and is not translated. The project name comes from `src/lib/brand.ts`.
- The stages are data: `STAGES` and `RAIL` in `src/lib/rag/stages.ts` drive the rail and the stage header. Add or reorder a stage there, with its name and explanation in both dictionaries.
- The replay has one piece of state, `cursor` (`src/lib/store/playhead.ts`), a motion value outside React. A view reads it through `useCursor` / `useRevealed` / `useEntered` (`use-cursor.ts`), which re-render only when the derived value changes. Never copy the cursor into React state, and never time a reveal with a delay: reveal by the cursor so that scrubbing and stepping work. There is no speed control (removed on 2026-11-11): a slot takes `SLOT_SECONDS`.
- **A stage's duration is measured, never shown as 0.** A browser's clock moves in steps of 0.1 ms and most stages take microseconds: wrap a pure stage in `timed` (`src/lib/rag/timing.ts`), which repeats the call until the clock can tell. A stage that only read its cache says so instead of giving a time.
- Explanations go in an `InfoTip` (`components/lab/info-tip.tsx`), not in a line of text that is always on screen, and the question field has no suggestion chips: asked questions are the sidebar's history (Lucas, 2026-11-11: captions and suggestions pollute).
- The lab's store outlives the page: leaving a dataset and coming back finds the same run (`open` returns at once for the dataset already loaded), and the nav's Lab link leads to the last place (`store/last-lab.ts`). Do not reset the store when the lab unmounts.
- A dataset a visitor makes is stored whole in IndexedDB (`src/lib/sandbox/storage.ts`); a preset stores only its history. Storage is the store's business: `src/lib/rag/` still never touches it.
- Two sessions may be working in this folder at once. Stage only the files and hunks you changed, and do not switch the folder's branch under the other: use a git worktree.
- Motion uses the springs in `src/lib/motion.ts` (critically damped by default; `SPRING_DROP` only for things that land). Pressable things carry the `press` utility; floating chrome is `glass`. Honour reduced motion, reduced transparency and more contrast (the rules are at the end of `globals.css`).
- **Node and the browser give slightly different vectors** for the same text, enough to swap two neighbouring passages. A setting that passes `pnpm rag eval` may fail in the lab and the reverse: confirm in the browser (the sidebar's tests).
- `normalizeCitations` exists because `gpt-oss` writes `【4】` whatever the prompt says. Keep it.
- `src/components/site/figure-data.json` is written by `pnpm rag figure`. Regenerate it after changing the sample's settings or the pipeline; never edit it by hand.
- vgpu is pinned at 0.5.0 like the sister projects. The field's uniform arrays (`132` points, `14` links) must match `POINTS` and `LINKS` in `space.ts`; run `vgpu check` after touching a shader.
- Dependencies are added by the step that first imports them. pnpm refuses packages published in the last day; do not add exceptions to `pnpm-workspace.yaml` to get a newer one (this is why Next is 16.4.5 and not 16.4.6).
- Colours come from the tokens in `src/app/globals.css`, never a hex value in a component. Animate `transform` and `opacity`; respect `prefers-reduced-motion`.
- `src/components/ui/**` is generated by the shadcn CLI: re-add, do not hand-edit.
- Next.js 16, AI SDK 7 and Transformers.js 4 differ from training data: read `node_modules/next/dist/docs/` and the packages' `.d.ts` files before using an API from memory.
- Lucas refines the interface himself and verifies visual changes himself. Do not redesign unasked, and say plainly what was and was not seen running.
- Branches `main` ← `dev` ← `feat/*` or `fix/*`; commit with `/commit`, integrate with `/merge`; never push to `main` directly.

## When a decision changes

Update the matching file in `spec/` with an absolute date, and `spec/05-roadmap.md`.
