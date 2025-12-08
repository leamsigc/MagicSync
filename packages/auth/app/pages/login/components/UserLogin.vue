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

const fields = computed<AuthFormField[]>(() => [{
  name: 'email',
  type: 'email',
  label: t('form.email'),
  placeholder: t('placeholders.email'),
  required: true,
  disabled: true
}, {
  name: 'password',
  label: t('form.password'),
  type: 'password',
  placeholder: t('placeholders.password'),
  required: true,
  disabled: true
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
  label: t('buttons.continue_with_github'),
  icon: 'i-simple-icons-github',
  onClick: () => {
    // TODO: Implement GitHub login
    add({
      title: t('coming_soon.title'),
      description: t('coming_soon.description'),
      color: 'info'
    })
  }
}]

const schema = z.object({
  email: z.email('Invalid email'),
  password: z.string('Password is required').min(5, 'Must be at least 5 characters')
})

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
