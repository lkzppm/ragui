// English interface strings. This object is the schema every other language
// must match (see `index.ts`). Functions take the values a sentence needs
// so word order stays each language's business. No em dash in anything the
// visitor reads: a comma, a colon or a full stop takes its place.
import type { KnobKey } from "@/lib/rag/stages";
import type { StageId } from "@/lib/rag/types";
import type { PresetId } from "@/lib/sandbox/presets";

interface StageText {
  name: string;
  /** One or two sentences: what the stage does and why it matters. */
  what: string;
}

const stages: Record<StageId, StageText> = {
  load: {
    name: "Load",
    what: "Reads the file and takes its text. A PDF is parsed in the browser; nothing is uploaded.",
  },
  clean: {
    name: "Clean",
    what: "Normalises the text: line breaks, repeated spaces, words split across lines, ligatures and stray glyphs left by the PDF. Every later position refers to this text.",
  },
  chunk: {
    name: "Chunk",
    what: "Cuts the text into passages small enough to embed and to cite. Where it cuts decides what can be found.",
  },
  embed: {
    name: "Embed",
    what: "Turns each passage into a vector of 384 numbers with a model that runs in the browser. Passages that mean similar things get similar vectors.",
  },
  index: {
    name: "Index",
    what: "Stores the vectors and the word statistics, and projects the vectors to two dimensions for the map.",
  },
  query: {
    name: "Question",
    what: "Embeds the question with the same model, so it lands in the same space as the passages.",
  },
  dense: {
    name: "Dense search",
    what: "Compares the question's vector with every passage's and keeps the closest. It finds meaning, even when the words differ.",
  },
  sparse: {
    name: "Keyword search",
    what: "Scores passages by the words they share with the question, rarer words weighing more. It finds exact names, codes and numbers.",
  },
  fuse: {
    name: "Fuse",
    what: "Merges the two rankings by position, since their scores cannot be compared directly.",
  },
  diversify: {
    name: "Diversify",
    what: "Drops passages that repeat one already picked, so the context is not the same sentence several times.",
  },
  gate: {
    name: "Gate",
    what: "If nothing is close enough to the question, the run stops here and the model is not called.",
  },
  assemble: {
    name: "Assemble",
    what: "Packs the best passages into the prompt under a token budget and numbers them for citation.",
  },
  generate: {
    name: "Generate",
    what: "The model writes the answer using only the numbered passages, citing each statement.",
  },
  verify: {
    name: "Verify",
    what: "Reads the answer back: every citation must point to a passage that was sent, and sentences with no citation are marked.",
  },
};

const knobs: Record<KnobKey, string> = {
  strategy: "Strategy",
  size: "Chunk size, in characters",
  overlap: "Overlap, in characters",
  model: "Embedding model",
  dtype: "Precision",
  device: "Backend",
  mode: "Search mode",
  k: "Candidates per search (k)",
  k1: "k₁, term saturation",
  b: "b, length normalisation",
  rrfK: "Fusion constant (k)",
  lambda: "λ, relevance against diversity",
  threshold: "Threshold (τ)",
  sources: "Sources at most",
  budget: "Budget, in tokens",
  order: "Order of the sources",
  llm: "Model",
  temperature: "Temperature",
  seed: "Seed",
  maxOutputTokens: "Output limit, in tokens",
};

const presets: Record<PresetId, { name: string; description: string }> = {
  lease: {
    name: "Lease contract",
    description: "The course assignment: a three-page residential lease in Portuguese, and the four questions asked about it.",
  },
};

export const en = {
  lang: "en",
  name: "English",
  short: "EN",

  common: {
    language: "Language",
    pages: "Pages",
    themeLight: "Switch to the light theme",
    themeDark: "Switch to the dark theme",
    source: "Source on GitHub",
    home: "RAGui home",
  },

  nav: {
    lab: "Lab",
  },

  home: {
    sentence: "A sandbox for building a RAG about anything, with every step of the pipeline on screen.",
    open: "Open the lab",
    points: [
      {
        title: "The code retrieves",
        body: "Chunking, embeddings, similarity, ranking and the context are plain functions that run in your browser. Same documents, same question, same settings: same context.",
      },
      {
        title: "The model writes",
        body: "A model gets the passages the code chose and writes the answer, citing each one. It never decides what to read.",
      },
      {
        title: "You see all of it",
        body: "Each run leaves a trace of its steps, and the interface replays it. Nothing moves on screen that was not computed.",
      },
    ],
  },

  lab: {
    sandbox: "Sandbox",
    sample: "sample",
    scaffold: {
      title: "Nothing runs yet",
      body: "This is the skeleton of the lab. The stages below are the pipeline as it is defined, with the settings of this sandbox; the code behind each one comes next.",
    },
    pipeline: "Pipeline",
    groups: {
      ingest: { name: "Indexing", hint: "runs when the documents or the chunking change" },
      query: { name: "Question", hint: "runs on every question" },
    },
    documents: "Documents",
    openDocument: (name: string) => `Open ${name} in a new tab`,
    tests: "Test questions",
    testsHint: "Each one has a known answer, so retrieval is graded by code: it passes when a retrieved passage contains the expected text.",
    expected: "expected",
    stage: (n: number, total: number) => `Stage ${n} of ${total}`,
    formula: "What it computes",
    knobs: "Settings it reads",
    noKnobs: "This stage has no settings.",
    by: {
      code: { tag: "code", hint: "Computed by a pure function: the same input always gives the same output." },
      model: { tag: "model", hint: "The only stage where the model takes part." },
    },
    notCalibrated: "not calibrated",
  },

  presets,
  stages,
  knobs,

  footer: {
    by: "by",
    course: (name: string, school: string, term: string) => `${name}, ${school} ${term}`,
  },

  notFound: {
    title: "Page not found",
    body: "There is nothing at this address.",
    home: "Back to the start",
  },
};
