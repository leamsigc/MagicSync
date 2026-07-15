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
  const { user } = UseUser()

  const menuItems = computed(() => menu[locale.value] || {})

  const isAdmin = computed(() => user.value?.role === 'admin')

  const navigationLinks = computed<NavigationMenuItem[]>(() => {
    const menuData = menuItems.value

    const links: NavigationMenuItem[] = [
      {
        label: menuData.menu.home,
        icon: 'i-lucide-home',
        to: '/app/home',
        active: route.path === '/app/home'
      },
      {
        label: menuData.menu.dashboard,
        icon: 'i-lucide-square',
        to: '/app',
        active: route.path === '/app'
      },
      {
        label: menuData.menu.media,
        icon: 'i-lucide-image',
        to: '/app/media',
        active: route.path.startsWith('/app/media'),
        defaultOpen: false,
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
        defaultOpen: false,
        children: [
          {
            label: menuData.menu.view,
            to: '/app/posts',
            icon: 'i-lucide-grid'
          },
          {
            label: menuData.menu.month,
            to: '/app/posts/feeds',
            icon: 'i-lucide-newspaper'
          },
          {
            label: menuData.menu.weeks,
            to: '/app/calendar/weeks',
            icon: 'i-lucide-calendar-range'
          },
          {
            label: menuData.menu.day,
            to: '/app/calendar/day',
            icon: 'i-lucide-calendar'
          }
          // TODO:Should show the post in board/table/grid/Twitter feed like
        ]
      },
      {
        label: menuData.menu.posts,
        icon: 'i-lucide-clipboard-list',
        to: '/app/posts',
        active: route.path.startsWith('/app/posts'),
        defaultOpen: true,
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
        defaultOpen: false,
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
        active: route.path.startsWith('/app/business'),
        defaultOpen: false,
        children: [
          {
            label: menuData.menu.all,
            to: '/app/business',
            icon: 'i-lucide-users'
          }
        ]
      },
      {
        label: menuData.menu.apiKeys,
        icon: 'i-lucide-key',
        to: '/app/keys',
        active: route.path.startsWith('/app/keys')
      },
      {
        label: menuData.menu.tools,
        icon: 'i-lucide-box',
        to: '/app/tools',
        active: route.path.startsWith('/app/tools') || route.path.startsWith('/tools'),
        defaultOpen: false,
        children: [
          {
            label: menuData.menu.aitools,
            to: '/app/tools/content-split',
            icon: 'i-lucide-sparkles'
          },
          // {
          //   label: menuData.menu.chat,
          //   to: '/app/ai-tools/chat',
          //   icon: 'i-lucide-message-square'
          // },
          {
            label: menuData.menu.growthStrategies,
            to: '/app/tools/growth-stratergy',
            icon: 'i-lucide-trending-up'
          },
          // {
          //   label: menuData.menu.aiToolsTools,
          //   to: '/app/ai-tools/tools',
          //   icon: 'i-lucide-wrench'
          // },
          // {
          //   label: menuData.menu.aiToolsSettings,
          //   to: '/app/ai-tools/settings',
          //   icon: 'i-lucide-settings'
          // },
          // {
          //   label: menuData.menu.analytics,
          //   to: '/app/ai-tools/knowledge',
          //   icon: 'i-lucide-folder'
          // },
          // {
          //   label: menuData.menu.aiToolsSkills,
          //   to: '/app/ai-tools/skills',
          //   icon: 'i-lucide-sparkles'
          // }
        ]
      },
      {
        label: menuData.menu.templates,
        icon: 'i-lucide-layout',
        to: '/app/templates',
        active: route.path.startsWith('/app/templates'),
        defaultOpen: false,
        children: [
          {
            label: menuData.menu.chat,
            to: '/app/templates/chat',
            icon: 'i-lucide-message-square'
          },
          {
            label: menuData.menu.email,
            to: '/app/templates/email',
            icon: 'i-lucide-mail'
          },
          {
            label: menuData.menu.image,
            to: '/app/templates/images',
            icon: 'i-lucide-image'
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
        defaultOpen: false,
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
            to: '/app/keys',
            icon: 'i-lucide-key'
          },
          {
            label: menuData.menu.notification,
            to: '/app/notifications',
            icon: 'i-lucide-bell'
          }
        ]
      }
    ]

    if (isAdmin.value) {
      links.push({
        label: 'Admin',
        icon: 'i-lucide-shield',
        to: '/app/admin',
        active: route.path.startsWith('/admin'),
        defaultOpen: false,
        children: [
          {
            label: 'Dashboard',
            to: '/app/admin',
            icon: 'i-lucide-gauge'
          },
          {
            label: 'Users',
            to: '/app/admin/users',
            icon: 'i-lucide-users'
          },
          {
            label: 'Businesses',
            to: '/app/admin/businesses',
            icon: 'i-lucide-building-2'
          },
          {
            label: 'Integrations',
            to: '/app/admin/integrations',
            icon: 'i-lucide-plug'
          },
          {
            label: 'Audit Log',
            to: '/app/admin/audit',
            icon: 'i-lucide-scroll-text'
          }
        ]
      })
    }

    return links
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
          to: '/app/profile'
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
