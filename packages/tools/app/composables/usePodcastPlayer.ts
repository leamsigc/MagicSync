import type { Episode } from './usePodcastService'



export const usePodcastPlayer = () => {
  const currentEpisode = useState<Episode | null>('podcast-currentEpisode', () => null)
  const isPlaying = useState<boolean>('podcast-isPlaying', () => false)
  const currentTime = useState<number>('podcast-currentTime', () => 0)
  const audioUrl = useState<string>('podcast-audioUrl', () => '')
  const podcastInfo = useState<{ title: string; artwork: string } | null>('podcast-info', () => null)

  const playEpisode = (episode: Episode, info: { title: string; artwork: string }) => {
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

  return {
    currentEpisode: readonly(currentEpisode),
    isPlaying: readonly(isPlaying),
    currentTime: readonly(currentTime),
    audioUrl: readonly(audioUrl),
    podcastInfo: readonly(podcastInfo),
    playEpisode,
    togglePlay,
    stop,
    setCurrentTime,
  }
}
