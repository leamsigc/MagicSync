export default defineNuxtPlugin({
  name: 'theme-init',
  setup() {
    const { initTheme } = useTheme()
    initTheme()
  },
})
