# 05 — Roadmap and status

## Status on 2026-11-10 (Tuesday)

**Delivery: in about a month** (Lucas, 2026-11-10), so around 2026-12-10. The exact date and what is handed in are not confirmed.

**The assignment is met on Lucas's machine**: the four questions of the statement are answered correctly on the contract, each citing the passage that holds the answer, in the browser and in the terminal.

Done today, in order:

- [x] Read the sister projects; looked up versions, Groq's models and limits, embedding model sizes.
- [x] Spec, `CLAUDE.md`, the public repository `lkzppm/ragui` with `main` and `dev`, CI and branch rules.
- [x] Read the assignment; the contract is published as the sample; the product is a sandbox for any subject, bilingual, and "deploy" means the app itself live on Vercel (three decisions by Lucas).
- [x] Scaffold: Next.js, themes, languages, the typed trace, settings, stages as data.
- [x] **The pipeline**: every stage as a pure function, the embedder in a Web Worker, PDF text in the browser, the Groq route, `pnpm rag` in the terminal. Measured on the contract (`02-rag-pipeline.md`, "Measured"); the sample's settings were changed to what the measurements showed (300-character chunks, a gate at 0.82).
- [x] **The lab**: one fixed screen that replays a run (rail, corpus view, retriever view, answer panel, transport, settings that take effect at once, test questions graded by code, documents added by drop or button).
- [x] **The landing page**: three screens, a WebGPU background through vgpu, a figure of real runs.

On 2026-11-11, from Lucas's first look at the landing page:

- [x] The caption under the hero's field is gone. The mark answers the pointer (lines to its four passages, which turn and come closer).
- [x] The second screen's figure explains the pipeline stage by stage, from `STAGES`, `RAIL` and the dictionaries, instead of showing runs of the sample. `pnpm rag figure`, `figure-data.json` and `home-figure.tsx` were removed with it.
- [x] The third screen has an animated background, a page of cells (`cells.wgsl`, a fourth shader in CI's `vgpu check`). Its Portuguese headline says "computado", and so do the two other strings that said "calcula".
- [x] A four-column footer like Debait's, with LinkedIn and the course code `EEL874`.
- Seen by Claude in headless Chromium with WebGPU on, at 1440 px in both themes and both languages and at 390 px: the mark under a synthetic pointer, the figure moving on by itself, holding under the pointer and following it, the cells following the question, the footer; and with reduced motion, the figure staying put and the cells at rest. Not seen: a real browser, a real pointer, how the motion feels.

Not done:

- [x] Lucas saw the lab on 2026-11-11 and asked for a list of changes, built the same day (`03-ui-design.md`, last section). He has not yet seen those.
- [x] Datasets (2026-11-11): the lab opens on a list; a visitor makes, opens and deletes datasets, each kept in IndexedDB with its documents, settings and question history. Still missing: writing test questions and instructions for one's own dataset, renaming and copying, keeping vectors between visits.
- [x] Deployed on 2026-11-11: Vercel project `rag-ui-ufrj`, production from `main`, https://rag-ui-ufrj.vercel.app. Seen by Claude in a fresh browser profile: the datasets screen, the example indexing and its four tests passing, a question retrieved up to the prompt.
- [ ] `GROQ_API_KEY` is not set on Vercel: generation is off on the live site. Lucas adds it; who may spend the quota is still open question 2.
- [ ] No unit tests.

What was actually run, and what was not:

| | State |
|---|---|
| `pnpm lint`, `pnpm typecheck`, `pnpm build`, `vgpu check` on the three shaders | pass |
| `pnpm rag ingest / eval / ask / ask --answer` | ran; the numbers are in `02-rag-pipeline.md` |
| The four questions end to end with Groq (`openai/gpt-oss-120b`) | correct, with valid citations: in the terminal, in the development server and in the production build (`pnpm build && pnpm start`) |
| The lab in a browser | headless Chromium, driven by script: indexing, a question, a closed gate, a settings change with re-indexing from cache, stepping, the language and theme switches, at 1440, 1280 and 390 px, both themes, both languages |
| The landing page | the same way: WebGPU on (animating, following a synthetic pointer, a ring after a click) and off (the still frame) |
| A first visit that downloads the model in the browser | seen on 2026-11-11 in a fresh profile: 135 MB, ready in 10 s on a fast connection. An earlier try the same day failed at 102 of 135 MB after six minutes ("network error"), which is why a stopped download is now retried three times and the failure has a button |
| A real browser, a real phone, touch, Safari, Firefox | **not run** |
| Dropping or picking a file to add a document | **not run** (the code path shares `readDoc` and `reindex` with the sample, which run) |
| A PDF other than the contract; a long document; another language | **not run** |
| Groq's rate limit, a wrong key, the access code | **not run**; the route maps them to messages that were never triggered. `POST` with a bad body returns 400 and `GET` reports the model, both checked |
| `Xenova/all-MiniLM-L6-v2`, WebGPU or `fp32` for the embedder | **not run**; there is no control for them in the interface yet |

## Next (Proposed)

1. **Lucas looks at it** (`pnpm dev`, then `/` and `/lab`) and says what to change. Everything visual is expected to move.
2. **Datasets, the rest**: an instructions field (the prompt already takes one); writing test questions; renaming and copying; keeping vectors between visits so a large dataset does not embed again on every reload; defaults for long documents.
3. **A second sample with a long document**, where retrieval is needed rather than demonstrated.
4. **The public deployment's key**: decide who pays for generation (open question 2), then Vercel: project, env vars, production on `main`.
5. **Real devices**: a phone, Safari, Firefox; a first visit on a slow connection; reduced motion in the lab's replay.
6. **The embedder's other options** as controls (the light model, WebGPU), each with its own cache and its own gate.
7. **Unit tests** on `src/lib/rag/` if wanted, the four questions first.
8. **README** with the walkthrough, and whatever has to be handed in.

## Open questions for Lucas

1. **The exact delivery date, and what is handed in** (a link, the code, a report, a presentation in class).
2. **Who pays for generation on the public site**: an access code protecting your free-tier key, or each visitor's own Groq key? For a tool open to anyone, their own key is what scales; your key behind a code is simpler for a classroom demo.
3. **The other four parts** of the final project (classification, sentiment, regression, clustering): elsewhere, presumably notebooks. Nothing about them belongs here unless you want it to.
4. **Unit tests**: wanted, or none as in Debait?
5. **The name**: RAGui, or something else before the Vercel URL is taken?

Settled on 2026-11-10: the sample (the contract, published), the embedding model (multilingual), the languages (Portuguese and English), the product's shape (a sandbox for any subject), what "deploy" means (the app live on Vercel), the delivery window (about a month), the structure of home and lab (GenWallet's) and the home's background (vgpu).

