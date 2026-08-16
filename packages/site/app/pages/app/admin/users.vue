<script lang="ts" setup>
import { h, resolveComponent, useTemplateRef } from 'vue'
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

const table = useTemplateRef('table')

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
    toast.add({ title: 'Error', description: 'Failed to load users', color: 'error' })
  } finally {
    loading.value = false
  }
}

onMounted(fetchUsers)

const showCreateModal = ref(false)
const createForm = ref({ name: '', email: '', password: '', role: 'user' })

async function createUser() {
  if (!createForm.value.name || !createForm.value.email || !createForm.value.password) {
    toast.add({ title: 'Error', description: 'Name, email and password are required', color: 'error' })
    return
  }
  try {
    await authClient.admin.createUser({
      name: createForm.value.name,
      email: createForm.value.email,
      password: createForm.value.password,
      role: createForm.value.role
    })
    toast.add({ title: 'User Created', description: `${createForm.value.name} has been created`, color: 'success' })
    showCreateModal.value = false
    createForm.value = { name: '', email: '', password: '', role: 'user' }
    await fetchUsers()
  } catch {
    toast.add({ title: 'Error', description: 'Failed to create user', color: 'error' })
  }
}

const selectedUser = ref<AdminUser | null>(null)
const showEditModal = ref(false)
const editForm = ref({ role: 'user' })
const banReason = ref('')

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
  try {
    if (editForm.value.role !== selectedUser.value.role) {
      await authClient.admin.setRole({ userId: selectedUser.value.id, role: editForm.value.role })
    }
    toast.add({ title: 'User Updated', description: `${selectedUser.value.name || selectedUser.value.email} has been updated`, color: 'success' })
    showEditModal.value = false
    await fetchUsers()
  } catch {
    toast.add({ title: 'Error', description: 'Failed to update user', color: 'error' })
  }
}

function toggleBan(user: AdminUser) {
  if (user.banned) {
    unban(user)
  } else {
    openEdit(user)
  }
}

async function unban(user: AdminUser) {
  try {
    await authClient.admin.unbanUser({ userId: user.id })
    toast.add({ title: 'User Unbanned', description: `${user.name || user.email} has been unbanned`, color: 'success' })
    await fetchUsers()
  } catch {
    toast.add({ title: 'Error', description: 'Failed to unban user', color: 'error' })
  }
}

async function banUser(user: AdminUser) {
  try {
    await authClient.admin.banUser({ userId: user.id, banReason: banReason.value || 'Violated terms of service' })
    toast.add({ title: 'User Banned', description: `${user.name || user.email} has been banned`, color: 'success' })
    showEditModal.value = false
    await fetchUsers()
  } catch {
    toast.add({ title: 'Error', description: 'Failed to ban user', color: 'error' })
  }
}

async function deleteUser(user: AdminUser) {
  try {
    await authClient.admin.removeUser({ userId: user.id })
    toast.add({ title: 'User Deleted', description: `${user.name || user.email} has been deleted`, color: 'success' })
    await fetchUsers()
  } catch {
    toast.add({ title: 'Error', description: 'Failed to delete user', color: 'error' })
  }
}

function confirmDelete(user: AdminUser) {
  toast.add({
    title: 'Delete User',
    description: `Are you sure you want to delete ${user.name || user.email}?`,
    color: 'error',
    actions: [
      { label: 'Delete', color: 'error', variant: 'solid', onClick: () => deleteUser(user) },
      { label: 'Cancel', color: 'neutral', variant: 'outline' }
    ]
  })
}

function getRowItems(row: Row<AdminUser>) {
  return [
    { type: 'label', label: 'Actions' },
    { label: 'Edit', onSelect: () => openEdit(row.original) },
    { label: row.original.banned ? 'Unban' : 'Ban', onSelect: () => toggleBan(row.original) },
    { type: 'separator' },
    { label: 'Delete', onSelect: () => confirmDelete(row.original) }
  ]
}

function roleColor(role: string): 'warning' | 'info' {
  return role === 'admin' ? 'warning' : 'info'
}

