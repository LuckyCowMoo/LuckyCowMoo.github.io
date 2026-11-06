import { makeCanvasTexture } from '../engine/canvasTexture.js'

export const pageIndex = 2
export const pageId = 'class-grades'
export const usesPhysics = false

const LIVE = 'https://luckycowmoo.github.io/class-grades-analyser/'

const REPORTS = [
  { name: 'Rowan Hale', dob: '14 Mar 2010', rows: [['Maths', '7'], ['English', '6'], ['Science', '8']] },
  { name: 'Mina Cole', dob: '02 Nov 2009', rows: [['Maths', '5'], ['English', '7'], ['Science', '6']] },
  { name: 'Ellis Ward', dob: '28 Jun 2010', rows: [['Maths', '8'], ['English', '5'], ['Science', '7']] },
  { name: 'Priya Shah', dob: '09 Jan 2011', rows: [['Maths', '6'], ['English', '8'], ['Science', '6']] },
  { name: 'Jonah Peck', dob: '19 Aug 2009', rows: [['Maths', '4'], ['English', '5'], ['Science', '5']] },
  { name: 'Noor Adel', dob: '03 May 2010', rows: [['Maths', '9'], ['English', '7'], ['Science', '8']] },
  { name: 'Greta Moss', dob: '11 Feb 2010', rows: [['Maths', '6'], ['English', '6'], ['Science', '7']] },
  { name: 'Idris Bell', dob: '30 Sep 2009', rows: [['Maths', '7'], ['English', '4'], ['Science', '6']] },
]

const INSIGHTS = [
  { text: 'KS4 Subgroup Trend: +14% Logic Mastery', color: 0x7ee7ff, home: [3.7, 1.05, 0.15] },
  { text: 'Intervention Flag: Anonymized ID #042', color: 0xc4b0ff, home: [5.05, 1.35, -0.25] },
  { text: 'Cohort Pacing: Above Target', color: 0x7dffc0, home: [5.85, 0.15, 0.35] },
  { text: 'Reading Age Delta: +0.6 years, names withheld', color: 0xffd27a, home: [4.35, -0.85, 0.05] },
  { text: 'Homework Completion: Cohort 91%', color: 0xff9ec4, home: [6.05, -1.15, -0.2] },
  { text: 'Attendance Pattern: Stable, ID withheld', color: 0x9ad4ff, home: [3.85, -1.55, 0.28] },
]

const LINKS = [[0, 1], [1, 2], [2, 4], [4, 5], [5, 3], [3, 0], [0, 2], [1, 4], [3, 4]]

const paperVert = `
  uniform float uPull;
  uniform float uTime;
  uniform vec3 uTarget;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    float lead = smoothstep(-0.05, 1.0, vUv.x);
    vec3 pos = position;
    pos += uTarget * uPull * lead;
    pos.z += sin(vUv.y * 3.14159) * uPull * 0.62 * lead;
    pos.y += sin(uTime * 1.3 + position.x * 4.0) * 0.02;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`
const paperFrag = `
  uniform sampler2D uMap;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    vec4 tex = texture2D(uMap, vUv);
    gl_FragColor = vec4(tex.rgb, tex.a * uOpacity);
  }
`

