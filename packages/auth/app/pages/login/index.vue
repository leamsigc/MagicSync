<!--  Translation file -->
<i18n src="./login.json"></i18n>

<script lang="ts" setup>
import UserLogin from './components/UserLogin.vue';
/**
 * Component Description: Login page with premium design and social authentication
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test
 * @todo [✔] Update the typescript
 */

const { t } = useI18n()
const route = useRoute()

const redirectUrl = computed(() => (route.query.redirect as string) || '/app/')

// Page meta with translations
useHead({
  title: t('title'),
  meta: [
    { name: 'description', content: t('description') }
  ]
})
</script>

<template>
  <div class="min-h-screen grid place-content-center ">
    <UserLogin :redirect-url="redirectUrl" />
  </div>
</template>

<style scoped></style>
