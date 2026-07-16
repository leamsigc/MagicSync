export interface CropKeyframe {
  id: string
  time: number
  x: number
  y: number
  width: number
  height: number
}

export interface CropLayer {
  id: string
  name: string
  keyframes: CropKeyframe[]
  color: string
}

export type StackingDirection = 'vertical' | 'horizontal'

export interface VideoMetadata {
  name: string
  url: string
  width: number
  height: number
  duration: number
  aspectRatio: number
}

export type InterpolationMode = 'linear' | 'ease' | 'step'

export interface ExportSettings {
  fps: number
  includeAudio: boolean
  autoSave: boolean
  interpolation: InterpolationMode
  stackingDirection: StackingDirection
  useWorker: boolean
}

export interface ExportProgress {
  status: 'idle' | 'processing' | 'completed' | 'failed'
  statusText: string
  processedFrames: number
  totalFrames: number
  percentage: number
  elapsedTime: number
  estimatedTimeRemaining: number
  error?: string
}

export interface CustomAudioTrack {
  id: string
  name: string
  url?: string
  file?: File
  loop: boolean
  volume: number
  buffer?: AudioBuffer
}

export interface SubtitleStyle {
  font: string
  size: number
  color: string
  position: 'bottom' | 'middle' | 'top'
  background: boolean
  bgColor: string
}

export interface CropperState {
  videoFile: File | null
  videoMetadata: VideoMetadata | null
  layers: CropLayer[]
  activeLayerId: string
  cropBoxAspectRatio: number | null
  finalVideoAspectRatio: number | null
  fitMode: 'cover' | 'contain' | 'fill'
  settings: ExportSettings
  audioTracks: CustomAudioTrack[]
  subtitleStyle: SubtitleStyle
  subtitleText: string
  isPlaying: boolean
  isMuted: boolean
  volume: number
}

export const LAYER_COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6']
