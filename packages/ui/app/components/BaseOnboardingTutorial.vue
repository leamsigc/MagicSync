<i18n src="./BaseOnboardingTutorial.json"></i18n>
<script lang="ts" setup>
/**
 * Component Description: Onboarding tutorial button with driver.js guided tours.
 * Route-aware: highlights the tutorial matching the current page and supports
 * every major app route.
 *
 * Key features:
 * - Each tutorial has element selectors (data-tour) pointing to specific UI triggers
 * - Tutorials are route-gated: you must be on the matching page to start a tutorial
 * - The modal highlights the current page's tutorial and shows others as "navigate first"
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.2.0
 */
import { driver, type DriveStep } from "driver.js"
import "driver.js/dist/driver.css"

const showModal = ref(false)
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()

// ── Tutorial definitions ──────────────────────────────────────────────

interface TutorialDefinition {
  id: string
  icon: string
  routePatterns: string[]
  stepCount: number
  /** CSS selectors for driver.js to highlight. Use `data-tour="tutorial-id-step-N"` convention.
   *  `undefined` means no highlight — driver.js centers the tooltip on screen. */
  elements?: (string | undefined)[]
}

const tutorialDefinitions: TutorialDefinition[] = [
  {
    id: 'first-time',
    icon: 'i-heroicons-rocket-launch',
    routePatterns: ['/app/home'],
    stepCount: 6,
    elements: [
      '[data-test=add-business-button]',
      '[data-test=step-zero]',
      '[data-test=step-zero-follow-twitter]',
      '[data-test=step-zero-skip]',
      '[data-test=step-one]',
      undefined,
    ],
  },
  {
    id: 'create-business',
    icon: 'i-heroicons-building-office-2',
    routePatterns: ['/app/business'],
    stepCount: 3,
    elements: [
      '[data-tour="create-business-step-0"]',
      '[data-tour="create-business-step-1"]',
      '[data-tour="create-business-step-2"]',
    ],
  },
  {
    id: 'connect-social-media',
    icon: 'i-heroicons-share',
    routePatterns: ['/app/integrations'],
    stepCount: 3,
    elements: [
      '[data-tour="connect-social-media-step-0"]',
      '[data-tour="connect-social-media-step-1"]',
      '[data-tour="connect-social-media-step-2"]',
    ],
  },
  {
    id: 'add-assets',
    icon: 'i-heroicons-photo',
    routePatterns: ['/app/media'],
    stepCount: 3,
    elements: [
      '[data-tour="add-assets-step-0"]',
      '[data-tour="add-assets-step-1"]',
      '[data-tour="add-assets-step-2"]',
    ],
  },  { id: 'create-new-post', icon: 'i-heroicons-document-plus', routePatterns: ['/app/posts/new'], stepCount: 3,
    elements: [
      '[data-tour="create-new-post-step-0"]',
      '[data-tour="create-new-post-step-1"]',
      '[data-tour="create-new-post-step-2"]',
    ],
  },
  {
    id: 'create-bulk-post',
    icon: 'i-heroicons-document-duplicate',
    routePatterns: ['/app/bulk-scheduler'],
    stepCount: 3,
    elements: [
      '[data-tour="create-bulk-post-step-0"]',
      '[data-tour="create-bulk-post-step-1"]',
      '[data-tour="create-bulk-post-step-2"]',
    ],
  },
  {
    id: 'send-invitation',
    icon: 'i-heroicons-envelope',
    routePatterns: ['/app/business/'],
    stepCount: 3,
    elements: [
      '[data-tour="send-invitation-step-0"]',
      '[data-tour="send-invitation-step-1"]',
      '[data-tour="send-invitation-step-2"]',
    ],
  },
  {
    id: 'connect-multiple-pages',
    icon: 'i-heroicons-link',
    routePatterns: ['/app/integrations/active'],
    stepCount: 3,
    elements: [
      '[data-tour="connect-multiple-pages-step-0"]',
      '[data-tour="connect-multiple-pages-step-1"]',
      '[data-tour="connect-multiple-pages-step-2"]',
    ],
  },
  {
    id: 'group-social-media',
    icon: 'i-heroicons-rectangle-group',
    routePatterns: ['/app/integrations'],
    stepCount: 3,
    elements: [
      '[data-tour="group-social-media-step-0"]',
      '[data-tour="group-social-media-step-1"]',
      '[data-tour="group-social-media-step-2"]',
    ],
  },
  {
    id: 'create-variables',
    icon: 'i-heroicons-variable',
    routePatterns: ['/app/templates/variables'],
    stepCount: 3,
    elements: [
      '[data-tour="create-variables-step-0"]',
      '[data-tour="create-variables-step-1"]',
      '[data-tour="create-variables-step-2"]',
    ],
  },
  {
    id: 'create-api-key',
    icon: 'i-heroicons-key',
    routePatterns: ['/app/keys'],
    stepCount: 3,
    elements: [
      '[data-tour="create-api-key-step-0"]',
      '[data-tour="create-api-key-step-1"]',
      '[data-tour="create-api-key-step-2"]',
    ],
  },
  {
    id: 'view-calendar',
    icon: 'i-heroicons-calendar-days',
    routePatterns: ['/app/calendar'],
    stepCount: 3,
    elements: [
      '[data-tour="view-calendar-step-0"]',
      '[data-tour="view-calendar-step-1"]',
      '[data-tour="view-calendar-step-2"]',
    ],
  },
  {
    id: 'posts',
    icon: 'i-heroicons-newspaper',
    routePatterns: ['/app/posts'],
    stepCount: 3,
    elements: [
      '[data-tour="posts-step-0"]',
      '[data-tour="posts-step-1"]',
      '[data-tour="posts-step-2"]',
    ],
  },
  {
    id: 'feeds',
    icon: 'i-heroicons-rss',
    routePatterns: ['/app/posts/feeds'],
    stepCount: 3,
    elements: [
      '[data-tour="feeds-step-0"]',
      '[data-tour="feeds-step-1"]',
      '[data-tour="feeds-step-2"]',
    ],
  },
  {
    id: 'post-video',
    icon: 'i-heroicons-video-camera',
    routePatterns: ['/app/post/video'],
    stepCount: 3,
    elements: [
      '[data-tour="post-video-step-0"]',
      '[data-tour="post-video-step-1"]',
      '[data-tour="post-video-step-2"]',
    ],
  },
  {
    id: 'templates',
    icon: 'i-heroicons-clipboard-document-list',
    routePatterns: ['/app/templates'],
    stepCount: 3,
    elements: [
      '[data-tour="templates-step-0"]',
      '[data-tour="templates-step-1"]',
      '[data-tour="templates-step-2"]',
    ],
  },
  {
    id: 'template-email',
    icon: 'i-heroicons-envelope-open',
    routePatterns: ['/app/templates/email'],
    stepCount: 3,
    elements: [
      '[data-tour="template-email-step-0"]',
      '[data-tour="template-email-step-1"]',
      '[data-tour="template-email-step-2"]',
    ],
  },
  {
    id: 'template-images',
    icon: 'i-heroicons-photo',
    routePatterns: ['/app/templates/images'],
    stepCount: 3,
    elements: [
      '[data-tour="template-images-step-0"]',
      '[data-tour="template-images-step-1"]',
      '[data-tour="template-images-step-2"]',
    ],
  },
  {
    id: 'template-chat',
    icon: 'i-heroicons-chat-bubble-left-right',
    routePatterns: ['/app/templates/chat'],
    stepCount: 3,
    elements: [
      '[data-tour="template-chat-step-0"]',
      '[data-tour="template-chat-step-1"]',
      '[data-tour="template-chat-step-2"]',
    ],
  },
  {
    id: 'ai-tools',
    icon: 'i-heroicons-sparkles',
    routePatterns: ['/app/ai-tools'],
    stepCount: 3,
    elements: [
      '[data-tour="ai-tools-step-0"]',
      '[data-tour="ai-tools-step-1"]',
      '[data-tour="ai-tools-step-2"]',
    ],
  },
  {
    id: 'ai-chat',
    icon: 'i-heroicons-chat-bubble-oval-left-ellipsis',
    routePatterns: ['/app/ai-tools/chat'],
    stepCount: 3,
    elements: [
      '[data-tour="ai-chat-step-0"]',
      '[data-tour="ai-chat-step-1"]',
      '[data-tour="ai-chat-step-2"]',
    ],
  },
  {
    id: 'ai-knowledge',
    icon: 'i-heroicons-book-open',
    routePatterns: ['/app/ai-tools/knowledge'],
    stepCount: 3,
    elements: [
      '[data-tour="ai-knowledge-step-0"]',
      '[data-tour="ai-knowledge-step-1"]',
      '[data-tour="ai-knowledge-step-2"]',
    ],
  },
  {
    id: 'ai-skills',
    icon: 'i-heroicons-bolt',
    routePatterns: ['/app/ai-tools/skills'],
    stepCount: 3,
    elements: [
      '[data-tour="ai-skills-step-0"]',
      '[data-tour="ai-skills-step-1"]',
      '[data-tour="ai-skills-step-2"]',
    ],
  },
  {
    id: 'ai-assets',
    icon: 'i-heroicons-folder',
    routePatterns: ['/app/ai-tools/assets'],
    stepCount: 3,
    elements: [
      '[data-tour="ai-assets-step-0"]',
      '[data-tour="ai-assets-step-1"]',
      '[data-tour="ai-assets-step-2"]',
    ],
  },
  {
    id: 'tools',
    icon: 'i-heroicons-wrench-screwdriver',
    routePatterns: ['/app/tools'],
    stepCount: 3,
    elements: [
      '[data-tour="tools-step-0"]',
      '[data-tour="tools-step-1"]',
      '[data-tour="tools-step-2"]',
    ],
  },
  {
    id: 'video-cropper',
    icon: 'i-heroicons-scissors',
    routePatterns: ['/app/tools/video-cropper'],
    stepCount: 3,
    elements: [
      '[data-tour="video-cropper-step-0"]',
      '[data-tour="video-cropper-step-1"]',
      '[data-tour="video-cropper-step-2"]',
    ],
  },
  {
    id: 'text-to-speech',
    icon: 'i-heroicons-speaker-wave',
    routePatterns: ['/app/tools/text-to-speech'],
    stepCount: 3,
    elements: [
      '[data-tour="text-to-speech-step-0"]',
      '[data-tour="text-to-speech-step-1"]',
      '[data-tour="text-to-speech-step-2"]',
    ],
  },
  {
    id: 'growth-strategy',
    icon: 'i-heroicons-chart-bar',
    routePatterns: ['/app/tools/growth-stratergy'],
    stepCount: 3,
    elements: [
      '[data-tour="growth-strategy-step-0"]',
      '[data-tour="growth-strategy-step-1"]',
      '[data-tour="growth-strategy-step-2"]',
    ],
  },
  {
    id: 'content-split',
    icon: 'i-heroicons-document-text',
    routePatterns: ['/app/tools/content-split'],
    stepCount: 3,
    elements: [
      '[data-tour="content-split-step-0"]',
      '[data-tour="content-split-step-1"]',
      '[data-tour="content-split-step-2"]',
    ],
  },
  {
    id: 'profile',
    icon: 'i-heroicons-user',
    routePatterns: ['/app/profile'],
    stepCount: 3,
    elements: [
      '[data-tour="profile-step-0"]',
      '[data-tour="profile-step-1"]',
      '[data-tour="profile-step-2"]',
    ],
  },
  {
    id: 'account',
    icon: 'i-heroicons-user-circle',
    routePatterns: ['/app/account'],
    stepCount: 3,
    elements: [
      '[data-tour="account-step-0"]',
      '[data-tour="account-step-1"]',
      '[data-tour="account-step-2"]',
    ],
  },
  {
    id: 'notifications',
    icon: 'i-heroicons-bell',
    routePatterns: ['/app/notifications'],
    stepCount: 3,
    elements: [
      '[data-tour="notifications-step-0"]',
      '[data-tour="notifications-step-1"]',
      '[data-tour="notifications-step-2"]',
    ],
  },
  {
    id: 'admin',
    icon: 'i-heroicons-shield-check',
    routePatterns: ['/app/admin'],
    stepCount: 3,
    elements: [
      '[data-tour="admin-step-0"]',
      '[data-tour="admin-step-1"]',
      '[data-tour="admin-step-2"]',
    ],
  },
]

