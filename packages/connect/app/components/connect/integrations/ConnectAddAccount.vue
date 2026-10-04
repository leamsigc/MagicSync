<!--  Translation file -->
<i18n src="#site/app/pages/app/integrations/connect.json"></i18n>
<script lang="ts" setup>
import { useConnectionManager, type Connection } from '../../../composables/connect/integrations/useConnectionManager';

/**
 *
 * The connection modal here
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import * as z from 'zod'
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui'
const { t, connectionList, setConnectionList, HandleConnectTo } = useConnectionManager();

setConnectionList();
const blueskyModal = ref(false)
const mainModal = ref(false)
const HandleConnectBaseOnThePlatform = (connection: Connection) => {
  if (connection.platform == 'bluesky') {
    blueskyModal.value = true
  } else {
    HandleConnectTo(connection)
  }
}
const schema = z.object({
  baseUrl: z.string().optional(),
  username: z.string('Username is required'),
  password: z.string('Password is required')
})
type Schema = z.output<typeof schema>
const fields = ref<AuthFormField[]>([
  {
    name: 'baseUrl',
    type: 'text',
    label: 'Base URL',
    placeholder: 'Enter your base url',
  },
  {
    name: 'username',
    type: 'text',
    label: 'Username',
    placeholder: 'Enter your username',
    required: true
  },
  {
    name: 'password',
    type: 'password',
    label: 'Password',
    placeholder: 'Enter your password',
    required: true
  },
])

const HandleConnectToBluesky = (payload: FormSubmitEvent<Schema>) => {
  HandleConnectTo({
    name: 'Bluesky',
    icon: 'fa6-brands:bluesky',
    url: '#',
    platform: "bluesky",
    authType: 'api-key'
  }, payload.data)
  blueskyModal.value = false
  mainModal.value = false

}
</script>

<template>
  <UModal v-model:open="mainModal">
    <button
type="button"
      class="w-full md:min-h-60 rounded-xl border-2 border-dashed border-border hover:border-primary bg-elevated/50 hover:bg-elevated transition-colors flex flex-col items-center justify-center gap-3 p-6 cursor-pointer text-highlighted"
      data-tour="connect-add-account"
      @click="mainModal = true">
      <span class="size-14 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
        <UIcon name="i-lucide-plus" class="size-7 text-primary" />
      </span>
      <span class="text-sm font-medium">{{ t('states.add_connection') }}</span>
    </button>
    <template #content>
      <section class="grid grid-cols-2 md:grid-cols-3 gap-4 p-6 overflow-y-auto">
        <UButton
v-for="connection in connectionList" :key="connection.name" color="neutral" variant="soft"
          :disabled="!connection.active" class="p-4 rounded-xl grid place-items-center gap-2 text-center min-h-32"
          @click="HandleConnectBaseOnThePlatform(connection)">
          <template v-if="connection.platform == 'bluesky'">
            <UModal
v-model:open="blueskyModal" title="Bluesky" :ui="{ footer: 'justify-end' }" size="small"
              class="max-w-sm">
              <template #body>
                <UAuthForm
:schema="schema" title="Bluesky" description="Enter bluesky credentials" icon="i-lucide-user"
                  :fields="fields" class="max-w-md" @submit="HandleConnectToBluesky" />
              </template>
            </UModal>

          </template>
          <Icon :name="connection.icon" size="40" class="shrink-0" />
          <h3 class="text-sm font-medium truncate w-full">{{ connection.name }}</h3>
        </UButton>
        <UButton
color="neutral" variant="soft" class="p-4 rounded-xl grid place-items-center gap-2 text-center min-h-32"
          disabled>
          <h3 class="text-sm font-medium">{{ t('states.coming_soon') }}</h3>
        </UButton>
      </section>
    </template>
  </UModal>
</template>
<style scoped></style>
