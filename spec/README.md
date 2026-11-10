# spec/ : project knowledge base

Short, stable documents so any session (human or Claude Code) can pick up the work without re-deriving it. Read in this order:

| File | What it holds |
|---|---|
| [00-overview.md](00-overview.md) | The assignment and its four questions, the sandbox idea, the three principles, the product in one page, success criteria |
| [01-architecture.md](01-architecture.md) | What runs where, the trace, the data model, the single server route, the folder tree, decisions, what the scaffold contains |
| [02-rag-pipeline.md](02-rag-pipeline.md) | The deterministic core: what the assignment's contract demands, chunking, embeddings, dense and sparse search, fusion, diversity, the gate, context assembly, the prompt, citation checks, test questions graded by code |
| [03-ui-design.md](03-ui-design.md) | The visual direction, the two main components (Pipeline and Retriever), their motion, the screens, what the scaffold looks like |
| [04-stack-and-versions.md](04-stack-and-versions.md) | Versions installed and still to install, how the scaffold was made, env vars, commands, CI and branch rules, Groq models and limits, lessons inherited |
| [05-roadmap.md](05-roadmap.md) | Status, build order, open questions for Lucas |

## Status legend

The spec was written on 2026-11-10, before any code, and revised the same day as the assignment was read, the app scaffolded and the pipeline, the lab and the landing page built. Where a file has an "As built" or "Measured" section, that is what the code does and what was observed; the text before it is the design it started from. Every claim carries one of these:

- **Decided**: chosen by Lucas or forced by a fact; build it this way unless a new fact appears.
- **Proposed**: a default worth starting from, chosen by Claude; change freely and record why.
- **Unverified**: read from docs or a search summary, never run. Check before relying on it.

## Maintenance rules

- Update the spec when a decision changes, not when a line of code changes.
- Absolute dates only (2026-11-10, never "yesterday").
- When something marked Proposed or Unverified gets built and tested, rewrite it as fact with the date.
- `CLAUDE.md` at the root points here; do not duplicate content there.
- Sister projects worth copying from: `../Debate-ai` (Next.js 16 + AI SDK 7 + Groq, the event log and "the model observes, the code scores", the closest relative in spirit) and `../CV-AI` (the same stack, PDF import with `unpdf`, `zustand`, sessions in the browser).