export function createPage(ctx) {
  const { THREE, scene, camera, pointerNDC, renderer } = ctx
  scene.background = new THREE.Color(0x0b1014)
  scene.fog = new THREE.Fog(0x0b1014, 18, 36)
  scene.add(new THREE.HemisphereLight(0xd5e4f4, 0x10141c, 0.65))
  const key = new THREE.DirectionalLight(0xfff6ea, 2.3)
  key.position.set(5, 8, 7)
  scene.add(key)

  const prismMat = new THREE.MeshPhysicalMaterial({
    color: 0xf7fffc,
    metalness: 0,
    roughness: 0.08,
    transmission: 0.95,
    thickness: 3.5,
    ior: 1.45,
    dispersion: 0.04,
    attenuationColor: new THREE.Color(0xd9fff4),
    attenuationDistance: 8,
    transparent: false,
  })
  const prism = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 3.0, 3), prismMat)
  const rimA = new THREE.PointLight(0xff4ad8, 3.5, 4.5, 2)
  rimA.position.set(-0.55, 0.7, 0.2)
  const rimB = new THREE.PointLight(0x3defff, 3.5, 4.5, 2)
  rimB.position.set(0.6, -0.55, 0.15)
  prism.add(rimA, rimB)
  prism.rotation.x = 0.72
  scene.add(prism)

  const cageMat = new THREE.MeshBasicMaterial({
    color: 0x1f8f62,
    wireframe: true,
    transparent: true,
    opacity: 0.42,
  })
  const cage = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6, 1), cageMat)
  scene.add(cage)

  const uTime = { value: 0 }
  const sheetGeo = new THREE.PlaneGeometry(1.1, 1.5, 16, 16)
  const sheets = REPORTS.map((report, index) => {
    const painted = makeCanvasTexture(640, 872, (g) => drawReport(g, report), renderer)
    const uniforms = {
      uMap: { value: painted.texture },
      uPull: { value: 0 },
      uOpacity: { value: 1 },
      uTime,
      uTarget: { value: new THREE.Vector3() },
    }
    const mesh = new THREE.Mesh(sheetGeo, new THREE.ShaderMaterial({
      uniforms,
      vertexShader: paperVert,
      fragmentShader: paperFrag,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    }))
    mesh.position.set(-7.4 + (index % 4) * 1.45, -0.35 - (index % 4) * 0.48 - Math.floor(index / 4) * 0.25, (index % 3 - 1) * 0.32)
    mesh.rotation.y = (index % 2 ? 1 : -1) * 0.14
    mesh.rotation.z = (index - 3.5) * 0.03
    scene.add(mesh)
    return {
      mesh,
      uniforms,
      x: mesh.position.x,
      baseY: mesh.position.y,
      phase: index * 1.3,
      speed: 0.72 + (index % 3) * 0.08,
      spent: false,
    }
  })

  const bitGeo = new THREE.OctahedronGeometry(0.045, 0)
  const bits = Array.from({ length: 42 }, (_, index) => {
    const mesh = new THREE.Mesh(bitGeo, new THREE.MeshBasicMaterial({
      color: index % 2 ? 0xe9fff8 : 0x39f0ff,
      toneMapped: false,
    }))
    mesh.visible = false
    scene.add(mesh)
    return { mesh, life: 0, vel: new THREE.Vector3() }
  })

  const nodes = INSIGHTS.map((insight, index) => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 32, 32),
      new THREE.MeshPhysicalMaterial({
        color: insight.color,
        emissive: insight.color,
        emissiveIntensity: 0.55,
        roughness: 0.18,
        metalness: 0.05,
        transmission: 0.42,
        thickness: 0.7,
        ior: 1.4,
      }),
    )
    const home = new THREE.Vector3(...insight.home)
    mesh.position.set(1.65, home.y * 0.35, home.z)
    scene.add(mesh)
    mesh.userData.index = index
    return {
      index,
      insight,
      mesh,
      home,
      vel: new THREE.Vector3(),
      acc: new THREE.Vector3(),
      pulse: 0,
    }
  })
  const linePositions = new Float32Array(LINKS.length * 6)
  const lineGeo = new THREE.BufferGeometry()
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3))
  const tethers = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({
    color: 0xb7dcff,
    transparent: true,
    opacity: 0.5,
  }))
  scene.add(tethers)

  const root = document.createElement('div')
  root.className = 'page-root'
  root.innerHTML = `
    <section class="side-copy grades-copy">
      <p class="eyebrow">Teacher resource</p>
      <h1 class="serif">Class Grades Analyser</h1>
      <p class="desc">Class Grades Analyser is a teacher resource that takes standard pupil progress reports as input and safely generates intelligent AI insights about individual students and the class as a whole, without ever exposing identifiable information to an AI company or third party. Read more about how this privacy architecture works on the website.</p>
      <div class="actions">
        <a class="btn" href="${LIVE}" target="_blank" rel="noopener noreferrer">Launch Class Grades Analyser</a>
      </div>
      <p class="hint">Hover an insight sphere. Names dissolve inside the prism.</p>
    </section>
    <aside class="insight-card" hidden>
      <p class="insight-kicker">Anonymized class insight</p>
      <h2></h2>
      <div class="pii-flow" aria-hidden="true">
        <span>Pupil report</span>
        <span class="pii-arrow">→</span>
        <span class="pii-strip">PII</span>
        <span class="pii-arrow">→</span>
        <span>Local inference</span>
      </div>
      <p class="pii-note">PII Stripped Locally Before Inference</p>
    </aside>
  `
  const card = root.querySelector('.insight-card')
  const cardTitle = card.querySelector('h2')

  const raycaster = new THREE.Raycaster()
  const localTarget = new THREE.Vector3()
  const pointerWorld = new THREE.Vector3()
  const plane = new THREE.Plane()
  const planeNormal = new THREE.Vector3()
  const clusterCenter = new THREE.Vector3(4.8, 0, 0.1)
  const delta = new THREE.Vector3()
  const projected = new THREE.Vector3()
  let anonymize = 0
  let pointerSeen = false
  let pinned = -1
  let nextPulse = 0

  function burst() {
    let spawned = 0
    bits.forEach((bit) => {
      if (spawned > 16 || bit.life > 0.05) return
      spawned += 1
      const angle = Math.random() * Math.PI * 2
      const radius = Math.random() * 0.85
      bit.mesh.position.set(Math.cos(angle) * radius, (Math.random() - 0.5) * 1.6, Math.sin(angle) * radius)
      bit.vel.set((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 0.8)
      bit.life = 0.85 + Math.random() * 0.45
      bit.mesh.visible = true
      bit.mesh.scale.setScalar(0.6 + Math.random() * 0.8)
    })
  }

  function showCard(index) {
    const node = nodes[index]
    cardTitle.textContent = node.insight.text
    node.mesh.getWorldPosition(projected)
    projected.project(camera)
    let x = (projected.x * 0.5 + 0.5) * window.innerWidth + 24
    let y = (-projected.y * 0.5 + 0.5) * window.innerHeight - 16
    if (x > window.innerWidth - 300) x -= 340
    if (y > window.innerHeight - 180) y = window.innerHeight - 190
    if (y < 12) y = 12
    card.style.left = `${x}px`
    card.style.top = `${y}px`
    card.hidden = false
  }

  function hitNode() {
    raycaster.setFromCamera(pointerNDC, camera)
    const hits = raycaster.intersectObjects(nodes.map((node) => node.mesh), false)
    return hits.length ? hits[0].object.userData.index : -1
  }

  return {
    dom: root,
    cameraPose: {
      position: new THREE.Vector3(0.15, 1.15, 14.4),
      target: new THREE.Vector3(0.2, -0.15, 0),
      fov: 36,
    },
    activate() {},
    deactivate() {
      ctx.setCursor('')
      card.hidden = true
      pinned = -1
    },
    update(dt, elapsed) {
      uTime.value = elapsed
      anonymize = Math.max(0, anonymize - dt * 0.45)
      prism.rotation.y += dt * 0.18
      cage.rotation.y -= dt * 0.28
      cage.rotation.x = Math.sin(elapsed * 0.35) * 0.18
      const pulse = anonymize * (0.55 + 0.45 * Math.sin(elapsed * 9))
      cage.scale.setScalar(1 + pulse * 0.045)
      cageMat.color.set(pulse > 0.08 ? 0x5dffb0 : 0x1f8f62)
      cageMat.opacity = 0.38 + pulse * 0.5

      sheets.forEach((sheet) => {
        sheet.x += dt * sheet.speed
        if (!sheet.spent && sheet.x >= -1.2) {
          sheet.spent = true
          anonymize = 1
          burst()
          nodes[nextPulse % nodes.length].pulse = 1
          nextPulse += 1
        }
        if (sheet.x > -0.45) {
          sheet.x = -8.6 - Math.random() * 1.4
          sheet.baseY = -2.15 + Math.random() * 1.7
          sheet.spent = false
        }
        sheet.mesh.position.x = sheet.x
        sheet.mesh.position.y = sheet.baseY + Math.sin(elapsed * 0.65 + sheet.phase) * 0.1
        sheet.uniforms.uPull.value = THREE.MathUtils.smoothstep(sheet.x, -2.7, -1.05)
        sheet.uniforms.uOpacity.value = 1 - THREE.MathUtils.smoothstep(sheet.x, -2.05, -0.6)
        localTarget.set(0, 0, 0)
        sheet.mesh.worldToLocal(localTarget)
        sheet.uniforms.uTarget.value.copy(localTarget)
      })

      bits.forEach((bit) => {
        if (bit.life <= 0) return
        bit.life -= dt
        bit.vel.y -= dt * 0.15
        bit.mesh.position.addScaledVector(bit.vel, dt)
        bit.mesh.rotation.y += dt * 2.4
        bit.mesh.material.opacity = 1
        if (bit.life <= 0) bit.mesh.visible = false
      })

      let magnet = null
      if (pointerSeen) {
        raycaster.setFromCamera(pointerNDC, camera)
        planeNormal.copy(camera.position).sub(clusterCenter).normalize()
        plane.setFromNormalAndCoplanarPoint(planeNormal, clusterCenter)
        magnet = raycaster.ray.intersectPlane(plane, pointerWorld)
      }
      nodes.forEach((node, index) => {
        nodes.forEach((other, otherIndex) => {
          if (otherIndex <= index) return
          delta.subVectors(other.mesh.position, node.mesh.position)
          const dist = Math.max(0.35, delta.length())
          delta.multiplyScalar(1.35 / (dist * dist * dist))
          node.acc.sub(delta)
          other.acc.add(delta)
        })
      })
      LINKS.forEach(([a, b]) => {
        delta.subVectors(nodes[b].mesh.position, nodes[a].mesh.position)
        const dist = Math.max(0.001, delta.length())
        const stretch = dist - 1.45
        delta.multiplyScalar((stretch * 2.4) / dist)
        nodes[a].acc.add(delta)
        nodes[b].acc.sub(delta)
      })
      nodes.forEach((node) => {
        delta.subVectors(node.home, node.mesh.position).multiplyScalar(1.6)
        node.acc.add(delta)
        if (magnet) {
          delta.subVectors(node.mesh.position, magnet)
          const dist = delta.length()
          if (dist > 0.001 && dist < 3.1) {
            delta.multiplyScalar(1 / dist)
            const push = dist < 1.05 ? 16 : -7 * (1 - dist / 3.1)
            node.acc.addScaledVector(delta, push)
          }
        }
        node.vel.addScaledVector(node.acc, dt)
        node.vel.multiplyScalar(0.86)
        if (node.vel.length() > 2.4) node.vel.setLength(2.4)
        node.mesh.position.addScaledVector(node.vel, dt)
        node.mesh.position.x = Math.max(1.7, node.mesh.position.x)
        node.acc.set(0, 0, 0)
        node.pulse = Math.max(0, node.pulse - dt * 0.8)
        const hover = node.mesh.userData.hot ? 0.16 : 0
        const scale = 1 + hover + node.pulse * 0.28
        node.mesh.scale.setScalar(scale)
        node.mesh.material.emissiveIntensity = 0.45 + hover * 0.8 + node.pulse * 1.1
      })
      let cursor = 0
      LINKS.forEach(([a, b]) => {
        nodes[a].mesh.position.toArray(linePositions, cursor)
        cursor += 3
        nodes[b].mesh.position.toArray(linePositions, cursor)
        cursor += 3
      })
      lineGeo.attributes.position.needsUpdate = true

      const hovered = pointerSeen ? hitNode() : -1
      nodes.forEach((node) => { node.mesh.userData.hot = node.index === hovered })
      const active = hovered >= 0 ? hovered : pinned
      if (active >= 0) showCard(active)
      else card.hidden = true
      ctx.setCursor(hovered >= 0 ? 'pointer' : '')
    },
    onPointerDown() {
      const hit = hitNode()
      if (hit < 0) {
        pinned = -1
        return false
      }
      pinned = hit
      showCard(hit)
      return true
    },
    onPointerMove() {
      pointerSeen = true
    },
    onPointerUp() {},
    onDoubleClick() {},
    onKeyDown() {},
    onResize() {},
  }
}

