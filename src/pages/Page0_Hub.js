import { makeCanvasTexture } from '../engine/canvasTexture.js'

export const pageIndex = 0
export const pageId = 'hub'
export const usesPhysics = true

const PORTAL = { x: 0, y: -2.4, z: 0 }
const PORTAL_RADIUS = 1.6

export function createPage(ctx) {
  const { THREE, RAPIER, scene, world, camera, pointerNDC, navigateToPageCallback, renderer } = ctx
  scene.background = new THREE.Color(0x0b0d13)
  scene.fog = new THREE.Fog(0x0b0d13, 12, 30)

  const hemi = new THREE.HemisphereLight(0x9eb4c8, 0x07080c, 0.55)
  const sun = new THREE.DirectionalLight(0xfff4e4, 2.4)
  sun.position.set(6.5, 9.5, 5)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.near = 1
  sun.shadow.camera.far = 28
  sun.shadow.camera.left = -10
  sun.shadow.camera.right = 10
  sun.shadow.camera.top = 10
  sun.shadow.camera.bottom = -10
  const fill = new THREE.DirectionalLight(0x88cfff, 0.45)
  fill.position.set(-6, 3, -4)
  const portalLight = new THREE.PointLight(0x37e7ff, 8, 9, 2)
  portalLight.position.set(0, -1.2, 0)
  scene.add(hemi, sun, fill, portalLight)

  const grid = makeCanvasTexture(512, 512, (g) => {
    g.fillStyle = '#1a2030'
    g.fillRect(0, 0, 512, 512)
    g.strokeStyle = 'rgba(110, 230, 255, 0.28)'
    g.lineWidth = 2
    for (let i = 0; i <= 512; i += 64) {
      g.beginPath()
      g.moveTo(i, 0)
      g.lineTo(i, 512)
      g.moveTo(0, i)
      g.lineTo(512, i)
      g.stroke()
    }
    g.strokeStyle = 'rgba(190, 250, 255, 0.55)'
    g.lineWidth = 4
    g.strokeRect(2, 2, 508, 508)
  }, renderer)
  grid.texture.wrapS = grid.texture.wrapT = THREE.RepeatWrapping
  grid.texture.repeat.set(14, 14)

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({
      color: 0x9aa6b5,
      roughness: 0.2,
      metalness: 0.8,
      map: grid.texture,
      emissive: 0x0b3a44,
      emissiveMap: grid.texture,
      emissiveIntensity: 0.45,
    }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -2.5
  floor.receiveShadow = true
  scene.add(floor)
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(30, 0.08, 30).setFriction(0.95).setRestitution(0.16),
    world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -2.58, 0)),
  )

  const portal = new THREE.Mesh(
    new THREE.TorusGeometry(1.8, 0.06, 16, 64),
    new THREE.ShaderMaterial({
      transparent: true,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec3 vNormal;
        void main() {
          float pulse = 0.5 + 0.5 * sin(uTime * 3.0);
          float rim = pow(1.0 - abs(vNormal.y), 1.4);
          vec3 col = mix(vec3(0.02, 0.28, 0.38), vec3(0.72, 1.0, 1.0), pulse);
          gl_FragColor = vec4(col + rim * 0.25, 0.95);
        }
      `,
    }),
  )
  portal.rotation.x = Math.PI / 2
  portal.position.set(PORTAL.x, PORTAL.y, PORTAL.z)
  scene.add(portal)

  const totems = []
  const raycaster = new THREE.Raycaster()
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const dragPoint = new THREE.Vector3()
  let grabbed = null
  let dx = 0
  let dy = 0
  let spinX = 0
  let spinY = 0

  function track(group, record) {
    group.userData.totem = record
    group.traverse((child) => {
      child.userData.totem = record
      child.castShadow = true
    })
    scene.add(group)
    totems.push(record)
  }

  function bodyFor(position, rotation, collider, density) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation[0], rotation[1], rotation[2]))
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(position[0], position[1], position[2])
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
        .setLinearDamping(0.32)
        .setAngularDamping(0.48)
        .setCcdEnabled(true),
    )
    world.createCollider(collider.setFriction(0.64).setRestitution(0.34).setDensity(density), body)
    body.setAngvel({
      x: (Math.random() - 0.5) * 1.4,
      y: (Math.random() - 0.5),
      z: (Math.random() - 0.5) * 1.4,
    }, true)
    return body
  }

  const bookTex = makeCanvasTexture(512, 768, (g) => {
    g.fillStyle = '#1a1030'
    g.fillRect(0, 0, 512, 768)
    g.strokeStyle = '#e6c27a'
    g.lineWidth = 14
    g.strokeRect(28, 28, 456, 712)
    g.strokeStyle = 'rgba(230, 194, 122, 0.45)'
    g.lineWidth = 2
    g.strokeRect(48, 48, 416, 672)
    g.strokeStyle = '#f0d59a'
    g.lineWidth = 6
    g.beginPath()
    g.arc(256, 300, 92, 0, Math.PI * 2)
    g.stroke()
    g.beginPath()
    g.moveTo(256, 214)
    g.lineTo(318, 340)
    g.lineTo(194, 340)
    g.closePath()
    g.moveTo(256, 386)
    g.lineTo(194, 260)
    g.lineTo(318, 260)
    g.closePath()
    g.stroke()
    const keys = ['T', 'Y', 'P', 'E']
    keys.forEach((letter, i) => {
      const x = 78 + i * 96
      g.fillStyle = '#2a2144'
      g.fillRect(x, 560, 74, 74)
      g.strokeStyle = '#d9c7ff'
      g.lineWidth = 3
      g.strokeRect(x, 560, 74, 74)
      g.fillStyle = '#f4f0ff'
      g.font = '600 32px Segoe UI, sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(letter, x + 37, 598)
    })
  }, renderer)
  const book = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.7, 0.15), [
    new THREE.MeshStandardMaterial({ color: 0x241636, roughness: 0.45, metalness: 0.2 }),
    new THREE.MeshStandardMaterial({ color: 0x241636, roughness: 0.45, metalness: 0.2 }),
    new THREE.MeshStandardMaterial({ color: 0x241636, roughness: 0.45, metalness: 0.2 }),
    new THREE.MeshStandardMaterial({ color: 0x241636, roughness: 0.45, metalness: 0.2 }),
    new THREE.MeshStandardMaterial({ map: bookTex.texture, roughness: 0.42, metalness: 0.18 }),
    new THREE.MeshStandardMaterial({ map: bookTex.texture, roughness: 0.42, metalness: 0.18 }),
  ])
  const bookSpawn = [-2.35, 0.55, 1.25]
  const bookBody = bodyFor(bookSpawn, [0.5, 0.2, 0.7], RAPIER.ColliderDesc.cuboid(0.6, 0.85, 0.075), 1.1)
  track(book, makeRecord('Typemancer', 1, book, bookBody, bookSpawn))

  const prismGeo = new THREE.OctahedronGeometry(1, 0)
  const prism = new THREE.Mesh(
    prismGeo,
    new THREE.MeshPhysicalMaterial({
      transmission: 0.95,
      ior: 1.5,
      thickness: 2.0,
      roughness: 0.05,
      color: 0x88ccff,
      metalness: 0,
    }),
  )
  const hull = RAPIER.ColliderDesc.convexHull(prismGeo.attributes.position.array)
  const prismSpawn = [3.35, 0.85, 1.35]
  const prismBody = bodyFor(prismSpawn, [0.4, 0.9, 0.2], hull || RAPIER.ColliderDesc.ball(0.9), 2.5)
  track(prism, makeRecord('Class Grades Analyser', 2, prism, prismBody, prismSpawn))

  const chipTex = makeCanvasTexture(512, 512, (g) => {
    g.fillStyle = '#102116'
    g.fillRect(0, 0, 512, 512)
    g.strokeStyle = '#c6a15a'
    g.lineWidth = 3
    for (let i = 0; i < 6; i += 1) {
      const y = 90 + i * 62
      g.beginPath()
      g.moveTo(24, y)
      g.lineTo(150, y)
      g.stroke()
    }
    g.strokeStyle = '#d7ffe8'
    g.lineWidth = 8
    g.beginPath()
    g.moveTo(168, 150)
    g.lineTo(270, 150)
    g.arc(270, 256, 106, -Math.PI / 2, Math.PI / 2)
    g.lineTo(168, 362)
    g.closePath()
    g.stroke()
    g.beginPath()
    g.moveTo(120, 204)
    g.lineTo(168, 204)
    g.moveTo(120, 308)
    g.lineTo(168, 308)
    g.moveTo(376, 256)
    g.lineTo(470, 256)
    g.stroke()
    g.fillStyle = '#d7ffe8'
    g.font = '600 40px Segoe UI, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('AND', 246, 262)
  }, renderer)
  const silicon = new THREE.MeshStandardMaterial({ color: 0x161c18, metalness: 0.45, roughness: 0.48 })
  const chipTop = new THREE.MeshStandardMaterial({ map: chipTex.texture, metalness: 0.35, roughness: 0.4 })
  const chip = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.3, 1.3), [silicon, silicon, chipTop, silicon, silicon, silicon])
  const pinGeo = new THREE.BoxGeometry(0.05, 0.07, 0.18)
  const pinMat = new THREE.MeshStandardMaterial({ color: 0xd4b46a, metalness: 0.9, roughness: 0.25 })
  const pins = new THREE.InstancedMesh(pinGeo, pinMat, 32)
  const dummy = new THREE.Object3D()
  let pin = 0
  for (let i = 0; i < 8; i += 1) {
    const along = -0.52 + (i * 1.04) / 7
    const places = [
      [along, -0.08, 0.78, 0],
      [along, -0.08, -0.78, 0],
      [0.78, -0.08, along, Math.PI / 2],
      [-0.78, -0.08, along, Math.PI / 2],
    ]
    for (const [x, y, z, rotY] of places) {
      dummy.position.set(x, y, z)
      dummy.rotation.set(0, rotY, 0)
      dummy.updateMatrix()
      pins.setMatrixAt(pin, dummy.matrix)
      pin += 1
    }
  }
  pins.instanceMatrix.needsUpdate = true
  chip.add(pins)
  const chipSpawn = [2.7, 0.45, -2.25]
  const chipBody = bodyFor(chipSpawn, [0.15, 0.4, 0.2], RAPIER.ColliderDesc.cuboid(0.65, 0.15, 0.65), 3.2)
  track(chip, makeRecord('Circuit Maker', 3, chip, chipBody, chipSpawn))

  const lensMat = new THREE.MeshStandardMaterial({ color: 0xc5ccd4, metalness: 0.92, roughness: 0.22 })
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.2, 32), lensMat)
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.78, 0.78, 0.06, 32),
    new THREE.MeshBasicMaterial({
      color: 0xff1a22,
      transparent: true,
      opacity: 0.9,
      toneMapped: false,
    }),
  )
  glass.position.y = 0.1
  const glow = new THREE.PointLight(0xff2028, 6, 4.2, 2)
  glow.position.y = 0.35
  lens.add(glass, glow)
  const lensSpawn = [-2.85, 1.05, -1.9]
  const lensBody = bodyFor(lensSpawn, [0.95, 0.35, 0.2], RAPIER.ColliderDesc.cylinder(0.1, 1), 6)
  track(lens, makeRecord('Fire-vs-Fire', 4, lens, lensBody, lensSpawn))

  const root = document.createElement('div')
  root.className = 'page-root'
  root.innerHTML = `
    <header class="hub-head">
      <h1 class="serif">Leah (Luke) Armstrong — Interactive Engineering Portfolio</h1>
      <p>Scroll down to explore, or toss a project totem into the central portal.</p>
    </header>
  `
  const tooltip = document.createElement('div')
  tooltip.className = 'tooltip'
  tooltip.hidden = true
  root.append(tooltip)

  function pick() {
    raycaster.setFromCamera(pointerNDC, camera)
    const hits = raycaster.intersectObjects(totems.map((totem) => totem.mesh), true)
    return hits[0]?.object.userData.totem || null
  }

  function segmentDistance(a, b) {
    const abx = b.x - a.x
    const aby = b.y - a.y
    const abz = b.z - a.z
    const apx = PORTAL.x - a.x
    const apy = PORTAL.y - a.y
    const apz = PORTAL.z - a.z
    const ab2 = abx * abx + aby * aby + abz * abz
    let t = ab2 < 1e-8 ? 0 : (apx * abx + apy * aby + apz * abz) / ab2
    t = Math.max(0, Math.min(1, t))
    return Math.hypot(a.x + abx * t - PORTAL.x, a.y + aby * t - PORTAL.y, a.z + abz * t - PORTAL.z)
  }

  return {
    dom: root,
    cameraPose: {
      position: new THREE.Vector3(0, 2.15, 8.5),
      target: new THREE.Vector3(0, -0.85, 0),
      fov: 40,
    },
    activate() {},
    deactivate() {
      grabbed = null
      tooltip.hidden = true
      ctx.setCursor('')
    },
    update(dt, elapsed) {
      portal.material.uniforms.uTime.value = elapsed
      const pulse = Math.sin(elapsed * 3.0)
      portalLight.intensity = 6 + pulse * 4
      if (grabbed) {
        raycaster.setFromCamera(pointerNDC, camera)
        if (raycaster.ray.intersectPlane(dragPlane, dragPoint)) {
          const pos = grabbed.body.translation()
          const gain = 12
          grabbed.body.setLinvel({
            x: (dragPoint.x - pos.x) * gain,
            y: (dragPoint.y - pos.y) * gain,
            z: (dragPoint.z - pos.z) * gain,
          }, true)
          spinX = spinX * 0.82 + dy * 0.045
          spinY = spinY * 0.82 + dx * 0.045
          grabbed.body.setAngvel({ x: spinX, y: spinY, z: spinX * 0.25 }, true)
          dx = 0
          dy = 0
        }
      }
      for (const totem of totems) {
        const t = totem.body.translation()
        const x = t.x
        const y = t.y
        const z = t.z
        const r = totem.body.rotation()
        totem.mesh.position.set(x, y, z)
        totem.mesh.quaternion.set(r.x, r.y, r.z, r.w)
        const curr = { x, y, z }
        const dist = Math.hypot(x - PORTAL.x, y - PORTAL.y, z - PORTAL.z)
        const hitting = dist < PORTAL_RADIUS || segmentDistance(totem.prev, curr) < PORTAL_RADIUS
        if (hitting && !totem.wasHitting && totem.wasGrabbed && grabbed !== totem) {
          navigateToPageCallback(totem.pageIndex)
        }
        totem.wasHitting = hitting
        totem.prev = curr
        if (y < -6) {
          totem.body.setTranslation({ x: totem.spawn[0], y: 1.4, z: totem.spawn[2] }, true)
          totem.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
          totem.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
          totem.wasGrabbed = false
        }
      }
    },
    onPointerMove(event) {
      dx += event.movementX || 0
      dy += event.movementY || 0
      if (grabbed) {
        tooltip.hidden = true
        ctx.setCursor('grabbing')
        return
      }
      const totem = pick()
      if (!totem) {
        tooltip.hidden = true
        ctx.setCursor('')
        return
      }
      tooltip.hidden = false
      tooltip.textContent = totem.name
      tooltip.style.left = `${event.clientX}px`
      tooltip.style.top = `${event.clientY}px`
      ctx.setCursor('grab')
    },
    onPointerDown(event) {
      if (event.button !== 0) return false
      const totem = pick()
      if (!totem) return false
      grabbed = totem
      totem.wasGrabbed = true
      totem.body.wakeUp()
      dx = 0
      dy = 0
      spinX = 0
      spinY = 0
      tooltip.hidden = true
      ctx.setCursor('grabbing')
      return true
    },
    onPointerUp() {
      if (!grabbed) return
      const v = grabbed.body.linvel()
      grabbed.body.setLinvel({ x: v.x * 1.12, y: v.y * 1.12, z: v.z * 1.12 }, true)
      grabbed = null
      ctx.setCursor('')
    },
    onDoubleClick() {
      const totem = pick()
      if (totem) navigateToPageCallback(totem.pageIndex)
    },
    onKeyDown() {},
    onResize() {},
  }
}

function makeRecord(name, pageIndex, mesh, body, spawn) {
  return {
    name,
    pageIndex,
    mesh,
    body,
    spawn,
    prev: { x: spawn[0], y: spawn[1], z: spawn[2] },
    wasGrabbed: false,
    wasHitting: false,
  }
}
