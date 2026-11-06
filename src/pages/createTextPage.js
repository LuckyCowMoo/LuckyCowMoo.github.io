export function createTextPage({
  title,
  eyebrow,
  html,
  links,
  background,
  accent,
}) {
  return function createPage(ctx) {
    const { THREE, scene } = ctx
    scene.background = new THREE.Color(background)
    scene.fog = new THREE.Fog(background, 8, 22)
    scene.add(new THREE.HemisphereLight(0xdfe7ef, 0x090a0d, 0.7))
    const key = new THREE.DirectionalLight(0xfff1dd, 2.2)
    key.position.set(4, 6, 5)
    scene.add(key)
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.85, 0),
      new THREE.MeshStandardMaterial({
        color: accent,
        emissive: accent,
        emissiveIntensity: 0.35,
        roughness: 0.28,
        metalness: 0.45,
      }),
    )
    mesh.position.set(1.6, 0.1, 0)
    scene.add(mesh)
    const root = document.createElement('div')
    root.className = 'page-root'
    const linkHtml = links.map((link) => (
      `<a class="${link.primary ? 'btn' : 'text-link'}" href="${link.href}" target="_blank" rel="noopener noreferrer">${link.label}</a>`
    )).join('')
    root.innerHTML = `
      <section class="side-copy">
        <p class="eyebrow">${eyebrow}</p>
        <h1 class="serif">${title}</h1>
        <div class="desc">${html}</div>
        <div class="actions">${linkHtml}</div>
      </section>
    `
    return {
      dom: root,
      cameraPose: {
        position: new THREE.Vector3(0, 0.7, 7.2),
        target: new THREE.Vector3(0.4, 0.05, 0),
        fov: 42,
      },
      activate() {},
      deactivate() {},
      update(dt) {
        mesh.rotation.y += dt * 0.35
        mesh.rotation.x += dt * 0.12
      },
      onPointerDown() { return false },
      onPointerMove() {},
      onPointerUp() {},
      onDoubleClick() {},
      onKeyDown() {},
      onResize() {},
    }
  }
}
