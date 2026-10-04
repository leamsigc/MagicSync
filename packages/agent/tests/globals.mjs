import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'

// Nuxt auto-imports used by services at runtime. useDrizzle is provided per
// test file after the file DB is created (see setup.mjs); it must exist as a
// global before service modules are dynamically imported.
dayjs.extend(utc)
globalThis.dayjs = dayjs
globalThis.useAuthApi = () => {
  throw new Error('useAuthApi stub not configured for this test')
}
