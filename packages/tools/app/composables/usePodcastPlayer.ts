import type { Episode } from './usePodcastService'
import { downloadEpisode, removeDownload, isEpisodeDownloaded, getDownload, getDownloadUrl } from '../utils/podcast-db'

export const usePodcastPlayer = () => {
  const currentEpisode = useState<Episode | null>('podcast-currentEpisode', () => null)
  const isPlaying = useState<boolean>('podcast-isPlaying', () => false)
  const currentTime = useState<number>('podcast-currentTime', () => 0)
  const audioUrl = useState<string>('podcast-audioUrl', () => '')
  const podcastInfo = useState<{ title: string; artwork: string; id: string } | null>('podcast-info', () => null)
  const podcastEpisodes = useState<Episode[]>('podcast-episodes', () => [])
  const isDownloaded = useState<boolean>('podcast-isDownloaded', () => false)
  const isDownloading = useState<boolean>('podcast-isDownloading', () => false)

  const proxiedAudioUrl = computed(() => {
    if (!audioUrl.value) return ''
    if (audioUrl.value.startsWith('blob:')) return audioUrl.value
    return `/api/v1/podcast/audio?url=${encodeURIComponent(audioUrl.value)}`
  })

  const playEpisode = async (episode: Episode, info: { title: string; artwork: string; id: string }, episodes?: Episode[]) => {
    currentEpisode.value = episode
    podcastInfo.value = info
    isPlaying.value = true
    currentTime.value = 0

    if (episodes) {
      podcastEpisodes.value = episodes
    }

    const downloaded = await getDownload(episode.id)
    if (downloaded) {
      isDownloaded.value = true
      audioUrl.value = getDownloadUrl(downloaded.audioBlob)
    } else {
      isDownloaded.value = false
      audioUrl.value = episode.audioUrl
    }
  }

  const togglePlay = () => {
    isPlaying.value = !isPlaying.value
  }

  const stop = () => {
    isPlaying.value = false
  }

  const setCurrentTime = (time: number) => {
    currentTime.value = time
  }

  const clearAudio = () => {
    currentEpisode.value = null
    isPlaying.value = false
    currentTime.value = 0
    audioUrl.value = ''
    podcastInfo.value = null
    isDownloaded.value = false
  }

  const saveForOffline = async () => {
    if (!currentEpisode.value || !podcastInfo.value) return
    isDownloading.value = true
    const success = await downloadEpisode(
      currentEpisode.value,
      podcastInfo.value.id,
      proxiedAudioUrl.value,
    )
    if (success) {
      isDownloaded.value = true
    }
    isDownloading.value = false
  }

  const removeOffline = async () => {
    if (!currentEpisode.value) return
    await removeDownload(currentEpisode.value.id)
    isDownloaded.value = false
  }

  const checkIfDownloaded = async () => {
    if (!currentEpisode.value) return
    isDownloaded.value = await isEpisodeDownloaded(currentEpisode.value.id)
  }

  return {
    currentEpisode: readonly(currentEpisode),
    isPlaying,
    currentTime: readonly(currentTime),
    audioUrl: readonly(audioUrl),
    proxiedAudioUrl: readonly(proxiedAudioUrl),
    podcastInfo: readonly(podcastInfo),
    podcastEpisodes: readonly(podcastEpisodes),
    isDownloaded: readonly(isDownloaded),
    isDownloading: readonly(isDownloading),
    playEpisode,
    togglePlay,
    stop,
    setCurrentTime,
    clearAudio,
    saveForOffline,
    removeOffline,
    checkIfDownloaded,
  }
}
