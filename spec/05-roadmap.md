# 05 — Roadmap and status

## Status on 2026-11-10 (Tuesday)

**Delivery: in about a month** (Lucas, 2026-11-10), so around 2026-12-10. The exact date and what is handed in are not confirmed.

Done today:

- [x] Read the two sister projects (`../CV-AI`, `../Debate-ai`) for structure, stack, workflow and lessons.
- [x] Looked up current versions on npm, Groq's model list and limits, and the size of two browser embedding models (`04-stack-and-versions.md`).
- [x] Wrote this spec and `CLAUDE.md`.
- [x] Public repository `lkzppm/ragui`, branches `main` and `dev`.
- [x] Read the assignment (`Trab Final.zip`): the statement and the contract. The contract is the sample, the statement's four questions are the acceptance test (`00-overview.md`, and "The assignment's document" in `02-rag-pipeline.md`).
- [x] Three decisions by Lucas: the contract may be published (it is in `public/samples/`), the interface is bilingual, and **the product is a sandbox for any subject**, with the contract as one preset (`00-overview.md`, "A sandbox for any subject").
- [x] **Scaffold**: the Next.js app with both themes and both languages, the landing page, the lab's skeleton (the pipeline rail and the stage inspector), the typed trace, the settings object, the stages as data, the sample sandbox, CI. What it contains: `01-architecture.md`, "As scaffolded"; what it looks like: `03-ui-design.md`, "As scaffolded".
- [x] Branch rules on GitHub, as in Debait: `main` takes changes only through a pull request with the CI check green; `dev` needs the CI check; neither can be deleted or force-pushed. Auto-merge and delete-branch-on-merge are on.

Not done:

- [ ] No stage of the pipeline computes anything. No embedder, no store, no route.
- [ ] No Vercel project.

What was actually run, and what was not:

| | State |
|---|---|
| `pnpm lint`, `pnpm typecheck`, `pnpm build` | pass locally and in CI |
| `pnpm dev`: `/`, `/lab`, an unknown address, the sample PDF, the icon | 200, 200, 404, 200, 200 |
| The pages on screen | seen by Claude in headless Chromium: `/lab` at 1440px and 390px (light) and 1280px (dark), `/` at 1440px (light), in Portuguese. **Not seen**: a real browser, a real phone, the English text, the switches being clicked. **Not seen by Lucas at all** |
| The contract | read by Claude as a PDF, and its text extracted once with `pdftotext` to count characters and find odd glyphs. **Not yet read with `unpdf`**, which is what the app will use and may extract differently |
| The four expected answers | read from the contract by Claude; not produced by any pipeline |
| `@huggingface/transformers` v4 in a browser worker or in Node | **never run** by this family of projects; not installed |
| The embedding models | sizes read from Hugging Face; **never loaded**. That `multilingual-e5-small` separates the three addresses or the two CPFs of the contract is a hope, not a result |
| Groq | models and limits read from the docs pages; **no call made** for this project |
| Every default in `DEFAULT_SETTINGS` (chunk size, `k`, `λ`, the token budget) | **placeholders**, reasoned from the document's size, not measured. The gate threshold is `null`: not calibrated |

## Build order (Proposed)

About four weeks. The order puts the risky unknowns first and the look last, because the look is what Lucas refines himself and what was redone in both sister projects. Steps 1 to 4 answer the assignment in a terminal; steps 5 to 9 make it visible; step 10 is what makes it a sandbox and must not be left for the last days.

