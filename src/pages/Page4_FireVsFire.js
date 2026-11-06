import * as THREE from 'three'
import { makeCanvasTexture } from '../engine/canvasTexture.js'

export const pageIndex = 4
export const pageId = 'fire-vs-fire'
export const usesPhysics = false

const GITHUB = 'https://github.com/LuckyCowMoo/Fire-vs-Fire'
const PDF = '/assets/fire-vs-fire-report.pdf'
const VIDEO = '/assets/fire-vs-fire-demo.mp4'
const DESCRIPTION = 'Fire-vs-Fire is my final-year undergraduate dissertation project (which earned a First!). It is a universal, locally run AI-filter browser extension accessible even on low-end consumer laptops, paired with a companion backend server running outside the browser environment for deeper hardware access. Fire-vs-Fire is open-source and designed for users to bring their own models; while the prototype AI-detection models currently sit at 75% accuracy with more on the way, secondary object-detection models (such as automatically blurring all spiders) are already highly effective.'

const screenVert = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const screenFrag = `
  uniform sampler2D uVideo;
  uniform sampler2D uFallback;
  uniform float uHasVideo;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vec4 col = mix(texture2D(uFallback, vUv), texture2D(uVideo, vUv), uHasVideo);
    float scan = sin(vUv.y * 900.0 + uTime * 8.0) * 0.035;
    float vign = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
    vign *= smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.92, vUv.y);
    col.rgb = col.rgb * mix(0.62, 1.0, vign) - scan;
    float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
    col.rgb += vec3(0.35, 0.85, 1.0) * (1.0 - smoothstep(0.0, 0.045, edge)) * 0.55;
    gl_FragColor = col;
  }
`
const cardVert = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const cardFrag = `
  uniform sampler2D uMap;
  uniform float uBlur;
  varying vec2 vUv;
  void main() {
    float cells = mix(220.0, 18.0, uBlur);
    vec2 pix = floor(vUv * cells) / cells;
    vec2 uv = mix(vUv, pix, uBlur);
    float r = uBlur * 0.02;
    vec4 color = texture2D(uMap, uv) * 0.4;
    color += texture2D(uMap, uv + vec2(r, 0.0)) * 0.15;
    color += texture2D(uMap, uv + vec2(-r, 0.0)) * 0.15;
    color += texture2D(uMap, uv + vec2(0.0, r)) * 0.15;
    color += texture2D(uMap, uv + vec2(0.0, -r)) * 0.15;
    gl_FragColor = color;
  }
`

