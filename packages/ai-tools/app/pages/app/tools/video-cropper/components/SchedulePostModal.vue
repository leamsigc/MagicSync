<i18n src="../index.json"></i18n>

<script lang="ts" setup>
const isOpen = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{
  publish: [data: { platforms: string[]; caption: string; scheduleAt: string | null }]
}>()

const { t } = useI18n()

const selectedPlatforms = ref<string[]>([])
const caption = ref('')
const scheduleOption = ref<'now' | 'later'>('now')
const scheduledDate = ref('')
const scheduledTime = ref('')

const platformOptions = [
  { label: 'YouTube', value: 'youtube', icon: 'i-lucide-film' },
  { label: 'TikTok', value: 'tiktok', icon: 'i-lucide-music' },
  { label: 'Instagram', value: 'instagram', icon: 'i-lucide-camera' },
  { label: 'Facebook', value: 'facebook', icon: 'i-lucide-message-square' },
  { label: 'LinkedIn', value: 'linkedin', icon: 'i-lucide-briefcase' },
  { label: 'X / Twitter', value: 'twitter', icon: 'i-lucide-hash' },
  { label: 'Bluesky', value: 'bluesky', icon: 'i-lucide-cloud' },
  { label: 'Threads', value: 'threads', icon: 'i-lucide-at-sign' },
]

function togglePlatform(platform: string) {
  const idx = selectedPlatforms.value.indexOf(platform)
  if (idx >= 0) selectedPlatforms.value.splice(idx, 1)
  else selectedPlatforms.value.push(platform)
}

function handlePublish() {
  const scheduleAt = scheduleOption.value === 'later' && scheduledDate.value && scheduledTime.value
    ? `${scheduledDate.value}T${scheduledTime.value}:00`
    : null
  emit('publish', {
    platforms: selectedPlatforms.value,
    caption: caption.value,
    scheduleAt,
  })
}

watch(isOpen, (val) => {
  if (!val) {
    selectedPlatforms.value = []
    caption.value = ''
    scheduleOption.value = 'now'
    scheduledDate.value = ''
    scheduledTime.value = ''
  }
})
</script>

<template>
  <UModal v-model:open="isOpen" size="xl">
    <template #title>
      {{ t('actions.schedule_post') }}
    </template>
    <template #description>
      {{ t('actions.schedule_post') }}
    </template>
    <template #content>


      <div class="p-4 space-y-6">
        <UCard>
          <template #header>
            <h3 class="text-xs font-mono text-gray-400 uppercase tracking-wider">{{ t('actions.caption') }}</h3>
          </template>
          <UTextarea v-model="caption" :placeholder="t('actions.caption')" :rows="3" block variant="subtle" />
        </UCard>

        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-xs font-mono text-gray-400 uppercase tracking-wider">{{ t('actions.platforms') }}</h3>
              <span v-if="selectedPlatforms.length" class="text-xs font-mono text-indigo-400">{{
                selectedPlatforms.length }} selected</span>
            </div>
          </template>
          <div class="space-y-1">
            <button v-for="platform in platformOptions" :key="platform.value" :class="[
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
              selectedPlatforms.includes(platform.value)
                ? 'bg-indigo-500/10 text-indigo-300'
                : 'hover:bg-slate-900 text-gray-400 hover:text-gray-200',
            ]" @click="togglePlatform(platform.value)">
              <div :class="[
                'w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
                selectedPlatforms.includes(platform.value)
                  ? 'bg-indigo-500 border-indigo-500'
                  : 'border-gray-600',
              ]">
                <UIcon v-if="selectedPlatforms.includes(platform.value)" name="i-lucide-check"
                  class="w-3 h-3 text-white" />
              </div>
              <UIcon :name="platform.icon" class="w-4 h-4 shrink-0" />
              <span>{{ platform.label }}</span>
            </button>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <h3 class="text-xs font-mono text-gray-400 uppercase tracking-wider">{{ t('actions.schedule') }}</h3>
          </template>
          <div class="space-y-4">
            <div class="flex gap-2">
              <UButton :variant="scheduleOption === 'now' ? 'soft' : 'outline'" color="neutral" block size="sm"
                @click="scheduleOption = 'now'">
                {{ t('actions.publish_now') }}
              </UButton>
              <UButton :variant="scheduleOption === 'later' ? 'soft' : 'outline'" color="neutral" block size="sm"
                @click="scheduleOption = 'later'">
                {{ t('actions.publish_later') }}
              </UButton>
            </div>
            <div v-if="scheduleOption === 'later'" class="grid grid-cols-2 gap-3">
              <div class="space-y-1">
                <label class="text-[10px] font-mono text-gray-500 uppercase">{{ t('actions.date') }}</label>
                <UInput v-model="scheduledDate" type="date" block size="sm" />
              </div>
              <div class="space-y-1">
                <label class="text-[10px] font-mono text-gray-500 uppercase">{{ t('actions.time') }}</label>
                <UInput v-model="scheduledTime" type="time" block size="sm" />
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton variant="outline" @click="() => { isOpen = false }">
          {{ t('actions.cancel') }}
        </UButton>
        <UButton :disabled="selectedPlatforms.length === 0" @click="handlePublish">
          {{ scheduleOption === 'now' ? t('actions.publish_now') : t('actions.schedule') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
