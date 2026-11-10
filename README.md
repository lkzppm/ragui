# RAGui

A RAG where the pipeline is the interface. Documents are chunked, embedded and searched in the browser, and two animated components, the Pipeline and the Retriever, replay every step with its real numbers: where a chunk was cut, what its vector looks like, why it ranked third, what fit in the prompt. A model on [Groq](https://groq.com) writes the final answer from the context the code selected.

A UFRJ course project (Inteligência Artificial, 2026/2).

> **Status (2026-11-10): design only.** There is no code yet. The plan is in [`spec/`](spec/README.md).

## The idea in three lines

1. **Everything before the prompt is code.** Chunking, embeddings, cosine similarity, BM25, rank fusion, diversity and the token budget are plain functions. Same documents, same question, same settings: same context.
2. **The animation is the data.** Each run produces a trace of its steps; the interface replays it with a play, pause and step control. Nothing moves that was not computed.
3. **Retrieval needs no key and no server.** The embedding model runs in the browser. The deployment is one route that streams the answer.

## Planned stack

Next.js (latest) on Vercel · Vercel AI SDK with Groq for generation · Transformers.js for embeddings in a Web Worker · Tailwind, shadcn/ui and Motion for the interface.

## Read more

| | |
|---|---|
| [`spec/00-overview.md`](spec/00-overview.md) | the idea and its principles |
| [`spec/01-architecture.md`](spec/01-architecture.md) | what runs where, and the trace |
| [`spec/02-rag-pipeline.md`](spec/02-rag-pipeline.md) | every stage and its formula |
| [`spec/03-ui-design.md`](spec/03-ui-design.md) | the Pipeline and the Retriever |
| [`spec/05-roadmap.md`](spec/05-roadmap.md) | status and build order |

## License

[MIT](LICENSE)
