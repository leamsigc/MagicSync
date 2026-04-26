import { ref, onUnmounted } from 'vue'

export interface AudioRecorderOptions {
  deviceId?: string
}

export interface AudioRecorderState {
  isRecording: boolean
  duration: number
  audioBlob: Blob | null
  transcript: string
  error: string | null
  isTranscribing: boolean
}

export function useAudioRecorder(options: AudioRecorderOptions = {}) {
  const isRecording = ref(false)
  const duration = ref(0)
  const audioBlob = ref<Blob | null>(null)
  const transcript = ref('')
  const error = ref<string | null>(null)
  const isTranscribing = ref(false)

  let mediaRecorder: MediaRecorder | null = null
  let audioChunks: Blob[] = []
  let timerInterval: ReturnType<typeof setInterval> | null = null
  let stream: MediaStream | null = null

  const startRecording = async (deviceId?: string) => {
    try {
      error.value = null
      transcript.value = ''
      audioBlob.value = null

      const audioConstraints: MediaStreamConstraints = {
        audio: deviceId 
          ? { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
          : { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      }
      
      stream = await navigator.mediaDevices.getUserMedia(audioConstraints);
      mediaRecorder = new MediaRecorder(stream)
      audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data)
        }
      }

      mediaRecorder.start(100) // Collect data every 100ms
      isRecording.value = true
      duration.value = 0

      timerInterval = setInterval(() => {
        duration.value++
      }, 1000)
    } catch (err: any) {
      error.value = err.message || 'Failed to access microphone'
      console.error('Microphone access error:', err)
    }
  }

  const stopRecording = async () => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') return

    return new Promise<void>((resolve) => {
      mediaRecorder!.onstop = async () => {
        clearInterval(timerInterval!)
        timerInterval = null

        audioBlob.value = new Blob(audioChunks, { type: 'audio/webm' })

        // Stop all tracks
        if (stream) {
          stream.getTracks().forEach(track => track.stop())
          stream = null
        }

        isRecording.value = false

        resolve()
      }

      mediaRecorder!.stop()
    })
  }

  const copyToClipboard = async () => {
    if (transcript.value) {
      await navigator.clipboard.writeText(transcript.value)
    }
  }

  const reset = () => {
    isRecording.value = false
    duration.value = 0
    audioBlob.value = null
    transcript.value = ''
    error.value = null
    isTranscribing.value = false
  }

  onUnmounted(() => {
    if (timerInterval) clearInterval(timerInterval)
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
    }
  })

  return {
    isRecording,
    duration,
    audioBlob,
    transcript,
    error,
    isTranscribing,
    startRecording,
    stopRecording,
    copyToClipboard,
    reset
  }
}
