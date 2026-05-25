<!-- Translation file -->
<i18n src="./index.json"></i18n>

<script lang="ts" setup>
import ProfileForm from './components/ProfileForm.vue'
import ProfileAvatar from './components/ProfileAvatar.vue'

const { t } = useI18n()
const { user, client } = UseUser()
const { theme, setTheme, themes, currentTheme } = useTheme()
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

useHead({
  title: t('title'),
  meta: [
    { name: 'description', content: t('description') }
  ]
})
</script>

<template>
  <UContainer class="py-8 max-w-4xl">
    <div class="mb-8">
      <h1 class="text-3xl font-bold mb-2">{{ t('heading') }}</h1>
      <p class="text-muted-foreground">{{ t('subheading') }}</p>
    </div>

    <div v-if="!user" class="flex justify-center items-center py-12">
      <UIcon name="i-lucide-loader-2" class="animate-spin h-12 w-12 text-primary" />
    </div>

    <div v-else class="grid gap-6 md:grid-cols-3">
      <div class="md:col-span-1">
        <div class="bg-elevated rounded-2xl  p-5">
          <ProfileAvatar />
        </div>
      </div>

      <div class="md:col-span-2 space-y-6">
        <div class="bg-elevated rounded-2xl ">
          <ProfileForm />
        </div>

        <div class="bg-elevated rounded-2xl  p-5">
          <h2 class="text-lg font-semibold text-highlighted mb-1">{{ t('theme.title') }}</h2>
          <p class="text-sm text-muted mb-4">{{ t('theme.description') }}</p>
          <div class="flex flex-wrap gap-3">
            <UButton v-for="t in themes" :key="t.id" :disabled="saving" variant="outline"
              class="gap-2 flex-1 min-w-28 justify-center rounded-xl"
              :class="theme === t.id ? 'ring-2 ring-primary' : ''" @click="selectTheme(t.id)">
              <span class="size-4 rounded-full shrink-0" :style="{ backgroundColor: t.color }" />
              <span>{{ t.label }}</span>
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </UContainer>
</template>
