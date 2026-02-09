import type { NavigationMenuItem } from '@nuxt/ui'
import menu from '../layouts/dashboard/Menu.json'

/**
 * Composable for dashboard navigation links
 * Provides navigation items for the Twitter-style sidebar
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.1
 */
export const useDashboardNavigation = () => {
  const { locale, t } = useI18n()
  const route = useRoute()

  const menuItems = computed(() => menu[locale.value] || {})

  const navigationLinks = computed<NavigationMenuItem[]>(() => {
    const menuData = menuItems.value

    return [
      {
        label: menuData.menu.dashboard,
        icon: 'i-lucide-house',
        to: '/app',
        active: route.path === '/app'
      },
      {
        label: menuData.menu.media,
        icon: 'i-lucide-image',
        to: '/app/media',
        active: route.path.startsWith('/app/media'),
        children: [
          {
            label: menuData.menu.editImage,
            to: '/tools/image-editor',
            icon: 'i-lucide-pencil'
          },
          {
            label: menuData.menu.upload,
            to: '/app/media/upload',
            icon: 'i-lucide-upload'
          },
          {
            label: menuData.menu.all,
            to: '/app/media',
            icon: 'i-lucide-images'
          }
        ]
      },
      {
        label: menuData.menu.calendar,
        icon: 'i-lucide-calendar',
        to: '/app/calendar',
        active: route.path.startsWith('/app/calendar'),
        children: [
          {
            label: menuData.menu.view,
            to: '/app/calendar',
            icon: 'i-lucide-calendar-days'
          },
          {
            label: menuData.menu.weeks,
            to: '/app/calendar/weeks',
            icon: 'i-lucide-calendar-range'
          },
          {
            label: menuData.menu.month,
            to: '/app/calendar/month',
            icon: 'i-lucide-calendar-check'
          }
        ]
      },
      {
        label: menuData.menu.posts,
        icon: 'i-lucide-clipboard-list',
        to: '/app/posts',
        active: route.path.startsWith('/app/posts'),
        children: [
          {
            label: menuData.menu.new,
            to: '/app/posts/new',
            icon: 'i-lucide-plus'
          },
          {
            label: menuData.menu.bulkCreate,
            to: '/app/bulk-scheduler',
            icon: 'i-lucide-layers'
          }
        ]
      },
      {
        label: menuData.menu.integrations,
        icon: 'i-lucide-plug',
        to: '/app/integrations',
        active: route.path.startsWith('/app/integrations'),
        children: [
          {
            label: menuData.menu.active,
            to: '/app/integrations/active',
            icon: 'i-lucide-check-circle'
          },
          {
            label: menuData.menu.providers,
            to: '/app/integrations',
            icon: 'i-lucide-grid-2x2'
          }
        ]
      },
      {
        label: menuData.menu.business,
        icon: 'i-lucide-users',
        to: '/app/business',
        active: route.path.startsWith('/app/business')
      },
      {
        label: menuData.menu.tools,
        icon: 'i-lucide-box',
        to: '/app/ai-tools',
        active: route.path.startsWith('/app/ai-tools') || route.path.startsWith('/app/tools'),
        children: [
          {
            label: menuData.menu.aitools,
            to: '/app/ai-tools/content-split',
            icon: 'i-lucide-sparkles'
          }
        ]
      },
      {
        label: menuData.menu.templates,
        icon: 'i-lucide-layout',
        to: '/app/templates',
        active: route.path.startsWith('/app/templates'),
        children: [
          {
            label: menuData.menu.chat,
            to: '/app/templates/chat',
            icon: 'i-lucide-message-square'
          },
          {
            label: menuData.menu.variables,
            to: '/app/templates/variables',
            icon: 'i-lucide-variable'
          }
        ]
      },
      {
        label: menuData.menu.settings,
        icon: 'i-lucide-settings',
        to: '/app/settings',
        active: route.path.startsWith('/app/settings') || route.path.startsWith('/app/profile') || route.path.startsWith('/app/account'),
        children: [
          {
            label: menuData.menu.profile,
            to: '/app/profile',
            icon: 'i-lucide-user'
          },
          {
            label: menuData.userNav.account,
            to: '/app/account',
            icon: 'i-lucide-user-cog'
          },
          {
            label: menuData.userNav.appearance,
            to: '/app/settings/appearance',
            icon: 'i-lucide-palette'
          },
          {
            label: menuData.menu.notification,
            to: '/app/notifications',
            icon: 'i-lucide-bell'
          }
        ]
      }
    ]
  })

  const userMenuItems = computed(() => {
    const menuData = menuItems.value
    const colorMode = useColorMode()
    const { signOut, user } = UseUser()

    const handleSignOut = async () => {
      await signOut()
      navigateTo('/')
    }

    const setAppearance = (mode: string) => {
      if (mode === 'system') {
        colorMode.preference = 'system'
      } else {
        colorMode.value = mode
      }
    }

    return [
      [
        {
          label: user.value?.name || 'User',
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
          label: menuData.userNav.upgradeToPro,
          icon: 'i-heroicons-sparkles',
          to: '/app/upgrade',
          badge: 'Pro'
        },
        {
          label: menuData.userNav.account,
          icon: 'i-heroicons-user',
          to: '/app/user/profile'
        },
        {
          label: menuData.userNav.settings,
          icon: 'i-heroicons-cog-6-tooth',
          children: [
            {
              label: menuData.userNav.billingSettings,
              icon: 'i-heroicons-credit-card',
              to: '/app/billing'
            },
            {
              label: menuData.userNav.paymentMethods,
              icon: 'i-heroicons-credit-card',
              to: '/app/billing/payment-methods'
            },
            {
              label: menuData.userNav.invoices,
              icon: 'i-heroicons-document-text',
              to: '/app/billing/invoices'
            }
          ]
        }
      ],
      [
        {
          label: menuData.userNav.appearance,
          icon: 'i-heroicons-eye',
          children: [
            {
              label: menuData.userNav.lightMode,
              icon: 'i-heroicons-sun',
              onSelect: () => setAppearance('light')
            },
            {
              label: menuData.userNav.darkMode,
              icon: 'i-heroicons-moon',
              onSelect: () => setAppearance('dark')
            },
            {
              label: menuData.userNav.systemPreference,
              icon: 'i-heroicons-computer-desktop',
              onSelect: () => setAppearance('system')
            }
          ]
        },
        {
          label: menuData.userNav.templates,
          icon: 'i-heroicons-squares-2x2',
          children: [
            {
              label: menuData.userNav.templateGallery,
              icon: 'i-heroicons-squares-2x2',
              to: '/app/templates'
            },
            {
              label: menuData.userNav.createTemplate,
              icon: 'i-heroicons-plus',
              to: '/app/templates/create'
            }
          ]
        }
      ],
      [
        {
          label: menuData.userNav.documentation,
          icon: 'i-heroicons-book-open',
          to: '/docs',
          target: '_blank'
        },
        {
          label: menuData.userNav.apiDocs,
          icon: 'i-heroicons-code-bracket',
          to: '/api-docs',
          target: '_blank'
        },
        {
          label: menuData.userNav.helpCenter,
          icon: 'i-heroicons-lifebuoy',
          to: '/help',
          target: '_blank'
        },
        {
          label: menuData.userNav.support,
          icon: 'i-heroicons-chat-bubble-left-right',
          to: '/support',
          target: '_blank'
        },
        {
          label: menuData.userNav.github,
          icon: 'i-heroicons-mark-github',
          to: 'https://github.com/leamsigc/magicsync',
          target: '_blank'
        },
        {
          label: menuData.userNav.changelog,
          icon: 'i-heroicons-document-text',
          to: '/changelog',
          target: '_blank'
        }
      ],
      [
        {
          label: menuData.userNav.logout,
          icon: 'i-heroicons-arrow-right-on-rectangle',
          onSelect: () => handleSignOut()
        }
      ]
    ]
  })

  return {
    navigationLinks,
    userMenuItems,
    t
  }
}