export function createPage(ctx) {
  const { scene, camera, pointerNDC, renderer } = ctx
  scene.background = new THREE.Color(0x120806)
  scene.fog = new THREE.Fog(0x120806, 11, 26)
  scene.add(new THREE.HemisphereLight(0xf0d2c4, 0x120806, 0.55))
  const key = new THREE.DirectionalLight(0xffe2c4, 2.3)
  key.position.set(4, 6, 6)
  const rim = new THREE.PointLight(0xff5a2a, 8, 12, 2)
  rim.position.set(3.2, 1.4, 1.2)
  scene.add(key, rim)

  const video = document.createElement('video')
  video.src = VIDEO
  video.loop = true
  video.muted = true
  video.defaultMuted = true
  video.playsInline = true
  video.crossOrigin = 'anonymous'
  video.preload = 'auto'
  video.setAttribute('playsinline', '')
  video.style.cssText = 'position:fixed;width:2px;height:2px;opacity:0;pointer-events:none;'
  document.body.append(video)
  const videoTexture = new THREE.VideoTexture(video)
  videoTexture.colorSpace = THREE.SRGBColorSpace
  const fallback = makeCanvasTexture(1024, 512, (g) => {
    g.fillStyle = '#14080c'
    g.fillRect(0, 0, 1024, 512)
    g.fillStyle = '#f6edd8'
    g.font = '600 42px Georgia, serif'
    g.textAlign = 'center'
    g.fillText('Fire vs Fire', 512, 230)
    g.font = '400 22px Segoe UI, sans-serif'
    g.fillStyle = '#e7c98a'
    g.fillText('Demonstration', 512, 280)
  }, renderer)

  const radius = 4.4
  const arc = 1.05
  const monitor = new THREE.Group()
  monitor.position.set(3.2, 0.5, 0)
  const bezel = new THREE.Mesh(
    new THREE.CylinderGeometry(radius - 0.03, radius - 0.03, 2.85, 72, 1, true, -arc / 2 - 0.04, arc + 0.08),
    new THREE.MeshStandardMaterial({ color: 0x1a1c22, metalness: 0.82, roughness: 0.28, side: THREE.DoubleSide }),
  )
  bezel.position.z = -(radius - 0.03)
  const screenMat = new THREE.ShaderMaterial({
    uniforms: {
      uVideo: { value: videoTexture },
      uFallback: { value: fallback.texture },
      uHasVideo: { value: 0 },
      uTime: { value: 0 },
    },
    vertexShader: screenVert,
    fragmentShader: screenFrag,
    side: THREE.DoubleSide,
  })
  const screen = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, 2.5, 72, 1, true, -arc / 2, arc),
    screenMat,
  )
  screen.position.z = -radius + 0.03
  screen.userData.role = 'monitor'
  const metal = new THREE.MeshStandardMaterial({ color: 0xb9c0c8, metalness: 0.88, roughness: 0.24 })
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.35, 16), metal)
  neck.position.set(0, -1.7, -0.35)
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.62, 0.08, 24), metal)
  foot.position.set(0, -2.38, -0.35)
  monitor.add(bezel, screen, neck, foot)
  scene.add(monitor)

  const cover = makeCanvasTexture(768, 1024, (g) => {
    g.fillStyle = '#1a120c'
    g.fillRect(0, 0, 768, 1024)
    g.strokeStyle = '#e7c98a'
    g.lineWidth = 18
    g.strokeRect(36, 36, 696, 952)
    g.fillStyle = '#f0d59a'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    wrapGold(g, 'FIRE VS FIRE — BSc (Hons) Dissertation — First Class Honours (25,000 Words) — L. Armstrong', 90, 220, 588, 78)
  }, renderer)
  const spine = makeCanvasTexture(128, 1024, (g) => {
    g.fillStyle = '#140e0a'
    g.fillRect(0, 0, 128, 1024)
    g.fillStyle = '#e7c98a'
    g.save()
    g.translate(64, 512)
    g.rotate(-Math.PI / 2)
    g.font = '600 42px Georgia, serif'
    g.textAlign = 'center'
    g.fillText('FIRE VS FIRE', 0, 0)
    g.restore()
  }, renderer)
  const pageEdge = new THREE.MeshStandardMaterial({ color: 0xf3efe4, roughness: 0.8 })
  const coverMat = new THREE.MeshStandardMaterial({ map: cover.texture, roughness: 0.45, metalness: 0.18 })
  const spineMat = new THREE.MeshStandardMaterial({ map: spine.texture, roughness: 0.4, metalness: 0.2 })
  const board = new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 0.5 })
  const book = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.4, 0.45), [pageEdge, spineMat, board, board, coverMat, coverMat])
  book.position.set(3.2, -2, 1)
  book.userData.role = 'book'
  scene.add(book)
  let bookLift = 0
  let bookYaw = 0
  let bookHovered = false

  const cards = []
  const layouts = [
    { x: -3.35, y: 0.4, kind: 'ai', variant: 0 },
    { x: -3.35, y: -1.35, kind: 'ai', variant: 1 },
    { x: -1.05, y: 0.4, kind: 'ai', variant: 2 },
    { x: -1.05, y: -1.35, kind: 'spider' },
  ]
  layouts.forEach((layout) => {
    const group = new THREE.Group()
    group.position.set(layout.x, layout.y, 1.35)
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(2.12, 1.62, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x2a211c, metalness: 0.5, roughness: 0.4 }),
    )
    frame.position.z = -0.04
    group.add(frame)
    let blurMat = null
    if (layout.kind === 'ai') {
      const art = makeCanvasTexture(640, 480, (g) => drawAiArt(g, layout.variant), renderer)
      blurMat = new THREE.ShaderMaterial({
        uniforms: { uMap: { value: art.texture }, uBlur: { value: 0 } },
        vertexShader: cardVert,
        fragmentShader: cardFrag,
      })
      group.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 1.5), blurMat))
    } else {
      const pageTex = makeCanvasTexture(640, 480, drawWebPage, renderer)
      group.add(new THREE.Mesh(
        new THREE.PlaneGeometry(2, 1.5),
        new THREE.MeshStandardMaterial({ map: pageTex.texture, roughness: 0.7 }),
      ))
    }
    const spider = layout.kind === 'spider' ? buildSpider() : null
    if (spider) {
      spider.group.position.z = 0.18
      group.add(spider.group)
    }
    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(1.45, 1.05, 0.42),
      new THREE.MeshPhysicalMaterial({
        color: 0xf4f7fb,
        roughness: 0.62,
        transmission: 0.28,
        thickness: 1.8,
        transparent: true,
        opacity: 0.97,
      }),
    )
    cube.position.z = 0.2
    cube.visible = false
    group.add(cube)
    const outline = makeFrame(layout.kind === 'spider' ? 0xffd84a : 0xff2d2d)
    outline.position.z = 0.08
    outline.visible = false
    group.add(outline)
    const label = makeLabel(layout.kind === 'spider'
      ? 'OBJECT DETECTED: SPIDER [99.4%] — AUTO-BLUR ACTIVE'
      : 'AI GENERATED: 75% CONFIDENCE', layout.kind === 'spider' ? '#ffd84a' : '#ff5b5b')
    group.add(label.sprite)
    scene.add(group)
    cards.push({ ...layout, group, blurMat, spider, cube, outline, label, hot: false, blur: 0 })
  })

  const reticle = new THREE.Group()
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.012, 8, 40),
    new THREE.MeshBasicMaterial({ color: 0xffc14a, toneMapped: false }),
  )
  reticle.add(ring)
  const cross = new THREE.Mesh(
    new THREE.PlaneGeometry(0.28, 0.012),
    new THREE.MeshBasicMaterial({ color: 0xffc14a, toneMapped: false, transparent: true, opacity: 0.9 }),
  )
  const crossY = cross.clone()
  crossY.rotation.z = Math.PI / 2
  reticle.add(cross, crossY)
  scene.add(reticle)
  const reticlePoint = new THREE.Vector3()
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -1.5)
  const raycaster = new THREE.Raycaster()

  let filterOn = true
  const root = document.createElement('div')
  root.className = 'page-root'
  root.innerHTML = `
    <section class="top-band">
      <p class="eyebrow">Undergraduate dissertation</p>
      <h1 class="serif">Fire-vs-Fire</h1>
      <p class="desc">${DESCRIPTION}</p>
      <div class="link-row">
        <a href="${GITHUB}" target="_blank" rel="noopener noreferrer">GitHub repository</a>
        <a href="${PDF}" target="_blank" rel="noopener noreferrer">Full 25,000-word dissertation</a>
        <a href="${VIDEO}" target="_blank" rel="noopener noreferrer">Demonstration video</a>
      </div>
    </section>
  `
  const filterButton = document.createElement('button')
  filterButton.type = 'button'
  filterButton.className = 'btn ghost filter-toggle'
  filterButton.textContent = 'Spider Filter: ON'
  filterButton.addEventListener('click', () => {
    filterOn = !filterOn
    filterButton.textContent = `Spider Filter: ${filterOn ? 'ON' : 'OFF'}`
  })
  root.append(filterButton)
  const badge = document.createElement('div')
  badge.className = 'hover-badge'
  badge.hidden = true
  badge.textContent = 'BSc (Hons) · First Class · 25,000 words'
  root.append(badge)

  const lightbox = document.createElement('div')
  lightbox.className = 'lightbox'
  lightbox.hidden = true
  lightbox.innerHTML = `
    <div class="lightbox-panel">
      <button type="button" class="lightbox-close">Close</button>
      <video controls playsinline src="${VIDEO}"></video>
    </div>
  `
  document.body.append(lightbox)
  const lightboxVideo = lightbox.querySelector('video')
  const closeLightbox = () => {
    lightbox.hidden = true
    lightboxVideo.pause()
    ctx.lockNavigation(false)
    if (video.paused) video.play().catch(() => {})
  }
  const openLightbox = () => {
    lightbox.hidden = false
    try { lightboxVideo.currentTime = video.currentTime || 0 } catch { /* file may still be writing */ }
    video.pause()
    ctx.lockNavigation(true)
    lightboxVideo.play().catch(() => {})
  }
  lightbox.querySelector('.lightbox-close').addEventListener('click', closeLightbox)
  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox) closeLightbox()
  })

  const badgeAnchor = new THREE.Vector3()

  return {
    dom: root,
    cameraPose: {
      position: new THREE.Vector3(0.15, 0.65, 8.7),
      target: new THREE.Vector3(0.2, -0.35, 0.45),
      fov: 42,
    },
    activate() {
      video.play().catch(() => {})
    },
    deactivate() {
      video.pause()
      if (!lightbox.hidden) closeLightbox()
      ctx.setCursor('')
    },
    update(dt, elapsed) {
      screenMat.uniforms.uTime.value = elapsed
      screenMat.uniforms.uHasVideo.value = video.readyState >= 2 ? 1 : 0
      if (video.readyState >= 2) videoTexture.needsUpdate = true

      if (bookHovered) {
        const delta = Math.atan2(Math.sin(0.2 - bookYaw), Math.cos(0.2 - bookYaw))
        bookYaw += delta * (1 - Math.exp(-dt * 6))
      } else {
        bookYaw += dt * 0.28
      }
      bookLift += ((bookHovered ? 0.38 : 0) - bookLift) * (1 - Math.exp(-dt * 7))
      book.position.y = -2 + bookLift
      book.rotation.y = bookYaw
      book.rotation.x = bookHovered ? -0.18 : 0
      if (bookHovered) {
        book.getWorldPosition(badgeAnchor)
        badgeAnchor.project(camera)
        badge.hidden = false
        badge.style.left = `${(badgeAnchor.x * 0.5 + 0.5) * window.innerWidth}px`
        badge.style.top = `${(-badgeAnchor.y * 0.5 + 0.5) * window.innerHeight}px`
      } else {
        badge.hidden = true
      }

      raycaster.setFromCamera(pointerNDC, camera)
      const hitPlane = raycaster.ray.intersectPlane(plane, reticlePoint)
      if (hitPlane) {
        reticle.visible = true
        reticle.position.copy(reticlePoint)
        reticle.lookAt(camera.position)
      } else {
        reticle.visible = false
      }
      cards.forEach((card) => {
        const over = !!hitPlane && Math.abs(reticlePoint.x - card.group.position.x) < 1.02 && Math.abs(reticlePoint.y - card.group.position.y) < 0.78
        card.hot = over
        card.outline.visible = over
        card.label.sprite.visible = over
        if (card.kind === 'ai') {
          card.blur += ((over ? 1 : 0) - card.blur) * (1 - Math.exp(-dt * 7))
          card.blurMat.uniforms.uBlur.value = card.blur
        } else if (card.spider) {
          const censor = over && filterOn
          card.spider.group.visible = !censor
          card.cube.visible = censor
          const text = filterOn
            ? 'OBJECT DETECTED: SPIDER [99.4%] — AUTO-BLUR ACTIVE'
            : 'OBJECT DETECTED: SPIDER [99.4%] — FILTER OFF'
          if (card.label.text !== text) {
            card.label.text = text
            card.label.redraw(text)
          }
          card.spider.legs.forEach((leg) => {
            leg.femurPivot.rotation.z = leg.baseFemur + Math.sin(elapsed * 2.6 + leg.phase) * 0.06
            leg.tibiaPivot.rotation.z = leg.baseTibia + Math.sin(elapsed * 3.4 + leg.phase) * 0.08
          })
        }
      })

      const uiHits = raycaster.intersectObjects([screen, book], false)
      const role = uiHits[0]?.object.userData.role
      bookHovered = role === 'book'
      ctx.setCursor(role ? 'pointer' : '')
    },
    onPointerDown() {
      raycaster.setFromCamera(pointerNDC, camera)
      const hits = raycaster.intersectObjects([screen, book], false)
      const role = hits[0]?.object.userData.role
      if (role === 'monitor') {
        if (lightbox.hidden) openLightbox()
        else closeLightbox()
        return true
      }
      if (role === 'book') {
        window.open(PDF, '_blank', 'noopener')
        return true
      }
      return false
    },
    onPointerMove() {},
    onPointerUp() {},
    onDoubleClick() {},
    onKeyDown() {},
    onResize() {},
  }
}

