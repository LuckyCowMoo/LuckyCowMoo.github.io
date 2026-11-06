import * as THREE from 'three'

const vert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const blurFrag = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform vec2 uDirection;
  uniform vec2 uResolution;
  varying vec2 vUv;
  void main() {
    vec2 texel = uDirection / uResolution;
    float w0 = 0.227027;
    float w1 = 0.1945946;
    float w2 = 0.1216216;
    float w3 = 0.054054;
    float w4 = 0.016216;
    vec4 color = texture2D(tDiffuse, vUv) * w0;
    color += texture2D(tDiffuse, vUv + texel) * w1;
    color += texture2D(tDiffuse, vUv - texel) * w1;
    color += texture2D(tDiffuse, vUv + texel * 2.0) * w2;
    color += texture2D(tDiffuse, vUv - texel * 2.0) * w2;
    color += texture2D(tDiffuse, vUv + texel * 3.0) * w3;
    color += texture2D(tDiffuse, vUv - texel * 3.0) * w3;
    color += texture2D(tDiffuse, vUv + texel * 4.0) * w4;
    color += texture2D(tDiffuse, vUv - texel * 4.0) * w4;
    gl_FragColor = color;
  }
`

const finalFrag = /* glsl */ `
  uniform sampler2D tA;
  uniform sampler2D tB;
  uniform sampler2D tSoftA;
  uniform sampler2D tSoftB;
  uniform sampler2D tHeavyA;
  uniform sampler2D tHeavyB;
  uniform float uT;
  uniform float uTime;
  uniform float uReduce;
  varying vec2 vUv;

  vec2 fade(vec2 t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }
  float perm(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float perlin(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = perm(i);
    float b = perm(i + vec2(1.0, 0.0));
    float c = perm(i + vec2(0.0, 1.0));
    float d = perm(i + vec2(1.0, 1.0));
    vec2 ga = vec2(a, perm(i + 17.0)) * 2.0 - 1.0;
    vec2 gb = vec2(b, perm(i + vec2(18.0, 1.0))) * 2.0 - 1.0;
    vec2 gc = vec2(c, perm(i + vec2(1.0, 18.0))) * 2.0 - 1.0;
    vec2 gd = vec2(d, perm(i + vec2(18.0, 18.0))) * 2.0 - 1.0;
    float va = dot(ga, f);
    float vb = dot(gb, f - vec2(1.0, 0.0));
    float vc = dot(gc, f - vec2(0.0, 1.0));
    float vd = dot(gd, f - vec2(1.0, 1.0));
    vec2 u = fade(f);
    return mix(mix(va, vb, u.x), mix(vc, vd, u.x), u.y) * 0.5 + 0.5;
  }

  void main() {
    if (uReduce > 0.5) {
      gl_FragColor = mix(texture2D(tA, vUv), texture2D(tB, vUv), smoothstep(0.35, 0.65, uT));
      return;
    }
    float y = vUv.y;
    float back = mix(-1.7, 1.15, uT);
    float front = back + 1.6;
    float feather = 0.18;
    float band = smoothstep(back, back + feather, y) * (1.0 - smoothstep(front - feather, front, y));
    float n = perlin(vUv * vec2(3.4, 5.2) + vec2(uTime * 0.04, 0.0));
    float amp = band * mix(0.5, 1.0, n);
    float swap = smoothstep(0.46, 0.54, uT);
    vec4 sharp = mix(texture2D(tA, vUv), texture2D(tB, vUv), swap);
    vec4 soft = mix(texture2D(tSoftA, vUv), texture2D(tSoftB, vUv), swap);
    vec4 heavy = mix(texture2D(tHeavyA, vUv), texture2D(tHeavyB, vUv), swap);
    vec4 color = mix(sharp, soft, smoothstep(0.02, 0.48, amp));
    color = mix(color, heavy, smoothstep(0.42, 1.0, amp));
    gl_FragColor = color;
  }
`

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

export function bandCoverage(t, y) {
  const back = -1.7 + 2.85 * t
  const front = back + 1.6
  const feather = 0.18
  return smoothstep(back, back + feather, y) * (1 - smoothstep(front - feather, front, y))
}

export function bandActive(t) {
  const back = -1.7 + 2.85 * t
  const front = back + 1.6
  return front > -0.02 && back < 1.02
}

function makeTarget(w, h, depth) {
  const rt = new THREE.WebGLRenderTarget(w, h, {
    depthBuffer: depth,
    stencilBuffer: false,
  })
  rt.texture.colorSpace = THREE.LinearSRGBColorSpace
  rt.texture.minFilter = THREE.LinearFilter
  rt.texture.magFilter = THREE.LinearFilter
  rt.texture.generateMipmaps = false
  return rt
}

function quadMaterial(fragmentShader, uniforms) {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: vert,
    fragmentShader,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  })
}

export class TransitionComposer {
  constructor() {
    this.scene = new THREE.Scene()
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2))
    this.quad.frustumCulled = false
    this.scene.add(this.quad)
    this.blurMat = quadMaterial(blurFrag, {
      tDiffuse: { value: null },
      uDirection: { value: new THREE.Vector2() },
      uResolution: { value: new THREE.Vector2() },
    })
    this.finalMat = quadMaterial(finalFrag, {
      tA: { value: null },
      tB: { value: null },
      tSoftA: { value: null },
      tSoftB: { value: null },
      tHeavyA: { value: null },
      tHeavyB: { value: null },
      uT: { value: 0 },
      uTime: { value: 0 },
      uReduce: { value: 0 },
    })
    this.width = 0
    this.height = 0
    this.targets = []
  }

  setSize(width, height) {
    const w = Math.max(2, Math.floor(width))
    const h = Math.max(2, Math.floor(height))
    if (w === this.width && h === this.height) return
    this.width = w
    this.height = h
    this.targets.forEach((rt) => rt.dispose())
    this.rtA = makeTarget(w, h, true)
    this.rtB = makeTarget(w, h, true)
    const bw = Math.max(2, Math.floor(w * 0.5))
    const bh = Math.max(2, Math.floor(h * 0.5))
    this.pingA = makeTarget(bw, bh, false)
    this.lightA = makeTarget(bw, bh, false)
    this.heavyA = makeTarget(bw, bh, false)
    this.pingB = makeTarget(bw, bh, false)
    this.lightB = makeTarget(bw, bh, false)
    this.heavyB = makeTarget(bw, bh, false)
    this.targets = [this.rtA, this.rtB, this.pingA, this.lightA, this.heavyA, this.pingB, this.lightB, this.heavyB]
  }

  renderScene(renderer, scene, camera, target) {
    renderer.setRenderTarget(target)
    renderer.clear(true, true, true)
    renderer.render(scene, camera)
  }

  blur(renderer, sourceTex, radius, ping, dest) {
    const uniforms = this.blurMat.uniforms
    uniforms.uResolution.value.set(dest.width, dest.height)
    uniforms.tDiffuse.value = sourceTex
    uniforms.uDirection.value.set(radius, 0)
    this.quad.material = this.blurMat
    renderer.setRenderTarget(ping)
    renderer.clear(true, true, true)
    renderer.render(this.scene, this.camera)
    uniforms.tDiffuse.value = ping.texture
    uniforms.uDirection.value.set(0, radius)
    renderer.setRenderTarget(dest)
    renderer.clear(true, true, true)
    renderer.render(this.scene, this.camera)
  }

  present(renderer, t, time, reduce) {
    const u = this.finalMat.uniforms
    u.tA.value = this.rtA.texture
    u.tB.value = this.rtB.texture
    u.uT.value = t
    u.uTime.value = time
    u.uReduce.value = reduce ? 1 : 0
    if (!reduce) {
      this.blur(renderer, this.rtA.texture, 1.6, this.pingA, this.lightA)
      this.blur(renderer, this.lightA.texture, 4.8, this.pingA, this.heavyA)
      this.blur(renderer, this.rtB.texture, 1.6, this.pingB, this.lightB)
      this.blur(renderer, this.lightB.texture, 4.8, this.pingB, this.heavyB)
    }
    u.tSoftA.value = this.lightA.texture
    u.tSoftB.value = this.lightB.texture
    u.tHeavyA.value = this.heavyA.texture
    u.tHeavyB.value = this.heavyB.texture
    this.quad.material = this.finalMat
    renderer.setRenderTarget(null)
    renderer.clear(true, true, true)
    renderer.render(this.scene, this.camera)
  }
}
