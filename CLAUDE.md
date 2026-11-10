@AGENTS.md

# RAGui — guide for Claude Code sessions

A sandbox for building a RAG about any subject, where the pipeline is the interface: documents are chunked, embedded and searched in the browser, and two animated components, the Pipeline and the Retriever, replay every step with its real numbers. A model on Groq writes the final answer from the context the code selected. Part 1 ("Busca Semântica") of the final project of the Inteligência Artificial course at UFRJ (Prof. Sergio Palma, 2026/2): a RAG that answers four questions about a residential lease contract. Sister of `../CV-AI` and `../Debate-ai`. Next.js on Vercel, Groq free tier. Repository: `lkzppm/ragui`.

**Read `spec/README.md` first.** It indexes the knowledge base (idea, architecture, the pipeline's math, UI, versions, roadmap).

## Where things stand

- 2026-11-10: the spec and **the scaffold** exist: the Next.js app, both themes, both languages, the landing page, the lab's skeleton with the pipeline rail and the stage inspector, the typed trace and settings, the sample sandbox, CI. **No pipeline code runs yet**: no chunker, no embedder, no search, no route, no deployment. `spec/05-roadmap.md` has the build order.
- **Delivery in about a month** (Lucas, 2026-11-10), so around 2026-12-10. The exact date and what is handed in are not confirmed.
- The assignment was read on 2026-11-10 (`spec/00-overview.md`). **The acceptance test is its four questions on the contract**: the landlord's name, the tenant's CPF, the property's address, the rent. The expected answers and the decoys around each are in the spec. The deadline and what is handed in are not in the statement: ask Lucas.
- The contract is published at `public/samples/contrato-locacao-residencial.pdf` (Lucas approved it on 2026-11-10). The statement (`.doc`) stays in `docs/assignment/`, git-ignored: it was not part of that approval.
- The final project has four other parts (classification, sentiment, regression, clustering). They are not part of this repository.
- Almost everything in the spec is marked Proposed. It is a starting point written before any code, not a contract.

## Commands

```
pnpm dev                                    # no configuration needed
pnpm lint && pnpm typecheck && pnpm build   # must be green (CI enforces)
```

Planned, not written yet:

```
pnpm rag ingest <file>                      # the ingestion trace in the terminal
pnpm rag ask '<question>' [--answer]        # the query trace; --answer also calls Groq
pnpm rag eval                               # the four questions on the contract: is each answer retrieved?
```

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
- The stages are data: `STAGES` and `RAIL` in `src/lib/rag/stages.ts` drive the rail and the inspector. Add or reorder a stage there, with its name and explanation in both dictionaries.
- Dependencies are added by the step that first imports them. pnpm refuses packages published in the last day; do not add exceptions to `pnpm-workspace.yaml` to get a newer one (this is why Next is 16.4.5 and not 16.4.6).
- Colours come from the tokens in `src/app/globals.css`, never a hex value in a component. Animate `transform` and `opacity`; respect `prefers-reduced-motion`.
- `src/components/ui/**` is generated by the shadcn CLI: re-add, do not hand-edit.
- Next.js 16, AI SDK 7 and Transformers.js 4 differ from training data: read `node_modules/next/dist/docs/` and the packages' `.d.ts` files before using an API from memory.
- Lucas refines the interface himself and verifies visual changes himself. Do not redesign unasked, and say plainly what was and was not seen running.
- Branches `main` ← `dev` ← `feat/*` or `fix/*`; commit with `/commit`, integrate with `/merge`; never push to `main` directly.

## When a decision changes

Update the matching file in `spec/` with an absolute date, and `spec/05-roadmap.md`.
