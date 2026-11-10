// The lines from the question to its nearest passages: one thin quad per
// link, laid along the segment, fading in and out with the link's strength.
struct Params {
  texel: vec2f,     // 1 / resolution (device pixels)
  query: vec2f,     // the question, in uv
  width: f32,       // line width in device pixels
  intensity: f32,
  accent: vec4f,    // sRGB
  links: array<vec4f, 14>, // x, y (uv) of the passage, strength 0..1, unused
}
@group(0) @binding(0) var<uniform> params: Params;

struct VsOut {
  @builtin(position) position: vec4f,
  @location(0) across: f32, // -1..1 over the line's width
  @location(1) along: f32,  // 0 at the question, 1 at the passage
  @location(2) strength: f32,
}

@vertex fn vs_main(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VsOut {
  var corners = array<vec2f, 6>(vec2f(0, -1), vec2f(1, -1), vec2f(0, 1), vec2f(0, 1), vec2f(1, -1), vec2f(1, 1));
  let link = params.links[ii];
  let corner = corners[vi];
  // Work in device pixels so the width is the same in every direction.
  let a = params.query / params.texel;
  let b = link.xy / params.texel;
  let direction = b - a;
  let len = max(length(direction), 1e-4);
  let normal = vec2f(-direction.y, direction.x) / len;
  let half_width = params.width * 0.5 + 1.0;
  let pixel = a + direction * corner.x + normal * corner.y * half_width;
  let uv = pixel * params.texel;
  var out: VsOut;
  out.position = vec4f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, 0.0, 1.0);
  out.across = corner.y * half_width;
  out.along = corner.x;
  out.strength = link.z;
  return out;
}

@fragment fn fs_main(frag: VsOut) -> @location(0) vec4f {
  let line = 1.0 - smoothstep(params.width * 0.5 - 0.5, params.width * 0.5 + 0.75, abs(frag.across));
  // Strongest at the question, lighter toward the passage.
  let fade = mix(0.85, 0.35, frag.along);
  let a = line * fade * frag.strength * params.intensity;
  if (a <= 0.002) {
    discard;
  }
  return vec4f(params.accent.rgb, a);
}
