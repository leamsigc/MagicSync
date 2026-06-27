<i18n src="./BaseOnboardingTutorial.json"></i18n>
<script lang="ts" setup>
/**
 * Component Description: Onboarding tutorial button with driver.js guided tours
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */
import { driver, type DriveStep } from "driver.js"
import "driver.js/dist/driver.css"

const showModal = ref(false)
const { t } = useI18n()

interface Tutorial {
  id: string
  label: string
  icon: string
  description: string
}

const tutorials: Tutorial[] = [
  { id: 'first-time', label: t('firstTime.label'), icon: 'i-heroicons-rocket-launch', description: t('firstTime.description') },
  { id: 'create-business', label: t('createBusiness.label'), icon: 'i-heroicons-building-office-2', description: t('createBusiness.description') },
  { id: 'connect-social-media', label: t('connectSocialMedia.label'), icon: 'i-heroicons-share', description: t('connectSocialMedia.description') },
  { id: 'add-assets', label: t('addAssets.label'), icon: 'i-heroicons-photo', description: t('addAssets.description') },
  { id: 'create-new-post', label: t('createNewPost.label'), icon: 'i-heroicons-document-plus', description: t('createNewPost.description') },
  { id: 'create-bulk-post', label: t('createBulkPost.label'), icon: 'i-heroicons-document-duplicate', description: t('createBulkPost.description') },
  { id: 'send-invitation', label: t('sendInvitation.label'), icon: 'i-heroicons-envelope', description: t('sendInvitation.description') },
  { id: 'connect-multiple-pages', label: t('connectMultiplePages.label'), icon: 'i-heroicons-link', description: t('connectMultiplePages.description') },
  { id: 'group-social-media', label: t('groupSocialMedia.label'), icon: 'i-heroicons-rectangle-group', description: t('groupSocialMedia.description') },
  { id: 'create-variables', label: t('createVariables.label'), icon: 'i-heroicons-variable', description: t('createVariables.description') },
  { id: 'create-api-key', label: t('createApiKey.label'), icon: 'i-heroicons-key', description: t('createApiKey.description') },
  { id: 'view-calendar', label: t('viewCalendar.label'), icon: 'i-heroicons-calendar-days', description: t('viewCalendar.description') },
]

