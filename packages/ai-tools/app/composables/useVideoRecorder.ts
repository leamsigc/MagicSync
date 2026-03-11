/**
 *
 * Component Description: Composable for video recording using mediabunny for high-quality MP4 output
 * Supports recording from camera + teleprompter canvas, with extensibility for audio and subtitles
 * Uses live-recording approach for better quality
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.2
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */

import {
  Output,
  BufferTarget,
  Mp4OutputFormat,
  CanvasSource,
  MediaStreamAudioTrackSource,
  MediaStreamVideoTrackSource,
  getFirstEncodableVideoCodec,
  getFirstEncodableAudioCodec,
  QUALITY_HIGH,
  OutputFormat,
} from 'mediabunny'

export type AspectRatio = '16:9' | '9:16' | '1:1'

export type RecordingState = 'idle' | 'countdown' | 'recording' | 'processing' | 'finalizing' | 'completed' | 'error'

export type VideoRecorderOptions = {
  aspectRatio: AspectRatio
  frameRate?: number
  videoBitrate?: number
  audioBitrate?: number
}

export type SubtitleTrack = {
  language?: string
  label?: string
  data: VTTSubtitle[]
}

export type VTTSubtitle = {
  startTime: number
  endTime: number
  text: string
}

export type AudioTrack = {
  source: AudioBuffer | MediaStreamAudioTrackSource
  label?: string
  language?: string
}

const ASPECT_RATIO_DIMENSIONS: Record<AspectRatio, { width: number; height: number }> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
}