// ── Helpers ───────────────────────────────────────────────────────────

function kebabToCamelCase(value: string): string {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
}

// ── Computed state ────────────────────────────────────────────────────

interface Tutorial {
  id: string
  label: string
  icon: string
  description: string
  routePatterns: string[]
  stepCount: number
  elements?: (string | undefined)[]
}

const tutorials = computed<Tutorial[]>(() => {
  return tutorialDefinitions.map((def) => {
    const key = kebabToCamelCase(def.id)
    return {
      id: def.id,
      label: t(`${key}.label`),
      icon: def.icon,
      description: t(`${key}.description`),
      routePatterns: def.routePatterns,
      stepCount: def.stepCount,
      elements: def.elements,
    }
  })
})

/** Whether a tutorial's route matches the current page. */
function tutorialMatchesRoute(tutorial: Tutorial): boolean {
  return tutorial.routePatterns.some((pattern) => route.path.startsWith(pattern))
}

/**
 * The tutorial that best matches the current route.
 * Prefers the most specific (longest) pattern match; uses definition order as tie-breaker.
 */
const currentRouteTutorial = computed<Tutorial | undefined>(() => {
  const path = route.path
  const matches = tutorials.value.filter((tutorial) =>
    tutorial.routePatterns.some((pattern) => path.startsWith(pattern)),
  )
  return matches.sort((a, b) => {
    const aMax = Math.max(...a.routePatterns.map((p) => p.length))
    const bMax = Math.max(...b.routePatterns.map((p) => p.length))
    if (bMax !== aMax) return bMax - aMax
    return tutorialDefinitions.findIndex((d) => d.id === a.id) - tutorialDefinitions.findIndex((d) => d.id === b.id)
  })[0]
})

