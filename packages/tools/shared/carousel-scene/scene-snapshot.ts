/**
 * Fabric scene snapshots for persistence (Task 1.4).
 *
 * A snapshot freezes the exact scene JSON a render used, so MCP renders stay
 * reproducible even if the auto-layout converter evolves. Snapshots ride
 * alongside slides (service `scene` field, REST payload, IndexedDB) and are
 * opaque to storage — only the tools/site layers build or read them.
 */
import { slideToFabricScene, type FabricSlideScene, type InputLayer } from './scene'
import { convertLegacySlide, type ConverterData } from './html-convert'

export interface SnapshotSlide {
  id: string
  templateKey: string
  data: ConverterData
  layers?: unknown[]
}

export interface SnapshotPalette {
  bg: string
  text: string
  accent: string
  font?: string
}

export interface SlideSceneSnapshot {
  slideId: string
  scene: FabricSlideScene
}

/**
 * Resolve the paintable layers for one slide: native object layers pass
 * through, legacy html-bound (or layer-less) slides convert.
 */
export function resolveSlideLayers(
  slide: SnapshotSlide,
  palette: SnapshotPalette,
  frame: { w: number, h: number },
  index: number,
  total: number,
): InputLayer[] {
  const layers = (slide.layers ?? []) as InputLayer[]
  if (layers.length > 0 && !layers.some(l => l.type === 'html')) return layers
  return convertLegacySlide(slide.templateKey, slide.data, palette, { frameH: frame.h, index, total }) as InputLayer[]
}

export function buildSceneSnapshots(
  slides: SnapshotSlide[],
  palette: SnapshotPalette,
  frame: { w: number, h: number },
): SlideSceneSnapshot[] {
  return slides.map((slide, index) => ({
    slideId: slide.id,
    scene: slideToFabricScene(resolveSlideLayers(slide, palette, frame, index, slides.length), { width: frame.w, height: frame.h, palette }),
  }))
}