export const useVideoRecorder = () => {
  const isCameraActive = ref(false)
  const isRecording = ref(false)
  const isProcessing = ref(false)
  const recordingState = ref<RecordingState>('idle')
  const previewUrl = ref<string | null>(null)
  const countdown = ref(0)
  const isCountingDown = ref(false)
  const timer = ref(0)
  const error = ref<string | null>(null)

  // Video elements
  const videoRef = ref<HTMLVideoElement | null>(null)
  const canvasRef = ref<HTMLCanvasElement | null>(null)
  const ctxRef = ref<CanvasRenderingContext2D | null>(null)

  // Media streams
  const streamRef = ref<MediaStream | null>(null)

  // Mediabunny instances
  const outputRef = ref<Output<OutputFormat, BufferTarget> | null>(null)
  const canvasSourceRef = ref<CanvasSource | null>(null)
  const audioSourceRef = ref<MediaStreamAudioTrackSource | null>(null)

  // Recording state
  const recordedChunks = ref<Uint8Array[]>([])
  const frameIntervalRef = ref<number | null>(null)
  const timerIntervalRef = ref<ReturnType<typeof setInterval> | null>(null)
  const countdownIntervalRef = ref<ReturnType<typeof setInterval> | null>(null)

  // Frame capture state
  const startTimeRef = ref(0)
  const lastFrameNumberRef = ref(-1)
  const readyForMoreFramesRef = ref(true)

  // Options
  const aspectRatio = ref<AspectRatio>('16:9')
  const frameRate = 60 // Higher frame rate for smoother video
  const videoBitrate = 15e6 // 15 Mbps for high quality
  const audioBitrate = 192e3 // 192 kbps for better audio quality

  // Additional tracks
  const additionalAudioTracks = ref<AudioTrack[]>([])
  const subtitleTracks = ref<SubtitleTrack[]>([])

  // Teleprompter text state
  const currentLineWords = ref<string[]>([])
  const currentWordIndex = ref(0)
  const nextLineText = ref('')
  const wordsPerLine = 8

  /**
   * Update teleprompter text to display on video
   */
  const updateTeleprompterText = (words: string[], wordIndex: number, nextLine: string) => {
    currentLineWords.value = words
    currentWordIndex.value = wordIndex
    nextLineText.value = nextLine
  }

  /**
   * Initialize camera with high-quality settings and set up canvas
   */
  const startCamera = async (videoEl: HTMLVideoElement, canvasEl: HTMLCanvasElement) => {
    try {
      videoRef.value = videoEl
      canvasRef.value = canvasEl

      const dimensions = ASPECT_RATIO_DIMENSIONS[aspectRatio.value]
      const targetRatio = aspectRatio.value === '9:16'
        ? 9 / 16
        : aspectRatio.value === '1:1'
          ? 1
          : 16 / 9

      // Get canvas context and set dimensions
      const ctx = canvasEl.getContext('2d', { alpha: false })
      if (!ctx) {
        throw new Error('Failed to get canvas context')
      }
      ctxRef.value = ctx

      // Set canvas to target dimensions
      canvasEl.width = dimensions.width
      canvasEl.height = dimensions.height

      // Fill with black background
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, canvasEl.width, canvasEl.height)

      // Request high-quality video
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: dimensions.width },
          height: { ideal: dimensions.height },
          aspectRatio: { ideal: targetRatio },
          frameRate: { ideal: frameRate },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      streamRef.value = mediaStream

      if (videoRef.value) {
        videoRef.value.srcObject = mediaStream
        await videoRef.value.play()
        isCameraActive.value = true
      }

      // Start canvas drawing loop
      startCanvasDrawing()

      return mediaStream
    } catch (err) {
      console.error('Failed to start camera:', err)
      error.value = 'Failed to access camera. Please ensure camera permissions are granted.'
      throw err
    }
  }

  /**
   * Draw video frames to canvas for recording with correct aspect ratio
   */
  const startCanvasDrawing = () => {
    if (!videoRef.value || !canvasRef.value || !ctxRef.value) return

    const video = videoRef.value
    const canvas = canvasRef.value
    const ctx = ctxRef.value
    const dimensions = ASPECT_RATIO_DIMENSIONS[aspectRatio.value]

    // Ensure canvas has correct dimensions
    if (canvas.width !== dimensions.width || canvas.height !== dimensions.height) {
      canvas.width = dimensions.width
      canvas.height = dimensions.height
    }

    const draw = () => {
      if (!isCameraActive.value) return

      if (!video.videoWidth || !video.videoHeight) {
        requestAnimationFrame(draw)
        return
      }

      const targetRatio = aspectRatio.value === '9:16'
        ? 9 / 16
        : aspectRatio.value === '1:1'
          ? 1
          : 16 / 9
      const videoAspect = video.videoWidth / video.videoHeight

      let sx = 0, sy = 0, sw = video.videoWidth, sh = video.videoHeight

      // Calculate source rectangle to crop video to target aspect ratio
      if (videoAspect > targetRatio) {
        // Video is wider - crop sides
        sw = video.videoHeight * targetRatio
        sx = (video.videoWidth - sw) / 2
      } else {
        // Video is taller - crop top/bottom
        sh = video.videoWidth / targetRatio
        sy = (video.videoHeight - sh) / 2
      }

      // Clear canvas with black background
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw video stretched to fill canvas
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)

      // Draw teleprompter text overlay if available
      if (currentLineWords.value.length > 0) {
        drawTeleprompterText(ctx, canvas)
      }

      requestAnimationFrame(draw)
    }

    if (video.readyState >= 1) {
      draw()
    }
    video.onloadedmetadata = () => {
      draw()
    }
  }

  /**
   * Draw teleprompter text onto canvas - shows current active line with gradient overlay
   * Active word highlighted, respects aspect ratio
   */
  const drawTeleprompterText = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    if (currentLineWords.value.length === 0) return

    const isVertical = aspectRatio.value === '9:16'
    const isSquare = aspectRatio.value === '1:1'

    // Font size based on aspect ratio
    const baseFontSize = isVertical ? canvas.height * 0.055 : isSquare ? canvas.height * 0.05 : canvas.height * 0.045
    const activeWordScale = 1.5

    // Gradient overlay covering bottom half of screen
    const gradient = ctx.createLinearGradient(0, canvas.height / 2, 0, canvas.height)
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.4)')
    gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.6)')
    gradient.addColorStop(1, 'rgba(0, 0, 0, 1)')
    ctx.fillStyle = gradient
    ctx.fillRect(0,0, canvas.width, canvas.height)

    const centerY = canvas.height * 0.75
    const centerX = canvas.width / 2
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // Calculate spacing to spread words across canvas width
    const margin = canvas.width * 0.01 // 10% margin on each side
    const availableWidth = canvas.width - (margin * 2)
    const wordCount = currentLineWords.value.length
    const wordSpacing = availableWidth / (wordCount + 1)

    // Calculate font size to fit within available space
    let fontSize = baseFontSize
    ctx.font = `500 ${fontSize}px sans-serif`

    // Adjust font size if needed to fit
    const totalTextWidth = currentLineWords.value.reduce((total, word) => {
      return total + ctx.measureText(word).width
    }, 0)

    if (totalTextWidth > availableWidth * 0.8) {
      fontSize = baseFontSize * 0.8
      ctx.font = `500 ${fontSize}px sans-serif`
    }

    // Draw each word with proper spacing
    currentLineWords.value.forEach((word, idx) => {
      const isActive = idx === currentWordIndex.value
      const isPast = idx < currentWordIndex.value

      // Calculate x position to spread words across canvas
      const x = margin + ((idx + 1) * wordSpacing)

      if (isActive) {
        // Active word - white with blue glow, elevated
        ctx.save()
        ctx.font = `bold ${fontSize * activeWordScale}px 'Josefin Sans'`

        ctx.fillStyle = '#00c951' // oklch(0.723 0.219 149.579)
        ctx.shadowColor = 'rgba(255, 0, 205, 0.8)'
        ctx.shadowBlur = 5
        ctx.fillText(word, centerX, centerY - 15)
        // ctx.strokeText(word, centerX, centerY - 15)
        // ctx.strokeStyle = '#00c951'
        ctx.restore()
      }
      // else if (isPast) {
      //   // Past words - very dimmed, on baseline
      //   ctx.font = `400 ${fontSize}px sans-serif`
      //   ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
      //   ctx.shadowBlur = 0
      //   ctx.fillText(word, x, centerY)
      // } else {
      //   // Future words - white with subtle shadow, on baseline
      //   ctx.font = `500 ${fontSize}px sans-serif`
      //   ctx.fillStyle = '#ffffff'
      //   ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'
      //   ctx.shadowBlur = 2
      //   ctx.fillText(word, x, centerY)
      // }
    })
  }

  /**
   * Stop camera and release resources
   */
  const stopCamera = () => {
    if (streamRef.value) {
      streamRef.value.getTracks().forEach(t => t.stop())
      streamRef.value = null
    }
    if (videoRef.value?.srcObject) {
      const stream = videoRef.value.srcObject as MediaStream
      stream.getTracks().forEach(t => t.stop())
      videoRef.value.srcObject = null
    }
    isCameraActive.value = false
  }

  /**
   * Start countdown before recording
   */
  const startCountdown = (onComplete: () => void) => {
    countdown.value = 3
    isCountingDown.value = true
    recordingState.value = 'countdown'

    countdownIntervalRef.value = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0) {
        if (countdownIntervalRef.value) clearInterval(countdownIntervalRef.value)
        isCountingDown.value = false
        onComplete()
      }
    }, 1000)
  }

  /**
   * Initialize mediabunny output for high-quality MP4 recording
   */
  const initializeOutput = async () => {
    if (!canvasRef.value) {
      throw new Error('Canvas not available')
    }

    const dimensions = ASPECT_RATIO_DIMENSIONS[aspectRatio.value]

    // Create output with MP4 format - use fast start for better compatibility
    const output = new Output({
      target: new BufferTarget(),
      format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
    })

    // Get supported video codec
    const videoCodec = await getFirstEncodableVideoCodec(
      output.format.getSupportedVideoCodecs(),
      {
        width: dimensions.width,
        height: dimensions.height,
        bitrate: videoBitrate,
      }
    )

    if (!videoCodec) {
      throw new Error('Your browser doesn\'t support video encoding.')
    }

    // Get supported audio codec
    const audioCodec = await getFirstEncodableAudioCodec(
      output.format.getSupportedAudioCodecs(),
      {
        numberOfChannels: 2,
        sampleRate: 48000,
        bitrate: audioBitrate,
      }
    )

    // Create canvas source for video capture with high quality settings
    const canvasSource = new CanvasSource(canvasRef.value, {
      codec: videoCodec,
      bitrate: videoBitrate,
      keyFrameInterval: 0.5, // Keyframe every 0.5 seconds for better quality
      latencyMode: 'realtime', // Allow encoder to skip frames to keep up with real-time
    })

    output.addVideoTrack(canvasSource, {
      frameRate,
    })

    canvasSourceRef.value = canvasSource

    // Add audio from camera stream if available
    if (streamRef.value) {
      const audioTrack = streamRef.value.getAudioTracks()[0]
      if (audioTrack) {
        const audioSource = new MediaStreamAudioTrackSource(audioTrack, {
          codec: audioCodec || 'opus',
          bitrate: audioBitrate,
        })

        output.addAudioTrack(audioSource)
        audioSourceRef.value = audioSource
      }
    }

    // Add additional audio tracks
    for (const audioTrack of additionalAudioTracks.value) {
      // Handle additional audio - can be extended
    }

    // Start output
    await output.start()

    outputRef.value = output

    // Reset frame capture state
    startTimeRef.value = 0
    lastFrameNumberRef.value = -1
    readyForMoreFramesRef.value = true

    return output
  }

  /**
   * Add a video frame to the recording
   */
  const addVideoFrame = async () => {
    if (!canvasSourceRef.value || !readyForMoreFramesRef.value) {
      return
    }

    const elapsedSeconds = timer.value
    const frameNumber = Math.round(elapsedSeconds * frameRate)

    if (frameNumber === lastFrameNumberRef.value) {
      // Prevent multiple frames with the same timestamp
      return
    }

    lastFrameNumberRef.value = frameNumber
    const timestamp = frameNumber / frameRate

    readyForMoreFramesRef.value = false

    try {
      await canvasSourceRef.value.add(timestamp, 1 / frameRate)
      readyForMoreFramesRef.value = true
    } catch (err) {
      console.error('Error adding frame:', err)
      readyForMoreFramesRef.value = true
    }
  }

  /**
   * Start actual video recording using mediabunny
   */
  const startRecording = async () => {
    if (!canvasRef.value) {
      error.value = 'Canvas not available for recording'
      return
    }

    isProcessing.value = true
    recordingState.value = 'processing'
    error.value = null
    timer.value = 0
    recordedChunks.value = []
    previewUrl.value = null

    try {
      // Initialize mediabunny output
      const output = await initializeOutput()

      // Set start time for frame timing
      startTimeRef.value = Date.now()
      lastFrameNumberRef.value = -1
      readyForMoreFramesRef.value = true

      // Start timer
      const startTime = Date.now()
      timerIntervalRef.value = setInterval(() => {
        timer.value = (Date.now() - startTime) / 1000
      }, 100)

      // Start frame capture loop
      frameIntervalRef.value = window.setInterval(() => {
        if (isRecording.value) {
          addVideoFrame()
        }
      }, 1000 / frameRate)

      // Begin recording
      isRecording.value = true
      recordingState.value = 'recording'

    } catch (err) {
      console.error('Failed to start recording:', err)
      error.value = 'Failed to start recording. Please try again.'
      recordingState.value = 'error'
      isProcessing.value = false
      throw err
    }
  }

  /**
   * Stop recording and finalize video
   */
  const stopRecording = async () => {
    if (!isRecording.value) return

    isRecording.value = false

    // Stop frame capture
    if (frameIntervalRef.value) {
      clearInterval(frameIntervalRef.value)
      frameIntervalRef.value = null
    }

    // Stop timer
    if (timerIntervalRef.value) {
      clearInterval(timerIntervalRef.value)
      timerIntervalRef.value = null
    }

    recordingState.value = 'finalizing'

    try {
      // Close canvas source
      if (canvasSourceRef.value) {
        canvasSourceRef.value.close()
      }

      // Close audio source
      if (audioSourceRef.value) {
        audioSourceRef.value.close()
      }

      // Finalize output
      if (outputRef.value) {
        await outputRef.value.finalize()

        // Create blob from output buffer
        const buffer = outputRef.value.target.buffer
        if (buffer) {
          const blob = new Blob([buffer], { type: 'video/mp4' })
          previewUrl.value = URL.createObjectURL(blob)
        }
      }

      recordingState.value = 'completed'
    } catch (err) {
      console.error('Failed to finalize recording:', err)
      error.value = 'Failed to process recording. Please try again.'
      recordingState.value = 'error'
    } finally {
      isProcessing.value = false
    }
  }

  /**
   * Cancel recording and cleanup
   */
  const cancelRecording = async () => {
    isRecording.value = false

    if (frameIntervalRef.value) {
      clearInterval(frameIntervalRef.value)
      frameIntervalRef.value = null
    }

    if (timerIntervalRef.value) {
      clearInterval(timerIntervalRef.value)
      timerIntervalRef.value = null
    }

    if (outputRef.value) {
      await outputRef.value.cancel()
      outputRef.value = null
    }

    if (canvasSourceRef.value) {
      canvasSourceRef.value.close()
      canvasSourceRef.value = null
    }

    if (audioSourceRef.value) {
      audioSourceRef.value.close()
      audioSourceRef.value = null
    }

    recordingState.value = 'idle'
    isProcessing.value = false
  }

  /**
   * Download the recorded video
   */
  const downloadVideo = (filename?: string) => {
    if (!previewUrl.value) return

    const a = document.createElement('a')
    a.href = previewUrl.value
    a.download =  `video-${aspectRatio.value}-${Date.now()}.mp4`
    a.click()
  }

  /**
   * Clear the recorded video
   */
  const clearVideo = () => {
    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value)
      previewUrl.value = null
    }
  }

  /**
   * Add additional audio track to the recording
   * Can be used for background music, voiceover, etc.
   */
  const addAudioTrack = async (audioBuffer: AudioBuffer, options?: { label?: string; language?: string }) => {
    additionalAudioTracks.value.push({
      source: audioBuffer,
      label: options?.label,
      language: options?.language,
    })
  }

  /**
   * Add subtitle track to the recording
   * Supports WebVTT format
   */
  const addSubtitleTrack = (subtitles: VTTSubtitle[], options?: { language?: string; label?: string }) => {
    subtitleTracks.value.push({
      data: subtitles,
      language: options?.language,
      label: options?.label,
    })
  }

  /**
   * Clear all additional tracks
   */
  const clearAdditionalTracks = () => {
    additionalAudioTracks.value = []
    subtitleTracks.value = []
  }

  /**
   * Reset recorder state
   */
  const reset = () => {
    cancelRecording()
    stopCamera()
    previewUrl.value = null
    error.value = null
    timer.value = 0
    countdown.value = 0
    isCountingDown.value = false
    recordingState.value = 'idle'
    clearAdditionalTracks()
  }

  /**
   * Set aspect ratio
   */
  const setAspectRatio = (ratio: AspectRatio) => {
    aspectRatio.value = ratio

    // Update canvas dimensions if it exists
    if (canvasRef.value) {
      const dimensions = ASPECT_RATIO_DIMENSIONS[ratio]
      canvasRef.value.width = dimensions.width
      canvasRef.value.height = dimensions.height

      // Redraw if context exists
      if (ctxRef.value) {
        ctxRef.value.fillStyle = '#000000'
        ctxRef.value.fillRect(0, 0, canvasRef.value.width, canvasRef.value.height)
      }
    }
  }

  // Cleanup on unmount
  onUnmounted(() => {
    reset()
    if (countdownIntervalRef.value) {
      clearInterval(countdownIntervalRef.value)
    }
  })

  return {
    // State
    isCameraActive,
    isRecording,
    isProcessing,
    recordingState,
    previewUrl,
    countdown,
    isCountingDown,
    timer,
    error,
    aspectRatio,

    // Methods
    startCamera,
    stopCamera,
    startCountdown,
    startRecording,
    stopRecording,
    cancelRecording,
    downloadVideo,
    clearVideo,
    addAudioTrack,
    addSubtitleTrack,
    clearAdditionalTracks,
    reset,
    setAspectRatio,
    updateTeleprompterText,

    // Constants
    frameRate,
  }
}