/** All tutorials except the one matching the current route. */
const otherTutorials = computed<Tutorial[]>(() => {
  return tutorials.value.filter((tutorial) => tutorial.id !== currentRouteTutorial.value?.id)
})

// ── Tutorial step generation ──────────────────────────────────────────

function getTutorialSteps(id: string): DriveStep[] {
  const def = tutorialDefinitions.find((item) => item.id === id)
  if (!def) {
    return [
      { popover: { title: t('comingSoon.title'), description: t('comingSoon.description') } },
    ]
  }

  const key = kebabToCamelCase(def.id)
  return Array.from({ length: def.stepCount }, (_, index) => {
    const element = def.elements?.[index]
    const step: DriveStep = {
      popover: {
        title: t(`${key}.steps.${index}.title`),
        description: t(`${key}.steps.${index}.description`),
      },
    }
    if (element) {
      step.element = element
    }
    return step
  })
}

// ── Tutorial launch ───────────────────────────────────────────────────

const driverInstance = ref<any>(null)

function startTutorial(id: string) {
  const def = tutorialDefinitions.find((item) => item.id === id)
  if (!def) return

  // Route gate: refuse to start a tutorial if the user is not on its target page
  if (!tutorialMatchesRoute(def)) {
    toast.add({
      title: t('routeWarning.title'),
      description: t('routeWarning.description', { route: def.routePatterns[0] }),
      color: 'warning',
      icon: 'i-heroicons-exclamation-triangle',
      duration: 5000,
    })
    return
  }  showModal.value = false

  // Destroy any existing tour before starting a new one
  if (driverInstance.value) {
    driverInstance.value.destroy()
    driverInstance.value = null
  }

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
  driverInstance.value = driverObj
  driverObj.drive()
}

