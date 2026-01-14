<script lang="ts" setup>
/**
 *
 * Posts Table View Component Description: Displays posts in a table layout.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import type { PostWithAllData } from '#layers/BaseDB/db/posts/posts';
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { Row } from '@tanstack/vue-table'
import { useClipboard } from '@vueuse/core'
import { usePostManager } from '../../composables/UsePostManager';
import UpdatePostModal from '../UpdatePostModal.vue';

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const UDropdownMenu = resolveComponent('UDropdownMenu')
const toast = useToast()
const { copy } = useClipboard()

const { deletePost, getPosts, activeBusinessId } = usePostManager();
const props = defineProps<{
  posts: PostWithAllData[];
}>();


const columns: TableColumn<PostWithAllData>[] = [
  {
    accessorKey: 'content',
    header: '#',
    cell: ({ row }) => {
      const contentDescription = row.getValue('content') as string;
      return h('div', { class: 'text-left' }, contentDescription.slice(0, 100))
    }
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const color = {
        paid: 'success' as const,
        failed: 'error' as const,
        refunded: 'neutral' as const
      }[row.getValue('status') as string]

      return h(UBadge, { class: 'capitalize', variant: 'subtle', color }, () =>
        row.getValue('status')
      )
    }
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      return h(
        'div',
        { class: 'text-right' },
        h(
          UDropdownMenu,
          {
            content: {
              align: 'end'
            },
            items: getRowItems(row),
            'aria-label': 'Actions dropdown'
          },
          () =>
            h(UButton, {
              icon: 'i-lucide-ellipsis-vertical',
              color: 'neutral',
              variant: 'ghost',
              class: 'ml-auto',
              'aria-label': 'Actions dropdown'
            })
        )
      )
    }
  }

];
function getRowItems(row: Row<PostWithAllData>) {
  return [
    {
      type: 'label',
      label: 'Actions'
    },
    {
      label: 'Update',
      onSelect() {
        HandleEventClicked(row.original)
      }
    },
    {
      label: 'Delete',
      onSelect() {
        toast.add({
          title: 'Delete Post',
          description: 'Are you sure you want to delete this post?',
          color: 'error',
          actions: [
            {
              label: 'Delete',
              color: 'error',
              variant: 'solid',
              onClick: () => {
                deletePost(row.original.id)
                toast.add({
                  title: 'The social media post has been deleted.',
                  color: 'success',
                  icon: 'i-heroicons-check-circle'
                })
              }
            },
            {
              label: 'Cancel',
              color: 'neutral',
              variant: 'outline'
            }
          ]
        })
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'View customer'
    }
  ]
}

const updatePostModalRef = ref<InstanceType<typeof UpdatePostModal> | null>(null);
const HandleRefresh = async () => {
  toast.add({
    title: 'The social media post has been updated.',
    color: 'success',
    icon: 'i-heroicons-check-circle'
  })
  await getPosts(activeBusinessId.value, {
    page: 1,
    limit: 100
  });
}
const HandleEventClicked = (post: PostWithAllData) => {
  updatePostModalRef.value?.openModal(post);
}
</script>

<template>
  <div class="mt-3">
    <UTable :data="posts" :columns="columns" class="flex-1" />
    <UpdatePostModal ref="updatePostModalRef" @refresh="HandleRefresh" />
  </div>
</template>

<style scoped>
/* Add any scoped styles here if needed */
</style>
