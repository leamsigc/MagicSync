<script lang="ts" setup>
const route = useRoute()
const router = useRouter()

const invitationId = computed(() => route.query.id as string)
const status = ref<'checking' | 'accepting' | 'success' | 'error'>('checking')
const errorMsg = ref('')

onMounted(async () => {
  if (!invitationId.value) {
    status.value = 'error'
    errorMsg.value = 'Invalid invitation link'
    return
  }

  const { loggedIn, fetchSession } = UseUser()
  await fetchSession()

  if (!loggedIn.value) {
    status.value = 'error'
    errorMsg.value = 'not_logged_in'
    return
  }

  status.value = 'accepting'

  try {
    await $fetch('/api/auth/accept-invitation', {
      method: 'POST',
      body: { id: invitationId.value }
    })
    status.value = 'success'
    setTimeout(() => router.push('/app/business'), 2000)
  } catch (err: any) {
    if (err?.status === 401 || err?.status === 403) {
      status.value = 'error'
      errorMsg.value = 'not_logged_in'
      return
    }
    status.value = 'error'
    errorMsg.value = err?.data?.message || err?.message || 'Failed to accept invitation'
  }
})
</script>

<template>
  <div class="min-h-screen grid place-content-center bg-background p-6">
    <UCard class="max-w-md w-full">
      <template #header>
        <div class="text-center">
          <div class="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <UIcon name="lucide:user-plus" class="w-5 h-5 text-primary" />
          </div>
          <h1 class="text-xl font-bold">
            {{ status === 'success' ? 'Welcome to the Team!' : status === 'error' && errorMsg === 'not_logged_in' ? 'Sign In Required' : status === 'error' ? 'Invitation Error' : 'Accepting Invitation...' }}
          </h1>
        </div>
      </template>

      <div class="py-8 text-center">
        <template v-if="status === 'checking' || status === 'accepting'">
          <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary mb-4" />
          <p class="text-muted-foreground">
            {{ status === 'checking' ? 'Verifying your session...' : 'Adding you to the business...' }}
          </p>
        </template>

        <template v-if="status === 'success'">
          <div class="mx-auto w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mb-3">
            <UIcon name="lucide:check" class="w-6 h-6 text-success" />
          </div>
          <p class="font-medium mb-1">Invitation Accepted!</p>
          <p class="text-sm text-muted-foreground">
            You now have full access to this business and all its accounts. Redirecting...
          </p>
        </template>

        <template v-if="status === 'error' && errorMsg === 'not_logged_in'">
          <div class="mx-auto w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center mb-3">
            <UIcon name="lucide:log-in" class="w-6 h-6 text-warning" />
          </div>
          <p class="font-medium mb-2">Sign in to accept your invitation</p>
          <p class="text-sm text-muted-foreground mb-6">
            You need to sign in or create an account before you can accept this invitation.
            Already have an account? Sign in below.
          </p>
          <div class="flex flex-col gap-3">
            <UButton color="primary" size="lg" @click="router.push(`/login?redirect=/accept-invitation%3Fid%3D${invitationId}`)">
              Sign In
            </UButton>
            <UButton variant="outline" color="neutral" size="lg" @click="router.push(`/register?redirect=/accept-invitation%3Fid%3D${invitationId}`)">
              Create an Account
            </UButton>
          </div>
        </template>

        <template v-if="status === 'error' && errorMsg !== 'not_logged_in'">
          <div class="mx-auto w-12 h-12 rounded-full bg-error/10 flex items-center justify-center mb-3">
            <UIcon name="lucide:x" class="w-6 h-6 text-error" />
          </div>
          <p class="font-medium mb-1">Unable to Accept Invitation</p>
          <p class="text-sm text-muted-foreground mb-4">{{ errorMsg }}</p>
          <div class="flex flex-col gap-3">
            <UButton variant="outline" color="neutral" @click="router.push('/login')">Sign In</UButton>
            <UButton variant="ghost" color="neutral" @click="router.push('/')">Go Home</UButton>
          </div>
        </template>
      </div>
    </UCard>
  </div>
</template>
