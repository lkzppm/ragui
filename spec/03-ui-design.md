# 03 — UI and design

Status on 2026-11-10: **Proposed. The skeleton is built ("As scaffolded" below); the Pipeline's motion and the Retriever are not. Nothing has been seen by Lucas.** The only fixed inputs are his words: "clean and modern", and "I want the rag pipeline and the retriever to be strong animated UI components, so the user sees what is happening in the rag". In CV-AI and Debait the first visual direction was rejected and redone, so build the two main components on plain tokens first and expect the look to change.

## Design idea

**A quiet page where the only things that move are the data.** Near-monochrome surfaces, hairline borders, a lot of air, one accent colour. Motion is the personality, and it is spent entirely on the pipeline: if something moves, it is a chunk, a vector, a score or a token.

- **Colour carries meaning, not decoration.** One accent for the question and whatever it touches (the query point, the hits, the citations). A second, cooler tone for the corpus at rest. A warning tone for what the code flags (truncated chunk, invalid citation, failed gate). Documents get a small categorical set so their chunks can be told apart on the map. All from tokens in `src/app/globals.css`, never a hex value in a component.
- **Two themes**, light and dark, by a switch (`.dark` on `<html>`).
- **Type**: Geist Sans for text and Geist Mono for everything that is a number, an id, a score or a formula. Numbers use tabular figures so they do not jitter while they count.
- **Shapes**: hairline borders, small radii, no shadows heavier than a hairline, no gradients as decoration.
- **The formula is part of the interface.** Each stage shows the expression it computes with the live numbers substituted in, in mono, the way Debait's ledger showed `62 = 78 − 16`.

## The two main components

Both are views of a trace with a playhead (`01-architecture.md`). They hold no pipeline state.

### `<Pipeline>`: what is happening, in order

A horizontal rail of stages across the top of the lab, in two groups separated by a gap: ingestion (load, clean, chunk, embed, index) and query (question, dense, sparse, fuse, diversify, gate, assemble, generate, verify).

- **A stage is a node**: its name, one live number (chunks produced, vectors embedded, hits, tokens) and its duration in milliseconds. States: idle, running, done, skipped (sparse in dense-only mode; generate when the gate fails), failed.
- **Edges carry packets.** When the playhead crosses from one stage to the next, small squares travel along the edge, one per item up to a cap, so "142 chunks went to the embedder" is seen, not read. The dense and sparse stages are drawn as two parallel branches that join at fuse.
- **The running stage counts up** to its real number, and its duration is the measured one, not the animation's.
- **Selecting a stage** opens its inspector in the centre panel: the stage's view, its formula, its knobs. The Retriever is the inspector for dense through assemble.
- **Changing a knob** marks every stage downstream as stale (dimmed) until the run is replayed, which shows what a setting actually affects: chunk size invalidates everything, top-k only the query side.
- On a phone the rail becomes a vertical list with the current stage expanded.

### `<Retriever>`: why these chunks

The centre of the lab during a query. Three linked parts; hovering a chunk in one highlights it in all three and in the document.

1. **The embedding map.** Every chunk is a point (PCA to 2D), coloured by document.
   - The question drops in as a point in the accent colour with a short settle.
   - Search plays as a ring growing from the question; points brighten in order of their real similarity as it passes, and the ring stops when `k` are found. Lines are drawn from the question to the `k` hits, each labelled with its score.
   - Every other point can be shaded by its similarity to the question (a switch), which shows the whole score field, not only the winners.
   - A fixed note says the map is a 2D shadow of 384 dimensions: the ring is ordered by true similarity, so it will not always be a perfect circle on the map. That mismatch is worth pointing at, not hiding.
   - Pan, zoom, hover for the chunk's text, click to pin it.
2. **The ranking race.** Two columns, dense and sparse, each a list of chunk cards with a score bar that fills to its value. At fuse, the cards fly from both columns into one, in fused order (shared layout animation, so a card visibly keeps its identity while its rank changes); a card found by both lists shows both ranks. At diversify, dropped cards slide out with a line to the card they duplicated.
3. **The context tray.** A bar as wide as the token budget. Chosen chunks drop in as blocks sized by their tokens and take their `[n]`; adjacent ones snap together when merged; the first that does not fit bounces off and is listed as left out.

Hover any hit to see **the score broken down**: for dense, the two vector strips one over the other and the strip of their products, with the sum; for sparse, the matched terms with each one's contribution.

### What the assignment's document changes (2026-11-10)

The contract yields about 15 to 20 chunks, not hundreds. That shifts the weight between the three parts:

- **The map is sparse**, so each point can be a labelled, clickable node (its clause title beside it) instead of an anonymous dot, and plain SVG is enough. Canvas only matters once someone drops in a long document.
- **The ranking race and the score breakdown carry the demo.** With so few candidates every card fits on screen, and the interesting moments are the decoys: the landlord's address ranking next to the property's, the deposit of R$ 6.400,00 next to the rent. Give them room.
- **A test panel** sits beside the Retriever: the sandbox's test questions (for the sample, the statement's four), each with the rank of the chunk that holds its answer (dense, sparse, fused) and a mark for "in the context". It recomputes on every setting change, with no model call (`02-rag-pipeline.md`, "Test questions"). Clicking a question runs it.

### Supporting views