function getTutorialSteps(id: string):DriveStep[] {
  switch (id) {
    case 'first-time':
      return [
        { element: '[data-test=add-business-button]', popover: { title: t('firstTime.steps.0.title'), description: t('firstTime.steps.0.description') } },
        { element: '[data-test=step-zero]',popover: { title: t('firstTime.steps.1.title'), description: t('firstTime.steps.1.description') } },
        { element: '[data-test=step-zero-follow-twitter]',popover: { title: t('firstTime.steps.2.title'), description: t('firstTime.steps.2.description') } },
        { element: '[data-test=step-zero-skip]', popover: { title: t('firstTime.steps.3.title'), description: t('firstTime.steps.3.description') } },
        { element: '[data-test=step-one]',popover: { title: t('firstTime.steps.4.title'), description: t('firstTime.steps.4.description') } },
      ]
    case 'create-business':
      return [
        { popover: { title: t('createBusiness.steps.0.title'), description: t('createBusiness.steps.0.description') } },
        { popover: { title: t('createBusiness.steps.1.title'), description: t('createBusiness.steps.1.description') } },
        { popover: { title: t('createBusiness.steps.2.title'), description: t('createBusiness.steps.2.description') } },
      ]
    case 'connect-social-media':
      return [
        { popover: { title: t('connectSocialMedia.steps.0.title'), description: t('connectSocialMedia.steps.0.description') } },
        { popover: { title: t('connectSocialMedia.steps.1.title'), description: t('connectSocialMedia.steps.1.description') } },
        { popover: { title: t('connectSocialMedia.steps.2.title'), description: t('connectSocialMedia.steps.2.description') } },
      ]
    case 'add-assets':
      return [
        { popover: { title: t('addAssets.steps.0.title'), description: t('addAssets.steps.0.description') } },
        { popover: { title: t('addAssets.steps.1.title'), description: t('addAssets.steps.1.description') } },
        { popover: { title: t('addAssets.steps.2.title'), description: t('addAssets.steps.2.description') } },
      ]
    case 'create-new-post':
      return [
        { popover: { title: t('createNewPost.steps.0.title'), description: t('createNewPost.steps.0.description') } },
        { popover: { title: t('createNewPost.steps.1.title'), description: t('createNewPost.steps.1.description') } },
        { popover: { title: t('createNewPost.steps.2.title'), description: t('createNewPost.steps.2.description') } },
      ]
    case 'create-bulk-post':
      return [
        { popover: { title: t('createBulkPost.steps.0.title'), description: t('createBulkPost.steps.0.description') } },
        { popover: { title: t('createBulkPost.steps.1.title'), description: t('createBulkPost.steps.1.description') } },
        { popover: { title: t('createBulkPost.steps.2.title'), description: t('createBulkPost.steps.2.description') } },
      ]
    case 'send-invitation':
      return [
        { popover: { title: t('sendInvitation.steps.0.title'), description: t('sendInvitation.steps.0.description') } },
        { popover: { title: t('sendInvitation.steps.1.title'), description: t('sendInvitation.steps.1.description') } },
        { popover: { title: t('sendInvitation.steps.2.title'), description: t('sendInvitation.steps.2.description') } },
      ]
    case 'connect-multiple-pages':
      return [
        { popover: { title: t('connectMultiplePages.steps.0.title'), description: t('connectMultiplePages.steps.0.description') } },
        { popover: { title: t('connectMultiplePages.steps.1.title'), description: t('connectMultiplePages.steps.1.description') } },
        { popover: { title: t('connectMultiplePages.steps.2.title'), description: t('connectMultiplePages.steps.2.description') } },
      ]
    case 'group-social-media':
      return [
        { popover: { title: t('groupSocialMedia.steps.0.title'), description: t('groupSocialMedia.steps.0.description') } },
        { popover: { title: t('groupSocialMedia.steps.1.title'), description: t('groupSocialMedia.steps.1.description') } },
        { popover: { title: t('groupSocialMedia.steps.2.title'), description: t('groupSocialMedia.steps.2.description') } },
      ]
    case 'create-variables':
      return [
        { popover: { title: t('createVariables.steps.0.title'), description: t('createVariables.steps.0.description') } },
        { popover: { title: t('createVariables.steps.1.title'), description: t('createVariables.steps.1.description') } },
        { popover: { title: t('createVariables.steps.2.title'), description: t('createVariables.steps.2.description') } },
      ]
    case 'create-api-key':
      return [
        { popover: { title: t('createApiKey.steps.0.title'), description: t('createApiKey.steps.0.description') } },
        { popover: { title: t('createApiKey.steps.1.title'), description: t('createApiKey.steps.1.description') } },
        { popover: { title: t('createApiKey.steps.2.title'), description: t('createApiKey.steps.2.description') } },
      ]
    case 'view-calendar':
      return [
        { popover: { title: t('viewCalendar.steps.0.title'), description: t('viewCalendar.steps.0.description') } },
        { popover: { title: t('viewCalendar.steps.1.title'), description: t('viewCalendar.steps.1.description') } },
        { popover: { title: t('viewCalendar.steps.2.title'), description: t('viewCalendar.steps.2.description') } },
      ]
    default:
      return [
        { popover: { title: t('comingSoon.title'), description: t('comingSoon.description') } },
      ]
  }
}

function startTutorial(id: string) {
  showModal.value = false
  const steps = getTutorialSteps(id)
  const driverObj = driver({
    showProgress: true,
    animate: true,
    popoverClass: 'driver-custom-theme',
    overlayColor: 'rgba(200, 220, 130, 0.9)',
    overlayOpacity: 0.5,
    steps,
    onHighlighted(element, _step, { driver }) {
      if (element) {
        const handler = () => {
          element.removeEventListener('click', handler)
          driver.moveNext()
        }
        element.addEventListener('click', handler)
      }
    },
  })
  driverObj.drive()
}
</script>

