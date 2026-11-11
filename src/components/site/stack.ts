import { siHuggingface, siNextdotjs, siTypescript, siWebgpu, type SimpleIcon } from "simple-icons";

/** What it is built with, for the hero and the footer. `icon: null` where simple-icons has no glyph. */
export const STACK: readonly { icon: SimpleIcon | null; label: string; href: string }[] = [
  { icon: siNextdotjs, label: "Next.js", href: "https://nextjs.org" },
  { icon: siTypescript, label: "TypeScript", href: "https://www.typescriptlang.org" },
  { icon: siHuggingface, label: "Transformers.js", href: "https://huggingface.co/docs/transformers.js" },
  { icon: siWebgpu, label: "WebGPU · vgpu", href: "https://vgpu.sh" },
  { icon: null, label: "Groq", href: "https://groq.com" },
];
