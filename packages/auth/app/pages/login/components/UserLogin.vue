<!--  Translation file -->
<i18n src="../login.json"></i18n>

<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent, AuthFormField } from '@nuxt/ui'

/**
* Component Description: Premium user login component with social authentication
*
* @author Ismael Garcia <leamsigc@leamsigc.com>
* @version 0.0.1
*
* @todo [ ] Test the component
* @todo [ ] Integration test
* @todo [✔] Update the typescript
*/
interface Props {
  redirectUrl?: string
}
const { signIn } = await import('#layers/BaseAuth/lib/auth-client')

const props = withDefaults(defineProps<Props>(), {
  redirectUrl: '/app/'
})

const { t } = useI18n()
const { add } = useToast()
const route = useRoute()
const router = useRouter()

/**
 * Better Auth sends OAuth callback failures here with `?error=<code>` when the
 * visitor has no session (see oauth-error.get.ts). Surface it once, then strip
 * the parameter so a refresh does not repeat the toast.
 */
function reportOAuthError() {
  const code = route.query.error
  if (typeof code !== 'string' || !code) return
  add({
    title: t('messages.login_error'),
    description: t('messages.oauth_error', { code }),
    color: 'error',
    // An OAuth failure needs the visitor's attention (they just came back from
    // a broken consent screen) — keep it until dismissed instead of letting it
    // vanish while they read the page.
    duration: 0,
  })
  const rest = { ...route.query }
  delete rest.error
  void router.replace({ query: rest })
}

onMounted(reportOAuthError)

const fields = computed<AuthFormField[]>(() => [{
  name: 'email',
  type: 'email',
  label: t('form.email'),
  placeholder: t('placeholders.email'),
  required: true,
}, {
  name: 'password',
  label: t('form.password'),
  type: 'password',
  placeholder: t('placeholders.password'),
  required: true,
}, {
  name: 'remember',
  label: t('form.remember_me'),
  type: 'checkbox'
}])

const providers = [{
  label: t('buttons.continue_with_google'),
  icon: 'i-simple-icons-google',
  onClick: signInWithGoogle
}, {
  label: t('buttons.continue_with_facebook'),
  icon: 'i-simple-icons-facebook',
  onClick: signInWithFacebook
}, {
  label: t('buttons.continue_with_linkedin'),
  icon: 'i-simple-icons-linkedin',
  onClick: signInWithLinkedIn
},
]

const schema = z.object({
  email: z.email('Invalid email'),
  password: z.string('Password is required').min(5, 'Must be at least 5 characters')
})

/**
 * Where Better Auth sends a failed OAuth callback — the same landing used by the
 * connect flow. For anonymous callers it logs the code and bounces to
 * `/login?error=<code>`, which `reportOAuthError` turns into a toast.
 */
const OAUTH_ERROR_CALLBACK = '/api/v1/social-accounts/oauth-error'

type Schema = z.output<typeof schema>

async function onSubmit(payload: FormSubmitEvent<Schema>) {
  await HandleLoginUser(payload.data.email, payload.data.password)
}

async function HandleLoginUser(email: string, password: string) {
  add({
    title: t('coming_soon.title'),
    description: t('coming_soon.description'),
    color: 'info'
  })
  return;
  // TODO: For now only google is available
  await signIn.email({
    email,
    password,
    callbackURL: props.redirectUrl,
    fetchOptions: {
      onError: (context: any) => {
        add({
          title: t('messages.login_error'),
          description: context?.error?.message || t('messages.check_credentials'),
          color: 'error'
        })
      }
    }
  })
}

async function signInWithGoogle() {
  await signIn.social({
    provider: 'google',
    callbackURL: props.redirectUrl,
    errorCallbackURL: OAUTH_ERROR_CALLBACK,
    fetchOptions: {
      onError: (context: any) => {
        add({
          title: t('messages.login_error'),
          description: context?.error?.message || t('messages.check_credentials'),
          color: 'error'
        })
      }
    }
  })
}

async function signInWithFacebook() {
  await signIn.social({
    provider: 'facebook',
    callbackURL: props.redirectUrl,
    errorCallbackURL: OAUTH_ERROR_CALLBACK,
    fetchOptions: {
      onError: (context: any) => {
        add({
          title: t('messages.login_error'),
          description: context?.error?.message || t('messages.check_credentials'),
          color: 'error'
        })
      }
    }
  })
}

async function signInWithLinkedIn() {
  await signIn.social({
    provider: 'linkedin',
    callbackURL: props.redirectUrl,
    errorCallbackURL: OAUTH_ERROR_CALLBACK,
    fetchOptions: {
      onError: (context: any) => {
        add({
          title: t('messages.login_error'),
          description: context?.error?.message || t('messages.check_credentials'),
          color: 'error'
        })
      }
    }
  })
}
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-4 p-4">
    <UToaster />
    <div class="absolute inset-0">
      <BaseBeams :beam-width="2" :beam-height="35" :beam-number="24" :light-color="'#ffffff'" :speed="1"
        :noise-intensity="2" :scale="0.2" :rotation="45" />
    </div>
    <UPageCard class="w-full max-w-lg lg:min-w-lg bg-default dark:bg-black/50" variant="ghost">
      <UAuthForm :schema="schema" :title="t('title')" :description="t('description')" icon="i-lucide-user"
        :fields="fields" :providers="providers" @submit="onSubmit" />
      <USeparator />
      <UButton variant="ghost" class="w-full">
        <NuxtLink to="/register">
          {{ t('links.register') }}
          <span class="underline">{{ t('links.register_link') }}</span>
        </NuxtLink>
      </UButton>
    </UPageCard>

  </div>
</template>

<style scoped></style>
