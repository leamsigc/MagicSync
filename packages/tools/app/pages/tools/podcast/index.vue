<i18n src="./index.json"></i18n>
<script lang="ts" setup>
/**
 *
 * Podcast Player Search Page
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */


const { t } = useI18n()
const { searchPodcasts } = usePodcastService()

const searchTerm = ref('')
const results = ref<Array<{ id: number; title: string; author: string; artwork: string; feedUrl: string }>>([])
const isSearching = ref(false)
const hasSearched = ref(false)
const favorites = ref<FavoritePodcast[]>([])

const loadFavorites = async () => {
  favorites.value = await getFavorites()
}

onMounted(async () => {
  await loadFavorites()
})

watchDebounced(
  searchTerm,
  async () => {
    if (!searchTerm.value.trim()) {
      results.value = []
      hasSearched.value = false
      return
    }
    isSearching.value = true
    hasSearched.value = true
    results.value = await searchPodcasts(searchTerm.value)
    isSearching.value = false
  },
  {
    debounce: 500,
    maxWait: 1000,
  },
)

const handleSelect = (id: number) => {
  const podcast = results.value.find((p) => p.id === id)
  if (podcast) {
    navigateTo(`/tools/podcast/${id}?title=${encodeURIComponent(podcast.title)}&author=${encodeURIComponent(podcast.author)}&artwork=${encodeURIComponent(podcast.artwork)}&feed=${encodeURIComponent(podcast.feedUrl)}`)
  }
}

const handleSelectFavorite = (podcast: FavoritePodcast) => {
  navigateTo(`/tools/podcast/${podcast.id}?title=${encodeURIComponent(podcast.title)}&author=${encodeURIComponent(podcast.author)}&artwork=${encodeURIComponent(podcast.artwork)}&feed=${encodeURIComponent(podcast.feedUrl)}`)
}

const handleRemoveFavorite = async (id: string) => {
  await removeFavorite(id)
  await loadFavorites()
}

useHead({
  title: t('podcast.title'),
  meta: [{ name: 'description', content: t('podcast.description') }],
})
</script>

<template>
  <div class="min-h-screen bg-background-foreground">
    <BaseHeader />
    <div class="max-w-3xl mx-auto p-6">
      <header class="mb-8 mt-4">
        <h1 class="text-3xl font-bold text-white mb-2">{{ t('podcast.title') }}</h1>
        <p class="text-gray-400">{{ t('podcast.description') }}</p>
      </header>

      <div class="relative mb-8">
        <UInput v-model="searchTerm" :placeholder="t('podcast.search.placeholder')" size="xl" class="w-full"
          :ui="{ base: 'rounded-xl' }" data-testid="podcast-search-input">
          <template #leading>
            <UIcon name="i-lucide-search" class="w-5 h-5 text-gray-500" />
          </template>
          <template v-if="isSearching" #trailing>
            <UIcon name="i-lucide-loader-2" class="w-5 h-5 text-gray-400 animate-spin"
              data-testid="podcast-search-loading" />
          </template>
        </UInput>
      </div>

      <div v-if="results.length > 0" class="space-y-3" data-testid="podcast-results">
        <PodcastCard v-for="podcast in results" :key="podcast.id" :id="podcast.id" :title="podcast.title"
          :author="podcast.author" :artwork="podcast.artwork" data-testid="podcast-card" @select="handleSelect" />
      </div>

      <div v-else-if="hasSearched && !isSearching" class="text-center py-16" data-testid="podcast-no-results">
        <UIcon name="i-lucide-search-x" class="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <p class="text-gray-500">{{ t('podcast.search.noResults', { term: searchTerm }) }}</p>
      </div>

      <div v-if="!hasSearched || results.length === 0">
        <div v-if="favorites.length > 0" class="mt-8" data-testid="podcast-favorites">
          <h2 class="text-lg font-semibold text-white mb-4">{{ t('podcast.saved.title') }}</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <SavedPodcastCard v-for="podcast in favorites" :key="podcast.id" :id="podcast.id" :title="podcast.title"
              :author="podcast.author" :artwork="podcast.artwork" :feed-url="podcast.feedUrl"
              @select="handleSelectFavorite(podcast)" @remove="handleRemoveFavorite(podcast.id)" />
          </div>
        </div>

        <div v-if="favorites.length === 0 && !hasSearched" class="py-16">
          <div class="text-center mb-8">
            <UIcon name="i-lucide-headphones" class="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p class="text-gray-500">{{ t('podcast.search.empty') }}</p>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="rounded-xl border border-white/5 p-4 text-center">
              <UIcon name="i-lucide-search" class="w-6 h-6 text-primary mx-auto mb-2" />
              <p class="text-xs text-gray-400">{{ t('podcast.search.emptyFeatures.search') }}</p>
            </div>
            <div class="rounded-xl border border-white/5 p-4 text-center">
              <UIcon name="i-lucide-play" class="w-6 h-6 text-primary mx-auto mb-2" />
              <p class="text-xs text-gray-400">{{ t('podcast.search.emptyFeatures.play') }}</p>
            </div>
            <div class="rounded-xl border border-white/5 p-4 text-center">
              <UIcon name="i-lucide-bookmark" class="w-6 h-6 text-primary mx-auto mb-2" />
              <p class="text-xs text-gray-400">{{ t('podcast.search.emptyFeatures.save') }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
