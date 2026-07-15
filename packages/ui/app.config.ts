export default defineAppConfig({
  BaseUiLayer: {
    name: 'Hello from Nuxt layer',
    footer: {
      main: {
        company: "MagicSync",
        logo: '/img/logo.png'
      },
      companyName: 'Default Company',
      socialLinks: [
        {
          name: 'Twitter',
          icon: 'lucide:twitter',
          url: '#',
        },
        {
          name: 'Facebook',
          icon: 'lucide:facebook',
          url: '#',
        },
        {
          name: 'Instagram',
          icon: 'lucide:instagram',
          url: '#',
        },
        {
          name: 'LinkedIn',
          icon: 'lucide:linkedin',
          url: '#',
        },
        {
          name: 'YouTube',
          icon: 'logos:youtube-icon',
          url: '#',
        }
      ]
    }
  },
  ui: {
    colors: {
      primary: 'orange',
      neutral: 'mauve'
    },
    button: {
      slots: {
        base: 'shadow-sm shadow-(color:--ui-shadow-final-soft)'
      },
      compoundVariants: [
        {
          variant: 'ghost',
          class: 'shadow-none hover:shadow-sm transition-shadow'
        },
        {
          variant: 'link',
          class: 'shadow-none'
        }
      ]
    },
    card: {
      slots: {
        root: 'shadow-md shadow-(color:--ui-shadow-final-soft)'
      }
    },
    empty: {
      slots: {
        root: 'shadow-md shadow-(color:--ui-shadow-final-soft)'
      }
    },
    input: {
      slots: {
        base: 'shadow-xs shadow-(color:--ui-shadow-final-soft)'
      },
      compoundVariants: [
        {
          variant: 'ghost',
          class: 'shadow-none'
        },
        {
          variant: 'none',
          class: 'shadow-none'
        }
      ]
    },
    select: {
      slots: {
        base: 'shadow-xs shadow-(color:--ui-shadow-final-soft)',
        content: 'shadow-lg shadow-(color:--ui-shadow-final-soft)'
      },
      compoundVariants: [
        {
          variant: 'ghost',
          class: 'shadow-none'
        },
        {
          variant: 'none',
          class: 'shadow-none'
        }
      ]
    },
    selectMenu: {
      slots: {
        base: 'shadow-xs shadow-(color:--ui-shadow-final-soft)',
        content: 'shadow-lg shadow-(color:--ui-shadow-final-soft)'
      },
      compoundVariants: [
        {
          variant: 'ghost',
          class: 'shadow-none'
        },
        {
          variant: 'none',
          class: 'shadow-none'
        }
      ]
    },
    inputMenu: {
      slots: {
        base: 'shadow-xs shadow-(color:--ui-shadow-final-soft)',
        content: 'shadow-lg shadow-(color:--ui-shadow-final-soft)'
      },
      compoundVariants: [
        {
          variant: 'ghost',
          class: 'shadow-none'
        },
        {
          variant: 'none',
          class: 'shadow-none'
        }
      ]
    },
    textarea: {
      slots: {
        base: 'shadow-xs shadow-(color:--ui-shadow-final-soft)'
      },
      compoundVariants: [
        {
          variant: 'ghost',
          class: 'shadow-none'
        },
        {
          variant: 'none',
          class: 'shadow-none'
        }
      ]
    },
    alert: {
      slots: {
        root: 'shadow-md shadow-(color:--ui-shadow-final-soft)'
      }
    },
    badge: {
      slots: {
        base: 'shadow-xs shadow-(color:--ui-shadow-final-soft)'
      }
    },
    popover: {
      slots: {
        content: 'shadow-lg shadow-(color:--ui-shadow-final-soft)'
      }
    },
    dropdownMenu: {
      slots: {
        content: 'shadow-lg shadow-(color:--ui-shadow-final-soft)'
      }
    },
    contextMenu: {
      slots: {
        content: 'shadow-lg shadow-(color:--ui-shadow-final-soft)'
      }
    },
    tooltip: {
      slots: {
        content: 'shadow-sm shadow-(color:--ui-shadow-final-soft)'
      }
    },
    toast: {
      slots: {
        root: 'shadow-lg shadow-(color:--ui-shadow-final-soft)'
      }
    },
    drawer: {
      slots: {
        content: 'shadow-lg shadow-(color:--ui-shadow-final-soft)'
      }
    },
    modal: {
      compoundVariants: [
        {
          fullscreen: false,
          class: {
            content: 'shadow-lg shadow-(color:--ui-shadow-final-soft)'
          }
        }
      ]
    },
    slideover: {
      slots: {
        content: 'sm:shadow-lg shadow-(color:--ui-shadow-final-soft)'
      }
    }
  }
})

declare module '@nuxt/schema' {
  interface AppConfigInput {
    BaseUiLayer: {
      name?: string,
      main: {
        company?: string
        logo?: string
      }
      footer: {
        companyName?: string
        socialLinks?: Array<{
          name: string
          icon: string
          url: string
        }>
      }
    }
  }
}

