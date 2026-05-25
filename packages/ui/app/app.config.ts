export default defineAppConfig({
  ui: {
    button: {
      slots: {
        leadingIcon: 'shrink-0'
      },
      variants: {
        size: {
          xs: 'text-xs px-2.5 py-1 gap-1',
          sm: 'text-sm px-3 py-1.5 gap-1.5',
          md: 'text-sm px-4 py-2 gap-2',
          lg: 'text-base px-5 py-2.5 gap-2'
        },
        color: {
          primary: '',
          secondary: '',
          success: '',
          info: '',
          warning: '',
          error: '',
          neutral: ''
        },
        variant: {
          solid: '',
          outline: '',
          soft: '',
          ghost: '',
          link: ''
        }
      },
      defaultVariants: {
        size: 'md',
        color: 'primary',
        variant: 'solid'
      }
    },
    badge: {
      slots: {

      },
      variants: {
        size: {
          xs: 'px-2 py-0.5 ',
          sm: 'px-2.5 py-0.5 ',
          md: 'px-3 py-1 text-xs'
        },
        variant: {
          solid: '',
          outline: '',
          soft: 'text-dark',
          subtle: ''
        }
      },
      defaultVariants: {
        size: 'sm',
        variant: 'soft'
      }
    },
    card: {
      slots: {
        root: 'rounded-xl bg-elevated   overflow-hidden',
        header: 'p-4 sm:px-5 border-0',
        body: 'p-4 sm:p-5',
        footer: 'p-4 sm:px-5 border-0'
      },
      variants: {
        variant: {
          solid: {
            root: 'bg-inverted text-inverted'
          },
          outline: {
            root: 'bg-elevated  '
          },
          soft: {
            root: 'bg-elevated/50 '
          },
          subtle: {
            root: 'bg-elevated/50  '
          }
        }
      },
      defaultVariants: {
        variant: 'outline'
      }
    },
    input: {
      slots: {
        root: 'relative inline-flex items-center',
        base: [
          'w-full rounded-xl border-0 appearance-none placeholder:text-dimmed focus:outline-none disabled:cursor-not-allowed disabled:opacity-75',
          'transition-all duration-180'
        ],
        leading: 'absolute inset-y-0 inset-s-0 flex items-center',
        leadingIcon: 'shrink-0 text-dimmed',
        leadingAvatar: 'shrink-0',
        leadingAvatarSize: '',
        trailing: 'absolute inset-y-0 inset-e-0 flex items-center',
        trailingIcon: 'shrink-0 text-dimmed'
      },
      variants: {
        fieldGroup: {
          horizontal: {
            root: 'group has-focus-visible:z-1',
            base: 'group-not-only:group-first:rounded-e-none group-not-only:group-last:rounded-s-none group-not-last:group-not-first:rounded-none'
          },
          vertical: {
            root: 'group has-focus-visible:z-1',
            base: 'group-not-only:group-first:rounded-b-none group-not-only:group-last:rounded-t-none group-not-last:group-not-first:rounded-none'
          }
        },
        size: {
          xs: {
            base: 'px-2.5 py-1.5 text-xs gap-1',
            leading: 'ps-2.5',
            trailing: 'pe-2.5',
            leadingIcon: 'size-4',
            leadingAvatarSize: '3xs',
            trailingIcon: 'size-4'
          },
          sm: {
            base: 'px-3 py-2 text-xs gap-1.5',
            leading: 'ps-3',
            trailing: 'pe-3',
            leadingIcon: 'size-4',
            leadingAvatarSize: '3xs',
            trailingIcon: 'size-4'
          },
          md: {
            base: 'px-3.5 py-2.5 text-sm gap-1.5',
            leading: 'ps-3.5',
            trailing: 'pe-3.5',
            leadingIcon: 'size-5',
            leadingAvatarSize: '2xs',
            trailingIcon: 'size-5'
          },
          lg: {
            base: 'px-4 py-2.5 text-sm gap-2',
            leading: 'ps-4',
            trailing: 'pe-4',
            leadingIcon: 'size-5',
            leadingAvatarSize: '2xs',
            trailingIcon: 'size-5'
          },
          xl: {
            base: 'px-4 py-3 text-base gap-2',
            leading: 'ps-4',
            trailing: 'pe-4',
            leadingIcon: 'size-6',
            leadingAvatarSize: 'xs',
            trailingIcon: 'size-6'
          }
        },
        variant: {
          outline: 'text-highlighted bg-white dark:bg-white/5 ring-1 ring-inset ring-black/5 dark:ring-white/10 focus:ring-2 focus:ring-primary',
          soft: 'text-highlighted bg-black/3 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/10 focus:bg-white/70 dark:focus:bg-white/10 disabled:bg-black/3 dark:disabled:bg-white/5',
          subtle: 'text-highlighted bg-white/70 dark:bg-white/5 ring-1 ring-inset ring-black/5 dark:ring-white/10',
          ghost: 'text-highlighted bg-transparent hover:bg-black/3 dark:hover:bg-white/5 focus:bg-white/70 dark:focus:bg-white/10 disabled:bg-transparent',
          none: 'text-highlighted bg-transparent'
        },
        color: {
          primary: '',
          secondary: '',
          success: '',
          info: '',
          warning: '',
          error: '',
          neutral: ''
        },
        leading: {
          true: ''
        },
        trailing: {
          true: ''
        },
        loading: {
          true: ''
        },
        highlight: {
          true: ''
        },
        type: {
          file: 'file:me-1.5 file:font-medium file:text-muted file:outline-none'
        }
      },
      compoundVariants: [
        {
          color: 'primary',
          variant: ['outline', 'subtle'],
          class: 'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary'
        },
        {
          color: 'primary',
          highlight: true,
          class: 'ring ring-inset ring-primary'
        },
        {
          color: 'neutral',
          variant: ['outline', 'subtle'],
          class: 'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-inverted'
        },
        {
          color: 'neutral',
          highlight: true,
          class: 'ring ring-inset ring-inverted'
        },
        {
          leading: true, size: 'xs', class: 'ps-8'
        },
        {
          leading: true, size: 'sm', class: 'ps-9'
        },
        {
          leading: true, size: 'md', class: 'ps-10'
        },
        {
          leading: true, size: 'lg', class: 'ps-11'
        },
        {
          leading: true, size: 'xl', class: 'ps-12'
        },
        {
          trailing: true, size: 'xs', class: 'pe-8'
        },
        {
          trailing: true, size: 'sm', class: 'pe-9'
        },
        {
          trailing: true, size: 'md', class: 'pe-10'
        },
        {
          trailing: true, size: 'lg', class: 'pe-11'
        },
        {
          trailing: true, size: 'xl', class: 'pe-12'
        },
        {
          loading: true, leading: true, class: { leadingIcon: 'animate-spin' }
        },
        {
          loading: true, leading: false, trailing: true, class: { trailingIcon: 'animate-spin' }
        }
      ],
      defaultVariants: {
        size: 'lg',
        color: 'neutral',
        variant: 'outline'
      }
    },
    table: {
      slots: {
        root: 'overflow-hidden rounded-xl',
        table: 'min-w-full border-separate border-spacing-0',
        thead: '',
        tbody: '',
        tr: 'group hover:bg-black/2 dark:hover:bg-white/2 transition-colors duration-120',
        th: 'h-11 px-4 text-left text-xs font-semibold text-muted tracking-wider uppercase bg-transparent border-b border-border last:text-right',
        td: 'h-14 px-4 py-3 text-sm border-b border-border/50 whitespace-nowrap last:text-right',
        caption: 'mt-3 text-sm text-muted text-center',
        loadingState: 'flex items-center justify-center py-12',
        emptyState: 'flex items-center justify-center py-12 text-sm text-muted'
      },
      variants: {
        divider: {
          horizontal: {
            td: 'border-b border-border/50',
            th: 'border-b border-border'
          },
          vertical: {
            td: 'border-s border-border/50 first:border-s-0',
            th: 'border-s border-border first:border-s-0'
          },
          both: {
            td: '/50',
            th: ''
          },
          none: {
            td: 'border-0',
            th: 'border-0'
          }
        },
        sticky: {
          true: {
            th: 'sticky top-0 z-10'
          },
          false: {}
        },
        sortable: {
          true: {
            th: 'cursor-pointer select-none hover:text-highlighted'
          }
        }
      },
      defaultVariants: {
        divider: 'horizontal',
        sticky: false,
        sortable: false
      }
    },
    navigationMenu: {
      slots: {
        root: 'relative flex gap-1.5 [&>div]:min-w-0',
        list: 'isolate min-w-0',
        label: 'w-full flex items-center gap-1.5 font-semibold text-xs text-muted px-3 py-2 tracking-wider uppercase',
        item: 'min-w-0 my-px',
        link: 'group relative w-full flex items-center gap-2 font-medium text-sm before:absolute before:z-[-1] before:rounded-lg focus:outline-none focus-visible:outline-none dark:focus-visible:outline-none focus-visible:before:ring-inset focus-visible:before:ring-2 transition-all duration-120',
        linkLeadingIcon: 'shrink-0 size-5',
        linkLeadingAvatar: 'shrink-0',
        linkLeadingAvatarSize: '2xs',
        linkTrailing: 'group ms-auto inline-flex gap-1.5 items-center',
        linkTrailingBadge: 'shrink-0',
        linkTrailingBadgeSize: 'sm',
        linkTrailingIcon: 'size-4 transform shrink-0 group-data-[state=open]:rotate-180 transition-transform duration-200',
        linkLabel: 'truncate',
        linkLabelExternalIcon: 'inline-block size-3 align-top text-dimmed',
        childList: 'isolate',
        childLabel: 'text-xs text-highlighted',
        childItem: '',
        childLink: 'group relative size-full flex items-start text-start text-sm before:absolute before:z-[-1] before:rounded-lg focus:outline-none focus-visible:outline-none dark:focus-visible:outline-none focus-visible:before:ring-inset focus-visible:before:ring-2 transition-all duration-120',
        childLinkWrapper: 'min-w-0',
        childLinkIcon: 'size-5 shrink-0',
        childLinkLabel: 'truncate',
        childLinkLabelExternalIcon: 'inline-block size-3 align-top text-dimmed',
        childLinkDescription: 'text-xs text-muted leading-relaxed line-clamp-2',
        separator: 'my-2 h-px bg-border/50',
        viewportWrapper: 'absolute top-full left-0 flex w-full',
        viewport: 'relative overflow-hidden bg-elevated rounded-xl ring-1 ring-border h-(--reka-navigation-menu-viewport-height) w-full transition-[width,height,left] duration-200 origin-[top_center] data-[state=open]:animate-[scale-in_100ms_ease-out] data-[state=closed]:animate-[scale-out_100ms_ease-in] z-[1]',
        content: '',
        indicator: 'absolute data-[state=visible]:animate-[fade-in_100ms_ease-out] data-[state=hidden]:animate-[fade-out_100ms_ease-in] data-[state=hidden]:opacity-0 bottom-0 z-[2] w-(--reka-navigation-menu-indicator-size) translate-x-(--reka-navigation-menu-indicator-position) flex h-2.5 items-end justify-center overflow-hidden transition-[translate,width] duration-200',
        arrow: 'relative top-[50%] size-2.5 rotate-45  bg-elevated z-[1] rounded-xs'
      },
      variants: {
        color: {
          primary: {
            link: 'focus-visible:before:ring-primary',
            childLink: 'focus-visible:before:ring-primary'
          },
          secondary: {
            link: 'focus-visible:before:ring-secondary',
            childLink: 'focus-visible:before:ring-secondary'
          },
          success: {
            link: 'focus-visible:before:ring-success',
            childLink: 'focus-visible:before:ring-success'
          },
          info: {
            link: 'focus-visible:before:ring-info',
            childLink: 'focus-visible:before:ring-info'
          },
          warning: {
            link: 'focus-visible:before:ring-warning',
            childLink: 'focus-visible:before:ring-warning'
          },
          error: {
            link: 'focus-visible:before:ring-error',
            childLink: 'focus-visible:before:ring-error'
          },
          neutral: {
            link: 'focus-visible:before:ring-inverted',
            childLink: 'focus-visible:before:ring-inverted'
          }
        },
        highlightColor: {
          primary: '',
          secondary: '',
          success: '',
          info: '',
          warning: '',
          error: '',
          neutral: ''
        },
        variant: {
          pill: '',
          link: ''
        },
        orientation: {
          horizontal: {
            root: 'items-center justify-between',
            list: 'flex items-center',
            item: 'py-1',
            link: 'px-3 py-2 before:inset-x-px before:inset-y-0',
            childList: 'grid p-2',
            childLink: 'px-3 py-2 gap-2 before:inset-x-px before:inset-y-0',
            childLinkLabel: 'font-medium',
            content: 'absolute top-0 left-0 w-full max-h-[70vh] overflow-y-auto'
          },
          vertical: {
            root: 'flex-col',
            link: 'flex-row px-3 py-2.5 before:inset-y-px before:inset-x-0',
            childLabel: 'px-1.5 py-0.5',
            childLink: 'p-2 gap-2 before:inset-y-px before:inset-x-0'
          }
        },
        contentOrientation: {
          horizontal: {
            viewportWrapper: 'justify-center',
            content: 'data-[motion=from-start]:animate-[enter-from-left_200ms_ease] data-[motion=from-end]:animate-[enter-from-right_200ms_ease] data-[motion=to-start]:animate-[exit-to-left_200ms_ease] data-[motion=to-end]:animate-[exit-to-right_200ms_ease]'
          },
          vertical: {
            viewport: 'sm:w-(--reka-navigation-menu-viewport-width) left-(--reka-navigation-menu-viewport-left)'
          }
        },
        active: {
          true: {
            childLink: 'before:bg-elevated text-highlighted',
            childLinkIcon: 'text-default'
          },
          false: {
            link: 'text-toned hover:text-highlighted',
            linkLeadingIcon: 'text-muted group-hover:text-toned',
            childLink: [
              'hover:before:bg-black/[0.03] dark:hover:before:bg-white/[0.05] text-default hover:text-highlighted',
              'transition-colors before:transition-colors'
            ],
            childLinkIcon: [
              'text-dimmed group-hover:text-toned',
              'transition-colors'
            ]
          }
        },
        disabled: {
          true: {
            link: 'cursor-not-allowed opacity-50'
          }
        },
        highlight: {
          true: ''
        },
        level: {
          true: ''
        },
        collapsed: {
          true: ''
        }
      },
      compoundVariants: [
        {
          orientation: 'horizontal',
          contentOrientation: 'horizontal',
          class: {
            childList: 'grid-cols-2 gap-2'
          }
        },
        {
          orientation: 'horizontal',
          contentOrientation: 'vertical',
          class: {
            childList: 'gap-1',
            content: 'w-60'
          }
        },
        {
          orientation: 'vertical',
          collapsed: false,
          class: {
            childList: 'ms-4 border-s border-border/50',
            childItem: 'ps-2 -ms-px',
            content: 'data-[state=open]:animate-[collapsible-down_200ms_ease-out] data-[state=closed]:animate-[collapsible-up_200ms_ease-out] overflow-hidden'
          }
        },
        {
          orientation: 'vertical',
          collapsed: true,
          class: {
            link: 'px-2',
            content: 'shadow-sm rounded-lg min-h-6 p-1'
          }
        },
        {
          orientation: 'horizontal',
          highlight: true,
          class: {
            link: [
              'after:absolute after:-bottom-2 after:inset-x-3 after:block after:h-0.5 after:rounded-full',
              'after:transition-colors'
            ]
          }
        },
        {
          orientation: 'vertical',
          highlight: true,
          level: true,
          class: {
            link: [
              'after:absolute after:-start-2 after:inset-y-1 after:block after:w-0.5 after:rounded-full',
              'after:transition-colors'
            ]
          }
        },
        {
          disabled: false,
          active: false,
          variant: 'pill',
          class: {
            link: [
              'hover:text-highlighted hover:before:bg-black/[0.03] dark:hover:before:bg-white/[0.05]',
              'transition-colors before:transition-colors'
            ],
            linkLeadingIcon: [
              'group-hover:text-toned',
              'transition-colors'
            ]
          }
        },
        {
          disabled: false,
          active: false,
          variant: 'pill',
          orientation: 'horizontal',
          class: {
            link: 'data-[state=open]:text-highlighted',
            linkLeadingIcon: 'group-data-[state=open]:text-toned'
          }
        },
        {
          disabled: false, variant: 'pill', highlight: true, orientation: 'horizontal',
          class: { link: 'data-[state=open]:before:bg-black/[0.03] dark:data-[state=open]:before:bg-white/[0.05]' }
        },
        {
          disabled: false, variant: 'pill', highlight: false, active: false, orientation: 'horizontal',
          class: { link: 'data-[state=open]:before:bg-black/[0.03] dark:data-[state=open]:before:bg-white/[0.05]' }
        },
        { color: 'primary', variant: 'pill', active: true, class: { link: 'text-primary', linkLeadingIcon: 'text-primary group-data-[state=open]:text-primary' } },
        { color: 'neutral', variant: 'pill', active: true, class: { link: 'text-highlighted', linkLeadingIcon: 'text-highlighted group-data-[state=open]:text-highlighted' } },
        { variant: 'pill', active: true, highlight: false, class: { link: 'before:bg-black/[0.03] dark:before:bg-white/[0.05]' } },
        { variant: 'pill', active: true, highlight: true, disabled: false, class: { link: ['hover:before:bg-black/[0.03] dark:hover:before:bg-white/[0.05]', 'before:transition-colors'] } },
        { disabled: false, active: false, variant: 'link', class: { link: ['hover:text-highlighted hover:before:bg-black/[0.03] dark:hover:before:bg-white/[0.05]', 'transition-colors'], linkLeadingIcon: ['group-hover:text-toned', 'transition-colors'] } },
        { disabled: false, active: false, variant: 'link', orientation: 'horizontal', class: { link: 'data-[state=open]:text-highlighted', linkLeadingIcon: 'group-data-[state=open]:text-toned' } },
        { color: 'primary', variant: 'link', active: true, class: { link: 'text-primary', linkLeadingIcon: 'text-primary group-data-[state=open]:text-primary' } },
        { color: 'neutral', variant: 'link', active: true, class: { link: 'text-highlighted', linkLeadingIcon: 'text-highlighted group-data-[state=open]:text-highlighted' } },
        { highlightColor: 'primary', highlight: true, level: true, active: true, class: { link: 'after:bg-primary' } },
        { highlightColor: 'neutral', highlight: true, level: true, active: true, class: { link: 'after:bg-inverted' } }
      ],
      defaultVariants: {
        color: 'primary',
        highlightColor: 'primary',
        variant: 'pill'
      }
    }
  }
})
