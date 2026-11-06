import './style.css'
import { Engine } from './engine/Engine.js'
import { pageModules } from './pages/registry.js'

const boot = document.querySelector('#boot')
const engine = new Engine(document.querySelector('#app'))

engine.start(pageModules).then(() => {
  boot.remove()
}).catch((error) => {
  console.error(error)
  boot.textContent = error?.stack || String(error)
})
