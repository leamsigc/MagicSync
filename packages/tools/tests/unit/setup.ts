// Vitest setup: isolate file-writing tests (carousel export writes PNGs).
process.env.NUXT_FILE_STORAGE_MOUNT = './test-uploads-tmp'
