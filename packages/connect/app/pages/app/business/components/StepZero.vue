<i18n src="../business.json"></i18n>
<script lang="ts" setup>
import { useLocalStorage } from '@vueuse/core'

interface StepZeroActions {
  starGithub: boolean
  followTwitter: boolean
  followLinkedin: boolean
  followBluesky: boolean
  followInstagram: boolean
  followFacebook: boolean
}

const emit = defineEmits<{
  continue: []
  skip: []
}>()

const { t } = useI18n()

// Local storage for step 0 actions
const stepZeroState = useLocalStorage<StepZeroActions>('business-step-zero', {
  starGithub: false,
  followTwitter: false,
  followLinkedin: false,
  followBluesky: false,
  followInstagram: false,
  followFacebook: false
})

const allActionsCompleted = computed(() => {
  return Object.values(stepZeroState.value).every(Boolean)
})

const totalActions = computed(() => Object.keys(stepZeroState.value).length)
const completedActions = computed(() => Object.values(stepZeroState.value).filter(Boolean).length)

// Social media links configuration
const socialLinks = {
  starGithub: 'https://github.com/leamsigc/production-example-nuxt-monorepo',
  followTwitter: 'https://twitter.com/leamsigc',
  followLinkedin: 'https://linkedin.com/in/leamsigc',
  followBluesky: 'https://bsky.app/profile/leamsigc.com',
  followInstagram: 'https://instagram.com/leamsigc',
  followFacebook: 'https://facebook.com/leamsigc'
}

const handleActionClick = (action: keyof StepZeroActions) => {
  const link = socialLinks[action]
  if (link) {
    window.open(link, '_blank', 'noopener,noreferrer')
  }
}

const handleContinue = () => {
  emit('continue')
}

const handleSkip = () => {
  emit('skip')
}
</script>

<template>
  <div class="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto w-full" 
      data-test="step-zero">
    <!-- Header -->
    <div class="mb-8 text-center">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white tracking-tight mb-2">
        {{ t('step_zero.title') }}
      </h2>
      <p class="text-sm text-gray-600 dark:text-gray-300">
        {{ t('step_zero.subtitle') }}
      </p>
    </div>

    <!-- Progress Indicator -->
    <div class="mb-6">
      <div class="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300 mb-2">
        <span>{{ t('step_zero.progress', { completed: completedActions, total: totalActions }) || `${completedActions}
          of ${totalActions} completed` }}</span>
        <span class="font-medium">{{ Math.round((completedActions / totalActions) * 100) }}%</span>
      </div>
      <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div class="bg-primary-500 h-2 rounded-full transition-all duration-300"
          :style="{ width: `${(completedActions / totalActions) * 100}%` }" />
      </div>
    </div>

    <!-- Actions Grid -->
    <div class="space-y-4">
      <!-- Star GitHub Repository -->
      <div
        class="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        @click="handleActionClick('starGithub')">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
            <UIcon name="lucide:star" class="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </div>
          <div class="text-left">
            <h3 class="font-medium text-gray-900 dark:text-white">
              {{ t('step_zero.actions.star_github') }}
            </h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ t('step_zero.actions.star_github_desc') }}
            </p>
          </div>
        </div>
        <UCheckbox v-model="stepZeroState.starGithub" :label="''" :ui="{ wrapper: 'pointer-events-none' }" />
      </div>

      <!-- Follow Twitter -->
      <div
        class="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        @click="handleActionClick('followTwitter')" data-test="step-zero-follow-twitter">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
            <UIcon name="lucide:twitter" class="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div class="text-left">
            <h3 class="font-medium text-gray-900 dark:text-white">
              {{ t('step_zero.actions.follow_twitter') }}
            </h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ t('step_zero.actions.follow_twitter_desc') }}
            </p>
          </div>
        </div>
        <UCheckbox v-model="stepZeroState.followTwitter" :label="''" :ui="{ wrapper: 'pointer-events-none' }" />
      </div>

      <!-- Follow LinkedIn -->
      <div
        class="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        @click="handleActionClick('followLinkedin')">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
            <UIcon name="lucide:linkedin" class="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div class="text-left">
            <h3 class="font-medium text-gray-900 dark:text-white">
              {{ t('step_zero.actions.follow_linkedin') }}
            </h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ t('step_zero.actions.follow_linkedin_desc') }}
            </p>
          </div>
        </div>
        <UCheckbox v-model="stepZeroState.followLinkedin" :label="''" :ui="{ wrapper: 'pointer-events-none' }" />
      </div>

      <!-- Follow Bluesky -->
      <div
        class="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        @click="handleActionClick('followBluesky')">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-sky-100 dark:bg-sky-900/30 rounded-full flex items-center justify-center">
            <UIcon name="lucide:cloud" class="w-5 h-5 text-sky-600 dark:text-sky-400" />
          </div>
          <div class="text-left">
            <h3 class="font-medium text-gray-900 dark:text-white">
              {{ t('step_zero.actions.follow_bluesky') }}
            </h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ t('step_zero.actions.follow_bluesky_desc') }}
            </p>
          </div>
        </div>
        <UCheckbox v-model="stepZeroState.followBluesky" :label="''" :ui="{ wrapper: 'pointer-events-none' }" />
      </div>

      <!-- Follow Instagram -->
      <div
        class="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        @click="handleActionClick('followInstagram')">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-pink-100 dark:bg-pink-900/30 rounded-full flex items-center justify-center">
            <UIcon name="lucide:camera" class="w-5 h-5 text-pink-600 dark:text-pink-400" />
          </div>
          <div class="text-left">
            <h3 class="font-medium text-gray-900 dark:text-white">
              {{ t('step_zero.actions.follow_instagram') }}
            </h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ t('step_zero.actions.follow_instagram_desc') }}
            </p>
          </div>
        </div>
        <UCheckbox v-model="stepZeroState.followInstagram" :label="''" :ui="{ wrapper: 'pointer-events-none' }" />
      </div>

      <!-- Follow Facebook -->
      <div
        class="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        @click="handleActionClick('followFacebook')">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
            <UIcon name="lucide:facebook" class="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div class="text-left">
            <h3 class="font-medium text-gray-900 dark:text-white">
              {{ t('step_zero.actions.follow_facebook') }}
            </h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ t('step_zero.actions.follow_facebook_desc') }}
            </p>
          </div>
        </div>
        <UCheckbox v-model="stepZeroState.followFacebook" :label="''" :ui="{ wrapper: 'pointer-events-none' }" />
      </div>
    </div>

    <!-- Actions -->
    <div class="flex flex-col sm:flex-row gap-3 pt-6 mt-8 border-t border-gray-200 dark:border-gray-800">
      <UButton color="primary" size="lg" class="flex-1 justify-center" :disabled="!allActionsCompleted"
        @click="handleContinue">
        {{ t('step_zero.continue') }}
      </UButton>

      <UButton color="neutral" variant="outline" size="lg" class="flex-1 justify-center" 
      data-test="step-zero-skip" @click="handleSkip">
        {{ t('step_zero.skip') }}
      </UButton>
    </div>

    <!-- Skip hint -->
    <p class="text-xs text-gray-500 dark:text-gray-400 text-center mt-4">
      {{ t('step_zero.skip_hint') }}
    </p>
  </div>
</template>
