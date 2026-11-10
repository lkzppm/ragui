# 00 — Overview

## The assignment (read on 2026-11-10)

Lucas supplied `Trab Final.zip` on 2026-11-10 (the Drive link given first could not be opened by Claude). It holds the statement of the course's final project and its data. The statement, `IA Trabalho Final .doc`:

> Universidade Federal do Rio de Janeiro · Escola de Engenharia - Departamento de Eletrônica · Curso de Inteligência Artificial - Prof. Sergio Palma · **Trabalho Final do Curso**

The final project has **five parts**. RAGui is the first:

> **Busca Semântica.** Construir uma estrutura RAG (Retrieval-Augmented Generation) que permita uma busca semântica e responda as seguintes perguntas:
> - Qual o nome do Locador
> - Qual o CPF do Locatário
> - Qual o endereço do imóvel
> - Qual o valor do aluguel

The document to search is `CONTRATO DE LOCAÇÃO RESIDENCIAL.pdf`: a residential lease, three pages, 11 clauses, about 3,900 characters, in Portuguese, with text that extracts cleanly. Its people and numbers are placeholders (a CPF of `123.456.789-00`).

The other four parts are classic machine learning on four CSV files and are **not part of this repository**: data classification (three models compared by ROC curve), sentiment analysis of reviews (two methods, accuracy, F1 and confusion matrix), multiple linear regression (apartment prices in Méier), and clustering (hierarchical with a dendrogram, then K-Means). Where they are done is Lucas's call (`05-roadmap.md`).

**What the statement does not say**: a deadline, what is handed in (code, report, presentation), or any required tool, language or model. Those are still unknown.

Local copies of the statement and the contract are in `docs/assignment/`, which is git-ignored: the files are the professor's, the repository is public, and publishing them is Lucas's decision.

### The four questions are the acceptance test

Read from the contract on 2026-11-10. The app is right when it answers these, each with a citation into the passage named:

| Question | Expected answer | Where |
|---|---|---|
| Qual o nome do Locador | Carlos Henrique de Almeida | the LOCADOR block at the top |
| Qual o CPF do Locatário | 987.654.321-00 (Mariana Souza Ribeiro) | the LOCATÁRIA block |
| Qual o endereço do imóvel | Rua Hermengarda, nº 812, apartamento 302, Bairro Méier, Rio de Janeiro – RJ, CEP 20710-030 | Cláusula 1 |
| Qual o valor do aluguel | R$ 3.200,00 por mês | Cláusula 4 |

Each one has a wrong answer sitting close by in the same document, which is what makes this small contract a good subject for a RAG that shows its retrieval (`02-rag-pipeline.md`, "The assignment's document").

## What Lucas asked for (2026-11-10)

- A **RAG system** for the Inteligência Artificial course (UFRJ, 2026/2), in the line of `../CV-AI` and `../Debate-ai`.
- **More general** than those two, and than the statement: not tied to one theme or one file. The contract is the document that is loaded on arrival and its four questions are the examples offered, but any documents can go in.
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

1. **Bring documents.** Paste text or drop `.txt`, `.md` or `.pdf` files. The assignment's contract is preloaded, with its four questions one click away (this needs the PDF in the public repository or its text typed into the code: open question in `05-roadmap.md`).
2. **Watch them be indexed.** The Pipeline plays the ingestion: load, clean, chunk, embed, index. Chunk boundaries and overlaps are drawn on the text; each vector is a strip of 384 coloured cells; each chunk lands as a point on the embedding map.
3. **Ask.** The question is embedded and dropped on the map. The Retriever shows the search: the nearest chunks light up, the dense ranking and the keyword ranking race side by side, the two lists merge, near-duplicates are dropped, and the survivors are packed into the context under a token budget.
4. **Read the answer.** Groq streams an answer that cites its sources as `[1]`, `[2]`. Each citation points back to its chunk on the text and on the map. A citation that points to nothing, and a sentence with no citation, are marked by code. If nothing in the corpus is close enough to the question, the model is not called at all.
5. **Change a knob and replay.** Chunk size, overlap, top-k, dense, sparse or hybrid, the diversity weight, the threshold. Every change reruns the pipeline and the difference is visible: which chunks entered and left the context, and why.

## What RAGui claims and does not claim (keep this honest everywhere)

- "Deterministic" covers **retrieval**, not the answer. The answer is generated at temperature 0 with a fixed seed, which makes it stable in practice but not guaranteed identical between calls.
- Retrieval is exact (every vector is compared), not approximate. That is a choice that fits a few thousand chunks; it is not how a system with millions of documents works, and the UI says so.
- The embedding map is a 2D projection of 384 dimensions. Distances on it are a lossy picture; rankings always come from the real vectors. The map carries that note.
- A high similarity score means "about the same thing", not "contains the answer", and not "true".

## Success criteria

1. **The four questions of the statement are answered correctly on the contract, each citing the right passage** (Decided by the assignment). For each, the passage holding the answer is in the retrieved context; this part is checked by code, with no model involved (`02-rag-pipeline.md`, "The four questions as a test").
2. Deployed on Vercel; opens on a laptop and on a phone. (Proposed, as are the rest.)
3. A document dropped in the browser is chunked, embedded and searchable with no server call and no key.
4. The Pipeline and the Retriever play, pause, step and scrub a real run, and their numbers match the functions in `src/lib/rag/`.
5. With `GROQ_API_KEY` set, an answer streams with citations that link back to chunks; with no relevant chunk, no model call is made.
6. Changing a setting and replaying shows a different, explainable result.

## Language (Proposed, the same rule as Debait)

- **The whole codebase is English**: code, comments, identifiers, commits, spec, README.
- The statement, the contract and the four questions are in Portuguese, so Portuguese is the language that has to work; English is the extra.
- **The UI and the prompt are bilingual**, Brazilian Portuguese by default, English by a switch: one typed dictionary per language in `src/i18n/` (`en.tsx` is the schema, `pt.tsx` must match it), no visible string inline in a component.

## Name (Proposed)

**RAGui**: RAG + UI, after the folder Lucas created. The repository is `lkzppm/ragui`. The name lives in `src/lib/brand.ts` and nowhere else, so changing it is one edit.
