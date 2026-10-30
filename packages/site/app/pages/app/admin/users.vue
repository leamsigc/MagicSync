<i18n src="./users.json"></i18n>

<script lang="ts" setup>
/**
 * Admin → Users.
 *
 * Table + list over every account. Selection is key-based (`v-model:selected`
 * with row ids) so filtering never desyncs it, and every mutation is applied
 * optimistically to the local row and rolled back on failure.
 */
import type { CollectionTableColumn } from '#layers/BaseUI/app/utils/collection'
import { authClient } from '#layers/BaseAuth/lib/auth-client'

definePageMeta({
  layout: 'dashboard-layout',
})

interface AdminUser {
  id: string
  name: string | null
  email: string
  emailVerified: boolean
  image: string | null
  role: string
  banned: boolean
  banReason: string | null
  createdAt: string
}

interface BulkItemResult {
  userId: string
  ok: boolean
  skipped?: boolean
  error?: string
}

const { t } = useI18n()
const toast = useToast()

const users = ref<AdminUser[]>([])
const loading = ref(true)
const selectedIds = ref<string[]>([])
const bulkBusy = ref(false)

const { user: currentUser, fetchSession } = UseUser()

const {
  view,
  setView,
  search,
  setSearch,
  filters,
  setFilter,
  filtered,
} = useCollectionView<AdminUser>({
  key: 'admin-users',
  modes: ['table', 'list'],
  defaultView: 'table',
  rows: users,
  searchFields: user => [user.name, user.email, user.role],
  filterFns: {
    role: (user, value) => user.role === value,
    status: (user, value) => (user.banned ? 'banned' : 'active') === value,
  },
})

const rowKey = (user: AdminUser): string => user.id

const selectedCount = computed(() => selectedIds.value.length)

const viewOptions = computed(() => [
  { value: 'table', label: t('views.table'), icon: 'i-lucide-table' },
  { value: 'list', label: t('views.list'), icon: 'i-lucide-list' },
])

const roleFilterOptions = computed(() => [
  { value: 'all', label: t('filters.allRoles') },
  { value: 'user', label: t('roles.user') },
  { value: 'admin', label: t('roles.admin') },
])

const statusFilterOptions = computed(() => [
  { value: 'all', label: t('filters.allStatuses') },
  { value: 'active', label: t('status.active') },
  { value: 'banned', label: t('status.banned') },
])

const toolbarFilters = computed(() => [
  {
    key: 'role',
    label: t('filters.role'),
    value: filters.value.role || 'all',
    options: roleFilterOptions.value,
    width: 'w-full sm:w-40',
  },
  {
    key: 'status',
    label: t('filters.status'),
    value: filters.value.status || 'all',
    options: statusFilterOptions.value,
    width: 'w-full sm:w-40',
  },
])

const columns = computed<CollectionTableColumn[]>(() => [
  { key: 'user', label: t('columns.user') },
  { key: 'role', label: t('columns.role') },
  { key: 'status', label: t('columns.status') },
  { key: 'verified', label: t('columns.verified'), hideBelow: 'md' },
])

async function fetchUsers() {
  loading.value = true
  try {
    const data = await $fetch<{ users: AdminUser[] }>('/api/v1/admin/users')
    users.value = data.users
  } catch {
    toast.add({ title: t('toast.error'), description: t('toast.loadFailed'), color: 'error' })
  } finally {
    loading.value = false
  }
}

onMounted(fetchUsers)

const showCreateModal = ref(false)
const creating = ref(false)
const savingRole = ref(false)
const banning = ref(false)
const createForm = ref({ name: '', email: '', password: '', role: 'user' })

