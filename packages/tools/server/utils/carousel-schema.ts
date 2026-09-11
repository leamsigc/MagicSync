import { z } from 'zod'

/**
 * Carousel persist schemas (Task 1.4) — shared by POST + PUT so both accept
 * the same shape. `layers` (object-layer slides) and `scene` (fabric scene
 * snapshots) are opaque JSON: validated for shape/size, never interpreted.
 */
export const carouselSlideSchema = z.object({
  id: z.string(),
  templateKey: z.string(),
  data: z.object({
    kicker: z.string().optional(),
    headline: z.string(),
    body: z.string().optional(),
    items: z.array(z.string()).optional(),
    quote: z.string().optional(),
    author: z.string().optional(),
    stat: z.string().optional(),
    statLabel: z.string().optional(),
    cta: z.string().optional(),
    footer: z.string().optional(),
    images: z.array(z.string()).optional(),
    borderRadius: z.number().optional(),
  }),
  pattern: z.string(),
  patternColor: z.string(),
  patternOpacity: z.number(),
  bgImage: z.object({
    url: z.string(),
    dim: z.number(),
    shadow: z.object({ x: z.number(), y: z.number(), blur: z.number(), opacity: z.number() }),
    transform: z.object({ x: z.number(), y: z.number(), scale: z.number() }).optional(),
  }).nullable(),
  customHtml: z.string(),
  layers: z.array(z.record(z.string(), z.unknown())).max(60).optional(),
})

export const sceneSnapshotSchema = z.object({
  slideId: z.string(),
  scene: z.record(z.string(), z.unknown()),
})

const paletteSchema = z.object({
  bg: z.string(),
  text: z.string(),
  accent: z.string(),
  font: z.string().optional(),
})

export const createCarouselSchema = z.object({
  id: z.string().max(120),
  name: z.string().max(120).default('Untitled Carousel'),
  slides: z.array(carouselSlideSchema).min(1).max(15),
  palette: paletteSchema,
  pattern: z.string().optional(),
  handle: z.string().max(120).optional(),
  scene: z.array(sceneSnapshotSchema).max(15).optional(),
})

export const updateCarouselSchema = z.object({
  name: z.string().max(120).optional(),
  slides: z.array(carouselSlideSchema).min(1).max(15).optional(),
  palette: paletteSchema.optional(),
  pattern: z.string().optional(),
  handle: z.string().max(120).optional(),
  scene: z.array(sceneSnapshotSchema).max(15).optional(),
})