function wrapGold(g, text, x, y, maxWidth, lineHeight) {
  g.font = '600 42px Georgia, serif'
  const words = text.split(' ')
  let line = ''
  let cursor = y
  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word
    if (g.measureText(test).width > maxWidth && line) {
      g.fillText(line, x + maxWidth / 2, cursor)
      line = word
      cursor += lineHeight
    } else {
      line = test
    }
  })
  if (line) g.fillText(line, x + maxWidth / 2, cursor)
}

function makeFrame(color) {
  const w = 2.08
  const h = 1.58
  const z = 0
  const hw = w / 2
  const hh = h / 2
  const points = [
    -hw, -hh, z, hw, -hh, z,
    hw, -hh, z, hw, hh, z,
    hw, hh, z, -hw, hh, z,
    -hw, hh, z, -hw, -hh, z,
  ]
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, toneMapped: false }))
}

function makeLabel(text, color) {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 128
  const g = canvas.getContext('2d')
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }))
  sprite.scale.set(2.35, 0.3, 1)
  sprite.position.set(0, 0.98, 0.12)
  sprite.visible = false
  const label = {
    sprite,
    text,
    redraw(next) {
      g.clearRect(0, 0, 1024, 128)
      g.font = '700 36px Segoe UI, sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillStyle = color
      g.shadowColor = color
      g.shadowBlur = 12
      g.fillText(next, 512, 64)
      texture.needsUpdate = true
    },
  }
  label.redraw(text)
  return label
}

