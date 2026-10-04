import { notificationService } from '#layers/BaseAuth/server/services/notification.service'
import { sendNotificationDigestEmail } from '#layers/BaseEmail/server/utils/email'

export default defineTask({
  meta: {
    name: 'notifications:digest',
    description: 'Send one daily digest email per user with unread notifications from the last 24 hours',
  },
  async run() {
    if (!process.env.NUXT_MAILGUN_API_KEY || !process.env.NUXT_MAILGUN_DOMAIN) {
      log.debug({ message: '[notifications:digest] Skipped — Mailgun is not configured.' })
      return { result: 'Skipped', reason: 'Mailgun not configured' }
    }
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const batch = await notificationService.getDigestBatch(since)
    if (batch.error || !batch.data) {
      log.error({ message: `[notifications:digest] ${batch.error || 'Failed to build digest batch'}` })
      return { result: 'Failed', error: batch.error || 'Failed to build digest batch' }
    }

    let sent = 0
    let failed = 0
    for (const recipient of batch.data) {
      // Digest respects the email channel: skip users who muted everything
      // (per-event email flags were already honoured at creation time for
      // immediate mail; the digest only covers still-unread in-app rows)
      try {
        await sendNotificationDigestEmail(recipient.email, recipient.name, recipient.items)
        sent++
      } catch (error) {
        failed++
        log.error({ message: `[notifications:digest] Failed for ${recipient.userId}:`, error: String(error) })
      }
    }

    log.debug({ message: `[notifications:digest] users ${batch.data.length} sent ${sent} failed ${failed}` })
    return { result: 'Digest sent', users: batch.data.length, sent, failed }
  },
})
