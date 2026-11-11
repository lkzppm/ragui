// The ground of the landing page's last screen: a page of cells, like a
// vector laid flat, one number per cell. A cell's number is how close it is
// to the question, which wanders or follows the pointer, plus a little of
// its own that rises and falls on its own time. A larger number is a larger
// dot, nearer the question's colour. Colours are sRGB and written as they
// are (the surface format is not sRGB), so they match the same CSS colours.
struct Params {
  texel: vec2f,      // 1 / resolution (device pixels)
  query: vec2f,      // the question, in uv
  cell: f32,         // distance between two cells, in device pixels
  radius: f32,       // a cell's dot at rest, in device pixels
  time: f32,         // seconds
  aspect: f32,       // width / height
  intensity: f32,    // overall strength, 0..1
  background: vec4f, // sRGB, the page
  rest: vec4f,       // sRGB, a cell at rest
  accent: vec4f,     // sRGB, the question's colour
}
@group(0) @binding(0) var<uniform> params: Params;

// One stable number in 0..1 per cell.
fn hash(cell: vec2f) -> f32 {
  let p = fract(cell * vec2f(0.1031, 0.1030));
  let q = p + dot(p, p.yx + 33.33);
  return fract((q.x + q.y) * q.x);
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  // Cells are counted from the middle, so the page stays symmetric at any size.
  let from_middle = (uv - 0.5) / params.texel;
  let cell = floor(from_middle / params.cell + 0.5);
  let centre = cell * params.cell;
  let cell_uv = centre * params.texel + 0.5;

  // How close the cell is to the question.
  let to_query = vec2f((cell_uv.x - params.query.x) * params.aspect, cell_uv.y - params.query.y);
  let near = exp(-dot(to_query, to_query) / 0.045);

  // Its own number: most of the time low, now and then high, each cell on its own clock.
  let seed = hash(cell);
  let beat = 0.5 + 0.5 * sin(params.time * (0.35 + seed * 0.9) + seed * 6.2832 * 7.0);
  // A slow swell crossing the page decides where the cells are livelier.
  let swell = 0.5 + 0.5 * sin(cell_uv.x * params.aspect * 4.2 + cell_uv.y * 2.6 - params.time * 0.32);
  let own = pow(beat, 8.0) * (0.25 + 0.75 * swell) * 0.55;

  let value = clamp(near + own, 0.0, 1.0);

  // Strongest in the middle, gone before the edges.
  let reach = length(uv - 0.5) * 1.41421356;
  let fade = 1.0 - smoothstep(0.1, 0.74, reach);

  let radius = params.radius * (1.0 + 1.7 * value);
  let dot_cover = 1.0 - smoothstep(radius - 0.6, radius + 0.6, length(from_middle - centre));
  let ink = mix(mix(params.background.rgb, params.rest.rgb, 0.36), params.accent.rgb, value);

  // A faint light under the question, so the lit cells sit in something.
  let to_pixel = vec2f((uv.x - params.query.x) * params.aspect, uv.y - params.query.y);
  let glow = exp(-dot(to_pixel, to_pixel) / 0.07) * 0.07 * fade * params.intensity;

  let ground = mix(params.background.rgb, params.accent.rgb, glow);
  return vec4f(mix(ground, ink, dot_cover * fade * params.intensity), 1.0);
}
