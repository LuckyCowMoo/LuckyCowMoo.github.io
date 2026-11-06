import gsap from 'gsap'
import { makeCanvasTexture } from '../engine/canvasTexture.js'

export const pageIndex = 3
export const pageId = 'circuit-maker'
export const usesPhysics = false

const LIVE = 'https://luckycowmoo.github.io/circuit-maker/'
const SWITCHES = [
  { id: 'A', x: -5.5, y: 2, bit: 0 },
  { id: 'B', x: -5.5, y: 0, bit: 0 },
  { id: 'C', x: -5.5, y: -2, bit: 1 },
]
const AND = { x: -0.55, y: 1 }
const NOT = { x: -0.45, y: -2 }
const OR = { x: 2.45, y: -0.15 }
const DISPLAY = { x: 5, y: 0 }

const GLYPH = {
  0: '1111110',
  1: '0110000',
  G: '1011110',
  O: '1111110',
  ' ': '0000000',
}

const wireVert = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const wireFrag = `
  uniform float uTime;
  uniform float uHot;
  varying vec2 vUv;
  void main() {
    float band = fract(vUv.x * 4.0 - uTime * 3.0);
    float pulse = smoothstep(0.0, 0.08, band) * (1.0 - smoothstep(0.16, 0.48, band));
    vec3 idle = vec3(0.04, 0.14, 0.11);
    vec3 neon = vec3(0.45, 1.0, 0.78);
    float live = clamp(uHot, 0.0, 1.0);
    vec3 col = mix(idle, neon, live * (0.32 + 0.68 * pulse));
    gl_FragColor = vec4(col, 1.0);
  }
`

