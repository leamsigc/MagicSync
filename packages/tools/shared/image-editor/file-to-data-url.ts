/**
 * Read a File/Blob into a data URL.
 *
 * Documents store image `src` values, so uploads and AI results must be
 * embedded (data:) instead of `blob:` — a blob URL dies with the page and
 * breaks saved designs and batch renders.
 */
export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