function drawAiArt(g, variant) {
  const w = 640
  const h = 480
  if (variant === 0) {
    g.fillStyle = '#1a0830'
    g.fillRect(0, 0, w, h)
    for (let i = 0; i < 18; i += 1) {
      const a = i * 0.55
      g.fillStyle = `hsla(${(i * 28) % 360}, 80%, 62%, 0.55)`
      g.beginPath()
      g.arc(320 + Math.cos(a) * (30 + i * 12), 240 + Math.sin(a) * (20 + i * 8), 28 + (i % 4) * 8, 0, Math.PI * 2)
      g.fill()
    }
  } else if (variant === 1) {
    g.fillStyle = '#081018'
    g.fillRect(0, 0, w, h)
    for (let i = 0; i < 16; i += 1) {
      g.fillStyle = `hsl(${180 + i * 12}, 70%, ${40 + (i % 5) * 8}%)`
      g.beginPath()
      g.moveTo(Math.random() * w, Math.random() * h)
      g.lineTo(Math.random() * w, Math.random() * h)
      g.lineTo(Math.random() * w, Math.random() * h)
      g.fill()
    }
  } else {
    g.fillStyle = '#20100a'
    g.fillRect(0, 0, w, h)
    for (let y = 0; y < h; y += 8) {
      for (let x = 0; x < w; x += 8) {
        const n = Math.abs(Math.sin(x * 0.07) * Math.cos(y * 0.05) + Math.sin((x + y) * 0.02))
        g.fillStyle = `rgb(${40 + n * 180}, ${30 + n * 80}, ${20 + n * 40})`
        g.fillRect(x, y, 8, 8)
      }
    }
  }
}