function roleOptions() {
  return [
    { label: 'User', value: 'user' },
    { label: 'Admin', value: 'admin' }
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
    accessorKey: 'email',
    header: 'User',
    cell: ({ row }) => {
      const user = row.original
      return h('div', { class: 'flex items-center gap-3' }, [
        h(UAvatar, { src: user.image || undefined, alt: user.name || user.email, size: 'sm' }),
        h('div', null, [
          h('p', { class: 'font-medium text-sm' }, user.name || 'Unnamed'),
          h('p', { class: 'text-xs text-muted-foreground' }, user.email)
        ])
      ])
    }
  },
  {
    accessorKey: 'role',
    header: 'Role',
    cell: ({ row }) =>
      h(UBadge, { color: roleColor(row.original.role), variant: 'subtle', size: 'sm' }, () =>
        row.original.role
      )
  },
  {
    accessorKey: 'banned',
    header: 'Status',
    cell: ({ row }) => {
      if (row.original.banned) {
        return h(UBadge, { color: 'error', variant: 'subtle', size: 'sm' }, () => 'Banned')
      }
      return h('span', { class: 'text-xs text-muted-foreground' }, 'Active')
    }
  },
  {
    accessorKey: 'emailVerified',
    header: 'Verified',
    cell: ({ row }) =>
      h(UBadge, { color: row.original.emailVerified ? 'success' : 'neutral', variant: 'subtle', size: 'sm' }, () =>
        row.original.emailVerified ? 'Verified' : 'Unverified'
      )
  },
  {
    id: 'actions',
    header: () => h('div', { class: 'text-right' }, 'Actions'),
    cell: ({ row }) =>
      h('div', { class: 'text-right' }, [
        h(UDropdownMenu, {
          content: { align: 'end' },
          items: getRowItems(row),
          'aria-label': 'Actions dropdown'
        }, () =>
          h(UButton, {
            icon: 'i-lucide-ellipsis-vertical',
            color: 'neutral',
            variant: 'ghost',
            size: 'sm',
            'aria-label': 'Actions dropdown'
          })
        )
      ])
  }
]
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Users</h1>
        <p class="text-muted-foreground">Manage user accounts and roles</p>
      </div>
      <div class="flex flex-col sm:flex-row gap-2">
        <UInput
          v-model="searchQuery"
          placeholder="Search users..."
          icon="i-heroicons-magnifying-glass"
          size="sm"
          class="sm:w-64"
        />
        <UButton icon="i-lucide-user-plus" size="sm" @click="() => { showCreateModal = true }">
          Create User
        </UButton>
      </div>
    </div>

    <div v-if="loading" class="bg-elevated rounded-2xl flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin text-muted-foreground" />
    </div>

    <div v-else class="bg-elevated rounded-2xl overflow-hidden">
      <div v-if="filteredUsers.length === 0" class="text-center py-12 text-muted-foreground">
        No users found
      </div>

      <UTable
        v-else
        ref="table"
        v-model:row-selection="rowSelection"
        :data="filteredUsers"
        :columns="columns"
        class="flex-1"
      />

      <div class="px-5 py-4 border-t border-border/50 text-sm text-muted flex items-center justify-between">
        <span>
          {{ table?.tableApi?.getFilteredSelectedRowModel().rows.length || 0 }} of
          {{ table?.tableApi?.getFilteredRowModel().rows.length || 0 }} row(s) selected.
        </span>
      </div>
    </div>

    <UModal v-model:open="showCreateModal">
      <template #content>
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold">Create User</h3>
          </template>
          <div class="space-y-4">
            <UFormField label="Name">
              <UInput v-model="createForm.name" placeholder="Full name" class="w-full" />
            </UFormField>
            <UFormField label="Email">
              <UInput v-model="createForm.email" type="email" placeholder="user@example.com" class="w-full" />
            </UFormField>
            <UFormField label="Password">
              <UInput v-model="createForm.password" type="password" placeholder="Temporary password" class="w-full" />
            </UFormField>
            <UFormField label="Role">
              <USelect v-model="createForm.role" :items="roleOptions()" class="w-full" />
            </UFormField>
          </div>
          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton variant="ghost" color="neutral" @click="closeCreateModal">Cancel</UButton>
              <UButton color="primary" @click="createUser">Create User</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <UModal v-model:open="showEditModal">
      <template #content>
        <UCard v-if="selectedUser">
          <template #header>
            <h3 class="text-lg font-semibold">Edit User</h3>
          </template>
          <div class="space-y-4">
            <div class="flex items-center gap-3">
              <UAvatar :src="selectedUser.image || undefined" :alt="selectedUser.name || selectedUser.email" size="sm" />
              <div>
                <p class="font-medium text-sm">{{ selectedUser.name || 'Unnamed' }}</p>
                <p class="text-xs text-muted-foreground">{{ selectedUser.email }}</p>
              </div>
            </div>
            <UFormField label="Role">
              <USelect v-model="editForm.role" :items="roleOptions()" class="w-full" />
            </UFormField>
            <UFormField v-if="selectedUser.banned" label="Ban Reason">
              <UTextarea v-model="banReason" placeholder="Enter reason for ban..." :rows="3" class="w-full" />
            </UFormField>
          </div>
          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton variant="ghost" color="neutral" @click="closeEditModal">Cancel</UButton>
              <UButton v-if="!selectedUser.banned" color="error" variant="outline" @click="() => banUser(selectedUser)">
                Ban User
              </UButton>
              <UButton color="primary" @click="saveUser">Save Changes</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
