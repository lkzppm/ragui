# RAGui

A sandbox for building a RAG about anything, where the pipeline is the interface. Documents are chunked, embedded and searched in the browser, and two animated components, the Pipeline and the Retriever, replay every step with its real numbers: where a chunk was cut, what its vector looks like, why it ranked third, what fit in the prompt. A model on [Groq](https://groq.com) writes the final answer from the context the code selected.

A UFRJ course project (Inteligência Artificial, 2026/2): the "Busca Semântica" part of the final assignment, which asks for a RAG that answers four questions about a residential lease contract. RAGui does that, and takes any other document too.

> **Status (2026-11-10): scaffold.** The app runs and shows the pipeline as it is defined, in Portuguese and English, light and dark. No stage computes anything yet. The plan is in [`spec/`](spec/README.md).

## Run it

Node.js 24 and pnpm.

```bash
pnpm install
pnpm dev        # http://localhost:3000, no configuration needed
```

## The idea in three lines

1. **Everything before the prompt is code.** Chunking, embeddings, cosine similarity, BM25, rank fusion, diversity and the token budget are plain functions. Same documents, same question, same settings: same context.
2. **The animation is the data.** Each run produces a trace of its steps; the interface replays it with a play, pause and step control. Nothing moves that was not computed.
3. **Retrieval needs no key and no server.** The embedding model runs in the browser. The deployment is one route that streams the answer.

## Stack

In place: Next.js 16, React 19, Tailwind 4, shadcn/ui, Motion, Geist. Planned: Transformers.js for embeddings in a Web Worker, the Vercel AI SDK with Groq for generation, Vercel for hosting.

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
