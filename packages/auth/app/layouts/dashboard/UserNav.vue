<i18n src="./Menu.json"></i18n>

<script lang="ts" setup>
import type { User } from '#layers/BaseDB/db/auth/auth';

/**
 *
 * Component Description: User navigation dropdown for the dashboard header with complex menu structure including themes, templates, and account management.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.1.0
 *>
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 * @todo [✔] Implement complex UDropdownMenu structure
 * @todo [✔] Add theme customization logic
 * @todo [✔] Add appearance mode toggles
 * @todo [✔] Configure template links section
 * @todo [✔] Add documentation and GitHub links
 */

interface Props {
  collapsed?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  collapsed: false
})
const { t } = useI18n();
const colorMode = useColorMode();

const { signOut, user } = UseUser();

const currentAppearance = ref('system');

const items = computed(() => [
  [
    {
      label: 'satnaing',
      name: user.value?.name || 'User',
      email: user.value?.email || 'user@email',
      avatar: {
        src: user.value?.image || "https://avatars.githubusercontent.com/u/23272293?s=96&v=4",
        alt: user.value?.name || 'Avatar'
      },
      slot: 'account',
      disabled: true
    }
  ],
  [
    {
      label: t('userNav.upgradeToPro'),
      icon: 'i-heroicons-sparkles',
      to: '/app/upgrade',
      badge: 'Pro'
    },
    {
      label: t('userNav.account'),
      icon: 'i-heroicons-user',
      to: '/app/user/profile'
    },
    {
      label: t('userNav.settings'),
      icon: 'i-heroicons-cog-6-tooth',
      children: [
        {
          label: t('userNav.billingSettings'),
          icon: 'i-heroicons-credit-card',
          to: '/app/billing'
        },
        {
          label: t('userNav.paymentMethods'),
          icon: 'i-heroicons-credit-card',
          to: '/app/billing/payment-methods'
        },
        {
          label: t('userNav.invoices'),
          icon: 'i-heroicons-document-text',
          to: '/app/billing/invoices'
        }
      ]
    }
  ],
  [
    {
      label: t('userNav.appearance'),
      icon: 'i-heroicons-eye',
      children: [
        {
          label: t('userNav.lightMode'),
          icon: 'i-heroicons-sun',
          onSelect: () => setAppearance('light')
        },
        {
          label: t('userNav.darkMode'),
          icon: 'i-heroicons-moon',
          onSelect: () => setAppearance('dark')
        },
        {
          label: t('userNav.systemPreference'),
          icon: 'i-heroicons-computer-desktop',
          onSelect: () => setAppearance('system')
        }
      ]
    },
    {
      label: t('userNav.templates'),
      icon: 'i-heroicons-squares-2x2',
      children: [
        {
          label: t('userNav.templateGallery'),
          icon: 'i-heroicons-squares-2x2',
          to: '/app/templates'
        },
        {
          label: t('userNav.createTemplate'),
          icon: 'i-heroicons-plus',
          to: '/app/templates/create'
        }
      ]
    }
  ],
  [
    {
      label: t('userNav.documentation'),
      icon: 'i-heroicons-book-open',
      to: '/docs',
      target: '_blank'
    },
    {
      label: t('userNav.apiDocs'),
      icon: 'i-heroicons-code-bracket',
      to: '/api-docs',
      target: '_blank'
    },
    {
      label: t('userNav.helpCenter'),
      icon: 'i-heroicons-lifebuoy',
      to: '/help',
      target: '_blank'
    },
    {
      label: t('userNav.support'),
      icon: 'i-heroicons-chat-bubble-left-right',
      to: '/support',
      target: '_blank'
    },
    {
      label: t('userNav.github'),
      icon: 'i-heroicons-mark-github',
      to: 'https://github.com/leamsigc/magicsync',
      target: '_blank'
    },
    {
      label: t('userNav.changelog'),
      icon: 'i-heroicons-document-text',
      to: '/changelog',
      target: '_blank'
    }
  ],
  [
    {
      label: t('userNav.logout'),
      icon: 'i-heroicons-arrow-right-on-rectangle',
      onSelect: () => handleSignOut()
    }
  ]
]);

const setAppearance = (mode: string) => {

  currentAppearance.value = mode;
  updateAppearance(mode);
};

const updateAppearance = (mode: string) => {

  // Use Nuxt color mode for switching
  if (mode === 'system') {
    colorMode.preference = 'system';
  } else {
    colorMode.value = mode;
  }
};

const handleSignOut = async () => {
  await signOut()
  navigateTo('/')
};
</script>

<template>
  <UDropdownMenu :items="items" :ui="{ content: 'bg-gray-50 dark:bg-gray-950' }">
    <UButton color="neutral" variant="ghost" class="w-full justify-start">
      <div v-if="props.collapsed">
        <UAvatar :src="user?.image || ''" :alt="user?.name" />
      </div>
      <div class="flex items-center gap-3 p-3" v-else>
        <UAvatar :src="user?.image || ''" :alt="user?.name" size="2xl" />
        <div class="text-left min-w-0 flex-1">
          <p class="truncate font-medium text-sm">
            {{ user?.name || 'User' }}
          </p>
          <p class="truncate text-xs text-gray-500 dark:text-gray-400">
            {{ user?.email || 'email@domain.com' }}
          </p>
        </div>
      </div>
    </UButton>

    <template #account="{ item }">
      <div class="flex items-center gap-3 p-3">
        <UAvatar :src="item.avatar?.src" :alt="item.avatar?.alt" size="2xl" />
        <div class="text-left min-w-0 flex-1">
          <p class="truncate font-medium text-sm">
            {{ item.name }}
          </p>
          <p class="truncate text-xs text-gray-500 dark:text-gray-400">
            {{ item.email }}
          </p>
        </div>
      </div>
    </template>



    <template #item="{ item }">
      <div class="flex items-center gap-2">
        <UIcon v-if="'icon' in item" :name="item.icon" class="shrink-0 h-4 w-4 text-gray-500" />
        <span class="truncate">{{ item.label }}</span>
        <UBadge v-if="'badge' in item" :label="item.badge" variant="subtle" size="xs" class="ml-auto" />
      </div>
    </template>

    <template #item-leading="{ item }">
      <UIcon v-if="'icon' in item" :name="item.icon" class="shrink-0 h-4 w-4 text-gray-500" />
    </template>
  </UDropdownMenu>
</template>

<style scoped></style>
