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
import { h, resolveComponent, useTemplateRef } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { Row } from '@tanstack/vue-table'
import { useClipboard } from '@vueuse/core'
import { usePostManager } from '../../composables/UsePostManager';
import UpdatePostModal from '../UpdatePostModal.vue';

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const UDropdownMenu = resolveComponent('UDropdownMenu')
const UCheckbox = resolveComponent('UCheckbox')
const toast = useToast()
const { copy } = useClipboard()

const { deletePost, getPosts, activeBusinessId } = usePostManager();
const props = defineProps<{
  posts: PostWithAllData[];
}>();

const rowSelection = ref<Record<string, boolean>>({})


const columns: TableColumn<PostWithAllData>[] = [
  {
    id: 'select',
    header: ({ table }) =>
      h(UCheckbox, {
        modelValue: table.getIsSomePageRowsSelected()
          ? 'indeterminate'
          : table.getIsAllPageRowsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') =>
          table.toggleAllPageRowsSelected(!!value),
        'aria-label': 'Select all'
      }),
    cell: ({ row }) =>
      h(UCheckbox, {
        modelValue: row.getIsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') => row.toggleSelected(!!value),
        'aria-label': 'Select row'
      })
  },
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
const table = useTemplateRef('table')
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

const handleBulkDelete = () => {
  const selectedRows = table.value?.tableApi?.getFilteredSelectedRowModel().rows || []
  if (selectedRows.length === 0) return

  toast.add({
    title: 'Delete Selected Posts',
    description: `Are you sure you want to delete ${selectedRows.length} post(s)?`,
    color: 'error',
    actions: [
      {
        label: 'Delete',
        color: 'error',
        variant: 'solid',
        onClick: async () => {
          const deletePromises = selectedRows.map(row => deletePost(row.original.id))
          await Promise.all(deletePromises)
          rowSelection.value = {} // Clear selection
          toast.add({
            title: `${selectedRows.length} post(s) have been deleted.`,
            color: 'success',
            icon: 'i-heroicons-check-circle'
          })
          // Refresh posts
          await getPosts(activeBusinessId.value, {
            page: 1,
            limit: 100
          });
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
</script>

<template>
  <div class="mt-3">
    <UTable ref="table" v-model:row-selection="rowSelection" :data="posts" :columns="columns" class="flex-1" />

    <div class="px-4 py-3.5 border-t border-accented text-sm text-muted flex items-center justify-between">
      <div>
        {{ table?.tableApi?.getFilteredSelectedRowModel().rows.length || 0 }} of
        {{ table?.tableApi?.getFilteredRowModel().rows.length || 0 }} row(s) selected.
      </div>
      <UButton
        v-if="(table?.tableApi?.getFilteredSelectedRowModel().rows.length || 0) > 0"
        color="error"
        variant="outline"
        size="sm"
        @click="handleBulkDelete"
      >
        Delete Selected
      </UButton>
    </div>

    <UpdatePostModal ref="updatePostModalRef" @refresh="HandleRefresh" />
  </div>
</template>

<style scoped>
/* Add any scoped styles here if needed */
</style>
