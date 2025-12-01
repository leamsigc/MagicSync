<!-- Translation file -->
<i18n src="./index.json"></i18n>

<script lang="ts" setup>
/**
 * Component Description: Profile page for managing user profile information
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

import ProfileForm from './components/ProfileForm.vue'
import ProfileAvatar from './components/ProfileAvatar.vue'

const { t } = useI18n()
const { user } = UseUser()

// Page meta with translations
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
      <!-- Avatar Section -->
      <div class="md:col-span-1">
        <ProfileAvatar />
      </div>

      <!-- Profile Form Section -->
      <div class="md:col-span-2">
        <ProfileForm />
      </div>
    </div>
  </UContainer>
</template>

<style scoped></style>
