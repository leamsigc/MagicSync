import { postBatchService } from "#layers/BaseDB/server/services/post.service";
import { AutoPostService } from "#layers/BaseScheduler/server/services/AutoPost.service";
import { platformRateLimiter } from "#layers/BaseScheduler/server/services/RateLimiter.service";

export default defineTask({
  meta: {
    name: "social:post",
    description: "Trigger social media post that are scheduled",
  },
  async run({ payload, context }) {
    const listOfPostToProcess = await postBatchService.getPostsToProcessNow();

    if (listOfPostToProcess.length === 0) {
      console.log("[social:post] No posts due for processing.");
      return { result: "No posts to process" };
    }

    const autoScheduler = new AutoPostService();

    // Properly await all post triggers (was fire-and-forget before)
    const postPromises = listOfPostToProcess.map((post) =>
      autoScheduler.triggerSocialMediaPost(post)
    );
    await Promise.all(postPromises);

    // Log rate limiter state after this run
    const rateLimiterState = platformRateLimiter.getState();
    const rateLimitedPlatforms = Object.entries(rateLimiterState)
      .filter(([, state]) => {
        const remaining = state.maxRequests - state.count;
        return remaining < state.maxRequests * 0.2; // < 20% remaining
      })
      .map(([platform, state]) => `${platform}: ${state.count}/${state.maxRequests}`);

    if (rateLimitedPlatforms.length > 0) {
      console.warn("[social:post] Rate limit warnings:", rateLimitedPlatforms.join(", "));
    }

    console.log(
      `[social:post] Processed ${listOfPostToProcess.length} posts. ` +
      `Rate limiter windows active: ${Object.keys(rateLimiterState).length}`
    );

    return { result: "Success", postsProcessed: listOfPostToProcess.length };
  },
});
