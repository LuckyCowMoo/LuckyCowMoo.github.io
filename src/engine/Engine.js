import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import * as RAPIER from '@dimforge/rapier3d-compat'
import { TransitionComposer, bandActive, bandCoverage } from './transition.js'

const PAGE_SCROLL = 3

export class Engine {
  constructor(root) {
    this.root = root
    this.canvas = root.querySelector('#webgl')
    this.uiOverlay = root.querySelector('#ui-overlay')
    this.pointerNDC = new THREE.Vector2()
    this.scroll = 0
    this.jump = null
    this.navLocked = false
    this.captured = null
    this.touch = null
    this.shown = null
    this.elapsed = 0
    this.reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    this.pages = []
  }

  async start(modules) {
    await RAPIER.init()
    this.RAPIER = RAPIER
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.08, 80)
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()
    this.composer = new TransitionComposer()
    this.composer.setSize(window.innerWidth, window.innerHeight)

    const ordered = [...modules].sort((a, b) => a.pageIndex - b.pageIndex)
    for (const mod of ordered) {
      const scene = new THREE.Scene()
      scene.environment = this.environment
      const world = mod.usesPhysics ? new RAPIER.World({ x: 0, y: -9.81, z: 0 }) : null
      if (world?.integrationParameters) world.integrationParameters.numSolverIterations = 8
      const page = await mod.createPage(this.makeContext(scene, world))
      page.index = mod.pageIndex
      page.scene = scene
      page.world = world
      page.usesPhysics = !!mod.usesPhysics
      page._acc = 0
      this.pages[mod.pageIndex] = page
    }

