// The ground of the toy space: the page colour, a soft light around the
// question, and the ring of a search travelling outward from it. Colours
// are sRGB and written as they are (the surface format is not sRGB), so
// they match the same CSS colours.
struct Params {
  texel: vec2f,      // 1 / resolution (device pixels)
  query: vec2f,      // the question, in uv
  ring: vec4f,       // x, y (uv), radius (screen heights), alpha
  aspect: f32,       // width / height
  intensity: f32,    // overall strength, 0..1
  dot_radius: f32,   // the question's own disc, in device pixels
  background: vec4f, // sRGB, the page
  accent: vec4f,     // sRGB, the question's colour
}
@group(0) @binding(0) var<uniform> params: Params;

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let to_query = vec2f((uv.x - params.query.x) * params.aspect, uv.y - params.query.y);
  let glow = exp(-dot(to_query, to_query) / 0.03) * 0.09 + exp(-dot(to_query, to_query) / 0.22) * 0.045;

  let to_ring = vec2f((uv.x - params.ring.x) * params.aspect, uv.y - params.ring.y);
  let dist = length(to_ring);
  // A thin line with a soft trailing edge inside it.
  let edge = 1.0 - smoothstep(0.0, 0.0025, abs(dist - params.ring.z));
  let wake = (1.0 - smoothstep(0.0, 0.09, params.ring.z - dist)) * step(dist, params.ring.z) * 0.07;
  let ring = (edge * 0.32 + wake) * params.ring.w * params.ring.w;

  // The question itself: a disc, and a thin halo that keeps it apart from the passages.
  let pixels = length((uv - params.query) / params.texel);
  let core = 1.0 - smoothstep(params.dot_radius - 0.75, params.dot_radius + 0.75, pixels);
  let halo = (1.0 - smoothstep(0.0, 1.5, abs(pixels - params.dot_radius * 2.4))) * 0.45;

  let amount = clamp((glow + ring) * params.intensity + max(core, halo), 0.0, 1.0);
  return vec4f(mix(params.background.rgb, params.accent.rgb, amount), 1.0);
}
