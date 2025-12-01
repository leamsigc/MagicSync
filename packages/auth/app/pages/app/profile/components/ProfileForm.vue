<!-- Translation file -->
<i18n src="../index.json"></i18n>

<script lang="ts" setup>
/**
 * Component Description: Profile form for editing user information
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
const error = ref<string | null>(null)

const schema = z.object({
  name: z.string().min(1, t('messages.required')),
  firstName: z.string().optional(),
  lastName: z.string().optional()
})

type Schema = z.output<typeof schema>

const state = reactive({
  name: '',
  firstName: '',
  lastName: ''
})

// Watch user changes and update form
watch(user, (newUser) => {
  if (newUser) {
    state.name = newUser.name || ''
    state.firstName = newUser.firstName || ''
    state.lastName = newUser.lastName || ''
  }
}, { immediate: true })

const handleSubmit = async (event: FormSubmitEvent<Schema>) => {
  loading.value = true
  error.value = null

  try {
    await client.updateUser({
      name: event.data.name,
      firstName: event.data.firstName,
      lastName: event.data.lastName
    })

    toast.add({
      title: t('messages.success'),
      color: 'success'
    })
  } catch (err: any) {
    error.value = err.message || 'Failed to update profile'
    toast.add({
      title: t('messages.error'),
      description: error.value,
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="text-xl font-semibold">{{ t('form.name') }}</h2>
    </template>

    <UForm :schema="schema" :state="state" @submit="handleSubmit" class="space-y-4">
      <UFormField :label="t('form.name')" name="name">
        <UInput v-model="state.name" :placeholder="t('placeholders.name')" :disabled="loading" />
      </UFormField>

      <div class="grid gap-4 md:grid-cols-2">
        <UFormField :label="t('form.firstName')" name="firstName">
          <UInput v-model="state.firstName" :placeholder="t('placeholders.firstName')" :disabled="loading" />
        </UFormField>

        <UFormField :label="t('form.lastName')" name="lastName">
          <UInput v-model="state.lastName" :placeholder="t('placeholders.lastName')" :disabled="loading" />
        </UFormField>
      </div>

      <UFormField :label="t('form.email')" name="email">
        <UInput :model-value="user?.email" disabled class="bg-muted" />
        <template #help>
          <span class="text-xs text-muted-foreground">Email cannot be changed here. Use Account settings.</span>
        </template>
      </UFormField>

      <UAlert v-if="error" color="error" variant="soft" :title="error" class="mb-4" />

      <div class="flex gap-2">
        <UButton type="submit" :loading="loading">
          {{ t('form.save') }}
        </UButton>
      </div>
    </UForm>
  </UCard>
</template>

<style scoped></style>
