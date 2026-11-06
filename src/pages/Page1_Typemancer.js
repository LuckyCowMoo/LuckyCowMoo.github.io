import { makeCanvasTexture } from '../engine/canvasTexture.js'

export const pageIndex = 1
export const pageId = 'typemancer'
export const usesPhysics = false

const PLAY_URL = 'https://luckycowmoo.github.io/typemancer/'
const WORD_POOL = ['FLAME', 'BOLT', 'AEGIS', 'SURGE', 'RIFT', 'EMBER', 'SPARK', 'GUARD', 'CLOCK', 'SHIFT', 'HEX', 'NOVA', 'PRISM', 'WARD', 'PULSE', 'GLYPH', 'RUNE', 'VEIL']
const STARTER = [
  { name: 'IGNITE', word: 'FLAME', mana: 1, art: 'fire' },
  { name: 'ARCANE BOLT', word: 'BOLT', mana: 2, art: 'bolt' },
  { name: 'SHIELD MATRIX', word: 'AEGIS', mana: 1, art: 'shield' },
  { name: 'OVERCLOCK', word: 'SURGE', mana: 3, art: 'overclock' },
  { name: 'CHRONO SHIFT', word: 'RIFT', mana: 2, art: 'chrono' },
]
const ART_COLOR = {
  fire: 0xff7a2a,
  bolt: 0x67d7ff,
  shield: 0x8ef0c8,
  overclock: 0xffd15c,
  chrono: 0xd58bff,
}

const holoVert = `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`
const holoFrag = `
  uniform sampler2D uMap;
  uniform vec2 uPointer;
  uniform vec3 uCameraPos;
  uniform float uFocus;
  uniform float uFail;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }
  void main() {
    vec4 tex = texture2D(uMap, vUv);
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(uCameraPos - vWorldPos);
    float ndv = clamp(dot(N, V), 0.0, 1.0);
    vec3 pointerDir = normalize(vec3(uPointer.x, uPointer.y, 0.55));
    float pointerTerm = dot(N, pointerDir);
    float hue = fract(0.04 + ndv * 0.42 + pointerTerm * 0.3 + vUv.x * 0.1);
    vec3 iri = hsv2rgb(vec3(hue, 0.65, 1.0));
    float sheen = pow(1.0 - ndv, 1.45);
    float sweep = pow(clamp(pointerTerm * 0.5 + 0.5, 0.0, 1.0), 2.1);
    float foil = clamp(sheen * 0.58 + sweep * 0.32 + uFocus * 0.14, 0.0, 0.8);
    vec3 color = mix(tex.rgb, iri, foil);
    color += iri * sheen * (0.1 + uFocus * 0.22);
    color = mix(color, vec3(0.75, 0.16, 0.12), uFail * 0.4);
    gl_FragColor = vec4(color, tex.a);
  }
`

