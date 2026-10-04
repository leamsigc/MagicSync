import type { Post } from "#layers/BaseDB/db/schema";


export const useScheduleManager = () => {
  const post = useState<Post[]>("scheduler:posts", () => []);

  const fetchPosts = async (timeFrame: "day" | "week" | "month" = "day") => {
    try {
      await callOnce(async () => {
        const response = await fetch('/api/v1/scheduler/posts');

        const data = await response.json();
        post.value = data;
      })
    } catch (error) {
      log.error({ message: 'Error fetching posts', error: String(error) });
    }
  };
  return {
    post,
    fetchPosts
  }
};
