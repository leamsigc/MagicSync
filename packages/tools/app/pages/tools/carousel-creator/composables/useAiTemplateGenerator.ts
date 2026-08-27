import type { DeckTemplate } from '../deckTemplates'
import { useCarouselDeck, type AiDeckTemplate } from './useCarouselDeck'

export function useAiTemplateGenerator() {
  const { t, locale } = useI18n()
  const toast = useToast()
  const { loggedIn, fetchSession } = UseUser()
  const { addCustomDeckTemplate, applyDeckTemplate, customDecks } = useCarouselDeck()

  const prompt = ref('')
  const slideCount = ref(5)
  const generating = ref(false)
  const error = ref('')
  const generated = ref<AiDeckTemplate | null>(null)

  const canGenerate = computed(() => prompt.value.trim().length >= 5 && !generating.value)

  function reset(): void {
    prompt.value = ''
    slideCount.value = 5
    generating.value = false
    error.value = ''
    generated.value = null
  }

  function dismiss(): void {
    error.value = ''
    generated.value = null
  }

  function applyGenerated(): void {
    if (!generated.value) return
    applyDeckTemplate(generated.value.key)
    toast.add({
      title: t('templates.applied'),
      description: t('templates.appliedDesc', { title: generated.value.title }),
      color: 'success',
    })
    reset()
  }

  async function generate(): Promise<void> {
    const value = prompt.value.trim()
    if (!value || generating.value) return
    if (!loggedIn.value) await fetchSession()
    if (!loggedIn.value) {
      error.value = t('toasts.loginRequired')
      toast.add({
        title: t('toasts.loginRequired'),
        color: 'warning',
        actions: [{ label: t('login'), to: '/login', color: 'primary' }],
      })
      return
    }

    generating.value = true
    error.value = ''
    try {
      const result = await $fetch<DeckTemplate>('/api/v1/ai/carousel-template', {
        method: 'POST',
        body: {
          prompt: value.slice(0, 600),
          slideCount: slideCount.value,
          language: locale.value,
        },
      })
      addCustomDeckTemplate(result)
      const newest = customDecks.value[0]
      if (!newest) throw new Error('Generated template missing')
      generated.value = newest
      prompt.value = ''
    } catch (err: unknown) {
      const shape = err as { status?: number, statusCode?: number, data?: { message?: string } }
      const status = shape?.status ?? shape?.statusCode
      if (status === 401 || status === 403) {
        error.value = t('toasts.loginRequired')
        toast.add({
          title: t('toasts.loginRequired'),
          color: 'warning',
          actions: [{ label: t('login'), to: '/login', color: 'primary' }],
        })
      } else {
        error.value = shape?.data?.message ?? t('aiTemplate.errorTitle')
        toast.add({
          title: t('aiTemplate.errorTitle'),
          description: shape?.data?.message,
          color: 'error',
        })
      }
    } finally {
      generating.value = false
    }
  }

  return {
    prompt,
    slideCount,
    generating,
    error,
    generated,
    canGenerate,
    generate,
    applyGenerated,
    reset,
    dismiss,
  }
}