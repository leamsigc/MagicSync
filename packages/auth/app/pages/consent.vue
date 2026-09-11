<i18n src="./consent.json"></i18n>

<script lang="ts" setup>
const { t } = useI18n()
const route = useRoute()
const toast = useToast()

const status = ref<'loading' | 'ready' | 'working' | 'error'>('loading')
const errorMsg = ref('')
const clientName = ref('')
const requestedScopes = ref<string[]>([])
const businesses = ref<Array<{ id: string, name: string }>>([])
const pickedBusinessId = ref('')
const pickedAccess = ref<'full' | 'read'>('read')

const oauthQuery = computed(() => {
  const idx = route.fullPath.indexOf('?')
  return idx >= 0 ? route.fullPath.slice(idx + 1) : ''
})
const clientId = computed(() => route.query.client_id as string || '')

const { fetchSession } = UseUser()

const sessionData = await fetchSession()
const hasSession = !!sessionData?.user
if (!hasSession) await navigateTo({ path: '/login', query: { redirect: route.fullPath } })

const SCOPE_DESCRIPTIONS: Record<string, string> = {
  openid: 'Verify your identity',
  profile: 'See your name and picture',
  email: 'See your email address',
  offline_access: 'Stay connected when you are offline (refresh access)',
  'mcp:read': 'Read posts, stats, calendar and media — never publish',
  'mcp:full': 'Create, schedule, publish and delete posts on your behalf',
}

function scopeDescription(scope: string): string {
  return SCOPE_DESCRIPTIONS[scope] || scope
}

const showAccessChoice = computed(() => requestedScopes.value.includes('mcp:full'))

const parseRequestedScopes = (scope: unknown): string[] =>
  ((scope as string) || '').split(' ').filter(Boolean)

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : t('failed')

type ConsentContext = {
  clientName: string
  scopes: string[]
  businesses: Array<{ id: string, name: string }>
}

const loadConsentContext = async (clientId: string, scope: unknown): Promise<ConsentContext> => {
  if (!clientId) throw new Error(t('missingClientId'))
  const [client, biz] = await Promise.all([
    $fetch<{ name?: string }>(`/api/v1/oauth/client?client_id=${encodeURIComponent(clientId)}`),
    $fetch<{ data?: Array<{ id: string, name: string }> }>('/api/v1/business'),
  ])
  return {
    clientName: client?.name || clientId,
    scopes: parseRequestedScopes(scope),
    businesses: biz?.data || [],
  }
}

async function loadContext(): Promise<void> {
  status.value = 'loading'
  if (!hasSession) return
  try {
    const context = await loadConsentContext(clientId.value, route.query.scope)
    clientName.value = context.clientName
    requestedScopes.value = context.scopes
    businesses.value = context.businesses
    if (context.businesses.length === 1 && context.businesses[0]) pickedBusinessId.value = context.businesses[0].id
    status.value = 'ready'
  }
  catch (error) {
    status.value = 'error'
    errorMsg.value = toErrorMessage(error)
  }
}

type ConsentResult = {
  redirect_uri?: string
  redirect?: string | boolean
  url?: string
}

const resolveConsentRedirect = (result: ConsentResult | null): string | undefined => {
  if (!result) return undefined
  if (result.redirect_uri) return result.redirect_uri
  if (result.url) return result.url
  return typeof result.redirect === 'string' ? result.redirect : undefined
}

