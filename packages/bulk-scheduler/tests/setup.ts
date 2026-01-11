import { vi } from 'vitest'

global.useI18n = vi.fn(() => ({
    t: (key: string) => key,
    locale: { value: 'en' }
}))

global.useToast = vi.fn(() => ({
    add: vi.fn()
}))

global.$fetch = vi.fn()

global.useState = vi.fn((key: string, init?: () => any) => {
    const value = init ? init() : undefined
    return {
        value
    }
})