function drawWebPage(g) {
  g.fillStyle = '#f4f1ea'
  g.fillRect(0, 0, 640, 480)
  g.fillStyle = '#d9d3c7'
  g.fillRect(0, 0, 640, 36)
  g.fillStyle = '#bf3b32'
  g.beginPath()
  g.arc(22, 18, 6, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#222'
  g.font = '600 22px Georgia, serif'
  g.fillText('Garden notes', 28, 78)
  g.fillStyle = '#5c564e'
  g.font = '16px Segoe UI, sans-serif'
  for (let i = 0; i < 8; i += 1) {
    g.fillRect(28, 110 + i * 28, 420 - (i % 3) * 40, 10)
  }
}

function buildSpider() {
  const mat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4, metalness: 0.15 })
  const group = new THREE.Group()
  const abdomen = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 14), mat)
  abdomen.scale.set(1.05, 0.78, 1.35)
  abdomen.position.set(0, 0.02, 0.16)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), mat)
  head.position.set(0, 0.03, -0.16)
  group.add(abdomen, head)
  const legs = []
  for (let i = 0; i < 8; i += 1) {
    const side = i < 4 ? 1 : -1
    const index = i % 4
    const hip = new THREE.Group()
    hip.position.set(side * 0.07, 0.02, -0.08 + index * 0.07)
    hip.rotation.y = side * (-0.85 + index * 0.52)
    const femurPivot = new THREE.Group()
    const femur = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.012, 0.28, 6), mat)
    femur.position.y = 0.14
    femurPivot.add(femur)
    femurPivot.rotation.z = side * 0.7
    const tibiaPivot = new THREE.Group()
    tibiaPivot.position.y = 0.27
    const tibia = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.008, 0.28, 6), mat)
    tibia.position.y = -0.14
    tibiaPivot.add(tibia)
    tibiaPivot.rotation.z = side * -1.15
    femurPivot.add(tibiaPivot)
    hip.add(femurPivot)
    group.add(hip)
    legs.push({
      femurPivot,
      tibiaPivot,
      baseFemur: femurPivot.rotation.z,
      baseTibia: tibiaPivot.rotation.z,
      phase: index * 0.7 + (side < 0 ? 1.2 : 0),
    })
  }
  group.scale.setScalar(1.2)
  return { group, legs }
}
