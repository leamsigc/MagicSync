<script lang="ts" setup>
definePageMeta({
  layout: 'dashboard-layout'
})

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
const selectedUser = ref<AdminUser | null>(null)
const showBanModal = ref(false)
const banReason = ref('')
const searchQuery = ref('')

const filteredUsers = computed(() => {
  if (!searchQuery.value) return users.value
  const q = searchQuery.value.toLowerCase()
  return users.value.filter(u =>
    u.name?.toLowerCase().includes(q) ||
    u.email.toLowerCase().includes(q)
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

async function toggleBan(user: AdminUser) {
  if (user.banned) {
    try {
      await $fetch(`/api/v1/admin/users/${user.id}/unban`, { method: 'POST' })
      toast.add({ title: 'User Unbanned', description: `${user.name || user.email} has been unbanned`, color: 'success' })
      await fetchUsers()
    } catch {
      toast.add({ title: 'Error', description: 'Operation failed', color: 'error' })
    }
  } else {
    selectedUser.value = user
    banReason.value = ''
    showBanModal.value = true
  }
}

async function confirmBan() {
  if (!selectedUser.value) return
  try {
    await $fetch(`/api/v1/admin/users/${selectedUser.value.id}/ban`, {
      method: 'POST',
      body: { banReason: banReason.value || 'Violated terms of service' }
    })
    toast.add({ title: 'User Banned', description: `${selectedUser.value.name || selectedUser.value.email} has been banned`, color: 'success' })
    showBanModal.value = false
    await fetchUsers()
  } catch {
    toast.add({ title: 'Error', description: 'Failed to ban user', color: 'error' })
  }
}

onMounted(fetchUsers)
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Users</h1>
        <p class="text-muted-foreground">Manage user accounts and roles</p>
      </div>
      <UInput
        v-model="searchQuery"
        placeholder="Search users..."
        icon="i-heroicons-magnifying-glass"
        size="sm"
        class="w-64"
      />
    </div>

    <UCard v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin text-muted-foreground" />
    </UCard>

    <UCard v-else>
      <div v-if="filteredUsers.length === 0" class="text-center py-12 text-muted-foreground">
        No users found
      </div>

      <table v-else class="w-full">
        <thead>
          <tr class="border-b border-border text-left">
            <th class="py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">User</th>
            <th class="py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Role</th>
            <th class="py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
            <th class="py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Verified</th>
            <th class="py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in filteredUsers" :key="user.id" class="border-b border-border hover:bg-muted/50">
            <td class="py-3 px-4">
              <div class="flex items-center gap-3">
                <UAvatar :src="user.image || undefined" :alt="user.name || user.email" size="sm" />
                <div>
                  <p class="font-medium text-sm">{{ user.name || 'Unnamed' }}</p>
                  <p class="text-xs text-muted-foreground">{{ user.email }}</p>
                </div>
              </div>
            </td>
            <td class="py-3 px-4">
              <UBadge :color="user.role === 'admin' ? 'warning' : 'info'" variant="subtle" size="sm">
                {{ user.role }}
              </UBadge>
            </td>
            <td class="py-3 px-4">
              <UBadge v-if="user.banned" color="error" variant="subtle" size="sm">Banned</UBadge>
              <span v-else class="text-xs text-muted-foreground">Active</span>
            </td>
            <td class="py-3 px-4">
              <UBadge :color="user.emailVerified ? 'success' : 'neutral'" variant="subtle" size="sm">
                {{ user.emailVerified ? 'Verified' : 'Unverified' }}
              </UBadge>
            </td>
            <td class="py-3 px-4 text-right">
              <UButton
                :color="user.banned ? 'success' : 'error'"
                variant="ghost"
                size="sm"
                @click="toggleBan(user)"
              >
                {{ user.banned ? 'Unban' : 'Ban' }}
              </UButton>
            </td>
          </tr>
        </tbody>
      </table>
    </UCard>

    <UModal v-model:open="showBanModal">
      <template #content>
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold">Ban User</h3>
          </template>
          <p class="text-sm text-muted-foreground mb-4">
            Are you sure you want to ban <strong>{{ selectedUser?.name || selectedUser?.email }}</strong>?
          </p>
          <UFormField label="Ban Reason">
            <UTextarea v-model="banReason" placeholder="Enter reason for ban..." :rows="3" class="w-full" />
          </UFormField>
          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton variant="ghost" color="neutral" @click="showBanModal = false">Cancel</UButton>
              <UButton color="error" @click="confirmBan">Confirm Ban</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
