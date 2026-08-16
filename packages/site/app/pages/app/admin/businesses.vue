<script lang="ts" setup>
import { h, resolveComponent, useTemplateRef } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { Row } from '@tanstack/vue-table'

definePageMeta({
  layout: 'dashboard-layout'
})

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const UDropdownMenu = resolveComponent('UDropdownMenu')

const toast = useToast()

interface AdminBusiness {
  id: string
  name: string | null
  description: string | null
  category: string | null
  address: string | null
  website: string | null
  phone: string | null
  isActive: boolean | null
  userId: string | null
  createdAt: string
}

const businesses = ref<AdminBusiness[]>([])
const loading = ref(true)
const searchQuery = ref('')
const viewMode = ref<'cards' | 'table'>('cards')
const table = useTemplateRef('table')

const filteredBusinesses = computed(() => {
  if (!searchQuery.value) return businesses.value
  const q = searchQuery.value.toLowerCase()
  return businesses.value.filter(b =>
    b.name?.toLowerCase().includes(q) ||
    b.category?.toLowerCase().includes(q) ||
    b.website?.toLowerCase().includes(q) ||
    b.address?.toLowerCase().includes(q)
  )
})

async function fetchBusinesses() {
  loading.value = true
  try {
    const data = await $fetch<{ businesses: AdminBusiness[] }>('/api/v1/admin/businesses')
    businesses.value = data.businesses
  } catch {
    toast.add({ title: 'Error', description: 'Failed to load businesses', color: 'error' })
  } finally {
    loading.value = false
  }
}

onMounted(fetchBusinesses)

const selectedBusiness = ref<AdminBusiness | null>(null)
const showEditModal = ref(false)
const editForm = ref<{
  name: string
  category: string
  address: string
  website: string
  phone: string
  description: string
  isActive: boolean
}>({
  name: '',
  category: '',
  address: '',
  website: '',
  phone: '',
  description: '',
  isActive: true
})

function openEdit(biz: AdminBusiness) {
  selectedBusiness.value = biz
  editForm.value = {
    name: biz.name || '',
    category: biz.category || '',
    address: biz.address || '',
    website: biz.website || '',
    phone: biz.phone || '',
    description: biz.description || '',
    isActive: biz.isActive ?? true
  }
  showEditModal.value = true
}

function closeEditModal() {
  showEditModal.value = false
}

async function saveBusiness() {
  if (!selectedBusiness.value) return
  try {
    await $fetch(`/api/v1/admin/businesses/${selectedBusiness.value.id}`, {
      method: 'PUT',
      body: editForm.value
    })
    toast.add({ title: 'Business Updated', description: `${editForm.value.name || 'Business'} has been updated`, color: 'success' })
    showEditModal.value = false
    await fetchBusinesses()
  } catch {
    toast.add({ title: 'Error', description: 'Failed to update business', color: 'error' })
  }
}

async function deleteBusiness(biz: AdminBusiness) {
  try {
    await $fetch(`/api/v1/admin/businesses/${biz.id}`, { method: 'DELETE' })
    toast.add({ title: 'Business Deleted', description: `${biz.name || 'Business'} has been deleted`, color: 'success' })
    await fetchBusinesses()
  } catch {
    toast.add({ title: 'Error', description: 'Failed to delete business', color: 'error' })
  }
}

function confirmDelete(biz: AdminBusiness) {
  toast.add({
    title: 'Delete Business',
    description: `Are you sure you want to delete ${biz.name || 'this business'}?`,
    color: 'error',
    actions: [
      { label: 'Delete', color: 'error', variant: 'solid', onClick: () => deleteBusiness(biz) },
      { label: 'Cancel', color: 'neutral', variant: 'outline' }
    ]
  })
}

function getRowItems(row: Row<AdminBusiness>) {
  return [
    { type: 'label', label: 'Actions' },
    { label: 'Edit', onSelect: () => openEdit(row.original) },
    { type: 'separator' },
    { label: 'Delete', onSelect: () => confirmDelete(row.original) }
  ]
}

