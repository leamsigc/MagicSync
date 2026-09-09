<i18n src="./users.json"></i18n>

<script lang="ts" setup>
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { Row } from '@tanstack/vue-table'
import { authClient } from '#layers/BaseAuth/lib/auth-client'

definePageMeta({
  layout: 'dashboard-layout'
})

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const UDropdownMenu = resolveComponent('UDropdownMenu')
const UCheckbox = resolveComponent('UCheckbox')
const UAvatar = resolveComponent('UAvatar')

const { t } = useI18n()
const toast = useToast()

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

const users = ref<AdminUser[]>([])
const loading = ref(true)
const searchQuery = ref('')
const rowSelection = ref<Record<string, boolean>>({})
const bulkBusy = ref(false)

const { user: currentUser } = UseUser()

const selectedCount = computed(() => Object.values(rowSelection.value).filter(Boolean).length)

// Stable row identity: without this TanStack keys selection by row index,
// which desyncs from rowSelection whenever the list is filtered or mutated.
function getUserRowId(row: AdminUser) {
  return row.id
}

const filteredUsers = computed(() => {
  if (!searchQuery.value) return users.value
  const q = searchQuery.value.toLowerCase()
  return users.value.filter(u =>
    u.name?.toLowerCase().includes(q) ||
    u.email.toLowerCase().includes(q) ||
    u.role.toLowerCase().includes(q)
  )
})

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
const createForm = ref({ name: '', email: '', password: '', role: 'user' })

