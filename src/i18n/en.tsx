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

  hero: {
    eyebrow: "Retrieval-augmented generation, in the open",
    sentence: "A sandbox for building a RAG about anything, with every step of the pipeline on screen.",
    open: "Open the lab",
    discover: "How it works",
    field: "Your pointer is the question. The lines go to the passages nearest to it.",
  },

  how: {
    title: "The code retrieves, the model writes",
    lead: "Before a model writes a word, plain functions cut your documents, turn the pieces into vectors, search them two ways and choose what goes in the prompt. Here that part is the interface.",
    facts: {
      stages: "stages, each one on screen with its numbers",
      code: "of them are code: the same input, the same output",
      dims: "numbers describe each passage",
      servers: "servers used to index and search: it runs in your browser",
    },
    figure: {
      note: "A real run on the sample contract, computed by the same code as the lab.",
      dense: "By meaning",
      sparse: "By words",
      fused: "Together",
      found: "holds the answer",
    },
  },

  principles: {
    eyebrow: "Built to be inspected",
    headline: "Nothing moves that was not computed",
    body: "Every run leaves a trace of its steps. The lab replays it: play, pause, step back, change a setting and watch what else changes.",
    items: [
      { title: "Your documents", body: "Drop a PDF or a text file. It is read, cut and indexed in the browser and never uploaded." },
      { title: "Two searches", body: "One by meaning, one by exact words. Watch them disagree, then see which one found the answer." },
      { title: "A context you can read", body: "The passages that reach the model are numbered and counted against a budget you set." },
      { title: "An answer that is checked", body: "Each citation must point at a passage that was sent. Code checks it, not the model." },
    ],
    cta: "Try it on the sample contract",
  },

  lab: {
    pipeline: "Pipeline",

    explorer: {
      eyebrow: "Lab",
      title: "Datasets",
      lead: "A dataset is a set of documents with its own settings and its own questions. Make one about anything, or start from the example.",
      example: "example",
      create: "New dataset",
      createHint: "Bring your own documents: PDF, text or Markdown.",
      name: "Name of the dataset",
      namePlaceholder: "What is it about?",
      createAction: "Create",
      cancel: "Cancel",
      untitled: "Untitled dataset",
      documents: (n: number) => (n === 1 ? "1 document" : `${n} documents`),
      asked: (n: number) => (n === 1 ? "1 question asked" : `${n} questions asked`),
      tests: (n: number) => (n === 1 ? "1 test question" : `${n} test questions`),
      remove: (name: string) => `Delete ${name}`,
      confirm: "Delete",
      local: "The datasets you make are kept in this browser. Nothing is uploaded.",
      back: "Datasets",
      backLabel: "Back to the datasets",
      missingTitle: "This dataset is not in this browser",
      missingBody: "A dataset is kept in the browser where it was made.",
      emptyTitle: "No documents yet",
      emptyBody: "Add a PDF, a text or a Markdown file. It is read and indexed here, in the browser.",
    },

    groups: {
      ingest: { name: "Indexing", hint: "runs when the documents or the chunking change" },
      query: { name: "Question", hint: "runs on every question" },
    },
    by: {
      code: { tag: "code", hint: "Computed by a pure function: the same input always gives the same output." },
      model: { tag: "model", hint: "The only stage where the model takes part." },
    },
    state: {
      skipped: "skipped",
      unused: "not used in this mode",
    },
    formula: "What it computes",
    about: (stage: string) => `About ${stage}`,
    cached: "from cache",
    cachedHint: "This text had been embedded before: the model did not run again.",

    phase: {
      loading: "Reading the documents",
      model: "Loading the embedding model",
      modelHint: (mb: number) => `About ${mb} MB the first time. The browser keeps it afterwards.`,
      downloaded: (loaded: string, total: string) => `${loaded} of ${total} MB`,
      indexing: "Indexing",
      embedding: (done: number, total: number) => `${done} of ${total} passages embedded`,
      retrying: (attempt: number, attempts: number) => `The download stopped. Trying again, ${attempt} of ${attempts}.`,
      error: "Something failed",
      again: "Try again",
    },

    sidebar: {
      documents: "Documents",
      add: "Add documents",
      addHint: "PDF, text or Markdown. They never leave this browser.",
      drop: "Drop to add",
      remove: (name: string) => `Remove ${name}`,
      open: (name: string) => `Open ${name} in a new tab`,
      noText: "No text could be read from that file. A scanned PDF has no text layer.",
      chars: (n: string) => `${n} characters`,
      chunking: "Chunking",
      retrieval: "Retrieval",
      context: "Context",
      tests: "Test questions",
      testsHint: "Each has a known answer, so retrieval is graded by code: it passes when a passage that reached the context contains the expected text.",
      expected: "expected",
      rank: { dense: "meaning", sparse: "words", fused: "together" },
      passed: "in the context",
      failed: "not in the context",
      missing: "the expected text is in no passage",
      score: (passed: number, total: number) => `${passed} of ${total}`,
      gateOff: "off",
      reset: "Back to this dataset's settings",
      history: "History",
      historyEmpty: "The questions you ask are kept here, to ask again.",
      historyClear: "Clear the history",
      forget: (question: string) => `Remove "${question}" from the history`,
      stopped: "stopped at the gate",
    },

    options: {
      strategy: { fixed: "Fixed", recursive: "Sentences", structure: "Headings" },
      strategyHint: {
        fixed: "Every N characters, at a word boundary.",
        recursive: "Whole sentences, packed up to the size.",
        structure: "A new passage at each heading, then whole sentences.",
      },
      mode: { dense: "Meaning", sparse: "Words", hybrid: "Both" },
      order: { rank: "By rank", document: "As in the document" },
    },

    corpus: {
      document: "Document",
      passages: (n: number) => `${n} passages`,
      passage: "Passage",
      overlap: "shared with the passage before",
      tokens: (n: number) => `${n} tokens`,
      chars: (n: number) => `${n} chars`,
      truncated: "cut by the model",
      vector: "Its vector, 384 numbers: one cell each, brighter is larger.",
      cleaned: (before: string, after: string) => `${before} characters read, ${after} kept`,
      cached: (embedded: number, cached: number) => `${embedded} embedded, ${cached} from cache`,
      indexed: (chunks: number, dims: number, terms: number) => `${chunks} vectors of ${dims} numbers, ${terms} distinct words`,
    },

    retriever: {
      map: "The space",
      mapNote: (percent: number) => `384 dimensions drawn in two, which keeps ${percent}% of the differences. Rankings use all of them.`,
      mapHelp: "Drag to move, scroll or pinch to zoom, click a passage to pin it.",
      mapLinks: "The thin lines join each passage to the two most similar to it. Pointing at one shows its five nearest, with the cosine of each.",
      mapAbout: "About the space",
      zoomIn: "Zoom in",
      zoomOut: "Zoom out",
      fit: "Show everything",
      question: "question",
      dense: "By meaning",
      sparse: "By words",
      fused: "Together",
      noSparse: "None of the question's words is in the documents.",
      terms: "The question's words",
      inPassages: (n: number) => (n === 1 ? "in 1 passage" : `in ${n} passages`),
      absent: "not in the documents",
      weight: "weight",
      kept: "kept",
      dropped: (to: number) => `too close to #${to}`,
      context: "Context",
      budget: (used: number, budget: number) => `${used} of ${budget} tokens`,
      leftOut: "did not fit",
      gateOpen: (best: string, threshold: string) => `The closest passage scores ${best}, above the threshold of ${threshold}.`,
      gateOff: (best: string) => `The closest passage scores ${best}. No threshold is set.`,
      gateClosed: (best: string, threshold: string) => `The closest passage scores ${best}, under the threshold of ${threshold}.`,
      gateAbout: "About the gate",
      gateClosedTitle: "Nothing here is close enough",
      gateClosedBody: "The run stops and the model is not called: no tokens, no invented answer.",
      idle: "Ask a question to watch the search.",
    },

    answer: {
      title: "Answer",
      idle: "The answer appears here, with the passages it was written from.",
      waiting: "Retrieving",
      pending: "Writing",
      skipped: "The model was not called.",
      off: "Generation is off",
      offBody: "No Groq key on the server. Everything up to the prompt works without one: add GROQ_API_KEY to .env and restart to get answers.",
      stale: "The context changed since this was written.",
      again: "Write it again",
      errors: {
        no_key: "No Groq key on the server.",
        locked: "This deployment asks for an access code.",
        bad_request: "The request was refused.",
        rate_limited: "The free tier's limit was reached. Try again in a minute.",
        bad_key: "Groq refused the key.",
        failed: "The model call failed.",
        network: "The request did not reach the server.",
      },
      usage: (input: number | null, output: number | null) => `${input ?? "?"} tokens in, ${output ?? "?"} out`,
      sources: "Sources sent",
      checks: "Checked by code",
      valid: "points to a source that was sent",
      invalid: "points to no source",
      support: (percent: number) => `${percent}% of its words are in the source`,
      uncited: (n: number) => (n === 1 ? "1 sentence cites nothing" : `${n} sentences cite nothing`),
      allCited: "Every sentence cites a source.",
      prompt: "The prompt, exactly as sent",
      system: "instructions",
      user: "message",
    },

    ask: {
      placeholder: "Ask something about the documents",
      send: "Ask",
      notReady: "The documents are still being indexed.",
      empty: "Add a document to ask about it.",
      play: "Play",
      pause: "Pause",
      back: "Step back",
      forward: "Step forward",
      replay: "Play again",
      scrub: "Position in the run",
    },
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
