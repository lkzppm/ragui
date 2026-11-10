import type { Projection } from "./types";

/**
 * PCA to two dimensions, for the map. Deterministic: the two components are
 * found by power iteration from a fixed starting vector, with the first
 * removed before the second, and each is flipped so its largest coordinate
 * is positive. A new point (the question) is placed with the same mean and
 * components, so adding it moves nothing else.
 *
 * The map is a picture, not the search: rankings always use all dimensions.
 */
export function project(vectors: Float32Array, dims: number): Projection {
  const count = vectors.length / dims;
  const mean = new Float32Array(dims);
  for (let i = 0; i < count; i++) for (let d = 0; d < dims; d++) mean[d] += vectors[i * dims + d] / Math.max(1, count);
  const centred = new Float64Array(vectors.length);
  let total = 0;
  for (let i = 0; i < count; i++) {
    for (let d = 0; d < dims; d++) {
      const value = vectors[i * dims + d] - mean[d];
      centred[i * dims + d] = value;
      total += value * value;
    }
  }

  const component = (): { axis: Float32Array; variance: number } => {
    const axis = new Float64Array(dims);
    // Any vector not orthogonal to the answer will do; this one is the same everywhere.
    for (let d = 0; d < dims; d++) axis[d] = Math.sin(d * 12.9898 + 4.1414);
    const scores = new Float64Array(count);
    let variance = 0;
    for (let iteration = 0; iteration < 80; iteration++) {
      for (let i = 0; i < count; i++) {
        let sum = 0;
        for (let d = 0; d < dims; d++) sum += centred[i * dims + d] * axis[d];
        scores[i] = sum;
      }
      const next = new Float64Array(dims);
      for (let i = 0; i < count; i++) for (let d = 0; d < dims; d++) next[d] += centred[i * dims + d] * scores[i];
      let norm = 0;
      for (let d = 0; d < dims; d++) norm += next[d] * next[d];
      norm = Math.sqrt(norm);
      if (norm < 1e-12) break;
      for (let d = 0; d < dims; d++) axis[d] = next[d] / norm;
      variance = norm;
    }
    let largest = 0;
    for (let d = 1; d < dims; d++) if (Math.abs(axis[d]) > Math.abs(axis[largest])) largest = d;
    if (axis[largest] < 0) for (let d = 0; d < dims; d++) axis[d] = -axis[d];
    // Remove this direction from the data before looking for the next.
    for (let i = 0; i < count; i++) {
      let sum = 0;
      for (let d = 0; d < dims; d++) sum += centred[i * dims + d] * axis[d];
      for (let d = 0; d < dims; d++) centred[i * dims + d] -= sum * axis[d];
    }
    return { axis: Float32Array.from(axis), variance };
  };

  const first = component();
  const second = component();
  const projection: Projection = {
    mean,
    components: [first.axis, second.axis],
    points: new Float32Array(count * 2),
    explained: [total > 0 ? first.variance / total : 0, total > 0 ? second.variance / total : 0],
  };
  for (let i = 0; i < count; i++) {
    const [x, y] = place(projection, vectors.subarray(i * dims, (i + 1) * dims));
    projection.points[i * 2] = x;
    projection.points[i * 2 + 1] = y;
  }
  return projection;
}

/** Where a vector lands on the map. */
export function place(projection: Projection, vector: Float32Array): [number, number] {
  let x = 0;
  let y = 0;
  for (let d = 0; d < vector.length; d++) {
    const value = vector[d] - projection.mean[d];
    x += value * projection.components[0][d];
    y += value * projection.components[1][d];
  }
  return [x, y];
}
