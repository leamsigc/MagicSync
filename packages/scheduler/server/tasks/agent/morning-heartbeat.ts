import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service'
import { contentArtifactService } from '#layers/BaseDB/server/services/content-artifact.service'
import { contentBoardService } from '#layers/BaseDB/server/services/content-board.service'
import { chatService } from '#layers/BaseDB/server/services/chat.service'
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service'

interface HeartbeatSnapshot {
  businessName: string
  channels: number
  reviewArtifacts: number
  reviewCards: number
  scheduledCards: number
  draftCards: number
}

function reportDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function buildReport(snapshot: HeartbeatSnapshot): string {
  const gaps = snapshot.scheduledCards === 0
    ? 'There are no scheduled board cards visible, so calendar coverage is the first gap to review.'
    : `${snapshot.scheduledCards} board card(s) are already scheduled.`
  const approval = snapshot.reviewArtifacts + snapshot.reviewCards
  const approvalLine = approval === 0
    ? 'Nothing is currently waiting for human review.'
    : `${approval} item(s) are waiting for human review before delivery.`
  return [
    `Good morning — here is your MagicSync workspace pulse for ${snapshot.businessName}.`,
    '',
    `• ${snapshot.channels} connected channel(s).`,
    `• ${approvalLine}`,
    `• ${snapshot.draftCards} draft or idea card(s) are available for development.`,
    `• ${gaps}`,
    '',
    'Recommended next step: ask me to review the calendar gaps or prepare approval-ready content. I will not publish or schedule anything without your approval.',
  ].join('\n')
}

async function snapshotForBusiness(userId: string, businessId: string, businessName: string): Promise<HeartbeatSnapshot> {
  const [boardResult, artifactResult, accounts] = await Promise.all([
    contentBoardService.list(userId, businessId, { limit: 100 }),
    contentArtifactService.listArtifacts(userId, { businessId }),
    socialMediaAccountService.getAccountsByBusinessId(businessId),
  ])
  const board = boardResult.success ? boardResult.data : []
  const artifacts = artifactResult.success ? artifactResult.data : []
  return {
    businessName,
    channels: accounts.length,
    reviewArtifacts: artifacts.filter(artifact => artifact.status === 'review_required').length,
    reviewCards: board.filter(item => item.state === 'review_required').length,
    scheduledCards: board.filter(item => item.state === 'scheduled').length,
    draftCards: board.filter(item => ['idea', 'drafting', 'changes_requested'].includes(item.state)).length,
  }
}

async function writeReport(userId: string, businessId: string, snapshot: HeartbeatSnapshot): Promise<boolean> {
  const title = `Morning report · ${snapshot.businessName} · ${reportDate()}`
  const threads = await chatService.getThreads(userId)
  if (!threads.success) return false
  const existing = threads.data.find(thread => thread.title === title)
  const thread = existing
    ? { success: true as const, data: existing }
    : await chatService.createThread(userId, { title })
  if (!thread.success) return false
  const message = await chatService.addMessage({
    threadId: thread.data.id,
    userId,
    role: 'system',
    content: buildReport(snapshot),
    metadata: { kind: 'morning-report', businessId, date: reportDate(), safeMode: true },
  })
  return message.success
}

export default defineTask({
  meta: {
    name: 'agent:morning-heartbeat',
    description: 'Write one safe-mode morning workspace report into each active business chat',
  },
  async run() {
    const businesses = await businessProfileService.findAllForHeartbeat()
    if (!businesses.success) return { result: 'Failed', error: businesses.error }
    let written = 0
    for (const business of businesses.data) {
      const snapshot = await snapshotForBusiness(business.userId, business.id, business.name)
      if (await writeReport(business.userId, business.id, snapshot)) written++
    }
    return { result: 'Morning reports written', businesses: businesses.data.length, written }
  },
})
