<script lang="ts" setup>
definePageMeta({
  layout: 'dashboard-layout'
})

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

const filteredBusinesses = computed(() => {
  if (!searchQuery.value) return businesses.value
  const q = searchQuery.value.toLowerCase()
  return businesses.value.filter(b =>
    b.name?.toLowerCase().includes(q) ||
    b.category?.toLowerCase().includes(q) ||
    b.website?.toLowerCase().includes(q)
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
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Businesses</h1>
        <p class="text-muted-foreground">View and manage all businesses</p>
      </div>
      <UInput
        v-model="searchQuery"
        placeholder="Search businesses..."
        icon="i-heroicons-magnifying-glass"
        size="sm"
        class="w-64"
      />
    </div>

    <UCard v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin text-muted-foreground" />
    </UCard>

    <div v-else-if="filteredBusinesses.length === 0" class="text-center py-12 text-muted-foreground">
      No businesses found
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <UCard v-for="biz in filteredBusinesses" :key="biz.id" class="hover:border-primary/50 transition-colors">
        <div class="space-y-3">
          <div class="flex items-start justify-between">
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
        </div>
      </UCard>
    </div>
  </div>
</template>
