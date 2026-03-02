/**
 *
 * Component Description: Composable managing all reactive state for the content pipeline (Create) page
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.3
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */

export type HookVariation = {
  id: string
  name: string
  template: string
  usage: string
  successRate: number
}

export type HookHealthResult = {
  overallScore: number
  metrics: {
    hookStrength: number
    relevance: number
    retention: number
  }
  feedback: string
  adjustments: string[]
  improvedScript: string
  alternativeVersions: {
    hookName: string
    predictedRetention: number
    script: string
    reasoning: string
  }[]
}

export const useContentPipeline = () => {
  const { t, tm, rt } = useI18n()

  const initialHooks = computed<HookVariation[]>(() => {
    const rawHooks = tm('defaults.hooks') as any[]
    return rawHooks.map((h: any) => ({
      id: h.id,
      name: rt(h.name),
      template: rt(h.template),
      usage: h.usage,
      successRate: h.successRate
    }))
  })

  const ideas = ref('')
  const topic = ref('')
  const hooks = ref<HookVariation[]>([])
  const selectedHook = ref<HookVariation>({ id: '', name: '', template: '', usage: '', successRate: 0 })
  const scriptContent = ref('')

  onMounted(() => {
    hooks.value = [...initialHooks.value]
    if (hooks.value.length > 0) {
      selectedHook.value = { ...hooks.value[0] }
    }
  })

  const isAddingHook = ref(false)
  const newHook = reactive({ name: '', template: '' })

  const hookHealth = ref<HookHealthResult | null>(null)
  const isCheckingHealth = ref(false)

  const aspectRatio = ref<'16:9' | '9:16' | '1:1'>('16:9')
  const isFocusMode = ref(false)
  const isCameraActive = ref(false)
  const isRecording = ref(false)
  const previewUrl = ref<string | null>(null)
  const timer = ref(0)
  const currentWordIndex = ref(0)
  const isAutoScroll = ref(false)
  const speedMultiplier = ref(1.0)

  const editChecklist = reactive({
    hookEngaging: false,
    valueDelivered: false,
    clearCta: false,
  })

  const videoUrl = ref('')

  const words = computed(() =>
    scriptContent.value.split(/\s+/).filter((w: string) => w.trim() !== '')
  )

  const WORDS_PER_LINE = 8
  const lines = computed(() => {
    const result: string[][] = []
    for (let i = 0; i < words.value.length; i += WORDS_PER_LINE) {
      result.push(words.value.slice(i, i + WORDS_PER_LINE))
    }
    return result
  })

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const handleHookSelect = (hook: HookVariation) => {
    selectedHook.value = hook
    if (!scriptContent.value.trim()) {
      scriptContent.value = hook.template + '\n\n'
    } else {
      const oldHook = hooks.value.find((h: HookVariation) => scriptContent.value.startsWith(h.template))
      if (oldHook) {
        scriptContent.value = scriptContent.value.replace(oldHook.template, hook.template)
      } else {
        scriptContent.value = hook.template + '\n\n' + scriptContent.value
      }
    }
  }

  const handleAddCustomHook = () => {
    if (!newHook.name || !newHook.template) return
    const added: HookVariation = {
      id: Date.now().toString(),
      name: newHook.name,
      template: newHook.template,
      usage: '0',
      successRate: 0,
    }
    hooks.value.push(added)
    selectedHook.value = added
    isAddingHook.value = false
    newHook.name = ''
    newHook.template = ''
    handleHookSelect(added)
  }

  const acceptImprovedScript = (script: string) => {
    scriptContent.value = script
    hookHealth.value = null
  }

  return {
    ideas,
    topic,
    hooks,
    selectedHook,
    scriptContent,
    isAddingHook,
    newHook,
    hookHealth,
    isCheckingHealth,
    aspectRatio,
    isFocusMode,
    isCameraActive,
    isRecording,
    previewUrl,
    timer,
    currentWordIndex,
    isAutoScroll,
    speedMultiplier,
    editChecklist,
    videoUrl,
    words,
    lines,
    WORDS_PER_LINE,
    formatTime,
    handleHookSelect,
    handleAddCustomHook,
    acceptImprovedScript,
  }
}
