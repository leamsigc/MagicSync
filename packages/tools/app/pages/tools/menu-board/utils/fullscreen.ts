/**
 * Fullscreen helpers with vendor fallbacks (Safari / iPad / smart-TV browsers).
 * Restaurant displays frequently run WebKit-based browsers, so we can't rely
 * on the standard API alone.
 */

interface FullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | void
}

interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void
}

export function isFullscreenActive(): boolean {
  if (typeof document === 'undefined') return false
  const doc = document as FullscreenDocument
  return !!(doc.fullscreenElement || doc.webkitFullscreenElement)
}

export async function requestFullscreen(el: HTMLElement = document.documentElement): Promise<void> {
  const target = el as FullscreenElement
  try {
    if (target.requestFullscreen) {
      await target.requestFullscreen()
    } else if (target.webkitRequestFullscreen) {
      await target.webkitRequestFullscreen()
    }
  } catch {
    // Browsers require a user gesture — callers show a fullscreen button as fallback.
  }
}

export async function exitImmersive(): Promise<void> {
  const doc = document as FullscreenDocument
  try {
    if (doc.exitFullscreen) {
      await doc.exitFullscreen()
    } else if (doc.webkitExitFullscreen) {
      await doc.webkitExitFullscreen()
    }
  } catch {
    // ignore
  }
}

/** Toggle fullscreen; returns the resulting state. */
export async function toggleFullscreen(): Promise<boolean> {
  if (isFullscreenActive()) {
    await exitImmersive()
    return false
  }
  await requestFullscreen()
  return true
}
