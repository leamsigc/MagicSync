const DOWNLOAD_ENDPOINT = '/api/v1/media/video-download'

function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim())
}

function fileNameFromResponse(res: Response): string {
  const name = res.headers.get('x-video-id')?.trim()
  return name || 'video.mp4'
}

/** Pull the machine-readable code the route sets, so the UI can translate it. */
async function readErrorCode(res: Response): Promise<string> {
  const body = await res.json().catch(() => null)
  const code = body?.data?.code
  return typeof code === 'string' ? code : 'DOWNLOAD_FAILED'
}

/**
 * Turn a public video page URL (YouTube, Vimeo, …) into an in-memory File via
 * the server's yt-dlp pipeline. The server streams the bytes and deletes its
 * temp copy, so the returned File is the only durable copy of the video and the
 * cropper treats it exactly like a locally uploaded one — which also keeps
 * `runExport` off its `fetch(videoMetadata.url)` re-download branch.
 */
export function useRemoteVideoDownload() {
  const isDownloading = ref(false)

  async function downloadToFile(url: string): Promise<File> {
    isDownloading.value = true
    try {
      const res = await fetch(`${DOWNLOAD_ENDPOINT}?url=${encodeURIComponent(url.trim())}`)
      if (!res.ok) throw new Error(await readErrorCode(res))
      const blob = await res.blob()
      return new File([blob], fileNameFromResponse(res), { type: blob.type || 'video/mp4' })
    }
    finally {
      isDownloading.value = false
    }
  }

  return { isDownloading, downloadToFile, isHttpUrl }
}
