export type Rgba = [number, number, number, number];

/** The theme's colours, as the shaders take them: sRGB 0..1. */
export interface Palette {
  background: Rgba;
  rest: Rgba;
  accent: Rgba;
}

/** What the light theme holds, for a page whose stylesheet has not arrived yet. */
const DEFAULTS = { background: "#fafaf9", rest: "#64748b", accent: "#4f46e5" };

function hexToRgba(hex: string): Rgba {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return [((value >> 16) & 0xff) / 255, ((value >> 8) & 0xff) / 255, (value & 0xff) / 255, 1];
}

/** The theme's colours, from the page's custom properties (six-digit hex in both themes). */
export function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement);
  const color = (name: string, fallback: string) => {
    const value = style.getPropertyValue(name).trim();
    return hexToRgba(/^#[0-9a-f]{6}$/i.test(value) ? value : fallback);
  };
  return { background: color("--background", DEFAULTS.background), rest: color("--corpus", DEFAULTS.rest), accent: color("--query", DEFAULTS.accent) };
}

/** Reads the palette again whenever the theme changes. Returns the function that stops watching. */
export function watchPalette(onChange: (palette: Palette) => void): () => void {
  const observer = new MutationObserver(() => onChange(readPalette()));
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
  return () => observer.disconnect();
}
