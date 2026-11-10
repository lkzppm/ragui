# 00 — Overview

## The assignment: not read yet

Lucas gave the course material as a Google Drive link on 2026-11-10:

> https://drive.google.com/file/d/1kJbQEBXqOZ6LJq6j-hLcOcSFNeEoo6Fm/view

**Claude could not open it.** The Drive connector answered "Requested entity was not found" and an anonymous download was redirected to the Google sign-in page, so the file is shared with an account other than the one the connector uses. Nothing in this spec comes from that file. What it holds is unknown: it may be the assignment statement, the documents to index, or both.

Until it is read, treat as unknown: the deadline, the deliverables (report, presentation, code walkthrough), any required corpus, and any required tool or language. Once Lucas puts a copy in `docs/`, rewrite this section with the statement quoted verbatim and check every **Proposed** item in the spec against it. This is the first item in `05-roadmap.md`.

## What Lucas asked for (2026-11-10)

- A **RAG system** for the Inteligência Artificial course (UFRJ, 2026/2), in the line of `../CV-AI` and `../Debate-ai`.
- **More general** than those two: not tied to one theme. Any documents can go in.
- The focus is **the deterministic part of RAG**: embeddings, retrieval, everything that is code and not the model.
- **The RAG pipeline and the retriever are strong animated UI components**, so the user sees what is happening inside the RAG.
- **Clean and modern** style.
- **Next.js, latest version**, deployed on **Vercel**, generation by a model on **Groq** with an API key.

## The idea

Most RAG demos are a chat box: a question goes in, an answer comes out, and the part that decides whether the answer is any good (which passages were found, and why those) stays hidden. RAGui turns that part inside out. It is a RAG where the pipeline is the interface: you watch your documents being cut into chunks, the chunks becoming vectors, your question landing among them, the nearest ones being pulled out, ranked, merged and packed into a prompt. The model writes the last paragraph; everything before it is code you can see, step through and change.

## Three principles (Proposed, derived from Lucas's request)

When time is short, protect these and cut everything else.

1. **Everything before the prompt is code.** Chunking, embedding, similarity, ranking, fusion, diversity, the token budget and the final context are computed by pure functions in `src/lib/rag/`, in the browser. The same corpus, question and settings give the same retrieved context, every time. The model receives that context and writes; it never chooses what to read. This is Debait's rule ("the model observes, the code scores") turned around: here **the code retrieves, the model writes**.
2. **The animation is the data.** A run of the pipeline produces a trace: an ordered list of steps with their real inputs, outputs and timings (`01-architecture.md`). The Pipeline and the Retriever are views of that trace with a playhead: play, pause, step, scrub. Nothing moves on screen without a trace step behind it, and every number shown comes from the code. No decorative loops.
3. **Retrieval needs no key and no server.** Documents, chunks and vectors stay in the browser; the embedding model runs there too. The deployment is one stateless route that streams the answer from Groq. Without a Groq key the whole deterministic part still works, which is also what keeps the free tier safe.

## The product in one page

1. **Bring documents.** Paste text or drop `.txt`, `.md` or `.pdf` files. A sample corpus is preloaded so the first visit already shows something (which corpus: open question in `05-roadmap.md`).
2. **Watch them be indexed.** The Pipeline plays the ingestion: load, clean, chunk, embed, index. Chunk boundaries and overlaps are drawn on the text; each vector is a strip of 384 coloured cells; each chunk lands as a point on the embedding map.
3. **Ask.** The question is embedded and dropped on the map. The Retriever shows the search: the nearest chunks light up, the dense ranking and the keyword ranking race side by side, the two lists merge, near-duplicates are dropped, and the survivors are packed into the context under a token budget.
4. **Read the answer.** Groq streams an answer that cites its sources as `[1]`, `[2]`. Each citation points back to its chunk on the text and on the map. A citation that points to nothing, and a sentence with no citation, are marked by code. If nothing in the corpus is close enough to the question, the model is not called at all.
5. **Change a knob and replay.** Chunk size, overlap, top-k, dense, sparse or hybrid, the diversity weight, the threshold. Every change reruns the pipeline and the difference is visible: which chunks entered and left the context, and why.

## What RAGui claims and does not claim (keep this honest everywhere)

- "Deterministic" covers **retrieval**, not the answer. The answer is generated at temperature 0 with a fixed seed, which makes it stable in practice but not guaranteed identical between calls.
- Retrieval is exact (every vector is compared), not approximate. That is a choice that fits a few thousand chunks; it is not how a system with millions of documents works, and the UI says so.
- The embedding map is a 2D projection of 384 dimensions. Distances on it are a lossy picture; rankings always come from the real vectors. The map carries that note.
- A high similarity score means "about the same thing", not "contains the answer", and not "true".

## Success criteria (Proposed, until the assignment is read)

1. Deployed on Vercel; opens on a laptop and on a phone.
2. A document dropped in the browser is chunked, embedded and searchable with no server call and no key.
3. The Pipeline and the Retriever play, pause, step and scrub a real run, and their numbers match the functions in `src/lib/rag/`.
4. With `GROQ_API_KEY` set, an answer streams with citations that link back to chunks; with no relevant chunk, no model call is made.
5. Changing a setting and replaying shows a different, explainable result.

## Language (Proposed, the same rule as Debait)

- **The whole codebase is English**: code, comments, identifiers, commits, spec, README.
- **The UI and the prompt are bilingual**, Brazilian Portuguese by default, English by a switch: one typed dictionary per language in `src/i18n/` (`en.tsx` is the schema, `pt.tsx` must match it), no visible string inline in a component.

## Name (Proposed)

**RAGui**: RAG + UI, after the folder Lucas created. The repository is `lkzppm/ragui`. The name lives in `src/lib/brand.ts` and nowhere else, so changing it is one edit.
