<script lang="ts" setup>
/**
 *
 * Component Description: Dashboard sidebar with navigation menu using Nuxt UI components
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */

import type { NavigationMenuItem } from '@nuxt/ui'
import menu from './Menu.json'

const { locale } = useI18n()



interface Props {
  collapsed?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  collapsed: false
})

const menuItems = computed(() => menu[locale.value] || {})

const navigationItems = computed<NavigationMenuItem[][]>(() => {
  const menuData = menuItems.value

  return [
    [
      // Main Menu
      {
        label: menuData.menu.general,
        type: 'label' as const
      },
      {
        label: menuData.menu.dashboard,
        icon: 'i-lucide-house',
        to: '/app'
      },
      {
        label: menuData.menu.media,
        icon: 'i-lucide-image',
        children: [
          {
            label: menuData.menu.editImage,
            to: '/tools/image-editor'
          },
          {
            label: menuData.menu.upload,
            to: '/app/media/upload'
          },
          {
            label: menuData.menu.all,
            to: '/app/media'
          },
          {
            label: menuData.menu.bulkCreate,
            to: '/app/media/bulk-create'
          }
        ]
      },
      {
        label: menuData.menu.calendar,
        icon: 'i-lucide-calendar',
        children: [
          {
            label: menuData.menu.view,
            to: '/app/calendar'
          },
          {
            label: menuData.menu.weeks,
            to: '/app/calendar/weeks'
          },
          {
            label: menuData.menu.month,
            to: '/app/calendar/month'
          },
          {
            label: menuData.menu.day,
            to: '/app/calendar/day'
          }
        ]
      },
      {
        label: menuData.menu.integrations,
        icon: 'i-lucide-plug',
        children: [
          {
            label: menuData.menu.active,
            to: '/app/integrations/active'
          },
          {
            label: menuData.menu.inactive,
            to: '/app/integrations/inactive'
          },
          {
            label: menuData.menu.new,
            to: '/app/integrations'
          }
        ]
      },
      {
        label: menuData.menu.business,
        icon: 'i-lucide-users',
        children: [
          {
            label: menuData.menu.all,
            to: '/app/business'
          }
        ]
      },
      {
        label: menuData.menu.tools,
        icon: 'i-lucide-box',
        children: [
          {
            label: menuData.menu.textOverImage,
            to: '/app/tools/text-over-image'
          },
          {
            label: menuData.menu.audioToText,
            to: '/app/tools/audio-to-text'
          },
          {
            label: menuData.menu.videoCreation,
            to: '/app/tools/video-creation'
          }
        ]
      },
      {
        label: menuData.menu.templates,
        icon: 'i-lucide-layout',
        children: [
          {
            label: menuData.menu.email,
            to: '/app/templates/email'
          },
          {
            label: menuData.menu.image,
            to: '/app/templates/image'
          }
        ]
      },
      {
        label: menuData.menu.settings,
        icon: 'i-lucide-settings',
        children: [
          {
            label: menuData.menu.profile,
            to: '/app/profile'
          },
          {
            label: menuData.userNav.account,
            to: '/app/account'
          },
          {
            label: menuData.userNav.appearance,
            to: '/app/settings/appearance'
          },
          {
            label: menuData.menu.notification,
            to: '/app/notifications'
          },
          {
            label: menuData.menu.emailTemplate,
            to: '/app/settings/email-template'
          },
          {
            label: menuData.menu.imageTemplate,
            to: '/app/settings/image-template'
          }
        ]
      },
      {
        label: menuData.menu.analytics,
        icon: 'i-lucide-bar-chart-2',
        children: [
          {
            label: menuData.menu.all,
            to: '/app/analytics'
          }
        ]
      },
      {
        label: menuData.menu.posts,
        icon: 'i-lucide-clipboard-list',
        children: [
          {
            label: menuData.menu.new,
            to: '/app/posts/new'
          },
          {
            label: menuData.menu.bulkCreate,
            to: '/app/posts/bulk-create'
          }
        ]
      }
    ],
    // Pages Menu
    [
      {
        label: menuData.menu.pages,
        type: 'label' as const,
        class: "text-muted "
      },
      {
        label: menuData.menu.auth,
        icon: 'i-lucide-lock',
        children: [
          {
            label: menuData.menu.login,
            to: '/login'
          },
          {
            label: menuData.menu.register,
            to: '/register'
          },
          {
            label: menuData.menu.passwordReset,
            to: '/password-reset'
          },
          {
            label: menuData.menu.inviteUser,
            to: '/invite-user'
          }
        ]
      },
      {
        label: menuData.menu.blogs,
        icon: 'i-lucide-book',
        children: [
          {
            label: menuData.menu.featured,
            to: '/blog'
          }
        ]
      },
      {
        label: menuData.menu.components,
        icon: 'i-lucide-box',
        children: [
          {
            label: menuData.menu.all,
            to: '/ui-preview'
          }
        ]
      }
    ]
  ]
})
</script>

<template>
  <div>
    <!-- Main Navigation Menu -->
    <UNavigationMenu :items="navigationItems[0]" orientation="vertical" popover :collapsed="collapsed" color="primary"
      class="data-[orientation=vertical]:space-y-4" type="single" variant="link" />

    <!-- Secondary Navigation Menu -->
    <UNavigationMenu :items="navigationItems[1]" orientation="vertical" popover :collapsed="collapsed" color="primary"
      class="mt-4 data-[orientation=vertical]:space-y-4" />
  </div>
</template>
<style scoped></style>
