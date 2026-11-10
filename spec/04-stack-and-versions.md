# 04 — Stack, versions and setup

Status on 2026-11-10: **nothing installed.** The versions below are the latest published on npm on 2026-11-10 (`npm view <package> version`). Once the scaffold exists, `package.json` is the source of truth and this table records what was installed.

| Package | Latest on 2026-11-10 | Note |
|---|---|---|
| node / pnpm | 26.7 / 11.25 on Lucas's machine | CI uses Node 24 in the sister projects |
| next | 16.4.6 | Lucas asked for the latest. CV-AI and Debait run 16.3.8. APIs differ from model training data: read `node_modules/next/dist/docs/` before using an API from memory |
| react / react-dom | 19.3.1 | |
| ai | 7.0.166 | AI SDK 7: `streamText` for the answer. Check the `.d.ts` before using a remembered API |
| @ai-sdk/groq | 4.0.78 | `createGroq` |
| @huggingface/transformers | 4.3.2 | the embedder, in a Web Worker. New to this family of projects: nobody here has run v4 |
| motion | 14.12.0 | `motion/react` |
| tailwindcss | 4.3.5 | tokens in `src/app/globals.css` |
| shadcn | 4.23.0 | radix mode (`radix-nova`), `components.json` copied from Debait |
| zustand | 5.1.0 | the lab store, as in CV-AI |
| zod | 4.6.7 | the route's body schema |
| unpdf | 2.1.0 | PDF text in the browser. CV-AI used 1.8: check what changed in 2.x |
| geist, lucide-react | 1.9.2 / 1.71.0 | fonts, icons |
| vgpu | 0.6.0 | only if the map moves to WebGPU (`03-ui-design.md`); the sister projects are on 0.5.0 |
| typescript / eslint | 7.0.2 / 10.14.0 are the latest | **Proposed: pin 5.9 / 9 as the sister projects do**, since `eslint-config-next` and the rest of the toolchain were never tried with the new majors. Revisit when scaffolding |

Not needed, on purpose: a vector database, LangChain or LlamaIndex (the point is to write and show the retrieval ourselves), a second model provider, Redis.

## How to scaffold (Proposed, the way Debait did)

Not with `create-next-app`: copy the config files from `../Debate-ai` (`tsconfig.json`, `postcss.config.mjs`, `components.json`, `pnpm-workspace.yaml`, `vercel.json`, `eslint.config.mjs`, `.github/workflows/ci.yml` without the shader step), then `pnpm add` the dependencies above. `next dev` writes `AGENTS.md`; once it exists, put `@AGENTS.md` on the first line of `CLAUDE.md` as the sister projects do. To add a shadcn component: `pnpm dlx shadcn@latest add <name>` (never hand-edit `src/components/ui`).

Two things to verify early because they are new here:

1. `@huggingface/transformers` in a Web Worker under Next 16 with Turbopack: the worker bundle, the WASM files, and that the package is never pulled into the server bundle.
2. The same package under `tsx` in Node for the terminal scripts.

## Environment variables (`.env.example`, to be written)

```
GROQ_API_KEY=                 # https://console.groq.com/keys (free tier). Missing → generation is off, retrieval still works
GROQ_MODEL=openai/gpt-oss-120b
ACCESS_CODE=                  # optional. When set, /api/answer requires it (see 01-architecture.md)
```

## Groq (read on 2026-11-10, Unverified until a call is made)

From https://console.groq.com/docs/models:

- Production chat models: `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `llama-3.3-70b-versatile`, `llama-3.1-8b-instant` (all 131,072 tokens of context).
- **No embedding model is listed.** This is what puts the embedder in the browser.

From https://console.groq.com/docs/rate-limits: `openai/gpt-oss-120b` and `openai/gpt-oss-20b` at 30 requests/min, 1,000 requests/day, **8,000 tokens/min, 200,000 tokens/day**, per model. Debait observed the same numbers on the free tier on 2026-10-06. The real limits of the key are on its account page.

What that means here: one answer is about 1,800 tokens of context, 300 of prompt and question and up to 600 of output, so roughly 2,700 tokens. That is about three answers a minute and seventy a day on one model. Hence the default context budget, the gate that skips the call, and the fact that retrieval costs nothing.

Proposed default: `openai/gpt-oss-120b`, as in the sister projects. `llama-3.3-70b-versatile` is the alternative if reasoning tokens get in the way.

## Commands (once scaffolded)

```
pnpm dev                                    # no configuration needed: everything but generation
pnpm lint && pnpm typecheck && pnpm build   # must be green (CI enforces)
pnpm rag ingest <file>                      # the ingestion trace in the terminal
pnpm rag ask '<question>' [--answer]        # the query trace; --answer also calls Groq
```

## Repository and deployment

- **Repository**: `lkzppm/ragui`, public, created on 2026-11-10. Branches `main` ← `dev` ← `feat/*` or `fix/*`; commit with `/commit`, integrate with `/merge`.
- **Not done yet**: CI, and the rulesets Debait has (on `main`: pull request required, the CI check required, no deletion or force push; on `dev`: CI required). They need the CI workflow to exist first, so they come with the scaffold. Auto-merge and delete-branch-on-merge are repository settings to turn on at the same time.
- **Vercel**: not created. Production will track `main`; every pull request gets a preview. In Debait the Vercel MCP connection was read-only on the team and the CLI did the work (`vercel project add`, `vercel link`, `vercel git connect`, `vercel env add`).

## Lessons inherited (observed in CV-AI and Debait, October 2026)

- Groq rate limits are per model.
- `gpt-oss` models spend output tokens on reasoning: set `maxOutputTokens` explicitly and `reasoningEffort: "low"`, and check `finishReason` before trusting the text (`"length"` with empty text happened).
- Recompute any number in code; never display a number the model wrote.
- Test without a browser with `tsx scripts/<name>.mts` (`.mts`, because `tsx` compiles `.ts` as CJS and rejects top-level `await`); the package scripts pass `--env-file-if-exists=.env.local`.
- Generated folders (`components/ui`) are re-added by CLI, never hand-edited; shadcn stays in radix mode.
- Tailwind v4 dropped the pointer cursor on buttons: add a base rule.
- CI concurrency: separate groups for `push` and `pull_request`, or the pull request run cancels the push run after a merge (CV-AI's `fix/ci-concurrency`).
- `vercel git connect` may fail until the Vercel GitHub app has access to the repository; connect from the dashboard if so.
- Lucas verifies visual changes himself. Say plainly what was and was not seen running.

## Links

- AI SDK: https://ai-sdk.dev/docs
- Groq: https://console.groq.com/docs/models · https://console.groq.com/docs/rate-limits
- Transformers.js: https://huggingface.co/docs/transformers.js · v4 announcement: https://huggingface.co/blog/transformersjs-v4
- Models: https://huggingface.co/Xenova/multilingual-e5-small · https://huggingface.co/Xenova/all-MiniLM-L6-v2
- Motion: https://motion.dev/docs/react