export function createPage(ctx) {
  const { THREE, scene, camera, pointerNDC, renderer } = ctx
  scene.background = new THREE.Color(0x120a1c)
  scene.fog = new THREE.Fog(0x120a1c, 10, 24)
  scene.add(new THREE.HemisphereLight(0xc9b6e8, 0x120910, 0.55))
  const key = new THREE.DirectionalLight(0xfff0dd, 2.1)
  key.position.set(-4, 7, 6)
  const golemLight = new THREE.PointLight(0xb184ff, 12, 10, 2)
  golemLight.position.set(2, 1.2, 0.6)
  const cardLight = new THREE.PointLight(0xffd7a1, 6, 8, 2)
  cardLight.position.set(0, 1.2, 5.2)
  scene.add(key, golemLight, cardLight)

  const cardGeo = roundedCardGeometry(THREE)
  const faceGeo = new THREE.PlaneGeometry(1.46, 2.14)
  const cards = STARTER.map((spec, index) => {
    const painted = makeCanvasTexture(512, 768, (g) => drawCard(g, spec, 0), renderer)
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: painted.texture },
        uPointer: { value: new THREE.Vector2() },
        uCameraPos: { value: new THREE.Vector3() },
        uFocus: { value: 0 },
        uFail: { value: 0 },
      },
      vertexShader: holoVert,
      fragmentShader: holoFrag,
    })
    const group = new THREE.Group()
    const body = new THREE.Mesh(
      cardGeo,
      new THREE.MeshStandardMaterial({ color: 0x140c08, metalness: 0.64, roughness: 0.36 }),
    )
    const face = new THREE.Mesh(faceGeo, material)
    face.position.z = 0.04
    group.add(body, face)
    group.scale.setScalar(0.56)
    scene.add(group)
    const baseAngle = (index - 2) * 0.3
    return {
      spec: { ...spec },
      group,
      face,
      material,
      texture: painted.texture,
      ctx2d: painted.ctx,
      matched: 0,
      token: `${spec.word}|0`,
      baseAngle,
      x: Math.sin(baseAngle) * 3.05,
      y: -0.95,
      z: 2.7 - (1 - Math.cos(baseAngle)) * 0.28,
      rx: 0,
      ry: -baseAngle * 0.4,
      rz: -baseAngle * 0.06,
      vx: 0, vy: 0, vz: 0, vrx: 0, vry: 0, vrz: 0,
    }
  })
  cards.forEach(placeCard)

  const golem = new THREE.Group()
  golem.position.set(2, 1.15, -0.35)
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x241038,
    emissive: 0x7a3cff,
    emissiveIntensity: 1.15,
    roughness: 0.16,
    metalness: 0.42,
  })
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 0), coreMat)
  const heart = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.26, 0),
    new THREE.MeshStandardMaterial({ color: 0xfff1c4, emissive: 0xffb450, emissiveIntensity: 1.7, roughness: 0.12 }),
  )
  golem.add(core, heart)
  const runes = []
  for (let i = 0; i < 7; i += 1) {
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.11 + (i % 3) * 0.045, 0),
      new THREE.MeshStandardMaterial({
        color: 0x160818,
        emissive: i % 2 ? 0x49f0ff : 0xff4ad2,
        emissiveIntensity: 1.45,
        roughness: 0.2,
        metalness: 0.25,
      }),
    )
    golem.add(mesh)
    runes.push({ mesh, radius: 1.05 + (i % 3) * 0.2, speed: 0.32 + i * 0.08, phase: i * 1.3, y: (i - 3) * 0.12 })
  }
  scene.add(golem)
  const sigil = makeCanvasTexture(512, 512, (g) => {
    g.clearRect(0, 0, 512, 512)
    g.strokeStyle = 'rgba(186, 140, 255, 0.85)'
    g.lineWidth = 6
    g.beginPath()
    g.arc(256, 256, 180, 0, Math.PI * 2)
    g.stroke()
    g.lineWidth = 2
    g.beginPath()
    g.arc(256, 256, 120, 0, Math.PI * 2)
    g.stroke()
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2
      g.beginPath()
      g.moveTo(256 + Math.cos(a) * 120, 256 + Math.sin(a) * 120)
      g.lineTo(256 + Math.cos(a) * 180, 256 + Math.sin(a) * 180)
      g.stroke()
    }
  }, renderer)
  const sigilMesh = new THREE.Mesh(
    new THREE.CircleGeometry(1.8, 48),
    new THREE.MeshBasicMaterial({ map: sigil.texture, transparent: true, opacity: 0.8, depthWrite: false }),
  )
  sigilMesh.rotation.x = -Math.PI / 2
  sigilMesh.position.set(2, -1.55, 0)
  scene.add(sigilMesh)

  const playPaint = makeCanvasTexture(512, 768, (g) => {
    g.fillStyle = '#e4b85a'
    g.fillRect(0, 0, 512, 768)
    g.strokeStyle = '#6a4310'
    g.lineWidth = 16
    roundPath(g, 24, 24, 464, 720, 36)
    g.stroke()
    g.fillStyle = '#3a2508'
    g.font = '700 54px Georgia, serif'
    g.textAlign = 'center'
    g.fillText('PLAY', 256, 300)
    g.font = '700 64px Georgia, serif'
    g.fillText('NOW', 256, 380)
    g.font = '500 24px Segoe UI, sans-serif'
    g.fillText('Open Typemancer', 256, 470)
  }, renderer)
  const playMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.15, 1.7, 0.06),
    new THREE.MeshStandardMaterial({
      map: playPaint.texture,
      color: 0xfff1c4,
      emissive: 0xffc44a,
      emissiveIntensity: 0.7,
      metalness: 0.18,
      roughness: 0.4,
    }),
  )
  playMesh.visible = false
  scene.add(playMesh)
  const play = { active: false, u: 0, pulse: 0, from: new THREE.Vector3(), mesh: playMesh }

  const projGeo = new THREE.SphereGeometry(0.045, 8, 8)
  const projectiles = []
  const debrisGeo = new THREE.OctahedronGeometry(0.06, 0)
  const debris = Array.from({ length: 18 }, () => {
    const material = new THREE.MeshStandardMaterial({
      color: 0xfff1c4,
      emissive: 0xfff6dd,
      emissiveIntensity: 1.4,
      transparent: true,
      roughness: 0.2,
    })
    const mesh = new THREE.Mesh(debrisGeo, material)
    mesh.visible = false
    scene.add(mesh)
    return { mesh, alive: false, life: 0, vx: 0, vy: 0, vz: 0 }
  })

  const raycaster = new THREE.Raycaster()
  const bez = new THREE.Vector3()
  const center = new THREE.Vector3()
  let buffer = ''
  let fail = 0
  let hoverIndex = -1
  let unique = null
  let matches = []
  let shake = 0
  let flash = 0

  function launch(card, origin) {
    const end = new THREE.Vector3(2, 1.15, -0.35)
    const mid = origin.clone().lerp(end, 0.5).add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 1.7, 0.25))
    const stream = { left: 25, origin: origin.clone(), finished: false }
    for (let i = 0; i < 25; i += 1) {
      let shot = projectiles.find((item) => !item.alive)
      if (!shot) {
        const material = new THREE.MeshBasicMaterial({ color: 0xffe1a0, toneMapped: false })
        const mesh = new THREE.Mesh(projGeo, material)
        mesh.visible = false
        scene.add(mesh)
        shot = { mesh, alive: false, p0: new THREE.Vector3(), p1: new THREE.Vector3(), p2: new THREE.Vector3() }
        projectiles.push(shot)
      }
      shot.alive = true
      shot.done = false
      shot.age = -i * 0.016
      shot.duration = 0.56
      shot.stream = stream
      shot.p0.copy(origin)
      shot.p1.copy(mid)
      shot.p2.copy(end)
      shot.mesh.material.color.setHex(ART_COLOR[card.spec.art] || 0xffe1a0)
      shot.mesh.visible = false
    }
  }

  function impact(stream) {
    shake = 1
    flash = 1
    debris.forEach((piece) => {
      piece.alive = true
      piece.life = 0.75 + Math.random() * 0.55
      piece.mesh.visible = true
      piece.mesh.position.set(2 + (Math.random() - 0.5) * 0.2, 1.15, -0.35 + (Math.random() - 0.5) * 0.2)
      piece.vx = (Math.random() - 0.5) * 3.4
      piece.vy = 1.6 + Math.random() * 2.4
      piece.vz = (Math.random() - 0.5) * 3.4
      piece.mesh.material.opacity = 1
    })
    if (!play.active) {
      play.active = true
      play.u = 0
      play.from.copy(stream.origin)
      play.mesh.visible = true
    } else {
      play.pulse = 1
    }
  }

  function nextWord(card) {
    const used = new Set(cards.filter((other) => other !== card).map((other) => other.spec.word))
    used.add(card.spec.word)
    const options = WORD_POOL.filter((word) => !used.has(word))
    const pool = options.length ? options : WORD_POOL
    return pool[Math.floor(Math.random() * pool.length)]
  }

  function redraw(card) {
    drawCard(card.ctx2d, card.spec, card.matched)
    card.texture.needsUpdate = true
    card.token = `${card.spec.word}|${card.matched}`
  }

  function refresh() {
    matches = buffer ? cards.filter((card) => card.spec.word.startsWith(buffer)) : []
    unique = matches.length === 1 ? matches[0] : null
    cards.forEach((card) => {
      card.matched = matches.includes(card) ? buffer.length : 0
      const token = `${card.spec.word}|${card.matched}`
      if (token !== card.token) redraw(card)
    })
  }

  function cast(card) {
    const origin = new THREE.Vector3()
    card.group.getWorldPosition(origin)
    launch(card, origin)
    card.spec.word = nextWord(card)
    card.matched = 0
    redraw(card)
  }

  const root = document.createElement('div')
  root.className = 'page-root'
  root.innerHTML = `
    <section class="side-copy">
      <p class="eyebrow">Deck-building roguelike</p>
      <h1 class="serif">Typemancer</h1>
      <p class="desc">Typemancer is a game heavily inspired by Slay the Spire and other deck-building roguelikes. Created in response to observing young people's typing proficiency, the goal was to build a genuinely enjoyable game that happens to only accept input through typing—encouraging players to have fun while improving their typing speed passively.</p>
      <div class="actions">
        <a class="btn" href="${PLAY_URL}" target="_blank" rel="noopener noreferrer">Play Typemancer Live</a>
      </div>
      <p class="hint">Type the word on a card to cast it.</p>
    </section>
  `

  return {
    dom: root,
    cameraPose: {
      position: new THREE.Vector3(0, 0.7, 9.1),
      target: new THREE.Vector3(0.15, -0.55, 1.6),
      fov: 42,
    },
    activate() {},
    deactivate() {
      ctx.setCursor('')
    },
    update(dt, elapsed) {
      raycaster.setFromCamera(pointerNDC, camera)
      const hits = raycaster.intersectObjects(cards.map((card) => card.face), false)
      hoverIndex = hits.length ? cards.findIndex((card) => card.face === hits[0].object) : -1
      const overPlay = play.active && play.u > 0.6 && raycaster.intersectObject(play.mesh, false).length > 0
      ctx.setCursor(overPlay ? 'pointer' : '')

      cards.forEach((card, index) => {
        let angle = card.baseAngle
        if (hoverIndex !== -1 && index !== hoverIndex) angle += Math.sign(index - hoverIndex) * 0.09
        const hovered = index === hoverIndex
        const typingLift = unique === card ? 0.34 : (matches.includes(card) ? 0.16 : 0)
        const targetX = Math.sin(angle) * 3.05
        const targetY = -0.95 + (hovered ? 0.55 : 0) + typingLift
        const targetZ = 2.7 - (1 - Math.cos(angle)) * 0.28 + (hovered ? 0.7 : 0)
        const targetRx = hovered ? -0.16 - pointerNDC.y * 0.14 : 0
        const targetRy = -angle * 0.4 + (hovered ? pointerNDC.x * 0.22 : 0)
        const targetRz = -angle * 0.06
        ;[card.x, card.vx] = spring(card.x, card.vx, targetX, dt)
        ;[card.y, card.vy] = spring(card.y, card.vy, targetY, dt)
        ;[card.z, card.vz] = spring(card.z, card.vz, targetZ, dt)
        ;[card.rx, card.vrx] = spring(card.rx, card.vrx, targetRx, dt)
        ;[card.ry, card.vry] = spring(card.ry, card.vry, targetRy, dt)
        ;[card.rz, card.vrz] = spring(card.rz, card.vrz, targetRz, dt)
        placeCard(card)
        const focus = hovered || unique === card ? 1 : (matches.includes(card) ? 0.45 : 0)
        card.material.uniforms.uFocus.value = focus
        card.material.uniforms.uFail.value = fail
        card.material.uniforms.uPointer.value.copy(pointerNDC)
        card.material.uniforms.uCameraPos.value.copy(camera.position)
      })
      fail = Math.max(0, fail - dt * 2.4)

      runes.forEach((rune) => {
        const a = elapsed * rune.speed + rune.phase
        rune.mesh.position.set(Math.cos(a) * rune.radius, Math.sin(a * 1.3) * 0.32 + rune.y, Math.sin(a) * rune.radius * 0.72)
        rune.mesh.rotation.x += dt * 0.8
        rune.mesh.rotation.y += dt * 1.1
      })
      core.rotation.y += dt * 0.25
      heart.rotation.y -= dt * 0.6
      shake *= Math.exp(-3.4 * dt)
      flash *= Math.exp(-5.5 * dt)
      golem.position.set(
        2 + (Math.random() - 0.5) * shake * 0.16,
        1.15 + (Math.random() - 0.5) * shake * 0.1,
        -0.35 + (Math.random() - 0.5) * shake * 0.16,
      )
      coreMat.emissive.set(flash > 0.25 ? 0xffffff : 0x7a3cff)
      coreMat.emissiveIntensity = 1.15 + flash * 4.5

      projectiles.forEach((shot) => {
        if (!shot.alive) return
        shot.age += dt
        if (shot.age < 0) return
        const t = Math.min(1, shot.age / shot.duration)
        bezier(shot.p0, shot.p1, shot.p2, t, bez)
        shot.mesh.position.copy(bez)
        shot.mesh.visible = true
        if (t >= 1 && !shot.done) {
          shot.done = true
          shot.alive = false
          shot.mesh.visible = false
          shot.stream.left -= 1
          if (shot.stream.left <= 0 && !shot.stream.finished) {
            shot.stream.finished = true
            impact(shot.stream)
          }
        }
      })

      debris.forEach((piece) => {
        if (!piece.alive) return
        piece.vy -= 9.8 * dt
        piece.mesh.position.x += piece.vx * dt
        piece.mesh.position.y += piece.vy * dt
        piece.mesh.position.z += piece.vz * dt
        piece.life -= dt
        piece.mesh.material.opacity = Math.max(0, piece.life)
        if (piece.life <= 0) {
          piece.alive = false
          piece.mesh.visible = false
        }
      })

      if (play.active) {
        play.u = Math.min(1, play.u + dt / 0.7)
        play.pulse = Math.max(0, play.pulse - dt)
        const k = 1 - (1 - play.u) ** 3
        center.set(0, -0.15, -4.2).applyMatrix4(camera.matrixWorld)
        play.mesh.position.lerpVectors(play.from, center, k)
        play.mesh.lookAt(camera.position)
        const pulse = 1 + Math.sin(elapsed * 6) * 0.04 + play.pulse * 0.08
        play.mesh.scale.setScalar((0.22 + 0.55 * k) * pulse)
        play.mesh.material.emissiveIntensity = 0.55 + play.pulse * 0.9
      }
    },
    onPointerDown() {
      if (!play.active || play.u < 0.55) return false
      raycaster.setFromCamera(pointerNDC, camera)
      if (raycaster.intersectObject(play.mesh, false).length) {
        window.open(PLAY_URL, '_blank', 'noopener')
        return true
      }
      return false
    },
    onPointerMove() {},
    onPointerUp() {},
    onDoubleClick() {},
    onKeyDown(event) {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === 'Backspace') {
        buffer = buffer.slice(0, -1)
        refresh()
        return
      }
      if (event.key === 'Escape') {
        buffer = ''
        refresh()
        return
      }
      if (!/^[a-z]$/i.test(event.key)) return
      const next = (buffer + event.key).toUpperCase()
      if (!cards.some((card) => card.spec.word.startsWith(next))) {
        fail = 1
        return
      }
      buffer = next
      const exact = cards.find((card) => card.spec.word === buffer)
      if (exact) {
        cast(exact)
        buffer = ''
      }
      refresh()
    },
    onResize() {},
  }
}

