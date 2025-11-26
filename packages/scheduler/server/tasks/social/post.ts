import { postService } from "#layers/BaseDB/server/services/post.service";
import { AutoPostService } from "#layers/BaseScheduler/server/services/AutoPost.service";

export default defineTask({
  meta: {
    name: "social:post",
    description: "Trigger social media post that are scheduled",
  },
  async run({ payload, context }) {
    const listOfPostToProcess = await postService.getPostsToProcessNow();
    const autoScheduler = new AutoPostService();

    const postToProcess = listOfPostToProcess.map((post) => {
      autoScheduler.triggerSocialMediaPost(post);
    });
    console.log("#### Trigger auto post for old post  ", listOfPostToProcess.length);

    return { result: "Success" };
  },
});
