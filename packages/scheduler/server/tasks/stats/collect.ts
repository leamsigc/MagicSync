import { statsCollectorService } from '#layers/BaseScheduler/server/services/StatsCollector.service'

export default defineTask({
  meta: {
    name: 'stats:collect',
    description: 'Collect due platform and post metrics with adaptive cadence and prune failed rows',
  },
  async run({ payload }) {
    const force = Boolean((payload as { force?: boolean })?.force)
    const result = await statsCollectorService.collectAllDue({}, { force })
    const pruned = await statsCollectorService.pruneFailed()
    console.log(
      `[stats:collect] accounts ${result.accountsCollected}/${result.accountsDue} ` +
        `posts ${result.postsCollected}/${result.postsDue} failed ${result.accountsFailed + result.postsFailed} pruned ${pruned.accountRows + pruned.postRows}`
    )
    return { result: 'Stats collected', ...result, pruned }
  },
})