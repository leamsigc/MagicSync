/**
 * Carousel scene constants — isomorphic (app + server, no DOM, no fabric dep).
 *
 * Single source of truth for the design space both the fabric stage editor
 * and the Node renderer use. Coordinates are top-left origin, pixels.
 */
export const SCENE_W = 1080
export const SCENE_H_PORTRAIT = 1350
export const SCENE_H_SQUARE = 1080

export const MIN_SLIDES = 1
export const MAX_SLIDES = 15

/** Instagram carousel bounds, enforced at export/post time (not at deck save). */
export const IG_CAROUSEL_MIN_IMAGES = 2
export const IG_CAROUSEL_MAX_IMAGES = 10

export const SCENE_VERSION = 'fabric-scene/1'

export type SceneAspect = 'portrait' | 'square'

const HEIGHTS: Record<SceneAspect, number> = {
  portrait: SCENE_H_PORTRAIT,
  square: SCENE_H_SQUARE,
}

export function sceneHeight(aspect: SceneAspect): number {
  return HEIGHTS[aspect] ?? SCENE_H_PORTRAIT
}
