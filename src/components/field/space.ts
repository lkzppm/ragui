/**
 * The toy space behind the landing page: passages as points in a plane,
 * gathered in a few clusters the way the chunks of a few documents are,
 * and a question that moves among them. Every frame it does what the
 * retriever does, with two dimensions instead of 384: it measures the
 * distance from the question to every point and keeps the nearest.
 *
 * Seeded, so the picture is the same on every visit. Positions are in uv
 * (0..1 on both axes); distances correct for the screen's shape.
 */

export const POINTS = 132;
export const NEAREST = 6;
/** Links drawn at once: the nearest, plus the ones still fading out. */
export const LINKS = 14;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Point {
  homeX: number;
  homeY: number;
  phase: number;
  speed: number;
  drift: number;
  x: number;
  y: number;
  /** 0..1, eased: how much it is one of the nearest right now. */
  near: number;
  /** 0..1, decaying: lit by a search ring passing over it. */
  flash: number;
}

/** Clusters keep to the right, where no text covers them on a wide screen. */
const CLUSTERS: readonly [number, number, number][] = [
  [0.62, 0.3, 0.075],
  [0.82, 0.22, 0.06],
  [0.9, 0.52, 0.07],
  [0.7, 0.62, 0.085],
  [0.5, 0.78, 0.06],
  [0.84, 0.82, 0.055],
  [0.3, 0.2, 0.05],
];

export class Space {
  aspect = 16 / 9;
  time = 0;
  readonly points: Point[] = [];
  /** The question, in uv. */
  query: [number, number] = [0.72, 0.45];
  /** A search ring: its radius (in units of screen height) and how visible it still is. */
  ring = { radius: 0, alpha: 0, x: 0, y: 0 };
  private target: [number, number] | null = null;

  constructor() {
    const random = mulberry32(20261110);
    const gauss = () => {
      const u = Math.max(1e-6, random());
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
    };
    for (let i = 0; i < POINTS; i++) {
      const [cx, cy, spread] = CLUSTERS[i % CLUSTERS.length];
      const homeX = Math.min(0.98, Math.max(0.02, cx + gauss() * spread));
      const homeY = Math.min(0.96, Math.max(0.04, cy + gauss() * spread * 1.3));
      this.points.push({ homeX, homeY, phase: random() * Math.PI * 2, speed: 0.15 + random() * 0.35, drift: 0.006 + random() * 0.012, x: homeX, y: homeY, near: 0, flash: 0 });
    }
    this.step(0);
  }

  /** Where the question should go: the pointer, or nowhere in particular. */
  aim(x: number | null, y?: number) {
    this.target = x === null || y === undefined ? null : [x, y];
  }

  /** Sends a ring out from the question: an exact search, visiting every point in order of distance. */
  search() {
    this.ring = { radius: 0, alpha: 1, x: this.query[0], y: this.query[1] };
  }

  private distance(point: Point, x: number, y: number): number {
    return Math.hypot((point.x - x) * this.aspect, point.y - y);
  }

  step(dt: number) {
    this.time += dt;
    const t = this.time;

    // With no pointer the question wanders a slow closed path through the clusters.
    const goal = this.target ?? [0.7 + 0.2 * Math.sin(t * 0.21), 0.5 + 0.3 * Math.sin(t * 0.13 + 1.3)];
    const follow = 1 - Math.pow(1 - (this.target ? 0.14 : 0.03), dt * 60);
    this.query[0] += (goal[0] - this.query[0]) * follow;
    this.query[1] += (goal[1] - this.query[1]) * follow;

    for (const point of this.points) {
      point.x = point.homeX + Math.cos(t * point.speed + point.phase) * point.drift;
      point.y = point.homeY + Math.sin(t * point.speed * 0.8 + point.phase) * point.drift * this.aspect * 0.6;
    }

    // The search itself: every point measured, the nearest kept.
    const order = this.points.map((point, i) => ({ i, d: this.distance(point, this.query[0], this.query[1]) }));
    order.sort((a, b) => a.d - b.d || a.i - b.i);
    const nearest = new Set(order.slice(0, NEAREST).map((entry) => entry.i));

    if (this.ring.alpha > 0) {
      this.ring.radius += dt * 0.55;
      this.ring.alpha = Math.max(0, 1 - this.ring.radius / 1.4);
    }
    const ease = 1 - Math.pow(1 - 0.12, dt * 60);
    this.points.forEach((point, i) => {
      point.near += ((nearest.has(i) ? 1 : 0) - point.near) * ease;
      point.flash = Math.max(0, point.flash - dt * 1.4);
      if (this.ring.alpha > 0 && Math.abs(this.distance(point, this.ring.x, this.ring.y) - this.ring.radius) < 0.018) point.flash = Math.max(point.flash, this.ring.alpha);
    });
  }

  /** The points that have a link to the question right now, strongest first. */
  links(): Point[] {
    return this.points
      .filter((point) => point.near > 0.02)
      .sort((a, b) => b.near - a.near)
      .slice(0, LINKS);
  }
}
