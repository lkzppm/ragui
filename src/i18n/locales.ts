// Kept apart from `index.ts` so server code (the answer route, the prompt)
// can import the locale type without pulling the interface dictionaries.
export type Locale = "en" | "pt";

export const LOCALES: readonly Locale[] = ["pt", "en"];
export const DEFAULT_LOCALE: Locale = "pt";

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "pt";
}
