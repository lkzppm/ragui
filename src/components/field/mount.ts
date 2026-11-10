import { clock, draw, effect, frameLoop, init, surface } from "vgpu";
import fieldShader from "./field.wgsl";
import linksShader from "./links.wgsl";
import pointsShader from "./points.wgsl";
import { LINKS, POINTS, Space } from "./space";

export interface FieldOptions {
  canvas: HTMLCanvasElement;
  onError?: (error: unknown) => void;
}

type Rgba = [number, number, number, number];

export interface Palette {
  background: Rgba;
  rest: Rgba;
  accent: Rgba;
}

/** What the light theme holds, for a page whose stylesheet has not arrived yet. */
const DEFAULTS = { background: "#fafaf9", rest: "#64748b", accent: "#4f46e5" };
const POINT_RADIUS_CSS = 2.6;
const LINK_WIDTH_CSS = 1.25;
const QUERY_RADIUS_CSS = 4.5;

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

/**
 * Draws the toy space on `canvas` with vgpu: one fullscreen effect for the
 * ground, one instanced draw for the links and one for the points. The
 * search runs on the CPU every frame (`Space`). The pointer anywhere on the
 * page is the question; a click that is not on a control sends a ring out.
 * Returns the function that stops everything.
 */
export function mountField(options: FieldOptions): () => void {
  let disposed = false;
  let cleanup: (() => void) | undefined;

  (async () => {
    const gpu = await init();
    if (disposed) return gpu.dispose();
    const canvasSurface = surface(gpu, options.canvas, { dpr: [1, 2] });
    const space = new Space();
    const time = clock(gpu);

    let palette = readPalette();
    const themeObserver = new MutationObserver(() => {
      palette = readPalette();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });

    const toUv = (x: number, y: number): [number, number] => {
      const rect = options.canvas.getBoundingClientRect();
      return [(x - rect.left) / Math.max(1, rect.width), (y - rect.top) / Math.max(1, rect.height)];
    };
    const inside = (x: number, y: number) => x >= 0 && x <= 1 && y >= 0 && y <= 1;
    const onMove = (event: PointerEvent) => {
      const [x, y] = toUv(event.clientX, event.clientY);
      space.aim(inside(x, y) ? x : null, y);
    };
    const onLeave = () => space.aim(null);
    const onDown = (event: PointerEvent) => {
      // Clicks on links and buttons are for them, not for the space.
      if ((event.target as Element | null)?.closest("a, button, input, select, textarea, [role=button]")) return;
      const [x, y] = toUv(event.clientX, event.clientY);
      if (inside(x, y)) space.search();
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);

    const pointArray = () => space.points.map((point): Rgba => [point.x, point.y, point.near, point.flash]);
    const linkArray = () => {
      const links = space.links().map((point): Rgba => [point.x, point.y, point.near, 0]);
      while (links.length < LINKS) links.push([space.query[0], space.query[1], 0, 0]);
      return links;
    };
    const ring = (): Rgba => [space.ring.x, space.ring.y, space.ring.radius, space.ring.alpha];

    const ground = effect(gpu, fieldShader, {
      label: "field",
      set: { params: { texel: canvasSurface.texelSize, query: space.query, ring: ring(), aspect: 16 / 9, intensity: 1, dot_radius: QUERY_RADIUS_CSS, background: palette.background, accent: palette.accent } },
    });
    const links = draw(gpu, {
      shader: linksShader,
      label: "field-links",
      vertices: 6,
      instances: LINKS,
      blend: "alpha",
      set: { params: { texel: canvasSurface.texelSize, query: space.query, width: LINK_WIDTH_CSS, intensity: 1, accent: palette.accent, links: linkArray() } },
    });
    const points = draw(gpu, {
      shader: pointsShader,
      label: "field-points",
      vertices: 6,
      instances: POINTS,
      blend: "alpha",
      set: { params: { texel: canvasSurface.texelSize, radius: POINT_RADIUS_CSS, intensity: 1, rest: palette.rest, accent: palette.accent, points: pointArray() } },
    });
    await ground.compile({ colors: [canvasSurface.format] });
    await links.compile({ colors: [canvasSurface.format] });
    await points.compile({ colors: [canvasSurface.format] });
    if (disposed) {
      canvasSurface.dispose();
      return gpu.dispose();
    }

    const loop = frameLoop(gpu, (frame) => {
      if (document.hidden) return;
      const width = options.canvas.clientWidth;
      const height = options.canvas.clientHeight;
      if (width === 0 || height === 0) return;
      // A tab coming back from the background reports one huge delta.
      const dt = Math.min(0.1, Math.max(0, time.deltaTime));
      space.aspect = width / height;
      space.step(dt);

      const dpr = canvasSurface.dpr;
      ground.set({ params: { texel: canvasSurface.texelSize, query: space.query, ring: ring(), aspect: space.aspect, intensity: 1, dot_radius: QUERY_RADIUS_CSS * dpr, background: palette.background, accent: palette.accent } });
      links.set({ params: { texel: canvasSurface.texelSize, query: space.query, width: LINK_WIDTH_CSS * dpr, intensity: 1, accent: palette.accent, links: linkArray() } });
      points.set({ params: { texel: canvasSurface.texelSize, radius: POINT_RADIUS_CSS * dpr, intensity: 1, rest: palette.rest, accent: palette.accent, points: pointArray() } });
      frame.pass({ target: canvasSurface }, (pass) => {
        pass.draw(ground);
        pass.draw(links);
        pass.draw(points);
      });
    });

    cleanup = () => {
      loop.stop();
      themeObserver.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      canvasSurface.dispose();
      gpu.dispose();
    };
  })().catch((error) => {
    if (!disposed) options.onError?.(error);
  });

  return () => {
    disposed = true;
    cleanup?.();
  };
}
