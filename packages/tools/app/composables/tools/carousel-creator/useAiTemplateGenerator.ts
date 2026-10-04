import type { DeckTemplate, DeckSlideSpec } from '#layers/BaseUI/app/utils/deckTemplates'
import { useCarouselDeck, type AiDeckTemplate } from '#layers/BaseUI/app/utils/composables/useCarouselDeck'

interface ApiSlide {
  template?: string
  templateKey?: string
  html?: string
  kicker?: string
  headline?: string
  body?: string
  items?: string[]
  quote?: string
  author?: string
  stat?: string
  statLabel?: string
  cta?: string
  footer?: string
}

interface ApiResponse {
  key: string
  title: string
  description: string
  palette: { bg: string; text: string; accent: string; font?: string }
  pattern?: string
  slides: ApiSlide[]
}

function resolveTemplateKey(slide: ApiSlide): string {
  return slide.templateKey ?? slide.template ?? 'big-statement'
}

function mapSlideData(slide: ApiSlide): DeckSlideSpec['data'] {
  return {
    kicker: slide.kicker,
    headline: slide.headline ?? '',
    body: slide.body,
    items: slide.items,
    quote: slide.quote,
    author: slide.author,
    stat: slide.stat,
    statLabel: slide.statLabel,
    cta: slide.cta,
    footer: slide.footer,
  }
}

function transformApiToDeckTemplate(api: ApiResponse, format: 'html' | 'structured'): DeckTemplate {
  return {
    key: api.key,
    title: api.title,
    description: api.description,
    palette: api.palette,
    pattern: api.pattern,
    slides: (api.slides ?? []).map(s => ({
      templateKey: resolveTemplateKey(s),
      data: mapSlideData(s),
      html: format === 'html' ? (s.html?.trim() || undefined) : undefined,
    })),
  }
}

function isAuthError(err: unknown): boolean {
  const shape = err as { status?: number; statusCode?: number }
  const status = shape?.status ?? shape?.statusCode
  return status === 401 || status === 403
}

function getErrorMessage(err: unknown): string {
  const shape = err as { data?: { message?: string } }
  return shape?.data?.message ?? ''
}

export function useAiTemplateGenerator() {
  const { t, locale } = useI18n()
  const toast = useToast()
  const { loggedIn, fetchSession } = UseUser()
  const { addCustomDeckTemplate, applyDeckTemplate, customDecks } = useCarouselDeck()

  const prompt = ref('')
  const slideCount = ref(5)
  const format = ref<'html' | 'structured'>('html')
  const generating = ref(false)
  const error = ref('')
  const generated = ref<AiDeckTemplate | null>(null)

  const canGenerate = computed(() => prompt.value.trim().length >= 5 && !generating.value)

  function reset(): void {
    prompt.value = ''
    slideCount.value = 5
    format.value = 'html'
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

  async function ensureLoggedIn(): Promise<boolean> {
    if (loggedIn.value) return true
    await fetchSession()
    if (loggedIn.value) return true
    error.value = t('toasts.loginRequired')
    toast.add({
      title: t('toasts.loginRequired'),
      color: 'warning',
      actions: [{ label: t('login'), to: '/login', color: 'primary' }],
    })
    return false
  }

  async function generate(): Promise<void> {
    const value = prompt.value.trim()
    if (!value || generating.value) return
    if (!await ensureLoggedIn()) return

    generating.value = true
    error.value = ''
    try {
      const rawResult = await $fetch<ApiResponse>('/api/v1/ai/carousel-template', {
        method: 'POST',
        body: {
          prompt: value.slice(0, 600),
          slideCount: slideCount.value,
          language: locale.value,
          format: format.value,
        },
      })
      const result = transformApiToDeckTemplate(rawResult, format.value)
      addCustomDeckTemplate(result)
      const newest = customDecks.value[0]
      if (!newest) throw new Error('Generated template missing')
      generated.value = newest
      prompt.value = ''
    } catch (err: unknown) {
      handleGenerateError(err)
    } finally {
      generating.value = false
    }
  }

  function handleGenerateError(err: unknown): void {
    if (isAuthError(err)) {
      error.value = t('toasts.loginRequired')
      toast.add({
        title: t('toasts.loginRequired'),
        color: 'warning',
        actions: [{ label: t('login'), to: '/login', color: 'primary' }],
      })
      return
    }
    const message = getErrorMessage(err)
    error.value = message || t('aiTemplate.errorTitle')
    toast.add({
      title: t('aiTemplate.errorTitle'),
      description: message || undefined,
      color: 'error',
    })
  }

  return {
    prompt,
    slideCount,
    format,
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