function placeCard(card) {
  card.group.position.set(card.x, card.y, card.z)
  card.group.rotation.set(card.rx, card.ry, card.rz)
}

function spring(value, velocity, target, dt) {
  const accel = (target - value) * 72 - velocity * 14
  const nextV = velocity + accel * dt
  return [value + nextV * dt, nextV]
}

function bezier(a, b, c, t, out) {
  const u = 1 - t
  out.set(
    u * u * a.x + 2 * u * t * b.x + t * t * c.x,
    u * u * a.y + 2 * u * t * b.y + t * t * c.y,
    u * u * a.z + 2 * u * t * b.z + t * t * c.z,
  )
}

function roundedCardGeometry(THREE) {
  const w = 1.6
  const h = 2.3
  const r = 0.12
  const shape = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  shape.moveTo(x + r, y)
  shape.lineTo(x + w - r, y)
  shape.quadraticCurveTo(x + w, y, x + w, y + r)
  shape.lineTo(x + w, y + h - r)
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  shape.lineTo(x + r, y + h)
  shape.quadraticCurveTo(x, y + h, x, y + h - r)
  shape.lineTo(x, y + r)
  shape.quadraticCurveTo(x, y, x + r, y)
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.04,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 2,
    curveSegments: 6,
  })
  geo.center()
  return geo
}

