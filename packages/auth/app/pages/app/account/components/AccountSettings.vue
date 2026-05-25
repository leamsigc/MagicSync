<!-- Translation file -->
<i18n src="../index.json"></i18n>
<script lang="ts" setup>
/**
 * Component Description: Account settings form
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

import { z } from 'zod'
import type { FormSubmitEvent } from '#ui/types'
import type { NuxtLayouts } from '#app'

const { t } = useI18n()
const { user, client } = UseUser()
const toast = useToast()

const loading = ref(false)

const schema = z.object({
  email: z.string().email(t('messages.invalidEmail'))
})

type Schema = z.output<typeof schema>

const state = reactive({
  email: ''
})

watch(user, (newUser) => {
  if (newUser) {
    state.email = newUser.email || ''
  }
}, { immediate: true })

const handleSubmit = async (event: FormSubmitEvent<Schema>) => {
  loading.value = true
  try {
    await client.changeEmail({
      newEmail: event.data.email,
      callbackURL: '/app/account' // Redirect back to account page after verification
    })

    toast.add({
      title: 'Verification email sent',
      description: 'Please check your email to verify your new address',
    })
  } catch (err: any) {
    toast.add({
      title: t('messages.error'),
      description: err.message,
      color: "error"
    })
  } finally {
    loading.value = false
  }
}

const { theme, setTheme, themes, currentTheme } = useTheme()
const savingTheme = ref(false)

async function selectTheme(id: ThemeId) {
  setTheme(id)
  savingTheme.value = true
  try {
    await client.updateUser({ theme: id })
    toast.add({ title: 'Theme updated', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to save theme', color: 'error' })
  } finally {
    savingTheme.value = false
  }
}

// Apply server-saved theme on mount
watch(user, (u) => {
  if (u?.theme && THEMES.some(t => t.id === u.theme)) {
    setTheme(u.theme as ThemeId)
  }
}, { immediate: true })

const userLayoutSetting = useState("dashboard-layout", () => 'dashboard-layout');

const HandleLayoutChange = async () => {

  if (userLayoutSetting.value === "dashboard-layout") {
    userLayoutSetting.value = "auth-twitter-layout";
  } else {
    userLayoutSetting.value = "dashboard-layout";
  }
  setPageLayout(userLayoutSetting.value as keyof NuxtLayouts);
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="text-xl font-semibold">{{ t('general.title') }}</h2>
    </template>

    <UForm :schema="schema" :state="state" @submit="handleSubmit" class="space-y-4">
      <UFormField :label="t('general.email')" name="email">
        <UInput v-model="state.email" type="email" :disabled="loading" />
      </UFormField>

      <div class="flex items-center gap-2">
        <UBadge :color="user?.emailVerified ? 'success' : 'neutral'" variant="subtle">
          {{ user?.emailVerified ? t('general.verified') : t('general.notVerified') }}
        </UBadge>
      </div>

      <UButton type="submit" :loading="loading">
        {{ t('general.save') }}
      </UButton>
    </UForm>

    <UDivider class="my-8" />

    <section class="space-y-6">
      <div>
        <h2 class="text-xl font-semibold">Layout</h2>
        <p class="text-sm text-muted-foreground">Choose your preferred app layout</p>
      </div>
      <div class="flex items-center gap-3">
        <USwitch :model-value="userLayoutSetting === 'dashboard-layout'"
          @update:model-value="HandleLayoutChange" />
        <span class="text-sm">{{ userLayoutSetting === 'dashboard-layout' ? 'Dashboard' : 'Twitter' }}</span>
      </div>
    </section>

    <UDivider class="my-8" />

    <section class="space-y-4">
      <div>
        <h2 class="text-xl font-semibold">Color Theme</h2>
        <p class="text-sm text-muted-foreground">Choose your preferred color palette</p>
      </div>
      <div class="flex flex-wrap gap-3">
        <UButton
          v-for="t in themes"
          :key="t.id"
          :disabled="savingTheme"
          variant="outline"
          class="gap-2 flex-1 min-w-28 justify-center"
          :class="theme === t.id ? 'ring-2 ring-primary' : ''"
          @click="selectTheme(t.id)"
        >
          <span class="size-4 rounded-full shrink-0" :style="{ backgroundColor: t.color }" />
          <span class="text-sm">{{ t.label }}</span>
        </UButton>
      </div>
    </section>
  </UCard>
</template>
