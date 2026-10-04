import type { BusinessProfile } from '#layers/BaseDB/db/schema'
import type { PaginatedResponse } from '#layers/BaseDB/server/services/types'
import { useBusinessManager } from '#layers/BaseShared/app/composables/useBusinessManager'
import type { GettingStartedStep } from '#layers/BaseUI/app/components/BaseGettingStarted.vue'

interface SocialAccountSummary {
  id: string
  platform?: string
}

/**
 * Tracks the business-owner setup flow:
 * 1. Business profile created
 * 2. At least one social account connected
 * 3. First post scheduled
 */
export const useGettingStarted = () => {
  const { t } = useI18n()
  const { businesses, activeBusinessId } = useBusinessManager()

  const loading = ref(false)
  const accountsCount = ref(0)
  const postsCount = ref(0)

  const hasBusiness = computed(() => (businesses.value?.data?.length ?? 0) > 0)
  const hasAccount = computed(() => accountsCount.value > 0)
  const hasPost = computed(() => postsCount.value > 0)

  async function fetch() {
    loading.value = true
    try {
      if (!businesses.value?.data?.length) {
        const res = await $fetch<PaginatedResponse<BusinessProfile>>('/api/v1/business')
        businesses.value = res
      }
      if (activeBusinessId.value) {
        const [accounts, posts] = await Promise.all([
          $fetch<SocialAccountSummary[]>('/api/v1/social-accounts'),
          $fetch<{ data: unknown[]; pagination?: { total?: number } }>('/api/v1/posts', {
            query: { businessId: activeBusinessId.value, page: 1, limit: 1 }
          })
        ])
        accountsCount.value = accounts.length
        postsCount.value = posts.pagination?.total ?? posts.data.length
      }
    } catch {
      // non-critical — checklist stays at current known state
    } finally {
      loading.value = false
    }
  }

  const steps = computed<GettingStartedStep[]>(() => [
    {
      key: 'business',
      label: t('getting_started.business.label'),
      description: t('getting_started.business.description'),
      cta: t('getting_started.business.cta'),
      to: '/app/business/initial',
      icon: 'i-lucide-building-2',
      done: hasBusiness.value
    },
    {
      key: 'connect',
      label: t('getting_started.connect.label'),
      description: t('getting_started.connect.description'),
      cta: t('getting_started.connect.cta'),
      to: '/app/integrations',
      icon: 'i-lucide-plug',
      done: hasAccount.value
    },
    {
      key: 'post',
      label: t('getting_started.post.label'),
      description: t('getting_started.post.description'),
      cta: t('getting_started.post.cta'),
      to: '/app/posts/new',
      icon: 'i-lucide-calendar-plus',
      done: hasPost.value
    }
  ])

  const complete = computed(() => steps.value.every(s => s.done))

  return {
    steps,
    complete,
    loading,
    activeBusinessId,
    fetch
  }
}