function openTutorialModal() {
  showModal.value = true
}

/** Navigate to the tutorial's first route pattern, then start the tutorial. */
function navigateAndStart(tutorial: Tutorial) {
  showModal.value = false
  const targetRoute = tutorial.routePatterns[0]

  // Only navigate if we're not already on the target route
  if (!tutorialMatchesRoute(tutorial)) {
    const unwatch = watch(
      () => route.path,
      (newPath) => {
        if (tutorial.routePatterns.some((p) => newPath.startsWith(p))) {
          unwatch()
          // Wait for the DOM to settle after navigation
          nextTick(() => {
            setTimeout(() => startTutorial(tutorial.id), 300)
          })
        }
      },
    )
    router.push(targetRoute).catch(() => {
      // Navigation failed or was cancelled — clean up the watcher
      unwatch()
    })
  } else {
    startTutorial(tutorial.id)
  }
}
</script>

<template>
  <div class="fixed bottom-6 right-6 z-50" v-if="currentRouteTutorial">
    <UTooltip :text="t('tooltip')" :popper="{ placement: 'left' }">
      <UButton
        :padded="false"
        color="primary"
        variant="solid"
        class="w-12 h-12 rounded-full shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-105 transition-all duration-200"
        @click="openTutorialModal"
        aria-label="Open tutorials"
      >
        <UIcon name="i-heroicons-question-mark-circle-16-solid" class="w-6 h-6" />
      </UButton>
    </UTooltip>

    <UModal v-model:open="showModal" :title="t('modalTitle')">
      <template #content>
        <div class="p-4 space-y-1 max-h-[70vh] overflow-y-auto">
          <!-- Current page tutorial — highlighted, one-click start -->
          <div v-if="currentRouteTutorial" class="mb-4">
            <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {{ t('currentPage') }}
            </div>
            <div
              class="flex items-center gap-3 p-3 rounded-lg cursor-pointer bg-primary/10 hover:bg-primary/20 transition-colors border border-primary/20"
              @click="startTutorial(currentRouteTutorial.id)"
            >
              <div class="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/20 shrink-0">
                <UIcon :name="currentRouteTutorial.icon" class="w-5 h-5 text-primary" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="font-medium text-sm text-foreground">{{ currentRouteTutorial.label }}</div>
                <div class="text-xs text-muted-foreground truncate">{{ currentRouteTutorial.description }}</div>
              </div>
              <UIcon name="i-heroicons-play-circle" class="w-5 h-5 text-primary shrink-0" />
            </div>
          </div>

          <!-- No tutorial for this page -->
          <div v-else class="mb-4 p-4 rounded-lg bg-muted/50 border border-dashed">
            <div class="flex items-center gap-2 text-sm text-muted-foreground">
              <UIcon name="i-heroicons-information-circle" class="w-4 h-4 shrink-0" />
              <span>{{ t('noTutorialForPage') }}</span>
            </div>
          </div>

          <!-- All other tutorials -->
          <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 pt-2 border-t">
            {{ t('allTutorials') }}
          </div>

          <div
            v-for="tutorial in otherTutorials"
            :key="tutorial.id"
            class="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors group"
            :class="tutorialMatchesRoute(tutorial)
              ? 'hover:bg-gray-100 dark:hover:bg-zinc-800/50'
              : 'opacity-60 hover:opacity-80 hover:bg-gray-50 dark:hover:bg-zinc-800/30'"
            @click="tutorialMatchesRoute(tutorial) ? startTutorial(tutorial.id) : navigateAndStart(tutorial)"
          >
            <div
              class="flex items-center justify-center w-9 h-9 rounded-lg shrink-0 transition-colors"
              :class="tutorialMatchesRoute(tutorial) ? 'bg-primary/10' : 'bg-gray-100 dark:bg-zinc-800'"
            >
              <UIcon
                :name="tutorial.icon"
                class="w-5 h-5"
                :class="tutorialMatchesRoute(tutorial) ? 'text-primary' : 'text-muted-foreground'"
              />
            </div>
            <div class="min-w-0 flex-1">
              <div class="font-medium text-sm text-foreground">{{ tutorial.label }}</div>
              <div class="text-xs text-muted-foreground truncate">{{ tutorial.description }}</div>
            </div>
            <!-- Action icon: play on current route, navigate arrow for others -->
            <UIcon
              v-if="tutorialMatchesRoute(tutorial)"
              name="i-heroicons-play"
              class="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            />
            <UIcon
              v-else
              name="i-heroicons-arrow-right-circle"
              class="w-4 h-4 text-muted-foreground shrink-0"
            />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