export function createPage(ctx) {
  const { THREE, scene, camera, pointerNDC, renderer } = ctx
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  scene.background = new THREE.Color(0x07110e)
  scene.fog = new THREE.Fog(0x07110e, 18, 36)
  scene.add(new THREE.HemisphereLight(0xd9fff1, 0x07110e, 0.7))
  const key = new THREE.DirectionalLight(0xf3fff8, 2.5)
  key.position.set(-6, 9, 8)
  const fill = new THREE.PointLight(0x3dffe0, 10, 22, 2)
  fill.position.set(3, 2, 7)
  scene.add(key, fill)

  const board = new THREE.Group()
  board.rotation.x = -0.62
  board.position.set(1.15, -1.18, 0)
  scene.add(board)

  const grid = makeCanvasTexture(1024, 640, drawBoard, renderer)
  const pcb = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 10),
    new THREE.MeshStandardMaterial({
      map: grid.texture,
      color: 0xffffff,
      metalness: 0.68,
      roughness: 0.38,
      emissive: 0x0e2c24,
      emissiveMap: grid.texture,
      emissiveIntensity: 0.22,
    }),
  )
  const substrate = new THREE.Mesh(
    new THREE.BoxGeometry(16.18, 10.18, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x070e0c, metalness: 0.4, roughness: 0.7 }),
  )
  substrate.position.z = -0.05
  board.add(substrate, pcb)

  const uTime = { value: 0 }
  const padGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.045, 14)
  padGeo.rotateX(Math.PI / 2)
  const padMat = new THREE.MeshStandardMaterial({ color: 0xd2b074, metalness: 0.85, roughness: 0.28 })
  const wires = []

  function addWire(points, hot) {
    const curve = roundedOrtho(THREE, points)
    const mesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, Math.max(16, Math.round(curve.getLength() * 7)), 0.034, 6, false),
      new THREE.ShaderMaterial({
        uniforms: { uTime, uHot: { value: 0 } },
        vertexShader: wireVert,
        fragmentShader: wireFrag,
        toneMapped: false,
      }),
    )
    board.add(mesh)
    for (const point of [points[0], points[points.length - 1]]) {
      const pad = new THREE.Mesh(padGeo, padMat)
      pad.position.set(point[0], point[1], 0.04)
      board.add(pad)
    }
    wires.push({ mesh, hot })
  }

  const andLeft = AND.x - 0.78
  const andNose = AND.x + 0.57
  const notLeft = NOT.x - 0.72
  const notTip = NOT.x + 0.72
  const orIn = OR.x - 0.28
  const orNose = OR.x + 0.92

  addWire([[-4.95, 2], [-2.2, 2], [-2.2, AND.y + 0.32], [andLeft, AND.y + 0.32]], () => bits.A)
  addWire([[-4.95, 0], [-2.2, 0], [-2.2, AND.y - 0.32], [andLeft, AND.y - 0.32]], () => bits.B)
  addWire([[-4.95, -2], [notLeft, -2]], () => bits.C)
  addWire([[andNose, AND.y], [1.15, AND.y], [1.15, OR.y + 0.28], [orIn, OR.y + 0.28]], () => logic.and)
  addWire([[notTip, NOT.y], [1.15, NOT.y], [1.15, OR.y - 0.3], [orIn, OR.y - 0.3]], () => logic.not)
  addWire([[orNose, OR.y], [4.15, OR.y], [4.15, DISPLAY.y], [4.42, DISPLAY.y]], () => logic.or)

  const andMat = gateMaterial(THREE, 0x1a3b33)
  const notMat = gateMaterial(THREE, 0x243246)
  const orMat = gateMaterial(THREE, 0x16362e)
  const andMesh = new THREE.Mesh(extrude(THREE, andShape(THREE)), andMat)
  andMesh.position.set(AND.x, AND.y, 0)
  const notMesh = new THREE.Mesh(extrude(THREE, notShape(THREE)), notMat)
  notMesh.position.set(NOT.x, NOT.y, 0)
  const bubbleMat = new THREE.MeshPhysicalMaterial({
    color: 0xe7fff6,
    roughness: 0.08,
    transmission: 0.92,
    thickness: 0.25,
    emissive: 0x0c2e24,
    emissiveIntensity: 0.3,
  })
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 16), bubbleMat)
  bubble.position.set(notTip, NOT.y, 0.16)
  const orMesh = new THREE.Mesh(extrude(THREE, orShape(THREE)), orMat)
  orMesh.position.set(OR.x, OR.y, 0)
  board.add(andMesh, notMesh, bubble, orMesh)
  board.add(gateLabel(THREE, renderer, 'AND', AND.x, AND.y + 0.98))
  board.add(gateLabel(THREE, renderer, 'NOT', NOT.x, NOT.y + 0.92))
  board.add(gateLabel(THREE, renderer, 'OR', OR.x, OR.y + 1.02))

  const bits = { A: 0, B: 0, C: 1 }
  const logic = { and: false, not: false, or: false }
  const pick = []
  const switches = SWITCHES.map((spec) => makeSwitch(THREE, renderer, spec, pick))
  switches.forEach((sw) => board.add(sw.group))

  const display = makeDisplay(THREE)
  display.group.position.set(DISPLAY.x, DISPLAY.y, 0)
  board.add(display.group)

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.56, 72),
    new THREE.MeshBasicMaterial({
      color: 0x7dffe4,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    }),
  )
  ring.position.set(OR.x, OR.y, 0.04)
  ring.visible = false
  board.add(ring)

  const root = document.createElement('div')
  root.className = 'page-root'
  root.innerHTML = `
    <section class="side-copy circuit-copy">
      <p class="eyebrow">Boolean logic</p>
      <h1 class="serif">Circuit Maker</h1>
      <p class="desc">Circuit Maker is a Boolean logic simulation tool. Teachers can use it to export lesson resources and demonstrate how complex systems—like a full calculator with memory and 7-segment displays—can be built entirely from simple logic gates. Students can experiment with gates to build their own circuits, complete challenges to match specific truth tables, and challenge their friends with custom puzzles.</p>
      <div class="actions">
        <a class="btn" data-open href="${LIVE}" target="_blank" rel="noopener noreferrer">Open Circuit Maker</a>
      </div>
      <p class="hint">Click the switches. The display spells GO when the output is 1.</p>
    </section>
    <aside class="truth-hud" aria-live="polite">
      <p>Y = (A AND B) OR NOT C</p>
      <table>
        <thead><tr><th>A</th><th>B</th><th>C</th><th>Y</th></tr></thead>
        <tbody></tbody>
      </table>
    </aside>
  `
  const openBtn = root.querySelector('[data-open]')
  const tbody = root.querySelector('tbody')
  const tableRows = []
  for (let i = 0; i < 8; i += 1) {
    const A = (i >> 2) & 1
    const B = (i >> 1) & 1
    const C = i & 1
    const Y = (A && B) || !C ? 1 : 0
    const tr = document.createElement('tr')
    tr.dataset.key = `${A}${B}${C}`
    tr.innerHTML = `<td>${A}</td><td>${B}</td><td>${C}</td><td>${Y}</td>`
    tbody.appendChild(tr)
    tableRows.push(tr)
  }

  const raycaster = new THREE.Raycaster()
  let wasHigh = false
  let primed = false

  function hitSwitch() {
    raycaster.setFromCamera(pointerNDC, camera)
    const hits = raycaster.intersectObjects(pick, false)
    return hits.length ? hits[0].object.userData.sw : null
  }

  function evaluate() {
    logic.and = !!(bits.A && bits.B)
    logic.not = !bits.C
    logic.or = logic.and || logic.not
  }

  function refresh() {
    evaluate()
    wires.forEach((wire) => {
      wire.mesh.material.uniforms.uHot.value = wire.hot() ? 1 : 0
    })
    andMat.emissiveIntensity = logic.and ? 0.85 : 0.06
    notMat.emissiveIntensity = logic.not ? 0.7 : 0.05
    orMat.emissiveIntensity = logic.or ? 0.9 : 0.06
    bubbleMat.emissive.set(logic.not ? 0x4dffe0 : 0x0c2e24)
    bubbleMat.emissiveIntensity = logic.not ? 1.6 : 0.25
    switches.forEach((sw) => {
      sw.state.bit = bits[sw.id]
      sw.painted.redraw()
      sw.cap.material.color.set(bits[sw.id] ? 0xb8ffe6 : 0x6e7f78)
      sw.cap.material.emissive.set(bits[sw.id] ? 0x37f0a8 : 0x101614)
      sw.cap.material.emissiveIntensity = bits[sw.id] ? 1.4 : 0.15
    })
    if (logic.or) {
      display.show('G', 'O')
      display.frame.material.emissive.set(0x1f9a6e)
      display.frame.material.emissiveIntensity = 0.85
    } else {
      display.show('0')
      display.frame.material.emissive.set(0x07140f)
      display.frame.material.emissiveIntensity = 0.12
    }
    const key = `${bits.A}${bits.B}${bits.C}`
    tableRows.forEach((row) => row.classList.toggle('active', row.dataset.key === key))
    openBtn.classList.toggle('circuit-go', logic.or)
    if (primed && logic.or && !wasHigh) celebrate()
    wasHigh = logic.or
    primed = true
  }

  function celebrate() {
    gsap.killTweensOf(ring.scale)
    gsap.killTweensOf(ring.material)
    ring.visible = true
    ring.material.opacity = 0.9
    ring.scale.set(0.25, 0.25, 0.25)
    const duration = reduce ? 0.01 : 0.9
    gsap.to(ring.scale, { x: 16, y: 16, z: 16, duration, ease: 'power2.out' })
    gsap.to(ring.material, {
      opacity: 0,
      duration,
      ease: 'power1.out',
      onComplete: () => { ring.visible = false },
    })
  }

  function toggle(sw) {
    bits[sw.id] = bits[sw.id] ? 0 : 1
    gsap.killTweensOf(sw.pivot.rotation)
    gsap.to(sw.pivot.rotation, {
      z: bits[sw.id] ? Math.PI / 6 : -Math.PI / 6,
      duration: reduce ? 0.01 : 0.22,
      ease: 'back.out(2.4)',
    })
    refresh()
  }

  refresh()

  return {
    dom: root,
    cameraPose: {
      position: new THREE.Vector3(1.25, 3.7, 13.3),
      target: new THREE.Vector3(1.15, 0.35, 0),
      fov: 36,
    },
    activate() {},
    deactivate() {
      ctx.setCursor('')
    },
    update(dt, elapsed) {
      uTime.value = elapsed
    },
    onPointerDown() {
      const sw = hitSwitch()
      if (!sw) return false
      toggle(sw)
      return true
    },
    onPointerMove() {
      ctx.setCursor(hitSwitch() ? 'pointer' : '')
    },
    onPointerUp() {},
    onDoubleClick() {},
    onKeyDown() {},
    onResize() {},
  }
}

