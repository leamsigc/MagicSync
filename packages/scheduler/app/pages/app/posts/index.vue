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

const { getPosts, postList } = usePostManager();
getPosts(activeBusinessId.value);

const { t } = useI18n();
useHead({
  title: t('seo_title_all'),
  meta: [
    { name: 'description', content: t('seo_description_all') }
  ]
});

const currentView = ref<'Board' | 'Table' | 'Grid'>('Board');
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
  <div class="container mx-auto py-6 space-y-6">
    <BasePageHeader :title="t('title')" :description="t('description')">
      <template #actions>
        <NewPostModal />
      </template>
    </BasePageHeader>
    <div class="flex justify-between items-center mb-4 bg-grey-950/10 rounded-lg p-3">
      <section>

        <UButton icon="i-heroicons-squares-2x2" :variant="currentView === 'Board' ? 'solid' : 'ghost'"
          @click="currentView = 'Board'">Board</UButton>
        <UButton icon="i-heroicons-table-cells" :variant="currentView === 'Table' ? 'solid' : 'ghost'"
          @click="currentView = 'Table'">Table</UButton>
        <UButton icon="lucide:grid" :variant="currentView === 'Grid' ? 'solid' : 'ghost'" @click="currentView = 'Grid'">
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