function roundPath(g, x, y, w, h, r) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.lineTo(x + w - r, y)
  g.quadraticCurveTo(x + w, y, x + w, y + r)
  g.lineTo(x + w, y + h - r)
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  g.lineTo(x + r, y + h)
  g.quadraticCurveTo(x, y + h, x, y + h - r)
  g.lineTo(x, y + r)
  g.quadraticCurveTo(x, y, x + r, y)
  g.closePath()
}

function drawWord(g, word, matched, x, y) {
  g.font = '700 58px Consolas, monospace'
  g.textAlign = 'left'
  g.textBaseline = 'middle'
  const letters = [...word]
  const widths = letters.map((letter) => g.measureText(letter).width)
  const gap = 10
  const total = widths.reduce((sum, width) => sum + width, 0) + gap * (letters.length - 1)
  let cursor = x - total / 2
  letters.forEach((letter, index) => {
    const on = index < matched
    g.shadowColor = on ? '#ffb428' : 'transparent'
    g.shadowBlur = on ? 18 : 0
    g.fillStyle = on ? '#ffd76a' : '#8d7b5e'
    g.fillText(letter, cursor, y)
    cursor += widths[index] + gap
  })
  g.shadowBlur = 0
}

function drawArt(g, art, x, y, w, h) {
  g.save()
  roundPath(g, x, y, w, h, 18)
  g.clip()
  if (art === 'fire') {
    const grad = g.createRadialGradient(x + w * 0.5, y + h * 0.7, 10, x + w * 0.5, y + h * 0.7, h)
    grad.addColorStop(0, '#fff1c2')
    grad.addColorStop(0.4, '#ff7a1a')
    grad.addColorStop(1, '#4a1020')
    g.fillStyle = grad
    g.fillRect(x, y, w, h)
    g.fillStyle = 'rgba(255, 220, 140, 0.85)'
    for (let i = 0; i < 5; i += 1) {
      const cx = x + w * (0.25 + i * 0.12)
      g.beginPath()
      g.moveTo(cx, y + h * 0.8)
      g.lineTo(cx + 18, y + h * 0.35)
      g.lineTo(cx - 18, y + h * 0.48)
      g.fill()
    }
  } else if (art === 'bolt') {
    g.fillStyle = '#071426'
    g.fillRect(x, y, w, h)
    g.strokeStyle = '#8ee7ff'
    g.lineWidth = 8
    g.beginPath()
    g.moveTo(x + 40, y + 30)
    g.lineTo(x + w - 30, y + h - 20)
    g.stroke()
    g.fillStyle = '#d8f7ff'
    for (let i = 0; i < 6; i += 1) {
      const cx = x + 50 + i * 52
      const cy = y + 40 + (i % 2) * 90
      g.beginPath()
      g.moveTo(cx, cy - 16)
      g.lineTo(cx + 12, cy)
      g.lineTo(cx, cy + 16)
      g.lineTo(cx - 12, cy)
      g.fill()
    }
  } else if (art === 'shield') {
    g.fillStyle = '#06281f'
    g.fillRect(x, y, w, h)
    g.strokeStyle = '#b9ffe2'
    g.lineWidth = 3
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        const cx = x + 48 + col * 68 + (row % 2) * 20
        const cy = y + 40 + row * 62
        hex(g, cx, cy, 22)
        g.stroke()
      }
    }
  } else if (art === 'overclock') {
    g.fillStyle = '#1a1204'
    g.fillRect(x, y, w, h)
    g.strokeStyle = '#ffd15c'
    g.lineWidth = 3
    for (let i = 0; i < 7; i += 1) {
      g.beginPath()
      g.moveTo(x + 20, y + 30 + i * 36)
      g.lineTo(x + w - 20, y + 50 + ((i * 47) % 80))
      g.stroke()
      g.fillStyle = '#fff1c4'
      g.beginPath()
      g.arc(x + 40 + i * 46, y + 40 + (i % 3) * 50, 5, 0, Math.PI * 2)
      g.fill()
    }
  } else {
    g.fillStyle = '#160820'
    g.fillRect(x, y, w, h)
    g.strokeStyle = '#e2b6ff'
    g.lineWidth = 3
    for (let i = 1; i <= 4; i += 1) {
      g.beginPath()
      g.arc(x + w * 0.5, y + h * 0.5, i * 28, 0, Math.PI * 2)
      g.stroke()
    }
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2
      g.beginPath()
      g.moveTo(x + w * 0.5 + Math.cos(a) * 20, y + h * 0.5 + Math.sin(a) * 20)
      g.lineTo(x + w * 0.5 + Math.cos(a) * 110, y + h * 0.5 + Math.sin(a) * 110)
      g.stroke()
    }
  }
  g.restore()
}

