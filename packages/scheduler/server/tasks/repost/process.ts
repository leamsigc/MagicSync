import { autoRepostService } from '#layers/BaseScheduler/server/services/AutoRepost.service'

export default defineTask({
  meta: {
    name: 'repost:process',
    description: 'Process due auto-reposts for posts with auto-repost enabled',
  },
  async run() {
    const result = await autoRepostService.processDueReposts()
    if (result.error || !result.data) {
      console.error(`[repost:process] failed: ${result.error}`)
      return { result: 'Reposts failed', processed: 0, errors: [result.error || 'Unknown error'] }
    }
    console.log(
      `[repost:process] processed ${result.data.processed}, errors ${result.data.errors.length}`
    )
    if (result.data.errors.length > 0) {
      console.warn('[repost:process] errors:', result.data.errors.slice(0, 5))
    }
    return { result: 'Reposts processed', ...result.data }
  },
})
