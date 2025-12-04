<script lang="ts" setup>
import { emoList, type Emoji } from '#layers/BaseScheduler/shared/EmojiList'


type EmojiCategory = keyof typeof emoList

defineProps<{
  placement?: 'top' | 'bottom' | 'left' | 'right'
}>()

const emit = defineEmits<{
  (e: 'select', emoji: string): void
}>()

const isOpen = ref(false)
const filter = ref('')
const activeCategory = ref<EmojiCategory | 'recent'>('Smileys & People')

const categoryIcons: Record<string, string> = {
  'Smileys & People': '😀',
  'Animals & Nature': '🐱',
  'Travel & Places': '🌍',
  'recent': '🕐'
}

const categories = computed(() => Object.keys(emoList) as EmojiCategory[])

const tabItems = computed(() => {
  const items: Array<{ label: string; value: EmojiCategory | 'recent'; icon: string }> = [
    { label: 'Recent', value: 'recent', icon: categoryIcons['recent'] || '🕐' }
  ]

  categories.value.forEach(category => {
    const firstEmoji = emoList[category]?.[0]?.emoji
    items.push({
      label: category,
      value: category,
      icon: categoryIcons[category] || firstEmoji || '❓'
    })
  })

  return items
})

const recentEmojisCookie = useCookie<string>('recentEmojis', { default: () => '' })

const recentEmojis = computed<Emoji[]>(() => {
  if (!recentEmojisCookie.value) return []
  return recentEmojisCookie.value
    .split('_')
    .filter(Boolean)
    .map((v: any) => ({ emoji: v, no: 0, code: '', description: '', flagged: false, keywords: [] }))
    .reverse()
})

const filteredEmojis = computed<Emoji[]>(() => {
  if (filter.value) {
    const searchTerm = filter.value.toLowerCase()
    const results: Emoji[] = []

    Object.values(emoList).forEach((categoryEmojis) => {
      ; (categoryEmojis as Emoji[]).forEach((item) => {
        if (
          item.description.toLowerCase().includes(searchTerm) ||
          item.keywords.some((keyword) => keyword.toLowerCase().includes(searchTerm))
        ) {
          results.push(item)
        }
      })
    })

    return results
  }

  if (activeCategory.value === 'recent') {
    return recentEmojis.value
  }

  return (emoList[activeCategory.value as EmojiCategory] || []) as Emoji[]
})

function changeCategory(category: EmojiCategory | 'recent') {
  activeCategory.value = category
  filter.value = ''
}

function selectEmoji(emoji: string) {
  emit('select', emoji)

  let recentList = recentEmojisCookie.value || ''
  recentList = recentList.replace(`_${emoji}`, '')
  recentList += `_${emoji}`

  const parts = recentList.split('_').filter(Boolean)
  if (parts.length > 24) {
    recentList = '_' + parts.slice(-24).join('_')
  }
  recentEmojisCookie.value = recentList

  isOpen.value = false
}

function handleSearch() {
  if (filter.value) {
    activeCategory.value = 'Smileys & People'
  }
}
</script>

<template>
  <UPopover v-model:open="isOpen" :content="{ side: placement || 'top', align: 'center' }">
    <slot name="trigger">
      <UButton variant="ghost" color="neutral" class="text-lg">
        😀
      </UButton>
    </slot>

    <template #content>
      <div class="w-72 p-2 max-h-[360px] overflow-hidden flex flex-col gap-2" @click.stop>
        <div class="pb-1">
          <UInput v-model="filter" placeholder="Search emojis..." icon="i-heroicons-magnifying-glass" size="sm"
            class="w-full" @input="handleSearch" />
        </div>

        <div v-if="filter" class="grid grid-cols-7 gap-0.5 max-h-60 overflow-y-auto p-1 scrollbar-thin">
          <button v-for="(item, index) in filteredEmojis" :key="index" :title="item.description"
            class="text-[22px] w-9 h-9 flex items-center justify-center rounded-md transition-all duration-150 cursor-pointer bg-transparent border-none hover:bg-gray-100 dark:hover:bg-gray-800 hover:scale-115"
            @click="selectEmoji(item.emoji)">
            {{ item.emoji }}
          </button>
          <p v-if="filteredEmojis.length === 0" class="text-sm text-muted text-center py-4 col-span-7">
            No emojis found
          </p>
        </div>

        <div v-else class="flex flex-col gap-2 flex-1 min-h-0">
          <div class="flex gap-0.5 py-1 border-b border-gray-200 dark:border-gray-800 overflow-x-auto scrollbar-none">
            <button v-for="item in tabItems" :key="item.value" :title="item.label"
              :class="{ 'bg-primary-100 dark:bg-primary-900': activeCategory === item.value }"
              class="text-lg w-8 h-8 flex items-center justify-center rounded-md transition-all duration-150 flex-shrink-0 cursor-pointer bg-transparent border-none hover:bg-gray-100 dark:hover:bg-gray-800"
              @click="changeCategory(item.value)">
              {{ item.icon }}
            </button>
          </div>

          <div class="grid grid-cols-7 gap-0.5 max-h-60 overflow-y-auto p-1 scrollbar-thin">
            <button v-for="(item, index) in filteredEmojis" :key="index" :title="item.description"
              class="text-[22px] w-9 h-9 flex items-center justify-center rounded-md transition-all duration-150 cursor-pointer bg-transparent border-none hover:bg-gray-100 dark:hover:bg-gray-800 hover:scale-115"
              @click="selectEmoji(item.emoji)">
              {{ item.emoji }}
            </button>
            <p v-if="filteredEmojis.length === 0 && activeCategory === 'recent'"
              class="text-sm text-muted text-center py-4 col-span-7">
              No recent emojis yet
            </p>
          </div>
        </div>
      </div>
    </template>
  </UPopover>
</template>

<style scoped>
.scrollbar-thin::-webkit-scrollbar {
  width: 4px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}

.scrollbar-none::-webkit-scrollbar {
  display: none;
}

.scrollbar-none {
  scrollbar-width: none;
}

.hover\:scale-115:hover {
  transform: scale(1.15);
}
</style>
