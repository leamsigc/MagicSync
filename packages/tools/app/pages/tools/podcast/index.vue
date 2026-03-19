<script lang="ts" setup>
const { searchPodcasts } = usePodcastService()

const searchTerm = ref('')
const results = ref<Array<{ id: number; title: string; author: string; artwork: string; feedUrl: string }>>([])
const isSearching = ref(false)
const hasSearched = ref(false)

let debounceTimer: ReturnType<typeof setTimeout>

watch(searchTerm, (val) => {
  clearTimeout(debounceTimer)
  if (!val.trim()) {
    results.value = []
    hasSearched.value = false
    return
  }
  debounceTimer = setTimeout(async () => {
    isSearching.value = true
    hasSearched.value = true
    results.value = await searchPodcasts(val)
    isSearching.value = false
  }, 400)
})

const handleSelect = (id: number) => {
  const podcast = results.value.find((p) => p.id === id)
  if (podcast) {
    navigateTo(`/tools/podcast/${id}?title=${encodeURIComponent(podcast.title)}&author=${encodeURIComponent(podcast.author)}&artwork=${encodeURIComponent(podcast.artwork)}&feed=${encodeURIComponent(podcast.feedUrl)}`)
  }
}

useHead({
  title: 'Podcast Player - Discover and Listen to Tech Podcasts',
  meta: [{ name: 'description', content: 'Search and listen to the best tech podcasts with our free online player.' }],
})
</script>

<template>
  <div class="min-h-screen bg-background-foreground">
    <BaseHeader />
    <div class="max-w-3xl mx-auto p-6">
      <header class="mb-8 mt-4">
        <h1 class="text-3xl font-bold text-white mb-2">Podcast Player</h1>
        <p class="text-gray-400">Discover and listen to the best tech podcasts</p>
      </header>

      <div class="relative mb-8">
        <UInput
          v-model="searchTerm"
          placeholder="Search for podcasts..."
          size="xl"
          class="w-full"
          :ui="{ base: 'rounded-xl' }"
        >
          <template #leading>
            <UIcon name="i-lucide-search" class="w-5 h-5 text-gray-500" />
          </template>
          <template v-if="isSearching" #trailing>
            <UIcon name="i-lucide-loader-2" class="w-5 h-5 text-gray-400 animate-spin" />
          </template>
        </UInput>
      </div>

      <div v-if="results.length > 0" class="space-y-3">
        <PodcastCard
          v-for="podcast in results"
          :key="podcast.id"
          :id="podcast.id"
          :title="podcast.title"
          :author="podcast.author"
          :artwork="podcast.artwork"
          @select="handleSelect"
        />
      </div>

      <div v-else-if="hasSearched && !isSearching" class="text-center py-16">
        <UIcon name="i-lucide-search-x" class="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <p class="text-gray-500">No podcasts found for "{{ searchTerm }}"</p>
      </div>

      <div v-else-if="!hasSearched" class="py-16">
        <div class="text-center mb-8">
          <UIcon name="i-lucide-headphones" class="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p class="text-gray-500">Search for your favorite podcasts above</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="rounded-xl border border-white/5 bg-white/5 p-4 text-center">
            <UIcon name="i-lucide-search" class="w-6 h-6 text-orange-400 mx-auto mb-2" />
            <p class="text-xs text-gray-400">Search by topic or name</p>
          </div>
          <div class="rounded-xl border border-white/5 bg-white/5 p-4 text-center">
            <UIcon name="i-lucide-play" class="w-6 h-6 text-orange-400 mx-auto mb-2" />
            <p class="text-xs text-gray-400">Play latest episodes instantly</p>
          </div>
          <div class="rounded-xl border border-white/5 bg-white/5 p-4 text-center">
            <UIcon name="i-lucide-bookmark" class="w-6 h-6 text-orange-400 mx-auto mb-2" />
            <p class="text-xs text-gray-400">Save favorites locally</p>
          </div>
        </div>
      </div>
    </div>

    <PodcastPlayer />
  </div>
</template>
