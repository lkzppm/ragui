/** Rows are L2-normalised, so cosine similarity is the dot product. */
export function dot(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

/** Row `i` of a row-major matrix, as a view. */
export function row(matrix: Float32Array, dims: number, i: number): Float32Array {
  return matrix.subarray(i * dims, (i + 1) * dims);
}

/** Positions sorted by score, highest first; ties go to the lower position, so the order is total. */
export function ranking(scores: ArrayLike<number>): number[] {
  const order = Array.from({ length: scores.length }, (_, i) => i);
  order.sort((a, b) => scores[b] - scores[a] || a - b);
  return order;
}