## Risks

| Risk | What to do about it |
|---|---|
| The sandbox part is left for the end and the app ships as a demo of one contract | The contract is already one preset and nothing else names it. Saving and making sandboxes is step 2 of what is next, not "if there is time" |
| Retrieval looks pointless on a three-page document that fits in the prompt | Keep the sample's context far smaller than the document (4 sources, 500 tokens), say so openly, and show a second sandbox with a long document, where the same pipeline is needed |
| A question is answered from the wrong block (the landlord's CPF for the tenant's, the tenant's home for the property) | All four were right on 2026-11-10, but the landlord's name passes by one rank (third of four). Check the four tests are green before every demo; they are in the sidebar |
| The browser's vectors differ from Node's, and may differ again between browsers or after a library update | Tune and check in the browser that will be used; `pnpm rag eval` is a guide, not a proof |
| The ONNX runtime and the model are fetched from jsDelivr and Hugging Face at run time | Open the site beforehand on the demo machine; consider serving both from the app |
| Other people's documents break assumptions made on the contract (scanned PDFs with no text, very long files, other languages) | Say what is not supported instead of failing silently: a PDF with no extractable text is reported as such; a size limit per sandbox with the reason shown |
| 135 MB on classroom Wi-Fi during a live demo | Open the site beforehand so the model is cached; a recorded backup |
| The free tier runs out in front of the class | The gate, the small budget, and the fact that everything but the last sentence needs no model |
| The animation drifts from the truth (a hand-tuned effect that no longer matches the numbers) | Principle 2: views draw `(trace, playhead)` and nothing else |