async function createUser() {
  if (!createForm.value.name || !createForm.value.email || !createForm.value.password) {
    toast.add({ title: t('toast.error'), description: t('toast.createRequiresFields'), color: 'error' })
    return
  }
  try {
    await authClient.admin.createUser({
      name: createForm.value.name,
      email: createForm.value.email,
      password: createForm.value.password,
      role: createForm.value.role
    })
    toast.add({ title: t('toast.created'), description: t('toast.createdDescription', { name: createForm.value.name }), color: 'success' })
    showCreateModal.value = false
    createForm.value = { name: '', email: '', password: '', role: 'user' }
    await fetchUsers()
  } catch {
    toast.add({ title: t('toast.error'), description: t('toast.createFailed'), color: 'error' })
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
  try {
    await authClient.admin.setRole({ userId, role: newRole })
    toast.add({ title: t('toast.updated'), description: t('toast.updatedDescription', { name: userLabel }), color: 'success' })
    showEditModal.value = false
  } catch {
    patchUser(userId, { role: prevRole })
    toast.add({ title: t('toast.error'), description: t('toast.updateFailed'), color: 'error' })
  }
}

function toggleBan(user: AdminUser) {
  if (user.banned) {
    unban(user)
  } else {
    openEdit(user)
  }
}

interface BulkItemResult {
  userId: string
  ok: boolean
  skipped?: boolean
  error?: string
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

function selectedRows(): AdminUser[] {
  const ids = new Set(
    Object.entries(rowSelection.value)
      .filter(([, selected]) => selected)
      .map(([id]) => id)
  )
  if (ids.size === 0) return []
  return filteredUsers.value.filter(user => ids.has(user.id))
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
    toast.add({ title: t('toast.unbanned'), description: t('toast.unbannedDescription', { name: user.name || user.email }), color: 'success' })
  } catch {
    patchUser(user.id, { banned: true, banReason: user.banReason })
    toast.add({ title: t('toast.error'), description: t('toast.unbanFailed'), color: 'error' })
  }
}

async function banUser(user: AdminUser) {
  const reason = banReason.value || t('defaultBanReason')
  patchUser(user.id, { banned: true, banReason: reason })
  try {
    await authClient.admin.banUser({ userId: user.id, banReason: reason })
    toast.add({ title: t('toast.banned'), description: t('toast.bannedDescription', { name: user.name || user.email }), color: 'success' })
    showEditModal.value = false
  } catch {
    patchUser(user.id, { banned: false, banReason: null })
    toast.add({ title: t('toast.error'), description: t('toast.banFailed'), color: 'error' })
  }
}

function handleBanFromEdit() {
  if (selectedUser.value) {
    banUser(selectedUser.value)
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
    toast.add({ title: t('toast.deleted'), description: t('toast.deletedDescription', { name: user.name || user.email }), color: 'success' })
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
  rowSelection.value = {}
  if (succeeded > 0) {
    toast.add({ title: t('toast.bulkTitle'), description: t('toast.bulkSuccess', { count: succeeded, action: actionLabel(action) }), color: 'success' })
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
    skippedSelf: targets.some(target => target.id === selfId)
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
      body: { action, userIds: eligible.map(target => target.id) }
    })
    const skippedByServer = applyBulkResults(action, eligible, response.results)
    if (skippedSelf || skippedByServer > 0) {
      toast.add({ title: t('toast.skippedSelf'), description: t('toast.skippedSelfDescription'), color: 'info' })
    }
  } catch {
    toast.add({ title: t('toast.error'), description: t('toast.bulkFailed', { action: actionLabel(action) }), color: 'error' })
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
  rowSelection.value = {}
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
  askDelete([user], async ([target]) => { await deleteUser(target) })
}

function askDeleteSelected() {
  const targets = selectedRows()
  if (targets.length === 0) return
  askDelete(targets, async selections => { await runBulk('delete', selections) })
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

function getRowItems(row: Row<AdminUser>) {
  const isSelf = row.original.id === currentUser.value?.id
  return [
    { type: 'label', label: t('menu.title') },
    { label: t('menu.edit'), onSelect: () => openEdit(row.original) },
    { label: row.original.banned ? t('menu.unban') : t('menu.ban'), disabled: isSelf, onSelect: () => toggleBan(row.original) },
    { type: 'separator' },
    { label: t('menu.delete'), disabled: isSelf, onSelect: () => askDeleteSingle(row.original) }
  ]
}

function roleColor(role: string): 'warning' | 'info' {
  return role === 'admin' ? 'warning' : 'info'
}

function roleOptions() {
  return [
    { label: t('roles.user'), value: 'user' },
    { label: t('roles.admin'), value: 'admin' }
  ]
}

const columns: TableColumn<AdminUser>[] = [
  {
    id: 'select',
    header: ({ table }) =>
      h(UCheckbox, {
        modelValue: table.getIsSomePageRowsSelected()
          ? 'indeterminate'
          : table.getIsAllPageRowsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') =>
          table.toggleAllPageRowsSelected(!!value),
        'aria-label': t('a11y.selectAll')
      }),
    cell: ({ row }) =>
      h(UCheckbox, {
        modelValue: row.getIsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') => row.toggleSelected(!!value),
        'aria-label': t('a11y.selectRow')
      })
  },
  {
    accessorKey: 'email',
    header: t('columns.user'),
    cell: ({ row }) => {
      const user = row.original
      return h('div', { class: 'flex items-center gap-3' }, [
        h(UAvatar, { src: user.image || undefined, alt: user.name || user.email, size: 'sm' }),
        h('div', null, [
          h('p', { class: 'font-medium text-sm' }, user.name || t('unnamed')),
          h('p', { class: 'text-xs text-muted-foreground' }, user.email)
        ])
      ])
    }
  },
  {
    accessorKey: 'role',
    header: t('columns.role'),
    cell: ({ row }) =>
      h(UBadge, { color: roleColor(row.original.role), variant: 'subtle', size: 'sm' }, () =>
        row.original.role
      )
  },
  {
    accessorKey: 'banned',
    header: t('columns.status'),
    cell: ({ row }) => {
      if (row.original.banned) {
        return h(UBadge, { color: 'error', variant: 'subtle', size: 'sm' }, () => t('status.banned'))
      }
      return h('span', { class: 'text-xs text-muted-foreground' }, t('status.active'))
    }
  },
  {
    accessorKey: 'emailVerified',
    header: t('columns.verified'),
    cell: ({ row }) =>
      h(UBadge, { color: row.original.emailVerified ? 'success' : 'neutral', variant: 'subtle', size: 'sm' }, () =>
        row.original.emailVerified ? t('status.verified') : t('status.unverified')
      )
  },
  {
    id: 'actions',
    header: () => h('div', { class: 'text-right' }, t('columns.actions')),
    cell: ({ row }) =>
      h('div', { class: 'text-right' }, [
        h(UDropdownMenu, {
          content: { align: 'end' },
          items: getRowItems(row),
          'aria-label': t('a11y.actions')
        }, () =>
          h(UButton, {
            icon: 'i-lucide-ellipsis-vertical',
            color: 'neutral',
            variant: 'ghost',
            size: 'sm',
            'aria-label': t('a11y.actions')
          })
        )
      ])
  }
]
</script>

<template>
  <div class="space-y-6">
    <div v-motion-fade-visible-once
      class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ t('title') }}</h1>
        <p class="text-muted-foreground">{{ t('description') }}</p>
      </div>
      <div class="flex flex-col sm:flex-row gap-2">
        <UInput v-model="searchQuery" :placeholder="t('searchPlaceholder')" icon="i-heroicons-magnifying-glass"
          size="sm" class="sm:w-64" />
        <UButton icon="i-lucide-user-plus" size="sm" @click="openCreateModal">
          {{ t('createUser') }}
        </UButton>
      </div>
    </div>

    <div v-if="selectedCount > 0" v-motion-slide-bottom :duration="250"
      class="flex flex-wrap items-center gap-2 rounded shadow px-4 py-3">
      <span class="text-sm font-medium">{{ t('bulk.selected', { count: selectedCount }) }}</span>
      <div class="flex-1" />
      <UButton icon="i-lucide-ban" size="sm" color="warning" variant="soft" :loading="bulkBusy" @click="handleBulkBan">
        {{ t('bulk.ban') }}
      </UButton>
      <UButton icon="i-lucide-undo-2" size="sm" color="success" variant="soft" :loading="bulkBusy"
        @click="handleBulkUnban">
        {{ t('bulk.unban') }}
      </UButton>
      <UButton icon="i-lucide-trash-2" size="sm" color="error" variant="soft" :loading="bulkBusy"
        @click="askDeleteSelected">
        {{ t('bulk.delete') }}
      </UButton>
      <UButton size="sm" color="neutral" variant="ghost" @click="clearSelection">
        {{ t('bulk.clear') }}
      </UButton>
    </div>

    <div v-if="loading" class=" rounded flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin text-muted-foreground" />
    </div>

    <div v-else v-motion-fade-visible-once class="shadow rounded overflow-hidden">
      <div v-if="filteredUsers.length === 0" class="text-center py-12 text-muted-foreground">
        {{ t('noUsers') }}
      </div>

      <UTable v-else v-model:row-selection="rowSelection" :data="filteredUsers" :columns="columns"
        :get-row-id="getUserRowId" class="flex-1"
        :ui="{ 'tr': 'bg-transparent transition-colors', 'td': 'border-0', 'th': 'border-0' }" />

      <div class="px-5 py-4  text-sm text-muted flex items-center justify-between">
        <span :key="selectedCount" v-motion-fade :duration="200">
          {{ t('footer.selected', { selected: selectedCount, total: filteredUsers.length }) }}
        </span>
      </div>
    </div>

    <UModal v-model:open="showDeleteModal">
      <template #content>
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold">
              {{ deleteTargets.length === 1 ? t('deleteModal.titleSingle') : t('deleteModal.titleMany', {
                count: deleteTargets.length }) }}
            </h3>
          </template>
          <div class="space-y-2">
            <p class="text-sm text-muted-foreground">
              {{ deleteTargets.length === 1 ? t('deleteModal.descriptionSingle') :
                t('deleteModal.descriptionMany') }}
            </p>
            <ul class="max-h-40 overflow-y-auto space-y-1 text-sm">
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
              <UButton variant="ghost" color="neutral" @click="closeDeleteModal">{{ t('deleteModal.cancel') }}
              </UButton>
              <UButton color="error" @click="confirmDeleteModal">{{ t('deleteModal.confirm') }}</UButton>
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
              <UInput v-model="createForm.email" type="email" :placeholder="t('createModal.emailPlaceholder')"
                class="w-full" />
            </UFormField>
            <UFormField :label="t('createModal.password')">
              <UInput v-model="createForm.password" type="password"
                :placeholder="t('createModal.passwordPlaceholder')" class="w-full" />
            </UFormField>
            <UFormField :label="t('createModal.role')">
              <USelect v-model="createForm.role" :items="roleOptions()" class="w-full" />
            </UFormField>
          </div>
          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton variant="ghost" color="neutral" @click="closeCreateModal">{{ t('createModal.cancel') }}
              </UButton>
              <UButton color="primary" @click="createUser">{{ t('createModal.submit') }}</UButton>
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
              <UAvatar :src="selectedUser.image || undefined" :alt="selectedUser.name || selectedUser.email"
                size="sm" />
              <div>
                <p class="font-medium text-sm">{{ selectedUser.name || t('unnamed') }}</p>
                <p class="text-xs text-muted-foreground">{{ selectedUser.email }}</p>
              </div>
            </div>
            <UFormField :label="t('editModal.role')">
              <USelect v-model="editForm.role" :items="roleOptions()" class="w-full" />
            </UFormField>
            <UFormField v-if="selectedUser.banned" :label="t('editModal.banReason')">
              <UTextarea v-model="banReason" :placeholder="t('editModal.banReasonPlaceholder')" :rows="3"
                class="w-full" />
            </UFormField>
          </div>
          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton variant="ghost" color="neutral" @click="closeEditModal">{{ t('editModal.cancel') }}</UButton>
              <UButton v-if="!selectedUser.banned" color="error" variant="outline" @click="handleBanFromEdit">
                {{ t('editModal.ban') }}
              </UButton>
              <UButton color="primary" @click="saveUser">{{ t('editModal.save') }}</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
