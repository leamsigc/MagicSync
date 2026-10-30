/**
 * Collection view contracts shared by the UI components.
 *
 * These live in a plain TS module (not an SFC `<script setup>`) so pages can
 * import the types with `import type { ... } from '#layers/BaseUI/app/utils/collection'`.
 */

export type CollectionViewMode = string

export interface CollectionViewOption {
  value: CollectionViewMode
  label: string
  icon: string
}

export interface CollectionFilterOption {
  label: string
  value: string
}

export interface CollectionFilter {
  key: string
  label?: string
  value: string
  options: CollectionFilterOption[]
  width?: string
}

export interface CollectionSort {
  value: string
  options: CollectionFilterOption[]
}

export interface CollectionTableColumn {
  key: string
  label: string
  align?: 'left' | 'center' | 'right'
  width?: string
  /** Hide the column below this breakpoint. */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  sortable?: boolean
}