function drawReport(g, report) {
  const w = 640
  const h = 872
  g.fillStyle = '#f3ecdf'
  g.fillRect(0, 0, w, h)
  g.strokeStyle = '#d7cbb6'
  g.lineWidth = 10
  g.strokeRect(18, 18, w - 36, h - 36)
  g.fillStyle = '#c42828'
  g.fillRect(36, 40, w - 72, 132)
  g.fillStyle = '#fff7f5'
  g.font = '700 30px Segoe UI, sans-serif'
  g.textAlign = 'left'
  g.textBaseline = 'middle'
  g.fillText('PII: Student Name / DOB', 56, 78)
  g.font = '600 34px Georgia, serif'
  g.fillText(report.name, 56, 124)
  g.fillStyle = '#2c241c'
  g.font = '600 26px Segoe UI, sans-serif'
  g.fillText(report.dob, 56, 214)
  g.fillStyle = '#8a3b32'
  g.font = '700 22px Segoe UI, sans-serif'
  g.fillText('PROGRESS REPORT', 56, 268)
  g.strokeStyle = '#c9b89a'
  g.lineWidth = 2
  g.beginPath()
  g.moveTo(56, 292)
  g.lineTo(w - 56, 292)
  g.stroke()
  g.fillStyle = '#6d6256'
  g.font = '700 22px Segoe UI, sans-serif'
  g.fillText('Subject', 64, 332)
  g.fillText('Grade', 430, 332)
  report.rows.forEach((row, index) => {
    const y = 392 + index * 78
    g.fillStyle = index % 2 ? '#efe6d6' : '#f7f1e6'
    g.fillRect(52, y - 28, w - 104, 64)
    g.fillStyle = '#241c16'
    g.font = '600 28px Georgia, serif'
    g.fillText(row[0], 72, y + 4)
    g.fillStyle = '#9d2b2b'
    g.font = '700 30px Segoe UI, sans-serif'
    g.fillText(row[1], 446, y + 4)
  })
  g.fillStyle = '#8d8172'
  g.font = '500 18px Segoe UI, sans-serif'
  g.fillText('Internal school copy  ·  not for external models', 56, 800)
}