async function createUser() {
  if (!createForm.value.name || !createForm.value.email || !createForm.value.password) {
    toast.add({ title: t('toast.error'), description: t('toast.createRequiresFields'), color: 'error' })
    return
  }
  creating.value = true
  try {
    await authClient.admin.createUser({
      name: createForm.value.name,
      email: createForm.value.email,
      password: createForm.value.password,
      role: createForm.value.role,
    })
    toast.add({
      title: t('toast.created'),
      description: t('toast.createdDescription', { name: createForm.value.name }),
      color: 'success',
    })
    showCreateModal.value = false
    createForm.value = { name: '', email: '', password: '', role: 'user' }
    await fetchUsers()
  } catch {
    toast.add({ title: t('toast.error'), description: t('toast.createFailed'), color: 'error' })
  } finally {
    creating.value = false
  }
}

const selectedUser = ref<AdminUser | null>(null)
const showEditModal = ref(false)
const editForm = ref({ role: 'user' })
const banReason = ref('')

function openCreateModal() {
  showCreateModal.value = true
}

function openEdit(user: AdminUser) {
  selectedUser.value = user
  editForm.value = { role: user.role }
  banReason.value = user.banReason || ''
  showEditModal.value = true
}

function closeCreateModal() {
  showCreateModal.value = false
}

function closeEditModal() {
  showEditModal.value = false
}

async function saveUser() {
  if (!selectedUser.value) return
  const newRole = editForm.value.role
  if (newRole === selectedUser.value.role) {
    showEditModal.value = false
    return
  }
  const userId = selectedUser.value.id
  const userLabel = selectedUser.value.name || selectedUser.value.email
  const prevRole = selectedUser.value.role
  patchUser(userId, { role: newRole })
  savingRole.value = true
  try {
    await authClient.admin.setRole({ userId, role: newRole })
    toast.add({
      title: t('toast.updated'),
      description: t('toast.updatedDescription', { name: userLabel }),
      color: 'success',
    })
    showEditModal.value = false
  } catch {
    patchUser(userId, { role: prevRole })
    toast.add({ title: t('toast.error'), description: t('toast.updateFailed'), color: 'error' })
  } finally {
    savingRole.value = false
  }
}

function toggleBan(user: AdminUser) {
  if (user.banned) {
    unban(user)
  } else {
    openEdit(user)
  }
}

function patchUser(id: string, patch: Partial<AdminUser>) {
  const index = users.value.findIndex(item => item.id === id)
  if (index !== -1) {
    users.value[index] = { ...users.value[index], ...patch }
  }
}

function removeUsersLocal(ids: string[]) {
  const gone = new Set(ids)
  users.value = users.value.filter(item => !gone.has(item.id))
}

/** Maps selected row ids back to rows; selection lives in `selectedIds`. */
function selectedRows(): AdminUser[] {
  const ids = new Set(selectedIds.value)
  if (ids.size === 0) return []
  return users.value.filter(user => ids.has(user.id))
}

function actionLabel(action: 'ban' | 'unban' | 'delete') {
  if (action === 'ban') return t('toast.actionBanned')
  if (action === 'unban') return t('toast.actionUnbanned')
  return t('toast.actionDeleted')
}

function applyLocalAction(action: 'ban' | 'unban' | 'delete', target: AdminUser) {
  if (action === 'delete') {
    removeUsersLocal([target.id])
  } else if (action === 'ban') {
    patchUser(target.id, { banned: true, banReason: t('defaultBanReason') })
  } else {
    patchUser(target.id, { banned: false, banReason: null })
  }
}

async function unban(user: AdminUser) {
  patchUser(user.id, { banned: false, banReason: null })
  try {
    await authClient.admin.unbanUser({ userId: user.id })
    toast.add({
      title: t('toast.unbanned'),
      description: t('toast.unbannedDescription', { name: user.name || user.email }),
      color: 'success',
    })
  } catch {
    patchUser(user.id, { banned: true, banReason: user.banReason })
    toast.add({ title: t('toast.error'), description: t('toast.unbanFailed'), color: 'error' })
  }
}

