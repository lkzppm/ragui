# 05 — Roadmap and status

## Status on 2026-11-10 (Tuesday)

Done today:

- [x] Read the two sister projects (`../CV-AI`, `../Debate-ai`) for structure, stack, workflow and lessons.
- [x] Looked up current versions on npm, Groq's model list and limits, and the size of two browser embedding models (`04-stack-and-versions.md`).
- [x] Wrote this spec and `CLAUDE.md`.
- [x] Public repository `lkzppm/ragui`, branches `main` and `dev`.
- [x] **Read the assignment** (`Trab Final.zip`, supplied by Lucas after the Drive link could not be opened): the statement and the contract. The spec was revised around them the same day: the contract is the default corpus, the statement's four questions are the acceptance test, the chunk and context defaults were cut down to the size of a three-page document, and the multilingual embedder became the default by necessity. Details in `00-overview.md` and in "The assignment's document" in `02-rag-pipeline.md`.

Not done:

- [ ] No code, no scaffold, no CI, no Vercel project.
- [ ] The deadline and what is handed in are not in the statement and are still unknown.

What was actually run, and what was not:

| | State |
|---|---|
| Any code of this project | does not exist |
| The contract | read by Claude as a PDF, and its text extracted once with `pdftotext` to count characters and find odd glyphs. **Not yet read with `unpdf`**, which is what the app will use and may extract differently |
| The four expected answers | read from the contract by Claude; not produced by any pipeline |
| `@huggingface/transformers` v4 in a browser worker or in Node | **never run** by this family of projects |
| The embedding models | sizes read from Hugging Face; **never loaded**. That `multilingual-e5-small` separates the three addresses or the two CPFs of the contract is a hope, not a result |
| Groq | models and limits read from the docs pages; **no call made** for this project |
| Every default in `02-rag-pipeline.md` (chunk size, `k`, `λ`, the gate threshold, the token budget) | **placeholders**, reasoned from the document's size, not measured |
| The design in `03-ui-design.md` | **not seen by Lucas** |

## Build order (Proposed)

The order puts the risky unknowns first and the look last, because the look is what Lucas refines himself and what was redone in both sister projects. Steps 3 to 5 already answer the assignment in a terminal; everything after makes it visible.

1. **Scaffold**: Next.js (latest), Tailwind, shadcn, Geist, motion, zustand; CI (lint, types, build); the rulesets on `main` and `dev`; `.env.example`; `@AGENTS.md` at the top of `CLAUDE.md`.
2. **Spike the embedder**: `@huggingface/transformers` in a Web Worker under Next 16, one sentence in, one vector out, with download progress. Then the same under `tsx`. If this does not work, the architecture changes, so it comes before anything else.
3. **The core in `src/lib/rag/`**, driven from the terminal (`pnpm rag`): load the contract with `unpdf`, clean, chunk, dense, BM25, RRF, MMR, gate, assemble, PCA, and the two `run-*` functions that return a trace. No interface yet.
4. **`pnpm rag eval`**: the four questions against the contract. Tune chunking, `k` and the context size until all four answers are in the context, and note which settings fail and why: those failures are the material for the presentation.
5. **Generation**: `/api/answer` and `pnpm rag ask --answer`. First call to Groq. The four questions answered end to end, with citations and the verify step. **At this point the assignment is met.**
6. **The store and a plain lab page**: the contract preloaded, the trace as text, a question, the hits. Ugly on purpose.
7. **`<Pipeline>` and the transport**: the rail, the playhead, packets, stale stages.
8. **`<Retriever>`**: the ranking race and the score breakdown first (they carry the demo on a small document), then the map, the context tray and the test panel.
9. **The answer panel**: streaming, citation chips linked to chunks, the prompt inspector, the gate-failed state.
10. **Any other document**: the drop zone, pasted text, IndexedDB, larger defaults for larger files.
11. **Visual pass** with Lucas: palette, type, both themes, the landing page and its live figure.
12. **Phone layout, reduced motion, the projector check.**
13. **Vercel**: project, env vars, production on `main`.
14. **README** with the walkthrough and the four answers, and whatever has to be handed in.

## Open questions for Lucas

1. **When is the delivery, and what is handed in** (a link, the code, a report, a presentation in class)? The statement does not say.
2. **May the contract go into the public repository?** The app needs it as its preloaded document (as the PDF in `public/`, or as its text in the code). It is the professor's file with placeholder people and numbers. Until you say so it stays in `docs/assignment/`, git-ignored.
3. **The other four parts** of the final project (classification, sentiment, regression, clustering): elsewhere, presumably notebooks. Nothing about them belongs here unless you want it to.
4. **Language**: bilingual with Portuguese by default, as in Debait, or Portuguese only now that the whole assignment is in Portuguese?
5. **The public endpoint**: is an optional access code enough to protect the free-tier key, or should generation ask each visitor for their own Groq key?
6. **Unit tests** on `src/lib/rag/`: the four questions make an obvious one. Wanted, or none as in Debait?
7. **The name**: RAGui, or something else before the Vercel URL is taken?

Settled on 2026-11-10 by the assignment: the sample corpus (the contract) and the default embedding model (multilingual).

## Risks

| Risk | What to do about it |
|---|---|
| The embedder does not bundle or run in the worker under Next 16 | Step 2 is first for this reason. Fallback: load `@huggingface/transformers` from its CDN build inside the worker |
| Retrieval looks pointless on a three-page document that fits in the prompt | Keep the context far smaller than the document (4 sources, 500 tokens), say so openly, and let the user drop a long document to see the same pipeline at a size where it is needed |
| A question is answered from the wrong block (the landlord's CPF for the tenant's, the tenant's home for the property) | This is the assignment's real difficulty. The test panel shows which chunk was retrieved; chunking by heading keeps "LOCATÁRIA" with her CPF; the prompt asks for the cited source; check the four by hand before every demo |
| `unpdf` extracts the contract differently from `pdftotext` (order, glyphs, line breaks) | Step 3 starts by diffing the two extractions |
| 118 MB on classroom Wi-Fi during a live demo | Open the site beforehand so the model is cached; a recorded backup |
| The free tier runs out in front of the class | The gate, the small budget, and the fact that everything but the last sentence needs no model |
| The animation drifts from the truth (a hand-tuned effect that no longer matches the numbers) | Principle 2: views draw `(trace, playhead)` and nothing else |
