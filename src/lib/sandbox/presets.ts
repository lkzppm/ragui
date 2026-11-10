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
  settings: DEFAULT_SETTINGS,
  golden: [
    { id: "landlord", question: "Qual o nome do Locador?", expect: "Carlos Henrique de Almeida", near: "LOCADOR" },
    { id: "tenant-cpf", question: "Qual o CPF do Locatário?", expect: "987.654.321-00" },
    { id: "address", question: "Qual o endereço do imóvel?", expect: "Rua Hermengarda, nº 812" },
    { id: "rent", question: "Qual o valor do aluguel?", expect: "R$ 3.200,00" },
  ],
};

export const PRESETS: readonly (Sandbox & { id: PresetId })[] = [lease];

export const DEFAULT_PRESET = lease;
