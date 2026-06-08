<i18n src="../business.json"></i18n>
<script lang="ts" setup>
const { t } = useI18n()
const toast = useToast()

const props = defineProps<{
  businessId: string
}>()

const email = ref('')
const sending = ref(false)

interface Member {
  id: string
  userId: string
  role: string
  user?: {
    name: string | null
    email: string
    image: string | null
  }
}

const members = ref<Member[]>([])
const loadingMembers = ref(true)

async function fetchMembers() {
  loadingMembers.value = true
  try {
    const data = await $fetch<{ members: Member[] }>(`/api/v1/business/${props.businessId}/members`)
    members.value = data.members ?? []
  } catch {
    console.error('Failed to fetch members')
  } finally {
    loadingMembers.value = false
  }
}

async function handleInvite() {
  if (!email.value) return
  sending.value = true
  try {
    await $fetch(`/api/v1/business/${props.businessId}/invite`, {
      method: 'POST',
      body: { email: email.value, role: 'member' }
    })
    toast.add({
      title: 'Invitation Sent',
      description: `${email.value} will receive an email to join this business. They will be automatically added upon registration.`,
      color: 'success'
    })
    email.value = ''
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send invitation'
    toast.add({
      title: 'Error',
      description: message,
      color: 'error'
    })
  } finally {
    sending.value = false
  }
}

onMounted(() => {
  fetchMembers()
})
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <UIcon name="lucide:users" class="w-5 h-5 text-primary" />
          <h3 class="text-lg font-semibold">Team</h3>
        </div>
        <UBadge v-if="!loadingMembers" color="neutral" variant="subtle" size="sm">
          {{ members.length }} {{ members.length === 1 ? 'member' : 'members' }}
        </UBadge>
      </div>
    </template>

    <div class="flex items-center gap-2">
      <UInput
        v-model="email"
        type="email"
        placeholder="colleague@example.com"
        icon="lucide:mail-plus"
        size="lg"
        class="flex-1"
        :disabled="sending"
      />
      <UButton
        color="primary"
        :loading="sending"
        :disabled="!email"
        @click="handleInvite"
      >
        Invite
      </UButton>
    </div>

    <p class="text-xs text-muted-foreground mt-2">
      They'll receive an email to join this business. Upon registration, they'll automatically get access to all accounts and settings.
    </p>

    <div v-if="!loadingMembers && members.length > 0" class="mt-4 space-y-1">
      <div v-for="member in members" :key="member.id"
        class="flex items-center gap-2 py-1.5">
        <UAvatar
          :src="member.user?.image || undefined"
          :alt="member.user?.name || member.user?.email || 'Member'"
          size="xs"
        />
        <span class="text-sm flex-1 truncate">{{ member.user?.name || member.user?.email }}</span>
        <UBadge color="neutral" variant="subtle" size="sm">{{ member.role }}</UBadge>
      </div>
    </div>

    <div v-if="loadingMembers" class="flex justify-center py-3">
      <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin text-muted-foreground" />
    </div>
  </UCard>
</template>
