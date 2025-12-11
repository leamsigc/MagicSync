/**
 * Composable for removing silence from videos
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

type Video = {
  id: string
  url: string
  duration: number
  hasSilenceRemoved?: boolean
  timestamp?: number
  format?: string
}

type ProcessedVideo = Video & {
  url: string
  timestamp: number
  hasSilenceRemoved: boolean
  format: string
  duration: number
}

const getBlobDuration = (blob: Blob): Promise<number> => {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.src = URL.createObjectURL(blob)
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src)
      resolve(video.duration)
    }
    video.onerror = () => {
      resolve(0)
    }
  })
}

export const useRemoveSilence = () => {
  const processingId = ref<string | null>(null)

  const setProcessingId = (id: string | null) => {
    processingId.value = id
  }

  const removeSilence = async (
    video: Video,
    onUpdate: (updatedVideo: ProcessedVideo) => void,
    onProgress?: (progress: number) => void,
    silenceThresh: number = 15,
    bufferFrames: number = 15
  ) => {
    if (processingId.value || video.hasSilenceRemoved) return

    setProcessingId(video.id)

    let audioCtx: AudioContext | null = null
    let videoEl: HTMLVideoElement | null = null
    let stream: MediaStream | null = null

    try {
      // 1. Setup hidden video element for processing
      videoEl = document.createElement('video')
      videoEl.playsInline = true
      videoEl.muted = false // Must be false to capture audio via createMediaElementSource
      videoEl.preload = 'auto'
      // IMPORTANT: Append to DOM (hidden) before setting src so captureStream works reliably
      videoEl.style.position = 'fixed'
      videoEl.style.top = '0'
      videoEl.style.left = '0'
      videoEl.style.width = '1px'
      videoEl.style.height = '1px'
      videoEl.style.opacity = '0'
      videoEl.style.pointerEvents = 'none'
      document.body.appendChild(videoEl)

      // Wait for metadata to load so we know duration/dimensions
      await new Promise<void>((resolve, reject) => {
        if (!videoEl) return reject(new Error('Video element creation failed'))
        videoEl.onloadedmetadata = () => resolve()
        videoEl.onerror = () => {
          const errCode = videoEl?.error?.code
          const errMsg = videoEl?.error?.message
          let friendlyMsg = 'Unknown error'
          if (errCode === 4) friendlyMsg = 'Source not supported or format invalid'
          reject(new Error(`Video load error: ${friendlyMsg} (Code ${errCode}) - ${errMsg}`))
        }
        // Set src AFTER attaching listeners and appending to DOM
        videoEl.src = video.url
      })

      // 2. Setup Audio Analysis
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      audioCtx = new AudioContextClass()
      // Ensure context is active
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume()
      }

      // Create Source
      const source = audioCtx.createMediaElementSource(videoEl)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      const dest = audioCtx.createMediaStreamDestination()
      // Connect Graph: Source -> Analyser -> Destination (Stream)
      source.connect(analyser)
      analyser.connect(dest)

      // 3. Capture Video Stream
      // @ts-ignore
      const streamFn = videoEl.captureStream || videoEl.mozCaptureStream
      if (!streamFn) throw new Error('Browser does not support video capture for processing.')
      const videoStream = streamFn.call(videoEl)
      stream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...dest.stream.getAudioTracks()
      ])

      // 4. Setup Recorder
      // Prioritize MP4/H.264 if available, fall back to WebM/VP9, then default
      let mimeType = 'video/webm'
      if (MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4'
      } else if (MediaRecorder.isTypeSupported('video/mp4; codecs="avc1.424028, mp4a.40.2"')) {
        mimeType = 'video/mp4; codecs="avc1.424028, mp4a.40.2"'
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
        mimeType = 'video/webm;codecs=vp9'
      }

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 2500000 // 2.5 Mbps
      })

      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }

      recorder.onstop = async () => {
        const newBlob = new Blob(chunks, { type: mimeType })
        // Calculate new duration accurately
        const newDuration = await getBlobDuration(newBlob)
        const newUrl = URL.createObjectURL(newBlob)
        const processedVideo: ProcessedVideo = {
          ...video,
          url: newUrl,
          timestamp: Date.now(),
          hasSilenceRemoved: true,
          format: mimeType.includes('mp4') ? 'mp4' : 'webm',
          duration: newDuration || video.duration
        }
        onUpdate(processedVideo)
        setProcessingId(null)
        // Cleanup in onstop
        if (audioCtx && audioCtx.state !== 'closed') audioCtx.close()
        if (videoEl && videoEl.parentNode) document.body.removeChild(videoEl)
      }

      // Stop recorder explicitly when video ends
      videoEl.onended = () => {
        if (recorder.state !== 'inactive') {
          recorder.stop()
        }
      }

      // 5. Start Process
      recorder.start()

      // Attempt to play
      try {
        await videoEl.play()
      } catch (playErr: any) {
        recorder.stop()
        throw new Error(`Failed to start video playback: ${playErr?.message || String(playErr)}`)
      }

      let silenceCounter = 0

      const checkAudio = () => {
        if (!videoEl || !analyser || !recorder || recorder.state === 'inactive') return

        // Safety check if video ended but event didn't fire yet
        if (videoEl.ended) {
          recorder.stop()
          return
        }

        const data = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(data)
        const volume = data.reduce((a, b) => a + b) / data.length

        if (volume < silenceThresh) {
          silenceCounter++
          // Only cut if we've been silent for a buffer period
          if (silenceCounter > bufferFrames) {
            if (recorder.state === 'recording') {
              recorder.pause()
            }
            // Speed up playback to skip silence
            videoEl.playbackRate = 4.0
          }
        } else {
          // Audio detected
          silenceCounter = 0
          if (recorder.state === 'paused') {
            recorder.resume()
          }
          videoEl.playbackRate = 1.0
        }

        // Calculate progress based on current time vs duration
        const progress = videoEl.currentTime / videoEl.duration * 100
        onProgress?.(Math.min(progress, 100))

        requestAnimationFrame(checkAudio)
      }

      checkAudio()
    } catch (err) {
      console.error('Failed to remove silence:', err)
      setProcessingId(null)
      const errorMessage = err instanceof Error ? err.message : String(err)
      // Cleanup on error
      if (audioCtx && audioCtx.state !== 'closed') {
        audioCtx.close()
      }
      if (videoEl && videoEl.parentNode) {
        document.body.removeChild(videoEl)
      }
      throw new Error(`Could not process video. ${errorMessage}`)
    }
  }

  return {
    processingId: readonly(processingId),
    removeSilence
  }
}
