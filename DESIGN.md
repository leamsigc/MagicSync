# Design System

## Theme Overview

This design system uses a **dual color mode**: `light` and `dark`, toggled via user preference. The system is built on Tailwind CSS v4 with CSS custom properties for theming.

---

## Typography

| Role | Font | Fallback |
|------|------|----------|
| **Sans** (body, UI) | `Poppins` | `system-ui, sans-serif` |
| **Mono** (code, timestamps) | `Josefin Sans` | `monospace` |

### Usage
- Headings: `text-3xl font-bold tracking-tight` (Poppins Bold)
- Body: `text-sm` (Poppins Regular)
- Mono: `text-sm font-mono` (Josefin Sans)

---

## Roundedness

The system uses a **standard border radius** aligned with Tailwind's default scale.

| Token | Value | Usage |
|-------|-------|-------|
| `--radius` | `0.5rem` (8px) | Base radius for all components |
| `--radius-xl` | `calc(var(--radius) + 4px)` | Cards, modals, large containers |
| `--radius-lg` | `var(--radius)` | Buttons, inputs |
| `--radius-md` | `calc(var(--radius) - 2px)` | Smaller elements |
| `--radius-sm` | `calc(var(--radius) - 4px)` | Badges, chips |

---

## Spacing

Standard Tailwind spacing scale (`normal` density). Tools pages use `max-w-6xl mx-auto p-6` container pattern.

---

## Color Palette

### Light Mode

| Token | HSL | Hex | Usage |
|-------|-----|-----|-------|
| `--primary` | `hsl(24.6 95% 48.1%)` | `#F97316` | CTAs, active states, accent |
| `--primary-foreground` | `hsl(60 9.1% 97.8%)` | `#FAF9F7` | Text on primary |
| `--background` | `hsl(0 0% 100%)` | `#FFFFFF` | Page background |
| `--foreground` | `hsl(20 14.3% 4.1%)` | `#0F0E0D` | Body text |
| `--secondary` | `hsl(60 4.8% 95.9%)` | `#F4F3EF` | Cards, panels |
| `--secondary-foreground` | `hsl(24 9.8% 10%)` | `#18141A` | Text on secondary |
| `--muted` | `hsl(60 4.8% 95.9%)` | `#F4F3EF` | Subtle backgrounds |
| `--muted-foreground` | `hsl(25 5.3% 44.7%)` | `#79747E` | Secondary text |
| `--accent` | `hsl(60 4.8% 95.9%)` | `#F4F3EF` | Hover states |
| `--accent-foreground` | `hsl(24 9.8% 10%)` | `#18141A` | Text on accent |
| `--border` | `hsl(20 5.9% 90%)` | `#E5E4E0` | Dividers, outlines |
| `--ring` | `hsl(24.6 95% 53.1%)` | `#EA6C0A` | Focus rings (matches primary) |
| `--destructive` | `hsl(0 84.2% 60.2%)` | `#EF4444` | Errors, destructive actions |

### Dark Mode

| Token | HSL | Hex | Usage |
|-------|-----|-----|-------|
| `--primary` | `hsl(20.5 90.2% 30.2%)` | `#C2410C` | Dimmed orange for dark mode |
| `--primary-foreground` | `hsl(60 9.1% 97.8%)` | `#FAF9F7` | Text on primary |
| `--background` | `hsl(20 14.3% 4.1%)` | `#0F0E0D` | Page background |
| `--foreground` | `hsl(60 9.1% 97.8%)` | `#FAF9F7` | Body text |
| `--secondary` | `hsl(12 6.5% 15.1%)` | `#1C1917` | Cards, panels |
| `--secondary-foreground` | `hsl(60 9.1% 97.8%)` | `#FAF9F7` | Text on secondary |
| `--muted` | `hsl(12 6.5% 15.1%)` | `#1C1917` | Subtle backgrounds |
| `--muted-foreground` | `hsl(24 5.4% 63.9%)` | `#A1A09E` | Secondary text |
| `--accent` | `hsl(12 6.5% 15.1%)` | `#1C1917` | Hover states |
| `--accent-foreground` | `hsl(60 9.1% 97.8%)` | `#FAF9F7` | Text on accent |
| `--border` | `hsl(12 6.5% 15.1%)` | `#1C1917` | Dividers |
| `--ring` | `hsl(20.5 90.2% 48.2%)` | `#D94F12` | Focus rings |
| `--destructive` | `hsl(0 72.2% 50.6%)` | `#DC2626` | Errors |

### Semantic Colors (Nuxt UI)

| Token | Hex | Usage |
|-------|-----|-------|
| `--ui-success` | `hsl(var(--ui-color-success-500))` | Success states |
| `--ui-info` | `hsl(var(--ui-color-info-500))` | Informational |
| `--ui-warning` | `hsl(var(--ui-color-warning-500))` | Warnings |
| `--ui-error` | `hsl(var(--ui-color-error-500))` | Error states |

---

## Components

### BaseHeader
- Full-width navigation bar
- Contains logo, nav links, locale switcher
- Sticky on scroll

### BaseShinyCard
- Card with shimmer hover effect
- Props: `title`, `description`, `icon`, `show-bg`
- Border: `rounded-xl`, border: `hsl(var(--border))`
- Hover: subtle brightness + shadow lift

### Buttons
- Uses Nuxt UI's `UButton` component
- Primary: `--primary` background
- Success: `--ui-success`
- Ghost: transparent with hover accent

### Forms
- Uses Nuxt UI's `UInput`, `USelect` components
- Border: `rounded-md`, `ring` on focus
- Focus ring: `--ring` color

---

## Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `shadow-light` | `inset 0 0 5px rgba(0,0,0,0.085)` | Light mode card inset |
| `shadow-dark` | `inset 0 0 5px rgba(255,255,255,0.141)` | Dark mode card inset |

---

## Animations

| Name | Usage |
|------|-------|
| `accordion-down/up` | Accordion expand/collapse |
| `collapsible-down/up` | Collapsible content |
| `marquee` | Horizontal scrolling text |
| `marquee-vertical` | Vertical scrolling text |
| `scale-in` | Modal/overlay entrance |
| `fade-in` | Fade transitions |

---

## Tool Pages Pattern

All tools pages (`/tools/*`) follow this structure:

```vue
<div class="min-h-screen bg-background-foreground">
  <BaseHeader />
  <div class="max-w-6xl mx-auto p-6">
    <header class="mb-12 mt-8">
      <h1 class="text-3xl font-semibold tracking-tight text-white mb-2">
        {Title}
      </h1>
      <p class="text-gray-400">{Description}</p>
    </header>
    <!-- Content -->
  </div>
</div>
```

### Colors for Tool Pages (dark theme)
- Background: `bg-[#0a0a0a]` or `bg-background-foreground`
- Text: `text-gray-200`, `text-gray-400`
- Headings: `text-white`
- Borders: `border-gray-700/50` or `hsl(var(--border))`
- Accent: `text-emerald-500` (used in existing tools)
- Error: `text-red-400`

---

## Mobile & Responsive

- Container: `max-w-6xl mx-auto` (lg breakpoint)
- Grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- Cards: stack on mobile, 2-col on tablet, 3-col on desktop
- Touch targets: minimum 44x44px
- Font scaling: `text-sm` body, `text-xs` captions on mobile

---

## Accessibility

- Focus rings: `--ring` color, visible on all interactive elements
- Color contrast: WCAG AA minimum (checked per component)
- Keyboard navigation: all interactive elements focusable
- ARIA: labels on icon-only buttons, roles on dynamic content
