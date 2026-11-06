/**
 * Shape pack for the design editor — plain SVG path data that fabric renders
 * as objects; the same file feeds the panel, stock previews and the server
 * renderer without fetches.
 */

export interface ShapeEntry {
  id: string
  name: string
  category: 'basic' | 'arrows' | 'lines' | 'frames' | 'badges'
  /** Rendered as object type 'path' with `path` = svg d (or empty uses rect/circle). */
  kind: 'path' | 'rect' | 'circle' | 'triangle'
  /** Path data (kind=path), or null. */
  path?: string
  /** Default fill when inserted. */
  fill: string
}

export const SHAPE_CATALOG: ShapeEntry[] = [
  { id: 'rect', name: 'Shape.basic.rect', category: 'basic', kind: 'rect', fill: '#0f172a' },
  { id: 'circle', name: 'Shape.basic.circle', category: 'basic', kind: 'circle', fill: '#0f172a' },
  { id: 'triangle', name: 'Shape.basic.triangle', category: 'basic', kind: 'triangle', fill: '#0f172a' },
  { id: 'quarter-circle', name: 'Shape.basic.quarter', category: 'basic', kind: 'path', path: 'M0 100 A100 100 0 0 1 100 0 L100 100 Z', fill: '#0f172a' },
  { id: 'arch', name: 'Shape.basic.arch', category: 'basic', kind: 'path', path: 'M0 100 L0 40 A50 50 0 0 1 100 40 L100 100 Z', fill: '#0f172a' },
  { id: 'blob', name: 'Shape.basic.blob', category: 'basic', kind: 'path', path: 'M25 5 C45 0 95 10 95 40 C120 60 80 100 50 95 C15 95 -5 70 5 45 C8 25 12 8 25 5 Z', fill: '#0f172a' },
  { id: 'star5', name: 'Shape.badge.star5', category: 'badges', kind: 'path', path: 'M50 5 L61 38 L95 38 L67 58 L78 91 L50 71 L22 91 L33 58 L5 38 L39 38 Z', fill: '#f59e0b' },
  { id: 'heart', name: 'Shape.badge.heart', category: 'badges', kind: 'path', path: 'M50 90 C20 65 5 45 15 28 C25 12 45 15 50 30 C55 15 75 12 85 28 C95 45 80 65 50 90 Z', fill: '#ef4444' },
  { id: 'badge-tag', name: 'Shape.badge.tag', category: 'badges', kind: 'path', path: 'M10 10 H60 L90 50 L60 90 H10 Z', fill: '#10b981' },
  { id: 'burst', name: 'Shape.badge.burst', category: 'badges', kind: 'path', path: 'M50 0 L58 18 L78 8 L74 30 L95 30 L80 45 L100 55 L78 60 L88 80 L68 72 L65 95 L50 78 L35 95 L32 72 L12 80 L22 60 L0 55 L20 45 L5 30 L26 30 L22 8 L42 18 Z', fill: '#facc15' },
  { id: 'arrow-right', name: 'Shape.arrows.right', category: 'arrows', kind: 'path', path: 'M0 40 H60 L60 15 L100 50 L60 85 L60 60 L0 60 Z', fill: '#0ea5e9' },
  { id: 'arrow-left', name: 'Shape.arrows.left', category: 'arrows', kind: 'path', path: 'M100 40 H40 L40 15 L0 50 L40 85 L40 60 L100 60 Z', fill: '#0ea5e9' },
  { id: 'arrow-up', name: 'Shape.arrows.up', category: 'arrows', kind: 'path', path: 'M40 100 V40 L15 40 L50 0 L85 40 L60 40 V100 Z', fill: '#0ea5e9' },
  { id: 'arrow-down', name: 'Shape.arrows.down', category: 'arrows', kind: 'path', path: 'M40 0 V60 L15 60 L50 100 L85 60 L60 60 V0 Z', fill: '#0ea5e9' },
  { id: 'arrow-curve', name: 'Shape.arrows.curve', category: 'arrows', kind: 'path', path: 'M5 80 C25 20 65 20 80 45 L70 50 L95 70 L98 42 L88 47 C70 10 18 15 5 80 Z', fill: '#8b5cf6' },
  { id: 'line-straight', name: 'Shape.lines.straight', category: 'lines', kind: 'path', path: 'M0 5 H100', fill: '#334155' },
  { id: 'line-dashed', name: 'Shape.lines.dashed', category: 'lines', kind: 'path', path: 'M0 5 H30 M35 5 H65 M70 5 H100', fill: '#334155' },
  { id: 'line-squiggle', name: 'Shape.lines.squiggle', category: 'lines', kind: 'path', path: 'M0 10 C10 0 20 20 30 10 C40 0 50 20 60 10 C70 0 80 20 90 10 C95 5 98 7 100 10', fill: '#334155' },
  { id: 'line-zigzag', name: 'Shape.lines.zigzag', category: 'lines', kind: 'path', path: 'M0 10 L10 0 L20 10 L30 0 L40 10 L50 0 L60 10 L70 0 L80 10 L90 0 L100 10', fill: '#334155' },
  { id: 'frame-rect', name: 'Shape.frames.rect', category: 'frames', kind: 'path', path: 'M0 0 H100 V100 H0 Z M8 8 V92 H92 V8 Z', fill: '#0f172a' },
  { id: 'frame-corners', name: 'Shape.frames.corners', category: 'frames', kind: 'path', path: 'M0 0 H30 V8 H8 V30 H0 Z M100 0 H70 V8 H92 V30 H100 Z M0 100 H30 V92 H8 V70 H0 Z M100 100 H70 V92 H92 V70 H100 Z', fill: '#0f172a' },
  { id: 'frame-scrap', name: 'Shape.frames.scrap', category: 'frames', kind: 'path', path: 'M0 0 H100 V100 H0 Z M4 4 L96 4 L96 96 L4 96 Z', fill: '#e2e8f0' },
  { id: 'frame-film', name: 'Shape.frames.film', category: 'frames', kind: 'path', path: 'M0 0 H100 V100 H0 Z M10 10 H90 V90 H10 Z M18 18 H82 V82 H18 Z', fill: '#0f172a' },
  { id: 'wave', name: 'Shape.basic.wave', category: 'basic', kind: 'path', path: 'M0 20 C25 -5 45 45 70 20 C82 8 92 8 100 20 V40 H0 Z', fill: '#38bdf8' },
  { id: 'wave-double', name: 'Shape.basic.waveDouble', category: 'basic', kind: 'path', path: 'M0 15 L15 5 L30 15 L45 5 L60 15 L75 5 L90 15 L100 8 V25 H0 Z', fill: '#38bdf8' },
  { id: 'scroll', name: 'Shape.badge.scroll', category: 'badges', kind: 'path', path: 'M15 10 C5 10 5 25 15 25 V75 C5 75 5 90 15 90 H85 C95 90 95 75 85 75 V25 C95 25 95 10 85 10 Z', fill: '#a16207' },
  { id: 'lightning', name: 'Shape.basic.lightning', category: 'basic', kind: 'path', path: 'M55 0 L20 55 H45 L38 100 L80 40 H52 L62 0 Z', fill: '#fbbf24' },
  { id: 'plus', name: 'Shape.basic.plus', category: 'basic', kind: 'path', path: 'M40 0 H60 V40 H100 V60 H60 V100 H40 V60 H0 V40 H40 Z', fill: '#0f172a' },
  { id: 'speech-bubble', name: 'Shape.badge.speech', category: 'badges', kind: 'path', path: 'M10 10 H90 V65 H55 L40 88 L40 65 H10 Z', fill: '#22c55e' },
]

export const SHAPE_CATEGORIES = ['basic', 'arrows', 'lines', 'frames', 'badges'] as const
