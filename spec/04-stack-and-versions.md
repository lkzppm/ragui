# 04 — Stack, versions and setup

Status on 2026-11-10: **scaffolded.** `package.json` is the source of truth for versions.

## Installed (2026-11-10)

| Package | Version | Note |
|---|---|---|
| node / pnpm | 26.7 / 11.25 on Lucas's machine | CI uses Node 24 |
| next | **16.4.5** | The latest that pnpm accepts. 16.4.6 came out on 2026-11-09 and pnpm 11 refuses packages less than a day old; asking for it by version made pnpm write exceptions to that check into `pnpm-workspace.yaml`, which was undone. Bump with `pnpm add next@latest eslint-config-next@latest` any day after 2026-11-10. APIs differ from model training data: read `node_modules/next/dist/docs/` before using an API from memory |
| react / react-dom | 19.3.1 | |
| tailwindcss, @tailwindcss/postcss | 4.3.5 | tokens in `src/app/globals.css` |
| shadcn | 4.23.0 | radix mode (`radix-nova`), `components.json` copied from Debait. `button` added with the CLI |
| radix-ui, class-variance-authority, cn, tw-animate-css | 1.8.1 / 0.7.1 / 0.5.2 / 1.4.0 | what shadcn components import |
| motion | 14.11.1 | `motion/react` |
| geist | 1.9.2 | Geist Sans and Mono, bundled: the build needs no network for fonts |
| lucide-react, simple-icons | 1.70.0 / 16.37.0 | interface icons, the GitHub glyph |
| typescript / eslint | **5.9.3 / 9.39.5, pinned** | TypeScript 7 and ESLint 10 exist; the sister projects' toolchain was never tried with them. `eslint-config-next` is 16.4.5 |

## Added with the pipeline (2026-11-10)

| Package | Version | Note |
|---|---|---|
| @huggingface/transformers | 4.3.2 | the embedder. Runs in a Web Worker under Next 16 with Turbopack with no extra configuration, in development and in the production build; and in Node under `tsx`. Loaded with a dynamic import |
| unpdf | 2.1.0 | PDF text, in the browser and in Node. On the contract it gives one line per printed line, bullets as U+F0B7 |
| zustand | 5.1.0 | the lab's store |
| ai, @ai-sdk/groq | 7.0.166 / 4.0.78 | `streamText` with `instructions` (`system` is deprecated in 7), `fullStream` parts are `{ type: "text-delta", text }` and `{ type: "error", error }` |
| zod | 4.6.7 | the route's body |
| vgpu, @vgpu/wgsl, @vgpu/wgsl-std | **0.5.0**, pinned | the landing page's background. 0.6.0 exists; 0.5.0 is what the sister projects run and what the code was written against. `@webgpu/types` 0.1.74 |
| tsx | 4.23.15 | `pnpm rag` |

`pnpm-workspace.yaml` allows one install script (`esbuild`, for `tsx`) and refuses the rest, `onnxruntime-node` included: its binaries for macOS come in the package, and on Linux the script would download GPU libraries CI and Vercel have no use for. Nothing on the server imports it.

Not needed at all: a vector database, LangChain or LlamaIndex (the point is to write and show the retrieval ourselves), a second model provider, Redis.

## How the scaffold was made (2026-11-10)

Not with `create-next-app`: `tsconfig.json`, `postcss.config.mjs`, `components.json`, `vercel.json` and `eslint.config.mjs` were copied from `../Debate-ai`, `pnpm-workspace.yaml` and the CI workflow adapted from it (no shader step), and the dependencies added with `pnpm add`. The language provider and the theme hook are Debait's with new storage keys (`ragui.locale`, `ragui.theme`). `next dev` wrote `AGENTS.md`, which `CLAUDE.md` imports on its first line. To add a shadcn component: `pnpm dlx shadcn@latest add <name>` (never hand-edit `src/components/ui`).

Both things that were new here worked on 2026-11-10: `@huggingface/transformers` in a Web Worker under Next 16 with Turbopack (`new Worker(new URL("./worker.ts", import.meta.url), { type: "module" })`), and the same package under `tsx`. The ONNX runtime's WASM files and the model come from jsDelivr and Hugging Face at run time, so a first visit needs both reachable.

