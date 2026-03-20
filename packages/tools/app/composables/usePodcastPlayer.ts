import type { Episode } from './usePodcastService'



export const usePodcastPlayer = () => {
  const currentEpisode = useState<Episode | null>('podcast-currentEpisode', () => null)
  const isPlaying = useState<boolean>('podcast-isPlaying', () => false)
  const currentTime = useState<number>('podcast-currentTime', () => 0)
  const audioUrl = useState<string>('podcast-audioUrl', () => '')
  const podcastInfo = useState<{ title: string; artwork: string } | null>('podcast-info', () => null)

  const proxiedAudioUrl = computed(() => {
    if (!audioUrl.value) return ''
    return `/api/v1/podcast/audio?url=${encodeURIComponent(audioUrl.value)}`
  })

  const playEpisode = (episode: Episode, info: { title: string; artwork: string }) => {
    console.log("Episode",episode);

    currentEpisode.value = episode
    podcastInfo.value = info
    audioUrl.value = episode.audioUrl
    isPlaying.value = true
    currentTime.value = 0
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
  }

  return {
    currentEpisode: readonly(currentEpisode),
    isPlaying: isPlaying,
    currentTime: readonly(currentTime),
    audioUrl: readonly(audioUrl),
    proxiedAudioUrl: readonly(proxiedAudioUrl),
    podcastInfo: readonly(podcastInfo),
    playEpisode,
    togglePlay,
    stop,
    setCurrentTime,
    clearAudio,
  }
}
