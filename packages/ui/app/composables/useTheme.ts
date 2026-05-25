export type ThemeId = 'orange' | 'ocean' | 'forest' | 'midnight' | 'rose'

export interface ThemeOption {
  id: ThemeId
  label: string
  icon: string
  color: string
}

export const THEMES: ThemeOption[] = [
  { id: 'orange', label: 'Orange', icon: 'i-lucide-sun', color: '#f97316' },
  { id: 'ocean', label: 'Ocean', icon: 'i-lucide-droplets', color: '#3b82f6' },
  { id: 'forest', label: 'Forest', icon: 'i-lucide-leaf', color: '#22c55e' },
  { id: 'midnight', label: 'Midnight', icon: 'i-lucide-moon-star', color: '#8b5cf6' },
  { id: 'rose', label: 'Rose', icon: 'i-lucide-flower-2', color: '#e11d48' },
]

const STORAGE_KEY = 'magicsync-theme'

export const useTheme = () => {
  const colorMode = useColorMode()
  const theme = ref<ThemeId>('orange')

  function applyTheme(value: ThemeId) {
    theme.value = value
    if (import.meta.client) {
      document.documentElement.setAttribute('data-theme', value)
    }
  }

  function setTheme(value: ThemeId) {
    applyTheme(value)
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY, value)
    }
  }

  function initTheme() {
    if (import.meta.client) {
      const saved = localStorage.getItem(STORAGE_KEY) as ThemeId | null
      const valid = saved && THEMES.some(t => t.id === saved) ? saved : 'orange'
      applyTheme(valid)
    }
  }

  const currentTheme = computed(() => THEMES.find(t => t.id === theme.value) ?? THEMES[0])

  return {
    theme: readonly(theme),
    currentTheme,
    setTheme,
    initTheme,
    themes: THEMES,
  }
}
