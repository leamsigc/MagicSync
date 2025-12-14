<!--  Translation file -->
<i18n src="../connect.json"></i18n>
<script lang="ts" setup>
import { useConnectionManager, type Connection } from '../composables/useConnectionManager';

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
const { connectionList, setConnectionList, HandleConnectTo } = useConnectionManager();

setConnectionList();

const { t } = useI18n();
const toast = useToast();
const HandleConnectBaseOnThePlatform = (connection: Connection) => {
  if (connection.platform == 'bluesky') {
    blueskyModal.value = true
  } else {
    HandleConnectTo(connection)
  }
}
const blueskyModal = ref(false)
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

}
</script>

<template>
  <UModal>
    <UButton color="primary" variant="outline" class="grid place-content-center py-8 shadow cursor-pointer md:size-56">
      <section class="flex flex-col items-center gap-2 border-2 border-primary  rounded-full p-4 mb-2 w-24 h-24">
        <Icon name="lucide:plus" size="80" class="" />
      </section>
      <h3 class=" text-center">{{ t('states.add_connection') }}</h3>
    </UButton>
    <template #content>
      <section class="grid grid-cols-2 md:grid-cols-3 gap-4 p-6 overflow-y-auto">
        <UButton color="neutral" variant="soft" v-for="connection in connectionList" :key="connection.name"
          @click="HandleConnectBaseOnThePlatform(connection)"
          class="p-4   rounded grid place-content-center text-center">
          <template v-if="connection.platform == 'bluesky'">
            <UModal v-model:open="blueskyModal" title="Bluesky" :ui="{ footer: 'justify-end' }" size="small"
              class="max-w-sm">
              <template #body>
                <UAuthForm :schema="schema" title="Bluesky" description="Enter bluesky credentials" icon="i-lucide-user"
                  :fields="fields" @submit="HandleConnectToBluesky" class="max-w-md" />
              </template>
            </UModal>

          </template>
          <Icon :name="connection.icon" size="48" class="w-20" />
          <h3>{{ connection.name }}</h3>
        </UButton>
        <UButton color="neutral" variant="soft" class="p-4  rounded grid place-content-center text-center" disabled>
          <h3>{{ t('states.coming_soon') }}</h3>
        </UButton>
      </section>
    </template>
  </UModal>
</template>
<style scoped></style>