const columns: TableColumn<AdminBusiness>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => h('span', { class: 'font-medium text-sm' }, row.original.name || 'Unnamed Business')
  },
  {
    accessorKey: 'category',
    header: 'Category',
    cell: ({ row }) => h('span', { class: 'text-sm text-muted-foreground' }, row.original.category || '—')
  },
  {
    accessorKey: 'website',
    header: 'Website',
    cell: ({ row }) => h('span', { class: 'text-sm text-muted-foreground' }, row.original.website || '—')
  },
  {
    accessorKey: 'isActive',
    header: 'Status',
    cell: ({ row }) =>
      h(UBadge, { color: row.original.isActive ? 'success' : 'neutral', variant: 'subtle', size: 'sm' }, () =>
        row.original.isActive ? 'Active' : 'Inactive'
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
        <h1 class="text-2xl font-bold tracking-tight">Businesses</h1>
        <p class="text-muted-foreground">View and manage all businesses</p>
      </div>
      <div class="flex flex-col sm:flex-row gap-2">
        <UInput
          v-model="searchQuery"
          placeholder="Search businesses..."
          icon="i-heroicons-magnifying-glass"
          size="sm"
          class="sm:w-64"
        />
        <UButtonGroup size="sm">
          <UButton
            :variant="viewMode === 'cards' ? 'solid' : 'outline'"
            icon="i-lucide-layout-grid"
            @click="() => { viewMode = 'cards' }"
          >
            Cards
          </UButton>
          <UButton
            :variant="viewMode === 'table' ? 'solid' : 'outline'"
            icon="i-lucide-table"
            @click="() => { viewMode = 'table' }"
          >
            Table
          </UButton>
        </UButtonGroup>
      </div>
    </div>

    <div v-if="loading" class="bg-elevated rounded-2xl flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin text-muted-foreground" />
    </div>

    <div v-else-if="filteredBusinesses.length === 0" class="bg-elevated rounded-2xl text-center py-12 text-muted-foreground">
      No businesses found
    </div>

    <div v-else-if="viewMode === 'cards'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="biz in filteredBusinesses" :key="biz.id" class="bg-elevated rounded-2xl p-4 hover:shadow-lg transition-shadow">
        <div class="space-y-3">
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold truncate">{{ biz.name || 'Unnamed Business' }}</h3>
              <p v-if="biz.category" class="text-xs text-muted-foreground">{{ biz.category }}</p>
            </div>
            <UBadge :color="biz.isActive ? 'success' : 'neutral'" variant="subtle" size="sm">
              {{ biz.isActive ? 'Active' : 'Inactive' }}
            </UBadge>
          </div>
          <p v-if="biz.description" class="text-sm text-muted-foreground line-clamp-2">{{ biz.description }}</p>
          <div class="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span v-if="biz.website" class="flex items-center gap-1">
              <UIcon name="lucide:globe" class="w-3 h-3" /> {{ biz.website }}
            </span>
            <span v-if="biz.phone" class="flex items-center gap-1">
              <UIcon name="lucide:phone" class="w-3 h-3" /> {{ biz.phone }}
            </span>
          </div>
          <div class="flex gap-2 pt-1">
            <UButton size="xs" icon="i-lucide-pencil" variant="outline" @click="() => openEdit(biz)">Edit</UButton>
            <UButton size="xs" icon="i-lucide-trash-2" variant="outline" color="error" @click="() => confirmDelete(biz)">Delete</UButton>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="bg-elevated rounded-2xl overflow-hidden">
      <UTable ref="table" :data="filteredBusinesses" :columns="columns" class="flex-1" />
    </div>

    <UModal v-model:open="showEditModal">
      <template #content>
        <UCard v-if="selectedBusiness">
          <template #header>
            <h3 class="text-lg font-semibold">Edit Business</h3>
          </template>
          <div class="space-y-4">
            <UFormField label="Name">
              <UInput v-model="editForm.name" placeholder="Business name" class="w-full" />
            </UFormField>
            <UFormField label="Category">
              <UInput v-model="editForm.category" placeholder="Category" class="w-full" />
            </UFormField>
            <UFormField label="Address">
              <UInput v-model="editForm.address" placeholder="Address" class="w-full" />
            </UFormField>
            <UFormField label="Website">
              <UInput v-model="editForm.website" placeholder="https://..." class="w-full" />
            </UFormField>
            <UFormField label="Phone">
              <UInput v-model="editForm.phone" placeholder="Phone" class="w-full" />
            </UFormField>
            <UFormField label="Description">
              <UTextarea v-model="editForm.description" placeholder="Description" :rows="3" class="w-full" />
            </UFormField>
            <UFormField label="Active">
              <UCheckbox v-model="editForm.isActive" label="Business is active" />
            </UFormField>
          </div>
          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton variant="ghost" color="neutral" @click="closeEditModal">Cancel</UButton>
              <UButton color="primary" @click="saveBusiness">Save Changes</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
