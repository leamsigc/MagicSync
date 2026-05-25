<!--  Translation file -->
<i18n src="./posts.json"></i18n>

<script lang="ts" setup>
/**
 *
 * Post previews
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import { ref, computed } from 'vue';
import { usePostManager } from './composables/UsePostManager';
import NewPostModal from './components/NewPostModal.vue';
import PostsGridView from './components/views/PostsGridView.vue';
import PostsBoardView from './components/views/PostsBoardView.vue';
import PostsTableView from './components/views/PostsTableView.vue';

const activeBusinessId = useState<string>('business:id');
const { getPosts, postList, t } = usePostManager();
getPosts(activeBusinessId.value);

useHead({
  title: t('seo_title_all'),
  meta: [
    { name: 'description', content: t('seo_description_all') }
  ]
});

const currentView = ref<'Board' | 'Table' | 'Grid'>('Grid');
const monthDate = ref(new Date());

const currentMonthPosts = computed(() => {
  const selectedMonth = monthDate.value.getMonth();
  const selectedYear = monthDate.value.getFullYear();

  return postList.value.filter(post => {
    if (!post.scheduledAt) return false;
    const postDate = new Date(post.createdAt);
    return postDate.getMonth() === selectedMonth && postDate.getFullYear() === selectedYear;
  });
});

</script>

<template>
  <div class="mx-auto space-y-6">
    <BasePageHeader :title="t('title')" :description="t('description')">
      <template #actions>
        <NewPostModal />
      </template>
    </BasePageHeader>
    <div class=" p-2 flex justify-between items-center ">
      <section class="flex gap-1">

        <UButton icon="i-heroicons-squares-2x2" :variant="currentView === 'Board' ? 'solid' : 'ghost'" size="sm"
          @click="currentView = 'Board'" class="rounded-xl">Board</UButton>
        <UButton icon="i-heroicons-table-cells" :variant="currentView === 'Table' ? 'solid' : 'ghost'" size="sm"
          @click="currentView = 'Table'" class="rounded-xl">Table</UButton>
        <UButton icon="lucide:grid" :variant="currentView === 'Grid' ? 'solid' : 'ghost'" size="sm"
          @click="currentView = 'Grid'" class="rounded-xl">
          Grid
        </UButton>
      </section>

      <!-- <UMonthPicker v-model="monthDate" /> -->
    </div>

    <!-- List of all posts -->
    <PostsGridView v-if="currentView === 'Grid'" :posts="currentMonthPosts" />

    <PostsBoardView v-if="currentView === 'Board'" :posts="currentMonthPosts" />

    <PostsTableView v-if="currentView === 'Table'" :posts="currentMonthPosts" />
  </div>
</template>
<style scoped></style>
