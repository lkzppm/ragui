// The pipeline in the terminal, on the sample sandbox, with the same code the browser runs.
//
//   pnpm rag ingest                     the indexing trace and the chunks
//   pnpm rag eval                       the sandbox's test questions: is each answer retrieved?
//   pnpm rag ask '<question>'           the query trace, no model call
//   pnpm rag ask '<question>' --answer  also asks Groq (needs GROQ_API_KEY)
//   pnpm rag figure                     rewrites the landing page's figure from real runs
//
// Options: --size N --overlap N --strategy fixed|recursive|structure --mode dense|sparse|hybrid
//          --k N --sources N --budget N --lambda X --threshold X
import { readFile } from "node:fs/promises";
import { nodeEmbedder } from "@/lib/embed/node";
import { modelOf } from "@/lib/embed/models";
import { pdfText } from "@/lib/load/pdf";
import { grade, summarize } from "@/lib/rag/eval";
import { ingest } from "@/lib/rag/run-ingest";
import { query } from "@/lib/rag/run-query";
import type { Settings } from "@/lib/rag/settings";
import { stepOf, type Index, type RawDoc, type Runtime } from "@/lib/rag/types";
import { verify } from "@/lib/rag/verify";
import { DEFAULT_PRESET } from "@/lib/sandbox/presets";

const [command = "eval", ...rest] = process.argv.slice(2);
const flag = (name: string) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
const has = (name: string) => rest.includes(`--${name}`);
const number = (name: string, fallback: number) => (flag(name) === undefined ? fallback : Number(flag(name)));

const sandbox = DEFAULT_PRESET;
const base = sandbox.settings;
const settings: Settings = {
  ...base,
  chunk: { strategy: (flag("strategy") as Settings["chunk"]["strategy"]) ?? base.chunk.strategy, size: number("size", base.chunk.size), overlap: number("overlap", base.chunk.overlap) },
  retrieve: {
    ...base.retrieve,
    mode: (flag("mode") as Settings["retrieve"]["mode"]) ?? base.retrieve.mode,
    k: number("k", base.retrieve.k),
    lambda: number("lambda", base.retrieve.lambda),
    threshold: flag("threshold") === undefined ? base.retrieve.threshold : flag("threshold") === "off" ? null : Number(flag("threshold")),
  },
  context: { ...base.context, sources: number("sources", base.context.sources), budget: number("budget", base.context.budget) },
};

const raw: RawDoc[] = [];
for (const document of sandbox.documents) {
  if (!document.url) continue;
  const started = performance.now();
  const bytes = new Uint8Array(await readFile(`public${document.url}`));
  const text = document.type === "pdf" ? (await pdfText(bytes)).text : new TextDecoder().decode(bytes);
  raw.push({ name: document.name, type: document.type, text, ms: performance.now() - started });
}

const runtime: Runtime = { embedder: await nodeEmbedder(modelOf(settings.embed)), now: () => performance.now(), cache: new Map() };
const { index, trace } = await ingest(raw, settings, runtime);
const ms = (value: number) => `${value.toFixed(1)} ms`;
const label = (i: number, width = 46) => {
  const chunk = index.chunks[i];
  return `#${String(i).padStart(2)} ${(chunk.title ?? "").slice(0, 22).padEnd(22)} ${JSON.stringify(chunk.text.slice(0, width))}`;
};

function printIngest() {
  for (const step of trace) {
    if (step.kind === "load") console.log(`load      ${step.docs.map((doc) => `${doc.name} (${doc.chars} chars)`).join(", ")}`);
    if (step.kind === "clean") console.log(`clean     ${step.before} → ${step.after} chars`);
    if (step.kind === "chunk") console.log(`chunk     ${step.strategy}, size ${step.size}, overlap ${step.overlap} → ${step.count} chunks`);
    if (step.kind === "embed") console.log(`embed     ${step.model.id} ${step.model.dtype}: ${step.embedded} embedded, ${step.cached} cached, ${step.tokens} tokens, ${step.truncated} truncated, ${ms(step.ms)}`);
    if (step.kind === "index") console.log(`index     ${step.chunks} × ${step.dims}, ${step.terms} terms, map keeps ${(index.projection.explained[0] * 100).toFixed(0)}% + ${(index.projection.explained[1] * 100).toFixed(0)}% of the variance`);
  }
}