1. **Spike the embedder**: `@huggingface/transformers` in a Web Worker under Next 16, one sentence in, one vector out, with download progress. Then the same under `tsx`. If this does not work, the architecture changes, so it comes before anything else.
2. **The core in `src/lib/rag/`**, driven from the terminal (`pnpm rag`): load the contract with `unpdf`, clean, chunk, dense, BM25, RRF, MMR, gate, assemble, PCA, and the two `run-*` functions that return a trace. No interface yet.
3. **`pnpm rag eval`**: a sandbox's test questions against its documents. On the sample, tune chunking, `k` and the context size until all four answers are in the context, and note which settings fail and why: those failures are the material for the presentation.
4. **Generation**: `/api/answer` and `pnpm rag ask --answer`. First call to Groq. The four questions answered end to end, with citations and the verify step. **At this point the assignment is met.**
5. **The store**: zustand and IndexedDB; the sample sandbox indexed in the browser; the trace on the lab page as plain text; a question field. Ugly on purpose.
6. **`<Pipeline>` and the transport**: the rail comes alive (states, counts, durations, packets, stale stages), the playhead, play, pause, step, scrub.
7. **`<Retriever>`**: the ranking race and the score breakdown first (they carry the demo on a small document), then the map, the context tray and the test panel.
8. **The answer panel**: streaming, citation chips linked to chunks, the prompt inspector, the gate-failed state.
9. **The stage views**: the chunked text with its boundaries, the vector strips, the settings as controls in each inspector.
10. **Sandboxes**: make one, name it, drop documents or paste text, write its instructions and its test questions, switch between them, copy the sample, delete, export to a file and import. Defaults for larger documents.
11. **Visual pass** with Lucas: palette, type, both themes, the landing page and its live figure.
12. **Phone layout, reduced motion, the projector check.**
13. **Vercel**: project, env vars, production on `main`.
14. **README** with the walkthrough and the four answers, and whatever has to be handed in.

## Open questions for Lucas

1. **What "deploy" means for a sandbox.** Read so far as: build and test a RAG here, then take it out as a file (settings, test questions, instructions). Did you mean more, for example a link that opens someone's sandbox, or a page that only shows the chat for a sandbox, without the lab?
2. **The exact delivery date, and what is handed in** (a link, the code, a report, a presentation in class).
3. **The other four parts** of the final project (classification, sentiment, regression, clustering): elsewhere, presumably notebooks. Nothing about them belongs here unless you want it to.
4. **The public endpoint**: is an optional access code enough to protect the free-tier key, or should generation ask each visitor for their own Groq key? For a sandbox meant for anyone, their own key is the option that scales.
5. **Unit tests** on `src/lib/rag/`: the four questions make an obvious one. Wanted, or none as in Debait?
6. **The name**: RAGui, or something else before the Vercel URL is taken?

Settled on 2026-11-10: the sample (the contract, published), the default embedding model (multilingual, by the assignment's language), the interface languages (Portuguese and English), the product's shape (a sandbox for any subject), the delivery window (about a month).

## Risks

| Risk | What to do about it |
|---|---|
| The embedder does not bundle or run in the worker under Next 16 | Step 1 is first for this reason. Fallback: load `@huggingface/transformers` from its CDN build inside the worker |
| The sandbox part is left for the end and the app ships as a demo of one contract | Keep the rule from day one: the contract is a preset and nothing else names it. Step 10 has a place in the order, not "if there is time" |
| Retrieval looks pointless on a three-page document that fits in the prompt | Keep the sample's context far smaller than the document (4 sources, 500 tokens), say so openly, and show a second sandbox with a long document, where the same pipeline is needed |
| A question is answered from the wrong block (the landlord's CPF for the tenant's, the tenant's home for the property) | This is the assignment's real difficulty. The test panel shows which chunk was retrieved; chunking by heading keeps "LOCATÁRIA" with her CPF; the prompt asks for the cited source; check the four by hand before every demo |
| `unpdf` extracts the contract differently from `pdftotext` (order, glyphs, line breaks) | Step 2 starts by diffing the two extractions |
| Other people's documents break assumptions made on the contract (scanned PDFs with no text, very long files, other languages) | Say what is not supported instead of failing silently: a PDF with no extractable text is reported as such; a size limit per sandbox with the reason shown |
| 118 MB on classroom Wi-Fi during a live demo | Open the site beforehand so the model is cached; a recorded backup |
| The free tier runs out in front of the class | The gate, the small budget, and the fact that everything but the last sentence needs no model |
| The animation drifts from the truth (a hand-tuned effect that no longer matches the numbers) | Principle 2: views draw `(trace, playhead)` and nothing else |