async function banUser(user: AdminUser) {
  const reason = banReason.value || t('defaultBanReason')
  patchUser(user.id, { banned: true, banReason: reason })
  banning.value = true
  try {
    await authClient.admin.banUser({ userId: user.id, banReason: reason })
    toast.add({
      title: t('toast.banned'),
      description: t('toast.bannedDescription', { name: user.name || user.email }),
      color: 'success',
    })
    showEditModal.value = false
  } catch {
    patchUser(user.id, { banned: false, banReason: null })
    toast.add({ title: t('toast.error'), description: t('toast.banFailed'), color: 'error' })
  } finally {
    banning.value = false
  }
}

function handleBanFromEdit() {
  if (selectedUser.value) {
    banUser(selectedUser.value)
  }
}

const impersonatingId = ref<string | null>(null)

function canImpersonate(target: AdminUser) {
  if (target.id === currentUser.value?.id) return false
  if (target.role === 'admin') return false
  return true
}

async function handleImpersonate(target: AdminUser) {
  if (!canImpersonate(target)) return
  impersonatingId.value = target.id
  try {
    const { error } = await authClient.admin.impersonateUser({ userId: target.id })
    if (error) throw error
    clearNuxtData('auth-session')
    await fetchSession()
    toast.add({
      title: t('toast.impersonated'),
      description: t('toast.impersonatedDescription', { name: target.name || target.email }),
      color: 'success',
    })
    await navigateTo('/app')
  } catch {
    toast.add({ title: t('toast.error'), description: t('toast.impersonateFailed'), color: 'error' })
  } finally {
    impersonatingId.value = null
  }
}

async function deleteUser(user: AdminUser) {
  const index = users.value.findIndex(item => item.id === user.id)
  const snapshot = index === -1 ? null : users.value[index]
  if (index !== -1) {
    removeUsersLocal([user.id])
  }
  try {
    await authClient.admin.removeUser({ userId: user.id })
    toast.add({
      title: t('toast.deleted'),
      description: t('toast.deletedDescription', { name: user.name || user.email }),
      color: 'success',
    })
  } catch {
    if (snapshot) {
      users.value.splice(Math.min(index, users.value.length), 0, snapshot)
    }
    toast.add({ title: t('toast.error'), description: t('toast.deleteFailed'), color: 'error' })
  }
}

function applyBulkResults(action: 'ban' | 'unban' | 'delete', eligible: AdminUser[], results: BulkItemResult[]) {
  const byId = new Map(results.map(result => [result.userId, result]))
  const failedNames: string[] = []
  let succeeded = 0
  let skipped = 0
  for (const target of eligible) {
    const result = byId.get(target.id)
    if (result?.skipped) {
      skipped += 1
    } else if (result?.ok) {
      succeeded += 1
      applyLocalAction(action, target)
    } else {
      failedNames.push(target.name || target.email)
    }
  }
  selectedIds.value = []
  if (succeeded > 0) {
    toast.add({
      title: t('toast.bulkTitle'),
      description: t('toast.bulkSuccess', { count: succeeded, action: actionLabel(action) }),
      color: 'success',
    })
  }
  if (failedNames.length > 0) {
    toast.add({ title: t('toast.bulkPartial'), description: failedNames.join(', '), color: 'error' })
  }
  return skipped
}

function splitEligible(targets: AdminUser[]) {
  const selfId = currentUser.value?.id
  return {
    eligible: targets.filter(target => target.id !== selfId),
    skippedSelf: targets.some(target => target.id === selfId),
  }
}