    this.bindInput()
    window.addEventListener('resize', () => this.resize())
    this.resize()
    this.clock = new THREE.Clock()
    this.renderer.setAnimationLoop(() => this.frame())
  }

  makeContext(scene, world) {
    return {
      THREE,
      RAPIER: this.RAPIER,
      renderer: this.renderer,
      camera: this.camera,
      canvas: this.canvas,
      scene,
      world,
      environment: this.environment,
      pointerNDC: this.pointerNDC,
      uiOverlay: this.uiOverlay,
      navigateToPageCallback: (index) => this.navigate(index),
      getElapsedTime: () => this.elapsed,
      lockNavigation: (locked) => {
        this.navLocked = locked
      },
      setCursor: (cursor) => {
        this.canvas.style.cursor = cursor || ''
      },
    }
  }

  span() {
    return window.innerHeight * PAGE_SCROLL
  }

  scrollState() {
    const span = this.span()
    const count = this.pages.length
    const cycle = span * count
    let s = this.scroll % cycle
    if (s < 0) s += cycle
    const f = s / span
    const i = Math.floor(f) % count
    const t = f - Math.floor(f)
    return { i, j: (i + 1) % count, t }
  }

  frameState() {
    if (this.jump) {
      const t = Math.min(1, this.jump.u)
      return {
        from: this.jump.from,
        to: this.jump.to,
        t,
        show: t >= 0.5 ? this.jump.to : this.jump.from,
        moving: true,
      }
    }
    const s = this.scrollState()
    return {
      from: s.i,
      to: s.j,
      t: s.t,
      show: s.t >= 0.5 ? s.j : s.i,
      moving: bandActive(s.t),
    }
  }

  navigate(index) {
    if (this.navLocked || this.jump) return
    if (index < 0 || index >= this.pages.length) return
    const { show } = this.frameState()
    if (index === show) return
    this.jump = {
      from: show,
      to: index,
      u: 0,
      duration: this.reduce ? 0.35 : 2.05,
    }
  }

  applyCamera(page) {
    const pose = page.cameraPose
    const aspect = window.innerWidth / Math.max(1, window.innerHeight)
    this.camera.position.copy(pose.position)
    this.camera.up.set(0, 1, 0)
    this.camera.lookAt(pose.target)
    this.camera.fov = aspect < 0.85 ? pose.fov + 12 : pose.fov
    this.camera.aspect = aspect
    this.camera.updateProjectionMatrix()
    this.camera.updateMatrixWorld()
  }

  stepPhysics(page, dt) {
    if (!page?.world) return
    page._acc += dt
    const step = 1 / 60
    let guard = 0
    while (page._acc >= step && guard < 5) {
      page.world.step()
      page._acc -= step
      guard += 1
    }
  }

  frame() {
    try {
    const dt = Math.min(0.05, this.clock.getDelta())
    this.elapsed += dt
    if (this.jump) {
      this.jump.u += dt / this.jump.duration
      if (this.jump.u >= 1) {
        this.scroll = this.jump.to * this.span()
        this.jump = null
      }
    }
    const state = this.frameState()
    const from = this.pages[state.from]
    const to = this.pages[state.to]
    const show = this.pages[state.show]
    if (state.moving) {
      this.stepPhysics(from, dt)
      if (to !== from) this.stepPhysics(to, dt)
      this.applyCamera(from)
      from.update?.(dt, this.elapsed)
      if (to !== from) {
        this.applyCamera(to)
        to.update?.(dt, this.elapsed)
      }
    } else {
      this.stepPhysics(show, dt)
      this.applyCamera(show)
      show.update?.(dt, this.elapsed)
    }

    if (!state.moving || this.reduce && !this.jump) {
      this.applyCamera(show)
      this.renderer.setRenderTarget(null)
      this.renderer.clear(true, true, true)
      this.renderer.render(show.scene, this.camera)
    } else if (this.reduce) {
      this.applyCamera(state.t < 0.5 ? from : to)
      this.renderer.setRenderTarget(null)
      this.renderer.clear(true, true, true)
      this.renderer.render((state.t < 0.5 ? from : to).scene, this.camera)
    } else {
      this.applyCamera(from)
      this.composer.renderScene(this.renderer, from.scene, this.camera, this.composer.rtA)
      this.applyCamera(to)
      this.composer.renderScene(this.renderer, to.scene, this.camera, this.composer.rtB)
      this.composer.present(this.renderer, state.t, this.elapsed, false)
    }

    const cover = state.moving ? bandCoverage(state.t, 0.5) : 0
    this.uiOverlay.style.opacity = String(1 - Math.min(1, cover))
    if (this.shown !== state.show) {
      this.pages[this.shown]?.deactivate?.()
      this.shown = state.show
      this.uiOverlay.replaceChildren(show.dom)
      show.activate?.()
    }
    } catch (error) {
      console.error(error)
    }
  }

  resize() {
    const w = window.innerWidth
    const h = window.innerHeight
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    this.renderer.setSize(w, h)
    this.composer.setSize(w, h)
    this.pages.forEach((page) => page.onResize?.())
  }

  currentPage() {
    return this.pages[this.frameState().show]
  }

  bindInput() {
    window.addEventListener('pointermove', (event) => {
      this.pointerNDC.x = (event.clientX / window.innerWidth) * 2 - 1
      this.pointerNDC.y = -(event.clientY / window.innerHeight) * 2 + 1
      if (this.touch && this.touch.id === event.pointerId) {
        this.scroll += (this.touch.y - event.clientY) * 1.7
        this.touch.y = event.clientY
      }
      this.currentPage()?.onPointerMove?.(event)
    })
    this.canvas.addEventListener('pointerdown', (event) => {
      const page = this.currentPage()
      const captured = page?.onPointerDown?.(event) === true
      if (captured) this.captured = page
      else if (event.pointerType === 'touch') this.touch = { id: event.pointerId, y: event.clientY }
    })
    window.addEventListener('pointerup', (event) => {
      this.captured?.onPointerUp?.(event)
      this.currentPage()?.onPointerUp?.(event)
      this.captured = null
      if (this.touch?.id === event.pointerId) this.touch = null
    })
    this.canvas.addEventListener('dblclick', (event) => {
      if (event.target.closest?.('a, button')) return
      this.currentPage()?.onDoubleClick?.(event)
    })
    window.addEventListener('keydown', (event) => {
      const tag = event.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || event.target?.isContentEditable) return
      this.currentPage()?.onKeyDown?.(event)
    })
    window.addEventListener('wheel', (event) => {
      if (this.navLocked || this.jump || event.target.closest?.('.lightbox')) return
      event.preventDefault()
      let dy = event.deltaY
      if (event.deltaMode === 1) dy *= 16
      if (event.deltaMode === 2) dy *= window.innerHeight
      this.scroll += dy
    }, { passive: false })
  }
}
