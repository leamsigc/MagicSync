<!--  Translation file -->
<i18n src="../register.json"></i18n>

<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent, AuthFormField } from '@nuxt/ui'

/**
* Component Description: Premium user register component with social authentication
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
const { signUp, signIn } = await import('#layers/BaseAuth/lib/auth-client')

const props = withDefaults(defineProps<Props>(), {
  redirectUrl: '/app/'
})

const { t } = useI18n()
const { add } = useToast()

const fields = computed<AuthFormField[]>(() => [{
  name: 'firstName',
  type: 'text',
  label: t('form.first_name'),
  placeholder: t('placeholders.first_name'),
  required: true,
  disabled: true
}, {
  name: 'lastName',
  type: 'text',
  label: t('form.last_name'),
  placeholder: t('placeholders.last_name'),
  required: true,
  disabled: true
}, {
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
  name: 'passwordConfirm',
  label: t('form.password_confirm'),
  type: 'password',
  placeholder: t('placeholders.password_confirm'),
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
    // TODO: Implement GitHub registration
    add({
      title: t('coming_soon.title'),
      description: t('coming_soon.description'),
      color: 'info'
    })
  }
}]

const schema = z.object({
  firstName: z.string('First name is required').min(1, 'First name is required'),
  lastName: z.string('Last name is required').min(1, 'Last name is required'),
  email: z.string('Email is required').email('Invalid email'),
  password: z.string('Password is required').min(5, 'Must be at least 5 characters'),
  passwordConfirm: z.string('Password confirmation is required')
}).refine((data) => data.password === data.passwordConfirm, {
  message: 'Passwords do not match',
  path: ['passwordConfirm']
})

type Schema = z.output<typeof schema>

async function onSubmit(payload: FormSubmitEvent<Schema>) {
  await HandleRegisterUser(payload.data)
}

async function HandleRegisterUser(data: Schema) {

  add({
    title: t('messages.register_error'),
    description: "Registration only available by invitation code",
    color: 'error'
  })
  return;
  // TODO: For now only google is available
  await signUp.email({
    email: data.email,
    password: data.password,
    name: `${data.firstName} ${data.lastName}`
      .toUpperCase()
      .replaceAll(' ', '-'),
    firstName: data.firstName,
    lastName: data.lastName,
    callbackURL: props.redirectUrl,
    fetchOptions: {
      onError: (context: any) => {
        add({
          title: t('messages.register_error'),
          description: context?.error?.message || t('messages.check_information'),
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
          title: t('messages.register_error'),
          description: context?.error?.message || t('messages.check_information'),
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
    <div class="absolute inset-0 min-h-screen">
      <BaseBeams :beam-width="2" :beam-height="35" :beam-number="24" :light-color="'#ffffff'" :speed="1"
        :noise-intensity="2" :scale="0.2" :rotation="45" />
    </div>
    <UPageCard class="w-full max-w-lg lg:min-w-lg bg-default dark:bg-black/50" variant="ghost">
      <UAuthForm :schema="schema" :title="t('title')" :description="t('description')" icon="i-lucide-user-plus"
        :fields="fields" :providers="providers" @submit="onSubmit" />
      <USeparator />
      <UButton variant="ghost" class="w-full">
        <NuxtLink to="/login">
          {{ t('links.login') }}
          <span class="underline">{{ t('links.login_link') }}</span>
        </NuxtLink>
      </UButton>
    </UPageCard>
  </div>
</template>

<style scoped></style>