function hex(g, cx, cy, r) {
  g.beginPath()
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI / 3) * i - Math.PI / 6
    const px = cx + Math.cos(a) * r
    const py = cy + Math.sin(a) * r
    if (i === 0) g.moveTo(px, py)
    else g.lineTo(px, py)
  }
  g.closePath()
}

function drawCard(g, spec, matched) {
  const w = 512
  const h = 768
  g.clearRect(0, 0, w, h)
  g.fillStyle = '#140b22'
  g.fillRect(0, 0, w, h)
  g.strokeStyle = '#e7c98a'
  g.lineWidth = 10
  roundPath(g, 18, 18, w - 36, h - 36, 28)
  g.stroke()
  g.beginPath()
  g.arc(86, 96, 36, 0, Math.PI * 2)
  g.fillStyle = '#2a1458'
  g.fill()
  g.lineWidth = 4
  g.strokeStyle = '#9ad7ff'
  g.stroke()
  g.fillStyle = '#f4fbff'
  g.font = '700 40px Georgia, serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(String(spec.mana), 86, 98)
  g.fillStyle = '#f6edd8'
  g.font = '600 36px Georgia, serif'
  g.textBaseline = 'middle'
  g.fillText(spec.name, w / 2, 168)
  g.fillStyle = '#8d7b5e'
  g.font = '600 18px Segoe UI, sans-serif'
  g.fillText('CAST', w / 2, 230)
  drawWord(g, spec.word, matched, w / 2, 292)
  drawArt(g, spec.art, 64, 360, 384, 320)
}