async function handleDecision(accept: boolean): Promise<void> {
  if (accept && !pickedBusinessId.value) {
    toast.add({ title: t('pickBusinessFirst'), color: 'error' })
    return
  }
  status.value = 'working'
  try {
    // Scope subset: full access only if the client asked for it AND the user
    // keeps it. Downgrading to read-only drops mcp:full from the grant.
    let scope: string | undefined
    if (accept && showAccessChoice.value && pickedAccess.value === 'read') {
      scope = requestedScopes.value.filter(s => s !== 'mcp:full').join(' ') || undefined
      if (scope && !scope.includes('mcp:read')) scope = `${scope} mcp:read`
    }
    // NOTE: the plugin consent endpoint is called browser-direct — it needs
    // the HTTP request context and fails via server-to-server auth.api calls.
    const result = await $fetch<ConsentResult>('/api/auth/oauth2/consent', {
      method: 'POST',
      body: {
        accept,
        ...(scope ? { scope } : {}),
        ...(oauthQuery.value ? { oauth_query: oauthQuery.value } : {}),
      },
    })
    const redirectUri = resolveConsentRedirect(result)
    if (!redirectUri) throw new Error(t('failed'))
    // Bind the picked business BEFORE leaving: order controlled here.
    if (accept && pickedBusinessId.value) {
      await $fetch('/api/v1/oauth/consent-business', {
        method: 'POST',
        body: { clientId: clientId.value, businessId: pickedBusinessId.value },
      })
    }
    await navigateTo(redirectUri, { external: true })
  }
  catch (error) {
    status.value = 'ready'
    toast.add({ title: error instanceof Error ? error.message : t('failed'), color: 'error' })
  }
}

function handleAllow(): void {
  void handleDecision(true)
}

function handleDeny(): void {
  void handleDecision(false)
}

onMounted(() => {
  void loadContext()
})

useHead({
  title: t('title'),
  meta: [{ name: 'description', content: t('description') }],
})
</script>

<template>
  <UContainer class="py-12 max-w-xl">
    <div v-if="status === 'loading' || status === 'working'" class="text-center py-12">
      <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin mx-auto mb-4" />
      <p class="text-muted-foreground">{{ status === 'loading' ? t('loading') : t('working') }}</p>
    </div>

    <div v-else-if="status === 'error'" class="text-center py-12">
      <UIcon name="i-lucide-shield-alert" class="w-12 h-12 text-muted-foreground mx-auto mb-4" />
      <h1 class="text-xl font-bold mb-2">{{ t('errorHeading') }}</h1>
      <p class="text-muted-foreground">{{ errorMsg }}</p>
    </div>

    <UCard v-else>
      <template #header>
        <div class="flex items-center gap-3">
          <UIcon name="i-lucide-plug" class="w-8 h-8" />
          <div>
            <h1 class="text-xl font-bold">{{ t('heading', { client: clientName }) }}</h1>
            <p class="text-sm text-muted-foreground">{{ t('subheading') }}</p>
          </div>
        </div>
      </template>

      <div class="space-y-6">
        <div>
          <h2 class="text-sm font-medium mb-2">{{ t('businessLabel') }}</h2>
          <p class="text-xs text-muted-foreground mb-2">{{ t('businessHint') }}</p>
          <USelect
            v-model="pickedBusinessId"
            :items="businesses.map(b => ({ label: b.name, value: b.id }))"
            :placeholder="t('businessPlaceholder')"
            value-key="value"
            label-key="label"
            class="w-full"
          />
        </div>

        <div v-if="showAccessChoice">
          <h2 class="text-sm font-medium mb-2">{{ t('accessLabel') }}</h2>
          <URadioGroup
            v-model="pickedAccess"
            :items="[
              { label: t('accessRead'), value: 'read', description: t('accessReadHint') },
              { label: t('accessFull'), value: 'full', description: t('accessFullHint') },
            ]"
          />
        </div>

        <div>
          <h2 class="text-sm font-medium mb-2">{{ t('scopesLabel') }}</h2>
          <ul class="space-y-1">
            <li v-for="scope in requestedScopes" :key="scope" class="flex items-center gap-2 text-sm">
              <UIcon name="i-lucide-check" class="w-4 h-4 text-green-600" />
              <span class="font-mono text-xs">{{ scope }}</span>
              <span class="text-muted-foreground">— {{ scopeDescription(scope) }}</span>
            </li>
          </ul>
        </div>

        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="handleDeny">{{ t('deny') }}</UButton>
          <UButton :disabled="!pickedBusinessId" @click="handleAllow">{{ t('allow') }}</UButton>
        </div>
      </div>
    </UCard>
  </UContainer>
</template>
