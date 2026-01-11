import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

export default defineConfig({
    plugins: [vue()],
    test: {
        environment: 'happy-dom',
        exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: [
                'node_modules/',
                '.playground/',
                '**/*.config.*',
                '**/dist/**',
                '**/*.d.ts',
                '**/__tests__/**',
                '**/e2e/**',
            ]
        },
        globals: true,
        setupFiles: ['./tests/setup.ts']
    },
    resolve: {
        alias: {
            '#layers/BaseDB': fileURLToPath(new URL('../db', import.meta.url)),
            '#layers/BaseAuth': fileURLToPath(new URL('../auth', import.meta.url)),
            '#layers/BaseUI': fileURLToPath(new URL('../ui', import.meta.url)),
            '#layers/BaseScheduler': fileURLToPath(new URL('../scheduler', import.meta.url)),
            '~': fileURLToPath(new URL('./app', import.meta.url)),
            '@': fileURLToPath(new URL('./app', import.meta.url)),
        }
    }
})