async function runBulk(action: 'ban' | 'unban' | 'delete', targets: AdminUser[]) {
  if (targets.length === 0) {
    toast.add({ title: t('toast.noSelection'), description: t('toast.noSelectionDescription'), color: 'warning' })
    return
  }
  const { eligible, skippedSelf } = splitEligible(targets)
  if (eligible.length === 0) {
    toast.add({ title: t('toast.nothingToDo'), description: t('toast.selfAction'), color: 'warning' })
    return
  }
  bulkBusy.value = true
  try {
    const response = await $fetch<{ results: BulkItemResult[] }>('/api/v1/admin/users/bulk', {
      method: 'POST',
      body: { action, userIds: eligible.map(target => target.id) },
    })
    const skippedByServer = applyBulkResults(action, eligible, response.results)
    if (skippedSelf || skippedByServer > 0) {
      toast.add({ title: t('toast.skippedSelf'), description: t('toast.skippedSelfDescription'), color: 'info' })
    }
  } catch {
    toast.add({
      title: t('toast.error'),
      description: t('toast.bulkFailed', { action: actionLabel(action) }),
      color: 'error',
    })
  } finally {
    bulkBusy.value = false
  }
}

function handleBulkBan() {
  runBulk('ban', selectedRows())
}

function handleBulkUnban() {
  runBulk('unban', selectedRows())
}

function clearSelection() {
  selectedIds.value = []
}

const showDeleteModal = ref(false)
const deleteTargets = ref<AdminUser[]>([])
const pendingDelete = ref<((targets: AdminUser[]) => Promise<void>) | null>(null)

function askDelete(targets: AdminUser[], run: (selections: AdminUser[]) => Promise<void>) {
  deleteTargets.value = targets
  pendingDelete.value = run
  showDeleteModal.value = true
}

function askDeleteSingle(user: AdminUser) {
  askDelete([user], async ([target]) => {
    await deleteUser(target)
  })
}

function askDeleteSelected() {
  const targets = selectedRows()
  if (targets.length === 0) return
  askDelete(targets, async selections => {
    await runBulk('delete', selections)
  })
}

function closeDeleteModal() {
  showDeleteModal.value = false
  deleteTargets.value = []
  pendingDelete.value = null
}

async function confirmDeleteModal() {
  const run = pendingDelete.value
  const targets = [...deleteTargets.value]
  closeDeleteModal()
  if (run) {
    await run(targets)
  }
}

function roleColor(role: string): 'warning' | 'info' {
  return role === 'admin' ? 'warning' : 'info'
}

function roleLabel(role: string): string {
  return role === 'admin' ? t('roles.admin') : t('roles.user')
}

function roleOptions() {
  return [
    { label: t('roles.user'), value: 'user' },
    { label: t('roles.admin'), value: 'admin' },
  ]
}

function isSelf(user: AdminUser): boolean {
  return user.id === currentUser.value?.id
}

function menuItems(user: AdminUser) {
  return [
    { type: 'label' as const, label: t('menu.title') },
    { label: t('menu.edit'), onSelect: () => openEdit(user) },
    {
      label: user.banned ? t('menu.unban') : t('menu.ban'),
      disabled: isSelf(user),
      onSelect: () => toggleBan(user),
    },
    {
      label: t('menu.impersonate'),
      disabled: !canImpersonate(user) || impersonatingId.value === user.id,
      onSelect: () => handleImpersonate(user),
    },
    { type: 'separator' as const },
    { label: t('menu.delete'), disabled: isSelf(user), onSelect: () => askDeleteSingle(user) },
  ]
}
</script>

