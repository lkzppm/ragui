// The passages: one disc per point (an instanced quad). A point near the
// question grows and takes the question's colour; one a search ring has
// just crossed flashes. Alpha-blended over the ground.
struct Params {
  texel: vec2f,     // 1 / resolution (device pixels)
  radius: f32,      // disc radius in device pixels
  intensity: f32,
  rest: vec4f,      // sRGB, a point at rest
  accent: vec4f,    // sRGB, a point near the question
  points: array<vec4f, 132>, // x, y (uv), near 0..1, flash 0..1
}
@group(0) @binding(0) var<uniform> params: Params;

struct VsOut {
  @builtin(position) position: vec4f,
  @location(0) local: vec2f, // position inside the quad, in device pixels from the centre
  @location(1) near: f32,
  @location(2) flash: f32,
  @location(3) radius: f32,
}

@vertex fn vs_main(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VsOut {
  var corners = array<vec2f, 6>(vec2f(-1, -1), vec2f(1, -1), vec2f(-1, 1), vec2f(-1, 1), vec2f(1, -1), vec2f(1, 1));
  let p = params.points[ii];
  let radius = params.radius * (1.0 + 0.9 * p.z + 0.5 * p.w);
  // Room for the halo of a point that is lit.
  let extent = radius * 3.2 + 2.0;
  let corner = corners[vi];
  let uv = p.xy + corner * extent * params.texel;
  var out: VsOut;
  out.position = vec4f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, 0.0, 1.0);
  out.local = corner * extent;
  out.near = p.z;
  out.flash = p.w;
  out.radius = radius;
  return out;
}

@fragment fn fs_main(frag: VsOut) -> @location(0) vec4f {
  let r = length(frag.local);
  let disc = 1.0 - smoothstep(frag.radius - 0.75, frag.radius + 0.75, r);
  let lit = max(frag.near, frag.flash);
  let halo = exp(-(r * r) / (frag.radius * frag.radius * 2.6)) * 0.35 * lit;
  let color = mix(params.rest.rgb, params.accent.rgb, lit);
  let a = max(disc * (0.5 + 0.5 * lit), halo) * params.intensity;
  if (a <= 0.002) {
    discard;
  }
  return vec4f(color, a);
}