:global(.driver-custom-theme.driver-popover) {
  background-color: hsl(var(--popover));
  color: hsl(var(--popover-foreground));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  padding: 1.25rem;
  max-width: 320px;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  font-family: 'Inter', 'Geist', system-ui, sans-serif;
}

:global(.driver-custom-theme .driver-popover-title) {
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.5;
  color: hsl(var(--popover-foreground));
  font-family: inherit;
  margin-bottom: 0.25rem;
}

:global(.driver-custom-theme .driver-popover-description) {
  font-size: 0.875rem;
  line-height: 1.5;
  color: hsl(var(--muted-foreground));
  font-family: inherit;
}

:global(.driver-custom-theme .driver-popover-close-btn) {
  font-size: 1.25rem;
  color: hsl(var(--muted-foreground));
  opacity: 0.7;
  transition: opacity 0.2s;
}

:global(.driver-custom-theme .driver-popover-close-btn:hover) {
  opacity: 1;
}

:global(.driver-custom-theme .driver-popover-progress-text) {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  font-family: inherit;
}

:global(.driver-custom-theme .driver-popover-footer) {
  margin-top: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

:global(.driver-custom-theme .driver-popover-footer button) {
  all: unset;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.375rem 0.875rem;
  font-size: 0.875rem;
  font-family: inherit;
  cursor: pointer;
  transition: opacity 0.2s;
  text-shadow: none;
}

:global(.driver-custom-theme .driver-popover-prev-btn) {
  background-color: transparent;
  color: hsl(var(--popover-foreground));
  border: 1px solid hsl(var(--border));
}

:global(.driver-custom-theme .driver-popover-prev-btn:hover) {
  background-color: hsl(var(--accent));
}

:global(.driver-custom-theme .driver-popover-next-btn) {
  background-color: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border: 1px solid transparent;
  font-weight: 500;
  border-radius: 0.5rem;
}

:global(.driver-custom-theme .driver-popover-next-btn:hover) {
  opacity: 0.9;
}

:global(.driver-custom-theme .driver-popover-navigation-btns) {
  display: flex;
  flex-grow: 1;
  justify-content: flex-end;
  gap: 0.5rem;
}

:global(.driver-custom-theme .driver-popover-navigation-btns button + button) {
  margin-left: 0;
}

:global(.driver-custom-theme .driver-popover-arrow-side-left) {
  border-left-color: hsl(var(--popover));
}

:global(.driver-custom-theme .driver-popover-arrow-side-right) {
  border-right-color: hsl(var(--popover));
}

:global(.driver-custom-theme .driver-popover-arrow-side-top) {
  border-top-color: hsl(var(--popover));
}

:global(.driver-custom-theme .driver-popover-arrow-side-bottom) {
  border-bottom-color: hsl(var(--popover));
}

:global(.driver-overlay) {
  background-color: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(0px);
}
</style>
