<script lang="ts" setup>

const route = useRoute()
const { getPodcastFeed } = usePodcastService()
const { currentEpisode, playEpisode } = usePodcastPlayer()

const feedUrl = computed(() => String(route.query.feed || ''))
const podcastTitle = computed(() => String(route.query.title || 'Podcast'))
const podcastAuthor = computed(() => String(route.query.author || ''))
const podcastArtwork = computed(() => String(route.query.artwork || ''))

const episodes = ref<Episode[]>([])
const isLoading = ref(false)
const isFavoriteState = ref(false)

const podcastId = computed(() => String(route.params.id))

onMounted(async () => {
  if (feedUrl.value) {
    isLoading.value = true
    episodes.value = await getPodcastFeed(feedUrl.value)
    isLoading.value = false
  }
  isFavoriteState.value = await isFavorite(podcastId.value)
})

const handlePlay = (episode: Episode) => {
  playEpisode(episode, { title: podcastTitle.value, artwork: podcastArtwork.value })
}

const handleToggleFavorite = async () => {
  if (isFavoriteState.value) {
    await removeFavorite(podcastId.value)
    isFavoriteState.value = false
  } else {
    await saveFavorite({
      id: podcastId.value,
      title: podcastTitle.value,
      author: podcastAuthor.value,
      artwork: podcastArtwork.value,
      feedUrl: feedUrl.value,
      savedAt: Date.now(),
    })
    isFavoriteState.value = true
  }
}

const isCurrentlyPlaying = (episode: Episode) => {
  return currentEpisode.value?.id === episode.id
}

useHead({
  title: `${podcastTitle.value} - Podcast Player`,
  meta: [{ name: 'description', content: `Listen to the latest episodes from ${podcastTitle.value}` }],
})
</script>

<template>
  <div class="min-h-screen bg-background-foreground">
    <BaseHeader />
    <div class="max-w-3xl mx-auto p-6">
      <UButton variant="ghost" size="sm" icon="i-lucide-arrow-left" class="mb-6" data-testid="podcast-back"
        to="/tools/podcast">
        Back to Search
      </UButton>

      <div class="flex items-start gap-6 mb-8">
        <img v-if="podcastArtwork" :src="podcastArtwork" :alt="podcastTitle"
          class="w-32 h-32 rounded-xl object-cover shrink-0" loading="lazy">
        <div v-else class="w-32 h-32 rounded-xl bg-gray-800 flex items-center justify-center shrink-0">
          <UIcon name="i-lucide-microphone" class="w-12 h-12 text-gray-600" />
        </div>
        <div class="flex-1 min-w-0">
          <h1 class="text-2xl font-bold text-white leading-tight line-clamp-2" data-testid="podcast-title">{{
            podcastTitle }}</h1>
          <p class="text-gray-400 mt-1">{{ podcastAuthor }}</p>
          <div class="flex items-center gap-3 mt-4">
            <UButton :icon="isFavoriteState ? 'i-lucide-bookmark-check' : 'i-lucide-bookmark'"
              :variant="isFavoriteState ? 'solid' : 'outline'" :color="isFavoriteState ? 'primary' : 'neutral'"
              size="sm" data-testid="podcast-favorite-toggle" @click="handleToggleFavorite">
              {{ isFavoriteState ? 'Saved' : 'Save' }}
            </UButton>
          </div>
        </div>
      </div>

      <h2 class="text-lg font-semibold text-white mb-4">Latest Episodes</h2>

      <div v-if="isLoading" class="flex items-center justify-center py-16">
        <UIcon name="i-lucide-loader-2" class="w-8 h-8 text-orange-400 animate-spin" />
      </div>

      <div v-else-if="episodes.length > 0" class="space-y-3" data-testid="podcast-episodes">
        <EpisodeCard v-for="episode in episodes" :key="episode.id" :id="episode.id" :title="episode.title"
          :date="episode.date" :duration="episode.duration" :description="episode.description"
          :is-playing="isCurrentlyPlaying(episode)" @play="handlePlay(episode)" />
      </div>

      <div v-else class="text-center py-16">
        <UIcon name="i-lucide-music-off" class="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <p class="text-gray-500">No episodes found for this podcast</p>
      </div>
    </div>

    <PodcastPlayer />
  </div>
</template>
