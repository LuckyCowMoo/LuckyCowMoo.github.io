import { createTextPage } from './createTextPage.js'

export const pageIndex = 3
export const pageId = 'circuit-maker'
export const usesPhysics = false

const build = createTextPage({
  title: 'Circuit Maker',
  eyebrow: 'Boolean logic',
  background: 0x0c1612,
  accent: 0x37f0a0,
  html: `Circuit Maker is a Boolean logic simulation tool. Teachers can use this to export resources for lessons and demonstrate how programs, like a full calculator with memory and 7-segment displays, can be built from only simple logic gates. Students can use this tool to experiment with different logic gates and create logic circuits, as well as complete challenges to create a circuit that outputs a specific truth table, and challenge their friends with their own.`,
  links: [
    { label: 'Open Circuit Maker', href: 'https://luckycowmoo.github.io/circuit-maker/', primary: true },
    { label: 'Source', href: 'https://github.com/LuckyCowMoo/circuit-maker' },
  ],
})

export function createPage(ctx) {
  return build(ctx)
}