<template>
  <BaseCollectionPage :title="t('title')" :description="t('description')">
    <template #actions>
      <UButton icon="i-lucide-user-plus" :label="t('createUser')" @click="openCreateModal" />
    </template>

    <template #toolbar>
      <BaseCollectionToolbar
        :search="search"
        :search-placeholder="t('searchPlaceholder')"
        :filters="toolbarFilters"
        :view="view"
        :views="viewOptions"
        :busy="loading"
        @update:search="setSearch"
        @update:filter="(key: string, value: string) => setFilter(key, value)"
        @update:view="setView"
      />
    </template>

    <BaseDataTable
      v-if="view === 'table'"
      v-model:selected="selectedIds"
      :rows="filtered"
      :columns="columns"
      :row-key="rowKey"
      :loading="loading"
      selectable
      :empty-title="t('noUsers')"
      empty-icon="i-lucide-users"
    >
      <template #bulk>
        <span class="text-sm font-medium">{{ t('bulk.selected', { count: selectedCount }) }}</span>
        <div class="ms-auto flex flex-wrap items-center gap-2">
          <UButton
            icon="i-lucide-ban"
            size="xs"
            color="warning"
            variant="soft"
            :loading="bulkBusy"
            :label="t('bulk.ban')"
            @click="handleBulkBan"
          />
          <UButton
            icon="i-lucide-undo-2"
            size="xs"
            color="success"
            variant="soft"
            :loading="bulkBusy"
            :label="t('bulk.unban')"
            @click="handleBulkUnban"
          />
          <UButton
            icon="i-lucide-trash-2"
            size="xs"
            color="error"
            variant="soft"
            :loading="bulkBusy"
            :label="t('bulk.delete')"
            @click="askDeleteSelected"
          />
          <UButton size="xs" color="neutral" variant="ghost" :label="t('bulk.clear')" @click="clearSelection" />
        </div>
      </template>

      <template #cell-user="{ row }">
        <div class="flex items-center gap-3">
          <UAvatar :src="row.image || undefined" :alt="row.name || row.email" size="sm" />
          <div class="min-w-0">
            <p class="truncate text-sm font-medium text-highlighted">{{ row.name || t('unnamed') }}</p>
            <p class="truncate text-xs text-muted">{{ row.email }}</p>
          </div>
        </div>
      </template>
      <template #cell-role="{ row }">
        <UBadge :color="roleColor(row.role)" variant="subtle" size="sm">{{ roleLabel(row.role) }}</UBadge>
      </template>
      <template #cell-status="{ row }">
        <UBadge v-if="row.banned" color="error" variant="subtle" size="sm">{{ t('status.banned') }}</UBadge>
        <span v-else class="text-xs text-muted">{{ t('status.active') }}</span>
      </template>
      <template #cell-verified="{ row }">
        <UBadge :color="row.emailVerified ? 'success' : 'neutral'" variant="subtle" size="sm">
          {{ row.emailVerified ? t('status.verified') : t('status.unverified') }}
        </UBadge>
      </template>
      <template #row-actions="{ row }">
        <UDropdownMenu :items="menuItems(row)" :content="{ align: 'end' }">
          <UButton
            icon="i-lucide-ellipsis-vertical"
            color="neutral"
            variant="ghost"
            size="xs"
            :aria-label="t('a11y.actions')"
          />
        </UDropdownMenu>
      </template>

      <template #footer>
        <p class="mt-3 px-1 text-sm text-muted">
          {{ t('footer.selected', { selected: selectedCount, total: filtered.length }) }}
        </p>
      </template>
    </BaseDataTable>

    <BaseCollectionList
      v-else
      :items="filtered"
      :row-key="rowKey"
      :loading="loading"
      :empty-title="t('noUsers')"
      empty-icon="i-lucide-users"
    >
      <template #item="{ item: user }">
        <UAvatar :src="user.image || undefined" :alt="user.name || user.email" size="sm" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-highlighted">{{ user.name || t('unnamed') }}</p>
          <p class="truncate text-sm text-muted">{{ user.email }}</p>
        </div>
        <UBadge class="hidden shrink-0 sm:inline-flex" :color="roleColor(user.role)" variant="subtle" size="sm">
          {{ roleLabel(user.role) }}
        </UBadge>
        <UBadge
          v-if="user.banned"
          class="hidden shrink-0 md:inline-flex"
          color="error"
          variant="subtle"
          size="sm"
        >
          {{ t('status.banned') }}
        </UBadge>
        <UDropdownMenu :items="menuItems(user)" :content="{ align: 'end' }">
          <UButton
            icon="i-lucide-ellipsis-vertical"
            color="neutral"
            variant="ghost"
            size="xs"
            :aria-label="t('a11y.actions')"
          />
        </UDropdownMenu>
      </template>
    </BaseCollectionList>

    <UModal v-model:open="showDeleteModal">
      <template #content>
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold">
              {{ deleteTargets.length === 1
                ? t('deleteModal.titleSingle')
                : t('deleteModal.titleMany', { count: deleteTargets.length }) }}
            </h3>
          </template>
          <div class="space-y-2">
            <p class="text-sm text-muted-foreground">
              {{ deleteTargets.length === 1
                ? t('deleteModal.descriptionSingle')
                : t('deleteModal.descriptionMany') }}
            </p>
            <ul class="max-h-40 space-y-1 overflow-y-auto text-sm">
              <li v-for="target in deleteTargets.slice(0, 5)" :key="target.id" class="truncate font-medium">
                {{ target.name || target.email }}
              </li>
              <li v-if="deleteTargets.length > 5" class="text-muted-foreground">
                {{ t('deleteModal.more', { count: deleteTargets.length - 5 }) }}
              </li>
            </ul>
          </div>
          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton variant="ghost" color="neutral" :label="t('deleteModal.cancel')" @click="closeDeleteModal" />
              <UButton color="error" :label="t('deleteModal.confirm')" @click="confirmDeleteModal" />
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <UModal v-model:open="showCreateModal">
      <template #content>
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold">{{ t('createModal.title') }}</h3>
          </template>
          <div class="space-y-4">
            <UFormField :label="t('createModal.name')">
              <UInput v-model="createForm.name" :placeholder="t('createModal.namePlaceholder')" class="w-full" />
            </UFormField>
            <UFormField :label="t('createModal.email')">
              <UInput
                v-model="createForm.email"
                type="email"
                :placeholder="t('createModal.emailPlaceholder')"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="t('createModal.password')">
              <UInput
                v-model="createForm.password"
                type="password"
                :placeholder="t('createModal.passwordPlaceholder')"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="t('createModal.role')">
              <USelect v-model="createForm.role" :items="roleOptions()" class="w-full" />
            </UFormField>
          </div>
          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton variant="ghost" color="neutral" :label="t('createModal.cancel')" @click="closeCreateModal" />
              <UButton color="primary" :loading="creating" :label="t('createModal.submit')" @click="createUser" />
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <UModal v-model:open="showEditModal">
      <template #content>
        <UCard v-if="selectedUser">
          <template #header>
            <h3 class="text-lg font-semibold">{{ t('editModal.title') }}</h3>
          </template>
          <div class="space-y-4">
            <div class="flex items-center gap-3">
              <UAvatar
                :src="selectedUser.image || undefined"
                :alt="selectedUser.name || selectedUser.email"
                size="sm"
              />
              <div>
                <p class="text-sm font-medium">{{ selectedUser.name || t('unnamed') }}</p>
                <p class="text-xs text-muted-foreground">{{ selectedUser.email }}</p>
              </div>
            </div>
            <UFormField :label="t('editModal.role')">
              <USelect v-model="editForm.role" :items="roleOptions()" class="w-full" />
            </UFormField>
            <UFormField v-if="selectedUser.banned" :label="t('editModal.banReason')">
              <UTextarea
                v-model="banReason"
                :placeholder="t('editModal.banReasonPlaceholder')"
                :rows="3"
                class="w-full"
              />
            </UFormField>
          </div>
          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton variant="ghost" color="neutral" :label="t('editModal.cancel')" @click="closeEditModal" />
              <UButton
                v-if="!selectedUser.banned"
                color="error"
                variant="outline"
                :loading="banning"
                :label="t('editModal.ban')"
                @click="handleBanFromEdit"
              />
              <UButton color="primary" :loading="savingRole" :label="t('editModal.save')" @click="saveUser" />
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </BaseCollectionPage>
</template>
