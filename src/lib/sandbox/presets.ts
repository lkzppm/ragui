import { DEFAULT_SETTINGS } from "@/lib/rag/settings";
import type { Sandbox } from "./types";

export type PresetId = "lease";

/**
 * The course assignment: a three-page residential lease and the four
 * questions the statement asks about it. The questions and the expected
 * answers are data from the assignment, in its language, not interface
 * text. Every question has a decoy in the same document
 * (spec/02-rag-pipeline.md, "The assignment's document").
 */
const lease: Sandbox & { id: PresetId } = {
  id: "lease",
  preset: true,
  documents: [{ name: "contrato-locacao-residencial.pdf", type: "pdf", url: "/samples/contrato-locacao-residencial.pdf" }],
  // Measured on 2026-11-10 with the browser's embedder: at 300 characters
  // the contract is 21 chunks and all four answers reach a context of four
  // sources, about a fifth of the document (at 400 the landlord's name
  // ranked fifth). The whole contract is some 1,200 tokens: a larger
  // context would hold all of it and retrieval would decide nothing.
  // The gate: answerable questions scored 0.873 or more, unrelated ones
  // 0.788 to 0.839, one about a guarantor the contract does not have 0.815.
  settings: {
    ...DEFAULT_SETTINGS,
    chunk: { strategy: "structure", size: 300, overlap: 40 },
    retrieve: { ...DEFAULT_SETTINGS.retrieve, threshold: 0.82 },
    context: { ...DEFAULT_SETTINGS.context, budget: 500 },
  },
  examples: ["Qual o prazo do contrato?", "Quem paga o IPTU?", "Qual a capital da França?"],
  golden: [
    { id: "landlord", question: "Qual o nome do Locador?", expect: "Carlos Henrique de Almeida", near: "LOCADOR" },
    { id: "tenant-cpf", question: "Qual o CPF do Locatário?", expect: "987.654.321-00" },
    { id: "address", question: "Qual o endereço do imóvel?", expect: "Rua Hermengarda, nº 812" },
    { id: "rent", question: "Qual o valor do aluguel?", expect: "R$ 3.200,00" },
  ],
};

export const PRESETS: readonly (Sandbox & { id: PresetId })[] = [lease];

export const DEFAULT_PRESET = lease;
