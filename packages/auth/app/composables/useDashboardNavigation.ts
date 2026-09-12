import type { NavigationMenuItem } from '@nuxt/ui'
import menu from '../layouts/dashboard/Menu.json'

/**
 * Composable for dashboard navigation links
 * Organised for business owners: daily actions first,
 * then content creation, then one-time setup.
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.2
 */
export const useDashboardNavigation = () => {
  const { locale, t } = useI18n()
  const route = useRoute()
  const { user } = UseUser()

  const menuItems = computed(() => menu[locale.value] || {})

  const isAdmin = computed(() => user.value?.role === 'admin')

  const navigationLinks = computed<NavigationMenuItem[]>(() => {
    const m = menuItems.value

    const links: NavigationMenuItem[] = [
      // ── Daily ──────────────────────────────────────────────
      {
        label: m.menu.dashboard,
        icon: 'i-lucide-home',
        to: '/app',
        active: route.path === '/app'
      },
      {
        label: m.menu.calendar,
        icon: 'i-lucide-calendar',
        to: '/app/calendar',
        active: route.path.startsWith('/app/calendar'),
        children: [
          {
            label: m.menu.month,
            to: '/app/calendar',
            icon: 'i-lucide-calendar'
          },
          {
            label: m.menu.weeks,
            to: '/app/calendar/weeks',
            icon: 'i-lucide-calendar-range'
          },
          {
            label: m.menu.day,
            to: '/app/calendar/day',
            icon: 'i-lucide-calendar-days'
          }
        ]
      },
      {
        label: m.menu.posts,
        icon: 'i-lucide-pen-line',
        to: '/app/posts',
        active: route.path.startsWith('/app/posts') || route.path.startsWith('/app/bulk-scheduler'),
        defaultOpen: false,
        children: [
          {
            label: m.menu.new,
            to: '/app/posts/new',
            icon: 'i-lucide-plus'
          },
          {
            label: m.menu.allPosts,
            to: '/app/posts',
            icon: 'i-lucide-list'
          },
          {
            label: m.menu.feed,
            to: '/app/posts/feeds',
            icon: 'i-lucide-messages-square'
          },
          {
            label: m.menu.bulkCreate,
            to: '/app/bulk-scheduler',
            icon: 'i-lucide-layers'
          }
        ]
      },

      {
        label: m.menu.inbox,
        icon: 'i-lucide-inbox',
        to: '/app/inbox',
        active: route.path.startsWith('/app/inbox')
      },
      {
        label: m.menu.grow,
        icon: 'i-lucide-trending-up',
        to: '/app/grow',
        active: route.path.startsWith('/app/grow')
      },
      {
        label: m.menu.autoReply || 'Auto-Reply',
        icon: 'i-lucide-message-circle-heart',
        to: '/app/auto-reply',
        active: route.path.startsWith('/app/auto-reply')
      },

      // ── Content ────────────────────────────────────────────
      { type: 'label', label: m.menu.sectionContent },
      {
        label: m.menu.toolbox,
        icon: 'i-lucide-wrench',
        to: '/app/toolbox',
        active: route.path.startsWith('/app/toolbox')
      },
      {
        label: m.menu.pipelines,
        icon: 'i-lucide-workflow',
        to: '/app/pipelines',
        active: route.path.startsWith('/app/pipelines'),
        children: [
          {
            label: m.menu.allPipelines,
            to: '/app/pipelines',
            icon: 'i-lucide-list'
          },
          {
            label: m.menu.agentOversight,
            to: '/app/pipelines/agents',
            icon: 'i-lucide-bot'
          }
        ]
      },
      {
        label: m.menu.media,
        icon: 'i-lucide-image',
        to: '/app/media',
        active: route.path.startsWith('/app/media'),
        children: [
          {
            label: m.menu.upload,
            to: '/app/media/upload',
            icon: 'i-lucide-upload'
          },
          {
            label: m.menu.all,
            to: '/app/media',
            icon: 'i-lucide-images'
          },
          {
            label: m.menu.editImage,
            to: '/tools/image-editor',
            icon: 'i-lucide-pencil'
          }
        ]
      },
      {
        label: m.menu.tools,
        icon: 'i-lucide-sparkles',
        to: '/app/tools',
        active: route.path.startsWith('/app/tools') || route.path.startsWith('/tools'),
        children: [
          {
            label: m.menu.aitools,
            to: '/app/tools/content-split',
            icon: 'i-lucide-recycle'
          },
          {
            label: m.menu.videoCropper,
            to: '/app/tools/video-cropper',
            icon: 'i-lucide-crop'
          },
          {
            label: m.menu.textToAudio,
            to: '/app/tools/text-to-speech',
            icon: 'i-lucide-volume-2'
          },
          {
            label: m.menu.growthStrategies,
            to: '/app/tools/growth-stratergy',
            icon: 'i-lucide-trending-up'
          },
          {
            label: m.menu.chat,
            to: '/app/ai-tools/chat',
            icon: 'i-lucide-bot'
          },
          {
            label: m.menu.aiToolsData,
            to: '/app/ai-tools/knowledge',
            icon: 'i-lucide-folder-open'
          },
          {
            label: m.menu.aiToolsSkills,
            to: '/app/ai-tools/skills',
            icon: 'i-lucide-blocks'
          }
        ]
      },

      // ── Setup ──────────────────────────────────────────────
      { type: 'label', label: m.menu.sectionSetup },
      {
        label: m.menu.connectAccounts,
        icon: 'i-lucide-plug',
        to: '/app/integrations',
        active: route.path.startsWith('/app/integrations'),
        children: [
          {
            label: m.menu.active,
            to: '/app/integrations/active',
            icon: 'i-lucide-check-circle'
          },
          {
            label: m.menu.providers,
            to: '/app/integrations',
            icon: 'i-lucide-grid-2x2'
          }
        ]
      },
      {
        label: m.menu.business,
        icon: 'i-lucide-building-2',
        to: '/app/business',
        active: route.path.startsWith('/app/business') || route.path === '/app/home',
        children: [
          {
            label: m.menu.allBusinesses,
            to: '/app/business',
            icon: 'i-lucide-list'
          },
          {
            label: m.menu.switchBusiness,
            to: '/app/home',
            icon: 'i-lucide-repeat'
          }
        ]
      },

      // ── Settings ───────────────────────────────────────────
      { type: 'label', label: m.menu.settings },
      {
        label: m.menu.templates,
        icon: 'i-lucide-layout-template',
        to: '/app/templates',
        active: route.path.startsWith('/app/templates'),
        children: [
          {
            label: m.menu.all,
            to: '/app/templates',
            icon: 'i-lucide-images'
          },
          {
            label: m.menu.chat,
            to: '/app/templates/chat',
            icon: 'i-lucide-message-square'
          },
          {
            label: m.menu.email,
            to: '/app/templates/email',
            icon: 'i-lucide-mail'
          },
          {
            label: m.menu.image,
            to: '/app/templates/images',
            icon: 'i-lucide-image'
          },
          {
            label: m.menu.variables,
            to: '/app/templates/variables',
            icon: 'i-lucide-variable'
          }
        ]
      },
      {
        label: m.menu.profile,
        icon: 'i-lucide-user',
        to: '/app/profile',
        active: route.path.startsWith('/app/profile')
      },
      {
        label: m.userNav.account,
        icon: 'i-lucide-user-cog',
        to: '/app/account',
        active: route.path.startsWith('/app/account')
      },
      {
        label: m.menu.notification,
        icon: 'i-lucide-bell',
        to: '/app/notifications',
        active: route.path.startsWith('/app/notifications')
      },
      {
        label: m.menu.apiKeys,
        icon: 'i-lucide-key',
        to: '/app/keys',
        active: route.path.startsWith('/app/keys')
      }
    ]

    if (isAdmin.value) {
      links.push(
        { type: 'label', label: m.menu.adminSection },
        {
          label: m.menu.admin,
          icon: 'i-lucide-shield',
          to: '/app/admin',
          active: route.path.startsWith('/app/admin'),
          children: [
            {
              label: m.menu.admin,
              to: '/app/admin',
              icon: 'i-lucide-gauge'
            },
            {
              label: m.menu.users,
              to: '/app/admin/users',
              icon: 'i-lucide-users'
            },
            {
              label: m.menu.businesses,
              to: '/app/admin/businesses',
              icon: 'i-lucide-building-2'
            },
            {
              label: m.menu.integrations,
              to: '/app/admin/integrations',
              icon: 'i-lucide-plug'
            },
            {
              label: m.menu.auditLog,
              to: '/app/admin/audit',
              icon: 'i-lucide-scroll-text'
            },
            {
              label: m.menu.announcements,
              to: '/app/admin/announcements',
              icon: 'i-lucide-megaphone'
            },
            {
              label: m.menu.feedback,
              to: '/app/admin/feedbacks',
              icon: 'i-lucide-message-square-heart'
            }
          ]
        }
      )
    }

    return links
  })

  const currentPageTitle = computed<string>(() => {
    const findLabel = (items: NavigationMenuItem[]): string | null => {
      for (const item of items) {
        if (item.type === 'label' || !item.to) continue
        const target = String(item.to)
        if (route.path === target) return item.label as string
        if (route.path.startsWith(`${target}/`)) return item.label as string
        if (item.children) {
          const child = item.children.find(c => c.to && (route.path === String(c.to) || route.path.startsWith(`${String(c.to)}/`)))
          if (child) return child.label as string
        }
      }
      return null
    }
    return findLabel(navigationLinks.value) ?? 'MagicSync'
  })

  // Composables live at setup scope: calling UseUser() or useColorMode()
  // inside the computed below re-subscribed to $sessionSignal on every
  // recompute and leaked a listener per evaluation.
  const colorMode = useColorMode()
  const { signOut, user: navUser } = UseUser()

  const handleSignOut = async () => {
    await signOut({ redirectTo: '/' })
  }

  const setAppearance = (mode: string) => {
    if (mode === 'system') {
      colorMode.preference = 'system'
    } else {
      colorMode.value = mode
    }
  }

  const userMenuItems = computed(() => {
    const menuData = menuItems.value
    const user = navUser

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
          label: menuData.userNav.profile,
          icon: 'i-heroicons-user',
          to: '/app/profile'
        },
        {
          label: menuData.userNav.account,
          icon: 'i-heroicons-user-circle',
          to: '/app/account'
        },
        {
          label: menuData.menu.apiKeys,
          icon: 'i-heroicons-key',
          to: '/app/keys'
        },
        {
          label: menuData.menu.notification,
          icon: 'i-heroicons-bell',
          to: '/app/notifications'
        }
      ],
      [
        {
          label: menuData.menu.business,
          icon: 'i-heroicons-building-office-2',
          to: '/app/business'
        },
        {
          label: menuData.menu.integrations,
          icon: 'i-heroicons-link',
          to: '/app/integrations'
        },
        {
          label: menuData.userNav.templateGallery,
          icon: 'i-heroicons-squares-2x2',
          to: '/app/templates'
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
          label: menuData.userNav.github,
          icon: 'i-heroicons-mark-github',
          to: 'https://github.com/leamsigc/magicsync',
          target: '_blank'
        }
      ],
      [
        {
          label: menuData.userNav.logout,
          icon: 'i-heroicons-arrow-right-on-rectangle',
          onSelect: handleSignOut
        }
      ]
    ]
  })

  return {
    navigationLinks,
    currentPageTitle,
    userMenuItems,
    t
  }
}
