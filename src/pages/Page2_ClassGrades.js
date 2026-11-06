import { createTextPage } from './createTextPage.js'

export const pageIndex = 2
export const pageId = 'class-grades'
export const usesPhysics = false

const build = createTextPage({
  title: 'Class Grades Analyser',
  eyebrow: 'Teacher resource',
  background: 0x14110e,
  accent: 0x88ccff,
  html: `Class Grades Analyser is a teacher resource. It takes standard pupil progress reports as input and uses them to safely generate intelligent AI insight about individuals within your classes and the class as a whole, without ever exposing any identifiable information to an AI company, or anyone else. Read more about why this is safe on the <a href="https://luckycowmoo.github.io/class-grades-analyser/" target="_blank" rel="noopener noreferrer">website</a>.`,
  links: [
    { label: 'Open the tool', href: 'https://luckycowmoo.github.io/class-grades-analyser/', primary: true },
    { label: 'Source', href: 'https://github.com/LuckyCowMoo/class-grades-analyser' },
  ],
})

export function createPage(ctx) {
  return build(ctx)
}
