# RAGui

A sandbox for building a RAG about anything, where the pipeline is the interface. Documents are chunked, embedded and searched in the browser, and two animated components, the Pipeline and the Retriever, replay every step with its real numbers: where a chunk was cut, what its vector looks like, why it ranked third, what fit in the prompt. A model on [Groq](https://groq.com) writes the final answer from the context the code selected.

A UFRJ course project (Inteligência Artificial, 2026/2): the "Busca Semântica" part of the final assignment, which asks for a RAG that answers four questions about a residential lease contract. RAGui does that, and takes any other document too.

> **Status (2026-11-11): live at https://rag-ui-ufrj.vercel.app.** Make a dataset from your own documents or open the example (a residential lease and four questions about it): it is indexed in the browser and searched there. Answers need a Groq key on the server, which the live site does not have yet. Details in [`spec/05-roadmap.md`](spec/05-roadmap.md).

## Run it

Node.js 24 and pnpm.

```bash
pnpm install
cp .env.example .env    # add a free Groq key: https://console.groq.com/keys
pnpm dev                # http://localhost:3000
```

Without a key everything up to the prompt still works: documents are read, cut, embedded and searched in your browser, and the lab shows the exact prompt that would be sent. The first visit downloads the embedding model (about 135 MB), which the browser then keeps.

Open `/lab`, click one of the test questions on the left, and watch the run. Then change the chunk size or the search mode and see which answers are still found.

The same pipeline runs in the terminal:

```bash
pnpm rag eval                              # are the sample's four answers retrieved?
pnpm rag ask 'Qual o valor do aluguel?' --answer
```

## The idea in three lines

1. **Everything before the prompt is code.** Chunking, embeddings, cosine similarity, BM25, rank fusion, diversity and the token budget are plain functions. Same documents, same question, same settings: same context.
2. **The animation is the data.** Each run produces a trace of its steps; the interface replays it with a play, pause and step control. Nothing moves that was not computed.
3. **Retrieval needs no key and no server.** The embedding model runs in the browser. The deployment is one route that streams the answer.

## Stack

Next.js 16 and React 19 · Transformers.js (`multilingual-e5-small`) in a Web Worker for embeddings · the Vercel AI SDK with Groq for the answer · WebGPU through [vgpu](https://vgpu.sh) for the landing page · Tailwind 4, Motion, Geist. No vector database and no retrieval framework: the retrieval is the code in [`src/lib/rag`](src/lib/rag).

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
