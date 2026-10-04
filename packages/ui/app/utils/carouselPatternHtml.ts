import { patternStyle } from './patterns'

/**
 * The pattern layer the deck renderer expects, built the way
 * `useCarouselDeck` builds it.
 *
 * `renderSlideHtml` takes the pattern as ready-made HTML. Passing an empty
 * string left the layer blank, which showed as a white band across the slide
 * wherever the pattern was meant to sit — most visible in the large
 * all-pages view. Building it here keeps the chat preview byte-identical to the
 * carousel tool's own stage.
 */
export function buildPatternHtml(pattern: string, color: string, opacity: number): string {
  const declarations = Object.entries(patternStyle(pattern, color, opacity))
    .map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}:${value}`)
    .join(';')
  return `<div style="position:absolute;inset:0;${declarations}"></div>`
}