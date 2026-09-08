import { autoReplyService } from '#layers/BaseScheduler/server/services/AutoReply.service'

export default defineTask({
  meta: {
    name: 'autoreply:process',
    description: 'Poll watched Instagram posts for keyword comments and send private-reply DMs',
  },
  async run() {
    const result = await autoReplyService.processDueCampaigns()
    if (result.error || !result.data) {
      console.error(`[autoreply:process] failed: ${result.error}`)
      return { result: 'Auto-reply failed', campaigns: 0, checked: 0, sent: 0, skipped: 0, failed: 1, errors: [result.error || 'Unknown error'] }
    }
    console.log(
      `[autoreply:process] campaigns ${result.data.campaigns}, checked ${result.data.checked}, sent ${result.data.sent}, skipped ${result.data.skipped}, failed ${result.data.failed}`,
    )
    return { result: 'Auto-reply processed', ...result.data }
  },
})
