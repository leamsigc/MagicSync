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
  </UCard>
</template>
