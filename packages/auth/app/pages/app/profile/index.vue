<!-- Translation file -->
<i18n src="./index.json"></i18n>

<script lang="ts" setup>
import ProfileForm from './components/ProfileForm.vue'
import ProfileAvatar from './components/ProfileAvatar.vue'

const { t } = useI18n()
const { user, client } = UseUser()
const { theme, setTheme, themes } = useTheme()
const toast = useToast()

const saving = ref(false)

async function selectTheme(id: ThemeId) {
  setTheme(id)
  saving.value = true
  try {
    await client.updateUser({ theme: id })
    toast.add({ title: 'Theme updated', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to save theme', color: 'error' })
  } finally {
    saving.value = false
  }
}

// Apply server-saved theme on mount
watch(user, (u) => {
  if (u?.theme && THEMES.some(t => t.id === u.theme)) {
    setTheme(u.theme as ThemeId)
  }
}, { immediate: true })

const shortcutLinks = computed(() => [
  { label: t('shortcuts.account'), icon: 'i-lucide-user-cog', to: '/app/account' },
  { label: t('shortcuts.apiKeys'), icon: 'i-lucide-key', to: '/app/keys' },
  { label: t('shortcuts.notifications'), icon: 'i-lucide-bell', to: '/app/notifications' },
  { label: t('shortcuts.business'), icon: 'i-lucide-building-2', to: '/app/business' }
])

useHead({
  title: t('title'),
  meta: [
    { name: 'description', content: t('description') }
  ]
})
</script>

<template>
  <UContainer class="py-8 max-w-5xl">
    <div class="mb-8">
      <h1 class="text-3xl font-bold tracking-tight mb-2">{{ t('heading') }}</h1>
      <p class="text-muted">{{ t('subheading') }}</p>
    </div>

    <div v-if="!user" class="flex justify-center items-center py-12">
      <UIcon name="i-lucide-loader-2" class="animate-spin h-12 w-12 text-primary" />
    </div>

    <template v-else>
      <div class="bg-elevated  rounded-2xl overflow-hidden mb-6">
        <div class="h-20 bg-gradient-to-r from-primary/25 via-primary/10 to-transparent" aria-hidden="true" />
        <div class="px-6 pb-6 -mt-9 flex flex-col sm:flex-row sm:items-end gap-4">
          <UAvatar :src="user.image || undefined" :alt="user.name || 'User'" size="3xl"
            class="ring-4 ring-background shrink-0" />
          <div class="flex-1 min-w-0 sm:pb-1">
            <p class="text-lg font-semibold text-highlighted truncate">
              {{ user.name || 'User' }}
            </p>
            <p class="text-sm text-muted truncate">
              {{ user.email || 'email@domain.com' }}
            </p>
          </div>
          <UBadge v-if="user.role" :label="user.role" variant="subtle" color="neutral" class="sm:mb-2 self-start" />
        </div>
      </div>

      <div class="grid gap-6 lg:grid-cols-3">
        <div class="lg:col-span-1 space-y-6" data-tour="profile-step-0">
          <div class="bg-elevated  rounded-2xl p-5">
            <ProfileAvatar />
          </div>

          <div class="bg-elevated  rounded-2xl p-5">
            <h2 class="text-sm font-semibold text-highlighted mb-3">{{ t('shortcuts.title') }}</h2>
            <nav class="space-y-1">
              <NuxtLink v-for="link in shortcutLinks" :key="link.to" :to="link.to"
                class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-default hover:bg-accent hover:text-accent-foreground transition-colors min-h-11">
                <UIcon :name="link.icon" class="size-4 text-muted shrink-0" />
                <span class="flex-1">{{ link.label }}</span>
                <UIcon name="i-lucide-chevron-right" class="size-4 text-dimmed" />
              </NuxtLink>
            </nav>
          </div>
        </div>

        <div class="lg:col-span-2 space-y-6" data-tour="profile-step-1">
          <div class="bg-elevated  rounded-2xl overflow-hidden">
            <ProfileForm />
          </div>

          <div class="bg-elevated  rounded-2xl p-5">
            <h2 class="text-base font-semibold text-highlighted mb-1">{{ t('theme.title') }}</h2>
            <p class="text-sm text-muted mb-4">{{ t('theme.description') }}</p>
            <div class="flex flex-wrap gap-3">
              <UButton v-for="themeOption in themes" :key="themeOption.id" :disabled="saving" variant="outline"
                class="gap-2 flex-1 min-w-28 justify-center rounded-xl"
                :class="theme === themeOption.id ? 'ring-2 ring-primary' : ''" @click="selectTheme(themeOption.id)">
                <span class="size-4 rounded-full shrink-0" :style="{ backgroundColor: themeOption.color }" />
                <span>{{ themeOption.label }}</span>
              </UButton>
            </div>
          </div>
        </div>
      </div>
    </template>
  </UContainer>
</template>
