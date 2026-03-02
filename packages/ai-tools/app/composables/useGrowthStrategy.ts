/**
 *
 * Component Description: Composable for managing growth strategy action plan state with localStorage persistence
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.3
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */

const STORAGE_KEY = 'growth-strategy-action-plan'

export const useGrowthStrategy = () => {
  const { t } = useI18n()

  const defaultPlans = computed(() => ({
    day7: t('defaults.day7'),
    day30: t('defaults.day30'),
    day90: t('defaults.day90'),
  }))

  const actionPlan = reactive({
    day7: '',
    day30: '',
    day90: '',
  })

  const editingSection = ref<'day7' | 'day30' | 'day90' | null>(null)
  const editBuffer = ref('')
  const selectedTopic = ref('')

  const loadFromStorage = () => {
    if (import.meta.client) {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          Object.assign(actionPlan, parsed)
          return
        } catch { }
      }
    }
    Object.assign(actionPlan, defaultPlans.value)
  }

  const saveToStorage = () => {
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(actionPlan))
    }
  }

  const startEditing = (section: 'day7' | 'day30' | 'day90') => {
    editingSection.value = section
    editBuffer.value = actionPlan[section]
  }

  const saveEditing = () => {
    if (!editingSection.value) return
    actionPlan[editingSection.value] = editBuffer.value
    saveToStorage()
    editingSection.value = null
    editBuffer.value = ''
  }

  const cancelEditing = () => {
    editingSection.value = null
    editBuffer.value = ''
  }

  const resetSection = (section: 'day7' | 'day30' | 'day90') => {
    actionPlan[section] = defaultPlans.value[section]
    saveToStorage()
  }

  onMounted(() => {
    loadFromStorage()
  })

  return {
    actionPlan,
    editingSection,
    editBuffer,
    selectedTopic,
    startEditing,
    saveEditing,
    cancelEditing,
    resetSection,
  }
}
