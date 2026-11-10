# 05 — Roadmap and status

## Status on 2026-11-10 (Tuesday)

Done today:

- [x] Read the two sister projects (`../CV-AI`, `../Debate-ai`) for structure, stack, workflow and lessons.
- [x] Looked up current versions on npm, Groq's model list and limits, and the size of two browser embedding models (`04-stack-and-versions.md`).
- [x] Wrote this spec and `CLAUDE.md`.
- [x] Public repository `lkzppm/ragui`, branches `main` and `dev`.

Not done:

- [ ] **The course file on Google Drive was not read** (`00-overview.md`). Deadline, deliverables and any required corpus are unknown.
- [ ] No code, no scaffold, no CI, no Vercel project.

What was actually run, and what was not:

| | State |
|---|---|
| Any code of this project | does not exist |
| `@huggingface/transformers` v4 in a browser worker or in Node | **never run** by this family of projects |
| The embedding models | sizes read from Hugging Face; **never loaded** |
| Groq | models and limits read from the docs pages; **no call made** for this project |
| Every default in `02-rag-pipeline.md` (chunk size, `k`, `λ`, the gate threshold, the token budget) | **placeholders**, not measured |
| The design in `03-ui-design.md` | **not seen by Lucas** |

## Build order (Proposed)

The order puts the two risky unknowns first and the look last, because the look is what Lucas refines himself and what was redone in both sister projects.

1. **Read the assignment.** Put the Drive file in `docs/`, rewrite the first section of `00-overview.md`, and re-check the spec against it.
2. **Scaffold**: Next.js (latest), Tailwind, shadcn, Geist, motion, zustand; CI (lint, types, build); the rulesets on `main` and `dev`; `.env.example`; `@AGENTS.md` at the top of `CLAUDE.md`.
3. **Spike the embedder**: `@huggingface/transformers` in a Web Worker under Next 16, one sentence in, one vector out, with download progress. Then the same under `tsx`. If this does not work, the architecture changes, so it comes before anything else.
4. **The core in `src/lib/rag/`**, driven from the terminal (`pnpm rag`): clean, chunk, dense, BM25, RRF, MMR, gate, assemble, PCA, and the two `run-*` functions that return a trace. No interface yet.
5. **The store and a plain lab page**: drop a file, see the trace as text, ask a question, see the hits. Ugly on purpose.
6. **`<Pipeline>` and the transport**: the rail, the playhead, packets, stale stages.
7. **`<Retriever>`**: the map, then the ranking race, then the context tray, then the score breakdown.
8. **Generation**: `/api/answer`, streaming, citations, the verify step, the prompt inspector. First call to Groq.
9. **The sample corpus and its example questions**; tune the defaults on it, the gate threshold first.
10. **Visual pass** with Lucas: palette, type, both themes, the landing page and its live figure.
11. **Phone layout, reduced motion, the projector check.**
12. **Vercel**: project, env vars, production on `main`.
13. **README** with the walkthrough, and whatever the assignment asks to hand in.

## Open questions for Lucas

1. **The Drive file**: what is in it, and when is the delivery? Drop a copy in `docs/`.
2. **The sample corpus**: the course's own material (if the Drive file is documents, that settles it), or neutral public texts? It should be in the language of the presentation and small enough to embed in under a minute.
3. **The default embedding model**: multilingual (118 MB to download on first visit, works in Portuguese) or the light English one (23 MB)? Proposed: multilingual by default, with the light one a click away.
4. **Language**: bilingual with Portuguese by default, as in Debait, or one language only?
5. **The public endpoint**: is an optional access code enough to protect the free-tier key, or should generation ask each visitor for their own Groq key?
6. **Unit tests** on `src/lib/rag/`: wanted for this project, or none as in Debait?
7. **The name**: RAGui, or something else before the Vercel URL is taken?

## Risks

| Risk | What to do about it |
|---|---|
| The assignment asks for something this spec does not (a given corpus, a given tool, a written report format) | Read it before step 2 |
| The embedder does not bundle or run in the worker under Next 16 | Step 3 is first for this reason. Fallback: load `@huggingface/transformers` from its CDN build inside the worker |
| 118 MB on classroom Wi-Fi during a live demo | Open the site beforehand so the model is cached; the light model as a switch; a recorded backup |
| Animating many points and cards drops frames on a projector laptop | Canvas for the map, `transform` and `opacity` only, an "instant" speed |
| The free tier runs out in front of the class | The gate, the small budget, and the fact that everything but the last paragraph needs no model |
| The animation drifts from the truth (a hand-tuned effect that no longer matches the numbers) | Principle 2: views draw `(trace, playhead)` and nothing else |
