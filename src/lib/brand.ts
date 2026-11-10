/**
 * Names live here and nowhere else, so renaming the project is a one-file
 * change. The wordmark splits "RAGui" into its two halves: what it is about
 * and what it adds.
 */
export const BRAND = {
  name: "RAGui",
  wordmark: ["RAG", "ui"] as const,
  repo: "https://github.com/lkzppm/ragui",
  /** Who made it, for the footer. */
  author: {
    name: "Lucas Pacheco",
    github: "https://github.com/lkzppm",
  },
  course: {
    name: "Inteligência Artificial",
    school: "UFRJ",
    term: "2026/2",
  },
} as const;