function gateMaterial(THREE, color) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: 0.58,
    roughness: 0.32,
    emissive: 0x39f0a4,
    emissiveIntensity: 0.06,
  })
}

function extrude(THREE, shape) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.28,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.022,
    bevelSegments: 2,
    curveSegments: 14,
  })
  geo.translate(0, 0, 0.02)
  return geo
}

function andShape(THREE) {
  const shape = new THREE.Shape()
  const h = 0.62
  const left = -0.78
  const mid = -0.05
  shape.moveTo(left, -h)
  shape.lineTo(left, h)
  shape.lineTo(mid, h)
  shape.absarc(mid, 0, h, Math.PI / 2, -Math.PI / 2, true)
  shape.closePath()
  return shape
}

function notShape(THREE) {
  const shape = new THREE.Shape()
  shape.moveTo(-0.72, 0.56)
  shape.lineTo(0.46, 0)
  shape.lineTo(-0.72, -0.56)
  shape.closePath()
  return shape
}

function orShape(THREE) {
  const shape = new THREE.Shape()
  shape.moveTo(-0.62, 0.62)
  shape.quadraticCurveTo(0.35, 0.62, 0.92, 0)
  shape.quadraticCurveTo(0.35, -0.62, -0.62, -0.62)
  shape.quadraticCurveTo(-0.08, 0, -0.62, 0.62)
  return shape
}