async function ask(index: Index, question: string) {
  return query(index, question, settings, runtime, { locale: "pt" });
}

if (command === "ingest") {
  printIngest();
  console.log();
  for (const chunk of index.chunks) console.log(`#${String(chunk.index).padStart(2)} [${chunk.start}-${chunk.end}] ${String(chunk.text.length).padStart(4)} chars ${String(chunk.tokens).padStart(4)} tok  ${(chunk.title ?? "").padEnd(34)} ${JSON.stringify(chunk.text.slice(0, 70))}`);
} else if (command === "eval") {
  printIngest();
  console.log(`\nmode ${settings.retrieve.mode}, k ${settings.retrieve.k}, λ ${settings.retrieve.lambda}, at most ${settings.context.sources} sources in ${settings.context.budget} tokens, threshold ${settings.retrieve.threshold ?? "off"}\n`);
  console.log("question".padEnd(30), "holders".padEnd(10), "dense", "sparse", "fused", "context", " best cos");
  const results = [];
  for (const test of sandbox.golden) {
    const run = await ask(index, test.question);
    const result = grade(index, test, run);
    results.push(result);
    const gate = stepOf(run, "gate")!;
    const cell = (rank: number | null) => String(rank ?? "–").padStart(5);
    console.log(test.question.padEnd(30), result.holders.join(",").padEnd(10), cell(result.dense), cell(result.sparse).padStart(6), cell(result.fused), result.inContext ? "    yes" : "     NO", gate.best.toFixed(3).padStart(9), gate.pass ? "" : "(gate closed)");
  }
  const { recall, mrr } = summarize(results);
  console.log(`\nrecall ${(recall * 100).toFixed(0)}%   MRR ${mrr.toFixed(3)}`);
  for (const stray of ["Qual o nome do fiador?", "Qual a capital da França?", "Como fazer um bolo de cenoura?"]) {
    const gate = stepOf(await ask(index, stray), "gate")!;
    console.log(`no answer expected: ${stray.padEnd(34)} best cos ${gate.best.toFixed(3)} ${gate.pass ? "" : "(gate closed)"}`);
  }
  if (recall < 1) process.exitCode = 1;
} else if (command === "ask") {
  const question = rest.find((arg) => !arg.startsWith("--") && rest[rest.indexOf(arg) - 1]?.startsWith("--") !== true) ?? rest[0];
  if (!question) throw new Error("pnpm rag ask '<question>'");
  const run = await ask(index, question);
  for (const step of run) {
    if (step.kind === "query") console.log(`query     ${JSON.stringify(step.text)} (${step.tokens} tokens)`);
    if (step.kind === "dense") { console.log(`dense     scanned ${step.scanned}`); for (const hit of step.hits) console.log(`  ${hit.rank}. ${hit.score.toFixed(3)}  ${label(hit.chunk)}`); }
    if (step.kind === "sparse") { console.log(`sparse    ${step.terms.map((term) => `${term.term}(df ${term.df}, idf ${term.idf.toFixed(2)})`).join(" ")}`); for (const hit of step.hits) console.log(`  ${hit.rank}. ${hit.score.toFixed(3)}  ${label(hit.chunk)}  ← ${hit.matched.map((m) => m.term).join(", ")}`); }
    if (step.kind === "fuse") { console.log(`fuse      ${step.mode}, k ${step.k}`); for (const hit of step.hits) console.log(`  ${hit.rank}. ${hit.score.toFixed(4)}  d${hit.denseRank ?? "–"} s${hit.sparseRank ?? "–"}  ${label(hit.chunk)}`); }
    if (step.kind === "diversify") { console.log(`diversify λ ${step.lambda}: kept ${step.kept.map((hit) => `#${hit.chunk}`).join(" ")}${step.dropped.length ? `, dropped ${step.dropped.map((hit) => `#${hit.chunk} (too close to #${hit.tooCloseTo}, ${hit.similarity.toFixed(3)})`).join(" ")}` : ""}`); }
    if (step.kind === "gate") console.log(`gate      best ${step.best.toFixed(3)} vs ${step.threshold ?? "off"} → ${step.pass ? "open" : "CLOSED, the model is not called"}`);
    if (step.kind === "assemble") { console.log(`assemble  ${step.sources.length} sources, ${step.tokens}/${step.budget} tokens${step.leftOut.length ? `, left out ${step.leftOut.map((hit) => `#${hit.chunk}`).join(" ")}` : ""}`); for (const source of step.sources) console.log(`  [${source.n}] chunks ${source.chunks.join("+")} (${source.tokens} tok) ${JSON.stringify(source.text.slice(0, 80))}`); }
  }
  const assembled = stepOf(run, "assemble");
  if (has("answer") && assembled) {
    if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY is not set");
    const { answer } = await import("@/lib/answer/groq");
    const started = performance.now();
    const result = await answer({ system: assembled.prompt.system, user: assembled.prompt.user, settings: settings.generate });
    let text = "";
    process.stdout.write("\nanswer    ");
    for await (const delta of result.textStream) { text += delta; process.stdout.write(delta); }
    const usage = await result.usage;
    console.log(`\n\n${result.model}, ${ms(performance.now() - started)}, ${usage.inputTokens} in + ${usage.outputTokens} out tokens, finish: ${await result.finishReason}`);
    const check = verify(text, assembled.sources);
    for (const citation of check.citations) console.log(`  sentence ${citation.sentence + 1} cites [${citation.n}]: ${citation.valid ? `valid, support ${citation.support === null ? "–" : `${Math.round(citation.support * 100)}%`}` : "INVALID"}`);
    if (check.uncited.length) console.log(`  uncited sentences: ${check.uncited.map((i) => i + 1).join(", ")}`);
  }
} else if (command === "figure") {
  // The landing page's figure: real runs of the sample's test questions, kept small.
  const { writeFile } = await import("node:fs/promises");
  const runs = [];
  for (const test of sandbox.golden) {
    const run = await ask(index, test.question);
    const { holders } = grade(index, test, run);
    const title = (chunk: number) => index.chunks[chunk].title ?? index.chunks[chunk].text.slice(0, 40);
    const row = (hit: { chunk: number; rank: number; score: number }) => ({ chunk: hit.chunk, title: title(hit.chunk), score: Number(hit.score.toFixed(4)), holder: holders.includes(hit.chunk) });
    const kept = new Set(stepOf(run, "diversify")!.kept.map((hit) => hit.chunk));
    runs.push({
      id: test.id,
      question: test.question,
      expect: test.expect,
      dense: stepOf(run, "dense")!.hits.slice(0, 5).map(row),
      sparse: stepOf(run, "sparse")!.hits.slice(0, 5).map(row),
      fused: stepOf(run, "fuse")!.hits.slice(0, 5).map((hit) => ({ ...row(hit), denseRank: hit.denseRank, sparseRank: hit.sparseRank, kept: kept.has(hit.chunk) })),
    });
  }
  const out = { model: settings.embed.model, chunks: index.chunks.length, sources: settings.context.sources, runs };
  await writeFile("src/components/site/figure-data.json", `${JSON.stringify(out, null, 2)}\n`);
  console.log(`wrote src/components/site/figure-data.json (${runs.length} runs over ${index.chunks.length} chunks)`);
} else {
  throw new Error(`Unknown command: ${command}`);
}