<template>
  <div class="fixed bottom-6 right-6 z-50">
    <UTooltip :text="t('tooltip')" :popper="{ placement: 'left' }">
      <UButton
        :padded="false"
        color="primary"
        variant="solid"
        class="w-12 h-12 rounded-full shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-105 transition-all duration-200"
        @click="showModal = true"
        aria-label="Open tutorials"
      >
        <UIcon name="i-heroicons-question-mark-circle-16-solid" class="w-6 h-6" />
      </UButton>
    </UTooltip>

    <UModal v-model:open="showModal" :title="t('modalTitle')">
      <template #content>
        <div class="p-4 space-y-1">
          <div
            v-for="tutorial in tutorials"
            :key="tutorial.id"
            class="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-800/50 transition-colors"
            @click="startTutorial(tutorial.id)"
          >
            <div class="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 shrink-0">
              <UIcon :name="tutorial.icon" class="w-5 h-5 text-primary" />
            </div>
            <div class="min-w-0">
              <div class="font-medium text-sm text-foreground">{{ tutorial.label }}</div>
              <div class="text-xs text-muted-foreground truncate">{{ tutorial.description }}</div>
            </div>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
:global(.driver-custom-theme.driver-popover) {
  background-color: hsl(var(--popover)) ;
  color: hsl(var(--popover-foreground)) ;
  border: 1px solid hsl(var(--border)) ;
  border-radius: var(--radius) ;
  padding: 1.25rem ;
  max-width: 320px ;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1) ;
  font-family: 'Inter', 'Geist', system-ui, sans-serif ;
}

:global(.driver-custom-theme .driver-popover-title) {
  font-size: 1rem ;
  font-weight: 600 ;
  line-height: 1.5 ;
  color: hsl(var(--popover-foreground)) ;
  font-family: inherit ;
  margin-bottom: 0.25rem ;
}

:global(.driver-custom-theme .driver-popover-description) {
  font-size: 0.875rem ;
  line-height: 1.5 ;
  color: hsl(var(--muted-foreground)) ;
  font-family: inherit ;
}

:global(.driver-custom-theme .driver-popover-close-btn) {
  font-size: 1.25rem ;
  color: hsl(var(--muted-foreground)) ;
  opacity: 0.7;
  transition: opacity 0.2s;
}

:global(.driver-custom-theme .driver-popover-close-btn:hover) {
  opacity: 1;
}

:global(.driver-custom-theme .driver-popover-progress-text) {
  font-size: 0.75rem ;
  color: hsl(var(--muted-foreground)) ;
  font-family: inherit ;
}

:global(.driver-custom-theme .driver-popover-footer) {
  margin-top: 1rem ;
  display: flex ;
  align-items: center ;
  gap: 0.5rem ;
}

:global(.driver-custom-theme .driver-popover-footer button) {
  all: unset ;
  display: inline-flex ;
  align-items: center ;
  justify-content: center ;
  padding: 0.375rem 0.875rem ;
  font-size: 0.875rem ;
  font-family: inherit ;
  cursor: pointer ;
  transition: opacity 0.2s ;
  text-shadow: none ;
}

:global(.driver-custom-theme .driver-popover-prev-btn) {
  background-color: transparent ;
  color: hsl(var(--popover-foreground)) ;
  border: 1px solid hsl(var(--border)) ;
}

:global(.driver-custom-theme .driver-popover-prev-btn:hover) {
  background-color: hsl(var(--accent)) ;
}

:global(.driver-custom-theme .driver-popover-next-btn) {
  background-color: hsl(var(--primary)) ;
  color: hsl(var(--primary-foreground)) ;
  border: 1px solid transparent ;
  font-weight: 500 ;
  border-radius: 0.5rem ;
}

:global(.driver-custom-theme .driver-popover-next-btn:hover) {
  opacity: 0.9 ;
}

:global(.driver-custom-theme .driver-popover-navigation-btns) {
  display: flex ;
  flex-grow: 1 ;
  justify-content: flex-end ;
  gap: 0.5rem ;
}

:global(.driver-custom-theme .driver-popover-navigation-btns button + button) {
  margin-left: 0 ;
}

:global(.driver-custom-theme .driver-popover-arrow-side-left) {
  border-left-color: hsl(var(--popover)) ;
}

:global(.driver-custom-theme .driver-popover-arrow-side-right) {
  border-right-color: hsl(var(--popover)) ;
}

:global(.driver-custom-theme .driver-popover-arrow-side-top) {
  border-top-color: hsl(var(--popover)) ;
}

:global(.driver-custom-theme .driver-popover-arrow-side-bottom) {
  border-bottom-color: hsl(var(--popover)) ;
}

:global(.driver-overlay) {
  background-color: rgba(0, 0, 0, 0.4) ;
  backdrop-filter: blur(0px);
}
</style>
