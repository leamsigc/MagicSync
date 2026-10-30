<i18n src="./PostsTableView.json"></i18n>
<script lang="ts" setup>
/**
 * Posts table view on the shared `BaseDataTable`.
 *
 * Selection is key-based (post ids) instead of TanStack row indexes, so filter
 * changes can never desync it. Row actions and the update modal are unchanged.
 */
import type { PostWithAllData } from '#layers/BaseDB/db/posts/posts'
import type { CollectionTableColumn } from '#layers/BaseUI/app/utils/collection'
import { usePostManager } from '#layers/BaseShared/app/composables/usePostManager'
import UpdatePostModal from '../UpdatePostModal.vue'

const props = defineProps<{
  posts: PostWithAllData[]
}>()

const { t } = useI18n()
const toast = useToast()
const router = useRouter()
const { deletePost, getPosts, activeBusinessId } = usePostManager()

const selected = ref<string[]>([])
const updatePostModalRef = ref<InstanceType<typeof UpdatePostModal> | null>(null)

const rows = computed(() => props.posts)

const columns = computed<CollectionTableColumn[]>(() => [
  { key: 'content', label: t('columns.content') },
  { key: 'status', label: t('columns.status') },
])

function rowKey(post: PostWithAllData): string {
  return post.id
}

function openPostDetails(id: string) {
  router.push(`/app/posts/feeds/${id}`)
}

function statusColor(status: string): 'success' | 'warning' | 'error' | 'neutral' {
  if (status === 'published') return 'success'
  if (status === 'pending') return 'warning'
  if (status === 'failed') return 'error'
  return 'neutral'
}

function openUpdateModal(post: PostWithAllData) {
  updatePostModalRef.value?.openModal(post)
}

function rowItems(post: PostWithAllData) {
  return [
    { label: t('actions'), type: 'label' as const },
    { label: t('update'), onSelect: () => openUpdateModal(post) },
    { label: t('delete'), onSelect: () => confirmDelete(post) },
    { type: 'separator' as const },
    { label: t('view_details'), icon: 'i-heroicons-eye', onSelect: () => openPostDetails(post.id) },
  ]
}

function confirmDelete(post: PostWithAllData) {
  toast.add({
    title: t('delete_title'),
    description: t('delete_description'),
    color: 'error',
    actions: [
      { label: t('delete_confirm'), color: 'error', variant: 'solid', onClick: () => removePost(post.id) },
      { label: t('cancel'), color: 'neutral', variant: 'outline' },
    ],
  })
}

async function removePost(id: string) {
  await deletePost(id)
  selected.value = selected.value.filter(selectedId => selectedId !== id)
  toast.add({ title: t('deleted'), color: 'success', icon: 'i-heroicons-check-circle' })
}

function confirmBulkDelete() {
  if (selected.value.length === 0) return
  toast.add({
    title: t('bulk_title'),
    description: t('bulk_description', { count: selected.value.length }),
    color: 'error',
    actions: [
      { label: t('delete_confirm'), color: 'error', variant: 'solid', onClick: () => removeSelected() },
      { label: t('cancel'), color: 'neutral', variant: 'outline' },
    ],
  })
}

async function removeSelected() {
  const ids = [...selected.value]
  await Promise.all(ids.map(id => deletePost(id)))
  selected.value = []
  toast.add({ title: t('bulk_success', { count: ids.length }), color: 'success', icon: 'i-heroicons-check-circle' })
  await getPosts(activeBusinessId.value, { page: 1, limit: 100 })
}

function clearSelection() {
  selected.value = []
}

async function handleRefresh() {
  toast.add({ title: t('refresh'), color: 'success', icon: 'i-heroicons-check-circle' })
  await getPosts(activeBusinessId.value, { page: 1, limit: 100 })
}
</script>

<template>
  <div class="mt-4">
    <BaseDataTable
      v-model:selected="selected"
      selectable
      :rows="rows"
      :columns="columns"
      :row-key="rowKey"
      :empty-title="t('columns.content')"
      empty-icon="i-lucide-file-text"
    >
      <template #cell-content="{ row }">
        <button type="button" class="max-w-md truncate text-left text-default hover:underline" @click="() => openPostDetails(row.id)">
          {{ String(row.content || '').slice(0, 100) }}
        </button>
      </template>
      <template #cell-status="{ row }">
        <UBadge :color="statusColor(row.status)" variant="subtle" class="capitalize">{{ t(`status.${row.status}`) }}</UBadge>
      </template>
      <template #row-actions="{ row }">
        <UDropdownMenu :items="rowItems(row)" :content="{ align: 'end' }">
          <UButton icon="i-lucide-ellipsis-vertical" color="neutral" variant="ghost" size="xs" :aria-label="t('actions')" />
        </UDropdownMenu>
      </template>
      <template #bulk="{ selected: selectedIds }">
        <span class="text-sm font-medium">{{ t('selected', { selected: selectedIds.length, total: rows.length }) }}</span>
        <UButton size="xs" color="error" variant="outline" icon="i-lucide-trash-2" @click="confirmBulkDelete">
          {{ t('delete') }}
        </UButton>
        <UButton size="xs" variant="ghost" color="neutral" @click="clearSelection">{{ t('cancel') }}</UButton>
      </template>
    </BaseDataTable>

    <UpdatePostModal ref="updatePostModalRef" @refresh="handleRefresh">
      <template v-if="$slots['mic-recorder']" #mic-recorder="slotProps">
        <slot name="mic-recorder" v-bind="slotProps" />
      </template>
      <template v-if="$slots['template-variable']" #template-variable="slotProps">
        <slot name="template-variable" v-bind="slotProps" />
      </template>
      <template v-if="$slots['ai-assistant']" #ai-assistant="slotProps">
        <slot name="ai-assistant" v-bind="slotProps" />
      </template>
    </UpdatePostModal>
  </div>
</template>

<style scoped>
/* Add any scoped styles here if needed */
</style>
