/**
 *
 * useMenuBoardExport — client-side PDF export for menu board pages.
 *
 * Renders each selected page into an offscreen 16:9 stage, captures it
 * with modern-screenshot and assembles a landscape PDF via jsPDF.
 *
 */
import { domToPng } from 'modern-screenshot'
import type { MenuPage } from '../../../utils/tools/menu-board/types'

export type PdfResolution = '1080p' | '4k'

const BASE_WIDTH = 1920
const BASE_HEIGHT = 1080

/** Convert viewport units to absolute pixels so offscreen rendering is exact. */
function toAbsolutePixels(html: string): string {
  return html
    .replace(/(\d+(?:\.\d+)?)vw/gi, (_, n: string) => `${(Number.parseFloat(n) / 100) * BASE_WIDTH}px`)
    .replace(/(\d+(?:\.\d+)?)vh/gi, (_, n: string) => `${(Number.parseFloat(n) / 100) * BASE_HEIGHT}px`)
}

async function capturePage(page: MenuPage, scale: number): Promise<string | null> {
  if (typeof document === 'undefined') return null

  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:-99999px;top:0;width:${BASE_WIDTH}px;height:${BASE_HEIGHT}px;`
  const stage = document.createElement('div')
  stage.style.cssText = `width:${BASE_WIDTH}px;height:${BASE_HEIGHT}px;overflow:hidden;background:#000;margin:0;padding:0;box-sizing:border-box;`

  if (page.type === 'html') {
     
    stage.innerHTML = toAbsolutePixels(page.content)
  } else {
    stage.innerHTML = `<img src="${page.content}" crossorigin="anonymous" style="width:100%;height:100%;object-fit:contain;" />`
  }

  host.appendChild(stage)
  document.body.appendChild(host)

  try {
    await new Promise(resolve => setTimeout(resolve, 400))
    return await domToPng(stage, {
      width: BASE_WIDTH,
      height: BASE_HEIGHT,
      scale,
      backgroundColor: '#000000',
    })
  } catch (error) {
    log.error({ message: 'Failed to capture menu page', error: String(error) })
    return null
  } finally {
    host.remove()
  }
}

export async function exportPagesToPdf(pages: MenuPage[], resolution: PdfResolution): Promise<boolean> {
  if (pages.length === 0) return false
  try {
    const { jsPDF } = await import('jspdf')
    const width = resolution === '4k' ? 3840 : 1920
    const height = resolution === '4k' ? 2160 : 1080
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [width, height] })

    let added = 0
    for (const page of pages) {
      const dataUrl = await capturePage(page, resolution === '4k' ? 2 : 1)
      if (!dataUrl) continue
      if (added > 0) pdf.addPage([width, height], 'landscape')
      pdf.addImage(dataUrl, 'PNG', 0, 0, width, height)
      added += 1
    }

    if (added === 0) return false
    pdf.save(`menu-export-${resolution}.pdf`)
    return true
  } catch (error) {
    log.error({ message: 'PDF export failed', error: String(error) })
    return false
  }
}
