<!--  Translation file -->
<i18n src="../posts.json"></i18n>


<script lang="ts" setup>
/**
 *
 * Component Description:Desc
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */


import { usePostManager } from '../composables/UsePostManager';
import dayjs from 'dayjs'


const activeBusinessId = useState<string>('business:id');
const { getPosts, postList, t } = usePostManager();
getPosts(activeBusinessId.value, { page: 1, limit: 100 });

useHead({
  title: t('seo_title_all'),
  meta: [
    { name: 'description', content: t('seo_description_all') }
  ]
});
setPageLayout('auth-twitter-layout')

const router = useRouter()

const handleViewPost = (id: string) => {
  router.push(`/app/posts/feeds/${id}`)
}
</script>

<template>
  <div>
    <div class="my-10">
      <TwitterPostCard v-for="(post, index) in postList" :key="index" :id="post.id" :avatar="post.user.image || ''"
        :name="post.user.name" :username="post.user.firstName" :content="post.content" :scheduledAt="post.scheduledAt"
        :createdAt="post.createdAt" :likes="100" :retweets="100" :replies="post.platformContent?.comment?.length || 0"
        :views="100" :handle="post.user.firstName || ''" :timestamp="dayjs(post.scheduledAt).format('DD MMM YYYY')"
        :comments="post.platformContent?.comment || []" @view="handleViewPost" @open="handleViewPost">

        <template #media v-if="post.assets?.length">
          <div class="grid grid-cols-1 gap-5">
            <img :src="asset.url" alt="" v-for="(asset, index) in post.assets" :key="index"
              class="w-full h-full object-contain" />
          </div>
        </template>
      </TwitterPostCard>
    </div>
  </div>
</template>
<style scoped></style>
