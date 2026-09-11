/**
 * Fabric object builders shared by the browser stage and the Node renderer
 * (Task 1.5). DOM-free and fabric-package-agnostic: every builder receives
 * the fabric module (`fabric` in the browser, `fabric/node` on the server),
 * whose Rect/Textbox/Image/Circle/Triangle/Line/Path/Gradient/FabricImage
 * surface is identical for these shapes.
 */
import type { FabricObjectJson } from './scene'

export type FabricModule = typeof import('fabric')
export type BuiltObject = import('fabric').FabricObject | null

export interface PaintedEntry {
  layerIndex: number
  obj: NonNullable<BuiltObject>
}

export function commonProps(obj: FabricObjectJson): Record<string, unknown> {
  return {
    left: Number(obj.left ?? 0),
    top: Number(obj.top ?? 0),
    angle: Number(obj.angle ?? 0),
    opacity: Number(obj.opacity ?? 1),
    originX: 'left',
    originY: 'top',
    selectable: false,
    evented: false,
  }
}

export function toFill(F: FabricModule, fill: unknown): unknown {
  if (fill && typeof fill === 'object' && 'colorStops' in (fill as Record<string, unknown>)) {
    const g = fill as { type: string, coords: unknown, colorStops: unknown }
    return new F.Gradient({ type: g.type === 'radial' ? 'radial' : 'linear', coords: g.coords as never, colorStops: g.colorStops as never })
  }
  return fill
}

export function buildLine(F: FabricModule, obj: FabricObjectJson): BuiltObject {
  const w = Number(obj.width ?? 100)
  return new F.Line([0, 0, w, 0], { ...commonProps(obj), stroke: (obj.fill as string | undefined) ?? '#ffffff', strokeWidth: 4 })
}

export function buildPath(F: FabricModule, obj: FabricObjectJson): BuiltObject {
  return new F.Path(String(obj.path ?? ''), {
    ...commonProps(obj),
    fill: toFill(F, obj.fill),
    scaleX: Number(obj.scaleX ?? 1),
    scaleY: Number(obj.scaleY ?? 1),
  })
}

export function buildRect(F: FabricModule, obj: FabricObjectJson): BuiltObject {
  return new F.Rect({ ...commonProps(obj), width: Number(obj.width ?? 0), height: Number(obj.height ?? 0), fill: toFill(F, obj.fill) as never, rx: Number(obj.rx ?? 0), ry: Number(obj.ry ?? 0), stroke: obj.stroke as never, strokeWidth: Number(obj.strokeWidth ?? 0) || undefined })
}

export function buildTextbox(F: FabricModule, obj: FabricObjectJson): BuiltObject {
  return new F.Textbox(String(obj.text ?? ''), {
    ...commonProps(obj),
    width: Number(obj.width ?? 800),
    fontFamily: String(obj.fontFamily ?? 'Inter'),
    fontSize: Number(obj.fontSize ?? 48),
    fontWeight: Number(obj.fontWeight ?? 700),
    textAlign: (obj.textAlign as 'left' | 'center' | 'right' | undefined) ?? 'center',
    lineHeight: Number(obj.lineHeight ?? 1.2),
    charSpacing: Number(obj.charSpacing ?? 0),
    fill: obj.fill as never,
  })
}

export function buildCircle(F: FabricModule, obj: FabricObjectJson): BuiltObject {
  return new F.Circle({ ...commonProps(obj), radius: Number(obj.width ?? 0) / 2, fill: toFill(F, obj.fill) as never, stroke: obj.stroke as never, strokeWidth: Number(obj.strokeWidth ?? 0) || undefined })
}

export function buildTriangle(F: FabricModule, obj: FabricObjectJson): BuiltObject {
  return new F.Triangle({ ...commonProps(obj), width: Number(obj.width ?? 0), height: Number(obj.height ?? 0), fill: toFill(F, obj.fill) as never })
}

type SyncBuilder = (F: FabricModule, obj: FabricObjectJson) => BuiltObject

const SYNC_BUILDERS: Record<string, SyncBuilder> = {
  Line: buildLine,
  Path: buildPath,
  Rect: buildRect,
  Textbox: buildTextbox,
  Circle: buildCircle,
  Triangle: buildTriangle,
}

export function buildSyncObject(F: FabricModule, obj: FabricObjectJson): BuiltObject {
  const build = SYNC_BUILDERS[obj.type]
  if (!build) return null
  return build(F, obj)
}

export async function buildImageObject(
  F: FabricModule,
  obj: FabricObjectJson,
  fallbackWidth: number,
  loadImage: (src: string) => Promise<BuiltObject | null> = src => F.FabricImage.fromURL(src, { crossOrigin: 'anonymous' }),
): Promise<BuiltObject> {
  try {
    const src = String(obj.src ?? '')
    if (!src) return null
    const img = await loadImage(src)
    if (!img) return null
    img.set({ ...commonProps(obj) })
    img.scaleToWidth(Number(obj.width ?? fallbackWidth))
    const targetH = Number(obj.height ?? 0)
    if (targetH > 0) img.scaleToHeight(targetH)
    return img
  } catch {
    return null
  }
}
