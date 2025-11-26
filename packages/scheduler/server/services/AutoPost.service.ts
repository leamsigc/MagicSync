import type { PostWithAllData } from '#layers/BaseDB/db/schema';
import { postService } from '#layers/BaseDB/server/services/post.service';
import { socialMediaAccountService, type SocialMediaPlatform } from '#layers/BaseDB/server/services/social-media-account.service';
import { SchedulerPost } from '#layers/BaseScheduler/server/services/SchedulerPost.service';
import type { SchedulerPluginConstructor } from '#layers/BaseScheduler/server/services/SchedulerPost.service';
import { FacebookPlugin } from '#layers/BaseScheduler/server/services/plugins/facebook.plugin';
export class AutoPostService {

  private matcher: Record<string, SchedulerPluginConstructor> = {
    facebook: FacebookPlugin as unknown as SchedulerPluginConstructor,
  }

  async triggerSocialMediaPost(post: PostWithAllData): Promise<void> {
    // Implement the logic to trigger a social media post
    post.platformPosts.forEach(async (platformPost) => {
      const platform = platformPost.platformPostId
      if (!platform) {
        return;
      }
      const user = post.user;
      const accounts = await socialMediaAccountService.getAccountsForPlatform(
        platform,
        user.id
      )
      const scheduler = new SchedulerPost({
        post: post,
        accounts: accounts
      });
      const socialMediaAccount = await socialMediaAccountService.getAccountById(platformPost.socialAccountId);
      if (!socialMediaAccount || !socialMediaAccount.accessToken) {
        throw new Error(`No access token found for platform ${platform}`);
      }
      //@ts-ignore
      scheduler.use(this.matcher[platform]);

      try {
        const response = await scheduler.publish(
          post,
          [],
          socialMediaAccount
        );
        await postService.updatePostBaseOnResponse(post, response, platformPost);
      } catch (e) {
        console.error(e);
        await postService.updatePostBaseOnResponse(
          post,
          { status: 'failed', id: platformPost.id, releaseURL: '', error: 'Post failed to post ', postId: post.id },
          platformPost
        );

      }
    });

  }
}