function gateLabel(THREE, renderer, text, x, y) {
  const painted = makeCanvasTexture(512, 160, (g) => {
    g.clearRect(0, 0, 512, 160)
    g.fillStyle = '#c8ffe8'
    g.font = '700 96px Segoe UI, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(text, 256, 84)
  }, renderer)
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.05, 0.33),
    new THREE.MeshBasicMaterial({ map: painted.texture, transparent: true, depthWrite: false }),
  )
  mesh.position.set(x, y, 0.42)
  return mesh
}

function makeSwitch(THREE, renderer, spec, pick) {
  const group = new THREE.Group()
  group.position.set(spec.x, spec.y, 0)
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(1.05, 0.62, 0.28),
    new THREE.MeshStandardMaterial({ color: 0x2a3330, metalness: 0.72, roughness: 0.28 }),
  )
  base.position.z = 0.16
  const slot = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.7, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x0c1211, metalness: 0.4, roughness: 0.55 }),
  )
  slot.position.z = 0.32
  const pivot = new THREE.Group()
  pivot.position.z = 0.34
  pivot.rotation.z = spec.bit ? Math.PI / 6 : -Math.PI / 6
  const lever = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.72, 0.14),
    new THREE.MeshStandardMaterial({ color: 0xc9d2cc, metalness: 0.8, roughness: 0.22 }),
  )
  lever.position.y = 0.32
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0x6e7f78, emissive: 0x101614, roughness: 0.3, metalness: 0.2 }),
  )
  cap.position.y = 0.7
  pivot.add(lever, cap)
  const state = { bit: spec.bit }
  const painted = makeCanvasTexture(320, 96, (g) => {
    g.clearRect(0, 0, 320, 96)
    g.fillStyle = state.bit ? '#d8ffe9' : '#9eb0a8'
    g.font = '700 64px Segoe UI, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(`${spec.id}  ${state.bit ? '1' : '0'}`, 160, 50)
  }, renderer)
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 0.34),
    new THREE.MeshBasicMaterial({ map: painted.texture, transparent: true, depthWrite: false }),
  )
  label.position.set(-0.15, 0.92, 0.4)
  group.add(base, slot, pivot, label)
  const sw = { id: spec.id, group, pivot, cap, painted, state }
  ;[base, lever, cap, slot].forEach((mesh) => {
    mesh.userData.sw = sw
    pick.push(mesh)
  })
  return sw
}

function makeDisplay(THREE) {
  const group = new THREE.Group()
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(2.55, 2.15, 0.16),
    new THREE.MeshStandardMaterial({
      color: 0x101816,
      metalness: 0.55,
      roughness: 0.4,
      emissive: 0x07140f,
      emissiveIntensity: 0.12,
    }),
  )
  frame.position.z = 0.1
  const face = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 1.82, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x07110e, roughness: 0.85, metalness: 0.1 }),
  )
  face.position.z = 0.18
  group.add(frame, face)
  const horiz = hexBar(THREE, 0.82, 0.16)
  const vert = hexBar(THREE, 0.34, 0.16)
  const layout = [
    { x: 0, y: 0.5, rot: 0, geo: horiz },
    { x: 0.34, y: 0.32, rot: Math.PI / 2, geo: vert },
    { x: 0.34, y: -0.32, rot: Math.PI / 2, geo: vert },
    { x: 0, y: -0.5, rot: 0, geo: horiz },
    { x: -0.34, y: -0.32, rot: Math.PI / 2, geo: vert },
    { x: -0.34, y: 0.32, rot: Math.PI / 2, geo: vert },
    { x: 0, y: 0, rot: 0, geo: horiz },
  ]
  function digit() {
    const root = new THREE.Group()
    root.position.z = 0.28
    const bars = layout.map((spec) => {
      const mesh = new THREE.Mesh(spec.geo, segmentMaterial(THREE))
      mesh.position.set(spec.x, spec.y, 0)
      mesh.rotation.z = spec.rot
      root.add(mesh)
      return mesh
    })
    group.add(root)
    return { root, bars }
  }
  const left = digit()
  const right = digit()
  function paint(target, glyph) {
    const pattern = GLYPH[glyph] || GLYPH[' ']
    target.bars.forEach((bar, index) => {
      const on = pattern[index] === '1'
      bar.material.color.set(on ? 0xc8ffe8 : 0x101614)
      bar.material.emissive.set(on ? 0x15e890 : 0x000000)
      bar.material.emissiveIntensity = on ? 1.35 : 0
    })
  }
  return {
    group,
    frame,
    show(a, b) {
      if (b) {
        left.root.visible = true
        right.root.visible = true
        left.root.position.x = -0.52
        right.root.position.x = 0.52
        paint(left, a)
        paint(right, b)
      } else {
        left.root.visible = true
        right.root.visible = false
        left.root.position.x = 0
        paint(left, a)
      }
    },
  }
}

