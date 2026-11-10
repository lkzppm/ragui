# 03 — UI and design

Status on 2026-11-10: **built ("As built" below), following three directions Lucas gave that day: the home on a vgpu background, the home and lab structured like GenWallet's, and everything animated the way Apple's fluid-interface guidance describes. Seen by Claude in headless Chromium only; not yet seen by Lucas.** The sections before "As built" are the earlier design; the built interface follows them except where "As built" says otherwise. The only fixed inputs are his words: "clean and modern", and "I want the rag pipeline and the retriever to be strong animated UI components, so the user sees what is happening in the rag". In CV-AI and Debait the first visual direction was rejected and redone, so build the two main components on plain tokens first and expect the look to change.

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

## As built (2026-11-10)

### Directions from Lucas (2026-11-10)

> "make a vgpu home, for the structure pattern of home + lab follow the pattern of ../GenWallet/. I want everything well animated, smooth transitions and stunning, /apple-design"

### Motion and material

- **Springs, critically damped by default** (`src/lib/motion.ts`: `SPRING` 0.4 s, `SPRING_FAST`, `SPRING_SLOW`, and `SPRING_DROP` with a little bounce for things that land: the question on the map, a source in the tray, a number on a row). A spring starts from where the element is, so changing a setting mid-animation never jumps.
- **Press feedback on pointer-down** (`press` utility: scale to 0.97 in 80 ms), on everything clickable.
- **Glass for floating chrome** (`glass` utility: the top bar, tooltips, the drop target, the hero's buttons): translucent with blur and saturation, content scrolling under it. Scroll areas fade at their edges (`fade-y`, `fade-x`) instead of being cut by a line.
- **Type**: large headings use the `display` utility (tracking −0.035em, leading 1.02); body tracking is untouched.
- **One highlight per thing that moves between places**: the rail's "now" marker slides from stage to stage (shared layout), the language switch's thumb slides, rows reorder with layout springs.
- **The three preferences are honoured in CSS**: reduced motion (nothing slides or loops; the landing background becomes one still frame), reduced transparency (glass becomes solid), more contrast (visible borders).

### Home `/`, three screens (GenWallet's pattern)

1. **Hero on the embedding field** (`components/field/`, WebGPU through vgpu 0.5): a toy space of 132 passages in seven clusters. The pointer is the question; each frame the six nearest are found on the CPU (the same exact search as the lab, in two dimensions) and lines go to them; a click sends a ring outward that lights each point as it passes, in order of distance. One fullscreen effect (the ground, the glow, the ring, the question's dot) and two instanced draws (links, points). With no pointer the question wanders a slow closed path. Without WebGPU, with reduced motion, or if the adapter is refused: one still frame on a 2D canvas. Over it: the mark and name, one sentence, the way into the lab, the source, the stack.
2. **How it works** on a tint: the claim, four numbers read from the code (14 stages, 13 of them code, 384 dimensions, 0 servers for retrieval), and a figure of **real runs**: the sample's four test questions, each as its three rankings with the passage that holds the answer marked. `pnpm rag figure` writes its data (`site/figure-data.json`) by running the pipeline. The questions turn every 8 s, a segment filling for the current one; the pointer pauses it.
3. **Built to be inspected** on a field of dots: the headline, four things the lab lets you do, the way in.

The footer is on this page only.

### Lab `/lab`, one fixed screen from `lg` up

Nothing scrolls the page; each panel scrolls inside itself. No footer.

```
┌ top bar ────────────────────────────────────────────────────────────────────┐
├──────────┬──────────────────────────────────────────────────────────────────┤
│ Sidebar  │ Rail: INDEXING  load ─ clean ─ chunk ─ embed ─ index             │
│ 17.5rem  │       QUESTION  question ═ dense/words ═ fuse ─ … ─ verify       │
│          ├───────────────────────────────────────────────┬──────────────────┤
│ sandbox  │ Stage: which stage, what it does, ms          │ Answer   20rem   │
│ tests    │ ┌ corpus view (indexing) ───────────────────┐ │ text + citations │
│ chunking │ │ document with passages │ passages+vectors │ │ checks by code   │
│ retrieval│ └ or retriever view (a question) ───────────┘ │ sources sent     │
│ context  │ │ map │ by meaning │ by words │ together    │ │ the prompt       │
│ documents│ │ context tray / closed gate                │ │                  │
│          ├───────────────────────────────────────────────┴──────────────────┤
│          │ examples · question field · ◀ ▶/❚❚ ▶ · scrubber · 0.5× 1× 2× ⚡  │
└──────────┴──────────────────────────────────────────────────────────────────┘
```

- **Rail** (`pipeline/pipeline-rail.tsx`): the highlight slides to the running stage; each connector fills in the last fifth of the slot before it, with one bright cell at its front; a finished stage keeps one number (chunks, `21×384`, the best cosine, tokens of context, citations checked). Skipped stages are struck through (everything after a closed gate); a search the mode does not use is dashed. Clicking a stage moves the run to it.
- **Stage header**: the current slot's stage or stages, the code/model tag, the time the step really took, two lines on what it does, and its formula from `2xl` up.
- **Corpus view**: the document with each passage tinted in turn as the chunking plays, overlaps darker and underlined; beside it the passages as cards that gain their vector strip (384 cells in two rows, the question's colour for positive, the corpus colour for negative) as the embedding plays. Pointing at a passage on one side lights and scrolls it on the other. A pill at the foot gives the stage's fact (characters kept; embedded against cached; vectors and distinct words).
- **Retriever view**: the map (PCA; the question drops in, every point takes the strength of its real similarity, lines are drawn in rank order, keyword hits wear a dashed square, kept sources get their number, hover shows the passage and its score); three lists that fill as each search plays (the question's words as chips, absent ones struck, rarer ones stronger); the fused list marks kept, dropped ("too close to #n") and beyond; the tray fills with blocks sized by tokens against the budget, with what did not fit beside it. A closed gate replaces the tray with the score, the threshold and "the model was not called".
- **Answer panel**: held back until the replay reaches generation, then follows the stream; citations are chips that light their source on the map, in the lists and in the tray; under it the checks, the sources sent, token usage and time, and the prompt exactly as sent. States: retrieving, writing, not called (gate), generation off (no key), error by kind, and "written for an earlier context" with a button to write it again.
- **Bottom bar**: the sandbox's test questions and examples as chips; the question field (`/` focuses it); step back, play/pause/replay, step forward (space and the arrow keys), a scrubber over the whole run, and the speed (⚡ is instant).
- **Sidebar**: five groups, one open at a time, each showing its current value when closed: test questions (pass or fail with the three ranks; clicking one asks it), chunking, retrieval (mode, k, λ, the gate's threshold or off), context (sources, budget, order), documents (add by button or by dropping files anywhere on the sidebar). A button restores the sandbox's own settings once something differs.
- **Phone**: the same parts stacked, the page scrolls, the bottom bar sticks.

### What the earlier design asked for and is not there

- Packets as separate squares travelling the edges (one bright cell per connector instead), stale stages dimmed after a setting change (the run is recomputed at once instead), a growing ring on the map (points light by true similarity instead, which is what a ring was standing in for), the dense score broken down per dimension, a sandbox switcher, and a `reduced motion` path for the lab's replay beyond what CSS and the ⚡ speed give.

### Seen, and not

Seen by Claude on 2026-11-10 in headless Chromium, driven through the DevTools protocol: the landing page's three screens (light) and hero (dark), with WebGPU on (the field animating, following a synthetic pointer, a ring after a click) and off (the still frame); the lab at 1440 and 1280 px in both themes, in Portuguese and English, through indexing, a question, a closed gate, stepping back, a slider change; and at 390 px. Clicks on the language switch, the theme button, a test question, the step button and a sidebar group were made on the real controls.

Not seen: any real browser or phone, a real pointer or touch, a file being dropped, Safari or Firefox (where WebGPU and the worker may behave differently), a first visit downloading the 118 MB model in the browser (the test browser already had it), and how any of it feels in motion. **Lucas has not seen it.**

## Not decided

- The accent colour and the exact palette (indigo `--query`, slate `--corpus`, amber `--flag` on near-monochrome are still the first pass).
- Whether the map is drawn with canvas 2D or with `vgpu` (WebGPU), which the sister projects use. Canvas 2D is enough for thousands of points; `vgpu` only earns its place if the map gets effects that need a shader.
- A logo or mark.