## Environment variables (`.env.example`)

Read by the answer route and by `pnpm rag ask --answer`, from `.env` or `.env.local` (both git-ignored). Lucas's `.env` has a key since 2026-11-10.

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

What that means here: with the defaults set for the assignment's contract, one answer is about 500 tokens of context, 300 of prompt and question and up to 400 of output (the four answers are one line each), so roughly 1,200 tokens: about six answers a minute and 160 a day on one model. A larger corpus with a 1,800-token context costs about 2,700 an answer, three a minute and seventy a day. Hence the gate that skips the call, and the fact that retrieval costs nothing.

Proposed default: `openai/gpt-oss-120b`, as in the sister projects. `llama-3.3-70b-versatile` is the alternative if reasoning tokens get in the way.

## Commands

```
pnpm dev                                    # the whole app; generation needs GROQ_API_KEY in .env
pnpm lint && pnpm typecheck && pnpm build   # what CI runs (typecheck = next typegen + tsc)
pnpm exec vgpu check src/components/field/field.wgsl   # and points.wgsl, links.wgsl, cells.wgsl
pnpm rag ingest                             # the indexing trace and every chunk of the sample
pnpm rag eval                               # its test questions: ranks, recall, MRR
pnpm rag ask '<question>' [--answer]        # the query trace; --answer also calls Groq
```

In development the lab's store is on `window.lab` (`window.lab.getState().ask("…", "pt")`, `.update({ chunk: { size: 300 } })`, `.tests`).

**Driving it without a browser window.** Playwright's headless Chromium sits in `~/Library/Caches/ms-playwright/`. Started with `--remote-debugging-port`, it is driven over the DevTools protocol with Node's own `WebSocket`: navigate, evaluate script, wait for a condition, capture a screenshot. That is how everything in `03-ui-design.md` under "Seen" was looked at. WebGPU needs `--enable-unsafe-webgpu --enable-features=Vulkan,WebGPU --use-angle=metal`; without them `requestAdapter()` returns null and the landing page shows its still frame, which is itself worth checking. Ports 3000 and 3111 are taken by other projects on Lucas's machine: start with `PORT=<free port> pnpm dev`.

## Repository and deployment

- **Repository**: `lkzppm/ragui`, public, created on 2026-11-10. Branches `main` ← `dev` ← `feat/*` or `fix/*`; commit with `/commit`, integrate with `/merge`.
- **CI** (`.github/workflows/ci.yml`): lint, typecheck, the four shaders through `vgpu check`, and build, on pushes and pull requests to `main` and `dev`, Node 24, one job named `lint · types · build`.
- **Branch rules** (set on 2026-11-10, copied from Debait): a ruleset on `main` requires a pull request and the `lint · types · build` check, and blocks deletion and force pushes; one on `dev` requires the check and blocks deletion and force pushes. Auto-merge and delete-branch-on-merge are on, so `/merge` arms auto-merge and the merge lands when CI is green, and a merged feature branch is removed on GitHub. The two pull requests before the scaffold were merged by hand: there was no CI then, and the `/merge` helper script stops when a repository reports no checks at all.
- **Vercel** (2026-11-11): project `rag-ui-ufrj` in Lucas's team, connected to `lkzppm/ragui` with the CLI (`vercel project add`, `vercel link`, `vercel git connect`). Production tracks `main` and is at https://rag-ui-ufrj.vercel.app; every pull request gets a preview. **`GROQ_API_KEY` is not set there yet**, so on the live site generation is off and everything up to the prompt works; Lucas adds it with `vercel env add GROQ_API_KEY production` and redeploys. Whoever has the address can then spend the key's free quota: `ACCESS_CODE` exists on the route but the interface has no field to type it. `vercel link` wrote a git-ignored `.env.local` holding only a Vercel token. Web Analytics (`@vercel/analytics` 2.0.1, `<Analytics />` in the root layout) counts page views once it is enabled for the project in Vercel's dashboard.

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