function segmentMaterial(THREE) {
  return new THREE.MeshStandardMaterial({
    color: 0x1a2622,
    emissive: 0x06110e,
    emissiveIntensity: 0.18,
    roughness: 0.35,
    metalness: 0.12,
  })
}

function hexBar(THREE, length, thick) {
  const shape = new THREE.Shape()
  const h = thick / 2
  const inset = h * 0.9
  const l = length / 2
  shape.moveTo(-l + inset, -h)
  shape.lineTo(l - inset, -h)
  shape.lineTo(l, 0)
  shape.lineTo(l - inset, h)
  shape.lineTo(-l + inset, h)
  shape.lineTo(-l, 0)
  shape.closePath()
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.1,
    bevelEnabled: true,
    bevelThickness: 0.016,
    bevelSize: 0.012,
    bevelSegments: 1,
    curveSegments: 1,
  })
  geo.translate(0, 0, -0.05)
  return geo
}

function roundedOrtho(THREE, points, radius = 0.22) {
  const out = []
  const at = (x, y) => out.push(new THREE.Vector3(x, y, 0.1))
  at(points[0][0], points[0][1])
  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = points[i - 1]
    const curr = points[i]
    const next = points[i + 1]
    const inX = curr[0] - prev[0]
    const inY = curr[1] - prev[1]
    const inLen = Math.hypot(inX, inY) || 1
    const outX = next[0] - curr[0]
    const outY = next[1] - curr[1]
    const outLen = Math.hypot(outX, outY) || 1
    const r = Math.min(radius, inLen * 0.46, outLen * 0.46)
    const ax = curr[0] - (inX / inLen) * r
    const ay = curr[1] - (inY / inLen) * r
    const bx = curr[0] + (outX / outLen) * r
    const by = curr[1] + (outY / outLen) * r
    at(ax, ay)
    for (let step = 1; step < 5; step += 1) {
      const t = step / 5
      const u = 1 - t
      at(
        u * u * ax + 2 * u * t * curr[0] + t * t * bx,
        u * u * ay + 2 * u * t * curr[1] + t * t * by,
      )
    }
    at(bx, by)
  }
  const last = points[points.length - 1]
  at(last[0], last[1])
  return new THREE.CatmullRomCurve3(out, false, 'catmullrom', 0)
}

function drawBoard(g, canvas) {
  const w = canvas.width
  const h = canvas.height
  g.fillStyle = '#10241f'
  g.fillRect(0, 0, w, h)
  g.strokeStyle = 'rgba(158, 204, 184, 0.16)'
  g.lineWidth = 2
  for (let x = 40; x < w; x += 40) {
    g.beginPath()
    g.moveTo(x, 0)
    g.lineTo(x, h)
    g.stroke()
  }
  for (let y = 40; y < h; y += 40) {
    g.beginPath()
    g.moveTo(0, y)
    g.lineTo(w, y)
    g.stroke()
  }
  g.fillStyle = '#081411'
  ;[[78, 78], [w - 78, 78], [78, h - 78], [w - 78, h - 78]].forEach(([x, y]) => {
    g.beginPath()
    g.arc(x, y, 16, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = 'rgba(214, 206, 186, 0.45)'
    g.lineWidth = 3
    g.stroke()
  })
}