- **Chunk view** (inspector for chunk): the document's text with chunk boundaries as brackets in the margin and overlaps shaded; moving the size and overlap sliders re-cuts it live.
- **Vector strip**: 384 cells in a row. Used in the embed inspector, on hover over a point, and in the score breakdown.
- **Answer**: the streamed text. A citation `[2]` is a chip; hovering it highlights source 2 in the tray, the ranking, the map and the document. Flags from the verify step appear on the sentence they concern.
- **Prompt inspector**: the exact messages sent, the estimated and the real token counts.
- **Gate failed**: the answer panel shows the best score against the threshold and states that the model was not called.

## Screens

### Landing `/`

As in Debait and GraphMan: the name, one sentence, and a figure that explains. The figure is a small `<Pipeline>` and embedding map replaying a real, precomputed trace of one of the four questions on the contract in a loop that the visitor can pause. One button into the lab. No marketing phrases; every number in the figure comes from the trace.

### Lab `/lab`

The lab always shows one sandbox; a switcher in its header lists the others and makes a new one (the sample sandbox cannot be deleted, only copied). The sketch below is the target, not the scaffold:

```
┌ ragui ─ sandbox: Contrato ▾ · 1 doc · 17 chunks · e5-small q8 ── PT/EN  ☀ ┐
│ ●load ─ ●clean ─ ●chunk ─ ●embed ─ ●index     ●ask ═╦═ ●dense ═╗          │
│                                                     ╚═ ●sparse ╩ ●fuse ─ … │
├───────────────┬──────────────────────────────────────┬─────────────────────┤
│ Corpus        │ Inspector of the selected stage      │ Answer              │
│ drop zone     │ (during a query: the Retriever:      │ streamed text       │
│ documents     │  map · ranking race · context tray)  │ citations           │
│ settings      │                                      │ prompt inspector    │
├───────────────┴──────────────────────────────────────┴─────────────────────┤
│ [ ask something about the documents…            ]  ◀ ▶ ❚❚  ───●──── 1×     │
└────────────────────────────────────────────────────────────────────────────┘
```

- The bottom bar is the question field and the transport (step back, play or pause, step forward, a scrubber over the trace, speed 0.5× 1× 2× and "instant").
- First visit: the assignment's contract is already indexed (or is being indexed, which is the first thing the visitor watches). The statement's four questions are offered as examples, plus one the contract cannot answer ("Qual o nome do fiador?") to show what happens then.
- The first load of the embedding model is a visible state of the embed stage with its progress in megabytes, not a spinner over the page.
- Phone: one column; the panels become tabs (corpus, pipeline, retriever, answer); the map stays usable by touch. Carry over the lessons from CV-AI and Debait: 16px inputs so iOS Safari does not zoom, `interactiveWidget: "resizes-content"`.

## Motion rules

- Library: `motion` (`motion/react`), as in the sister projects. Shared layout animations for anything that changes rank or container.
- Animate `transform` and `opacity` only. The map is the one place with many moving elements: draw it on a `<canvas>` once it passes a few hundred points instead of one DOM node per point.
- Durations follow the playhead, so the speed control and "instant" work everywhere; nothing has a hard-coded delay.
- `prefers-reduced-motion`: the playhead jumps from step to step and the views crossfade; packets, flights and the growing ring are off. Everything stays readable with no motion at all.
- The projector case matters (this will be shown in a classroom): at large zoom the current stage, its number and the top hits must be readable from the back of a room.

## As scaffolded (2026-11-10)

A first, deliberately plain pass, to be changed by Lucas:

- **Tokens** (`src/app/globals.css`): a warm off-white page and near-black text in light, the reverse in dark; `--query` indigo (`#4f46e5` / `#8b8cf9`), `--corpus` slate, `--flag` amber; 8px radius; hairline borders. Geist Sans and Geist Mono from the `geist` package (no download at build time). The `eyebrow` and `num` utilities.
- **Top bar**: the mark and wordmark ("RAG" plain, "ui" in the query colour), the lab link, GitHub, the language switch (a sliding thumb), the theme button. One row at every width.
- **The mark**: a filled dot with a ring among four small dots, a question and the search around it, among passages. Also the favicon.
- **Landing**: the name, one sentence, the button into the lab, the rail as a still figure, three short statements of the principles.
- **Lab**: the sandbox's name and description, a dashed notice that nothing runs yet, the rail, then three columns: documents, the stage inspector, the test questions. One column on a phone.
- **The rail is two rows**, indexing above and the question below: the 13 columns do not fit one row at 1280px. Each stage is a chip with its number, icon and name; the selected one has a border in the query colour that slides between chips. Dense and keyword search are stacked in one column. On a phone each row scrolls sideways. There are no edges with packets yet, only hairlines.
- **The stage inspector**: the stage's position ("7 of 14"), a tag saying whether code or the model does it, what it does in two sentences, the expression it computes, and the settings it reads with their current values. When the pipeline runs, each stage's own view replaces the description.
- **Seen by Claude** in headless Chromium on 2026-11-10: `/lab` at 1440px and 390px in light, at 1280px in dark; `/` at 1440px in light. In Portuguese only (the English dictionary is type-checked against the same shape but was not looked at on screen). Not seen: any real browser, a real phone, the theme and language switches being clicked.

## Not decided

- The accent colour and the exact palette (the scaffold's are placeholders).
- Whether the map is drawn with canvas 2D or with `vgpu` (WebGPU), which the sister projects use. Canvas 2D is enough for thousands of points; `vgpu` only earns its place if the map gets effects that need a shader.
- A logo or mark.
