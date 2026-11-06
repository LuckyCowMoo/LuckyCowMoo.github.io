import * as THREE from 'three'

export function makeCanvasTexture(width, height, draw, renderer) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  draw(ctx, canvas)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = renderer ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 8
  texture.needsUpdate = true
  return {
    canvas,
    ctx,
    texture,
    redraw() {
      draw(ctx, canvas)
      texture.needsUpdate = true
    },
  }
}
