# Design System — MagicSync

## Design Philosophy

MagicSync follows a **premium, minimal, trust-focused** aesthetic inspired by Later.com. The design language prioritizes clarity, whitespace, and conversion-driven layouts. Every screen should feel polished, professional, and purposeful.

---

## Theme Overview

**Dual color mode**: `light` and `dark`, toggled via user preference. Built on Tailwind CSS v4 with CSS custom properties for theming.

### Implementation Requirements

**All components and pages MUST support both light and dark themes.**

- Use design token classes (e.g., `bg-background`, `text-foreground`, `text-muted-foreground`) instead of hardcoded colors
- Avoid using fixed color values like `text-zinc-500` or `bg-gray-900` — use semantic tokens
- Test all implementations in both light and dark modes
- Use Nuxt UI components which handle theming automatically

---

## Color Palette

### Brand Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--brand-primary` | `#F97316` | CTAs, active states, primary accent (orange — Later-style) |
| `--brand-primary-hover` | `#EA6C0A` | Primary hover state |
| `--brand-secondary` | `#1A1A1A` | Dark text, headers |
| `--brand-accent` | `#7C3AED` | AI features, premium indicators |

### Light Mode

| Token | HSL | Hex | Usage |
|-------|-----|-----|-------|
| `--primary` | `hsl(24.6 95% 48.1%)` | `#F97316` | CTAs, active states, accent |
| `--primary-foreground` | `hsl(0 0% 100%)` | `#FFFFFF` | Text on primary |
| `--background` | `hsl(0 0% 100%)` | `#FFFFFF` | Page background |
| `--foreground` | `hsl(240 10% 3.9%)` | `#0F0E0D` | Body text |
| `--secondary` | `hsl(60 4.8% 95.9%)` | `#F4F3EF` | Cards, panels, subtle bg |
| `--secondary-foreground` | `hsl(24 9.8% 10%)` | `#18141A` | Text on secondary |
| `--muted` | `hsl(60 4.8% 95.9%)` | `#F4F3EF` | Subtle backgrounds |
| `--muted-foreground` | `hsl(25 5.3% 44.7%)` | `#79747E` | Secondary text, captions |
| `--accent` | `hsl(60 4.8% 95.9%)` | `#F4F3EF` | Hover states |
| `--accent-foreground` | `hsl(24 9.8% 10%)` | `#18141A` | Text on accent |
| `--border` | `hsl(20 5.9% 90%)` | `#E5E4E0` | Dividers, outlines |
| `--ring` | `hsl(24.6 95% 53.1%)` | `#EA6C0A` | Focus rings |
| `--destructive` | `hsl(0 84.2% 60.2%)` | `#EF4444` | Errors, destructive actions |
| `--success` | `hsl(142 71% 45%)` | `#22C55E` | Success states |
| `--info` | `hsl(217 91% 60%)` | `#3B82F6` | Informational |

### Dark Mode

| Token | HSL | Hex | Usage |
|-------|-----|-----|-------|
| `--primary` | `hsl(24.6 95% 48.1%)` | `#F97316` | CTAs (vibrant orange) |
| `--primary-foreground` | `hsl(0 0% 100%)` | `#FFFFFF` | Text on primary |
| `--background` | `hsl(0 0% 3.9%)` | `#0A0A0A` | Page background (true black) |
| `--foreground` | `hsl(0 0% 98%)` | `#FAFAFA` | Body text |
| `--secondary` | `hsl(0 0% 9%)` | `#171717` | Cards, panels |
| `--secondary-foreground` | `hsl(0 0% 98%)` | `#FAFAFA` | Text on secondary |
| `--muted` | `hsl(0 0% 9%)` | `#171717` | Subtle backgrounds |
| `--muted-foreground` | `hsl(0 0% 63.9%)` | `#A3A3A3` | Secondary text |
| `--accent` | `hsl(0 0% 9%)` | `#171717` | Hover states |
| `--accent-foreground` | `hsl(0 0% 98%)` | `#FAFAFA` | Text on accent |
| `--border` | `hsl(0 0% 14.9%)` | `#262626` | Dividers |
| `--ring` | `hsl(24.6 95% 53.1%)` | `#F97316` | Focus rings |
| `--destructive` | `hsl(0 72.2% 50.6%)` | `#DC2626` | Errors |
| `--success` | `hsl(142 71% 45%)` | `#22C55E` | Success states |

---

## Typography

| Role | Font | Fallback | Weight |
|------|------|----------|--------|
| **Sans** (body, UI) | `Inter` | `system-ui, -apple-system, sans-serif` | 400, 500, 600, 700 |
| **Display** (hero, headlines) | `Inter` | `system-ui, sans-serif` | 700, 800 |
| **Mono** (code, timestamps) | `JetBrains Mono` | `monospace` | 400, 500 |

### Type Scale

| Role | Class | Size | Weight | Line Height | Tracking |
|------|-------|------|--------|-------------|----------|
| **Hero Title** | `text-5xl lg:text-6xl` | 48-60px | 800 | 1.1 | `-0.02em` |
| **Section Title** | `text-3xl lg:text-4xl` | 30-36px | 700 | 1.2 | `-0.01em` |
| **Card Title** | `text-xl` | 20px | 600 | 1.3 | normal |
| **Subtitle** | `text-lg` | 18px | 400 | 1.5 | normal |
| **Body** | `text-base` | 16px | 400 | 1.6 | normal |
| **Small** | `text-sm` | 14px | 400 | 1.5 | normal |
| **Caption** | `text-xs` | 12px | 500 | 1.4 | `0.02em` |

### Font Usage Rules

- Headings: tight letter-spacing (`tracking-tight` or `tracking-tighter`)
- Body: normal tracking, 1.5-1.6 line height
- Labels/Badges: uppercase, letter-spacing `0.05em`, font-weight 500-600
- Numbers/Stats: font-weight 700, tabular-nums

---

## Roundedness

Later.com uses a **generous border radius** — clean, friendly, modern.

| Token | Value | Usage |
|-------|-------|-------|
| `--radius` | `0.75rem` (12px) | Base radius |
| `--radius-xl` | `1rem` (16px) | Cards, modals, large containers |
| `--radius-lg` | `0.75rem` (12px) | Buttons, inputs |
| `--radius-md` | `0.5rem` (8px) | Smaller elements |
| `--radius-sm` | `0.375rem` (6px) | Badges, chips |
| `--radius-full` | `9999px` | Avatars, pills |

---

## Spacing

Standard Tailwind spacing scale (`normal` density). Content pages use `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8` container pattern.

### Spacing Rules

- Section padding: `py-16 lg:py-24`
- Card padding: `p-6 lg:p-8`
- Stack items: `space-y-4` or `space-y-6`
- Grid gaps: `gap-6 lg:gap-8`
- Inline elements: `space-x-2` or `space-x-3`

---

## Shadows

Later.com uses subtle, layered shadows for depth.

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px 0 rgba(0,0,0,0.05)` | Subtle elevation |
| `--shadow` | `0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)` | Cards, dropdowns |
| `--shadow-md` | `0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)` | Elevated elements |
| `--shadow-lg` | `0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)` | Modals, popovers |
| `--shadow-xl` | `0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)` | Floating elements |

---

## Components

### Header / Navigation

- **Full-width** sticky header
- **Height**: 64px desktop, 56px mobile
- **Background**: `bg-background` with `border-b border-border`
- **Logo**: left-aligned, 112px width
- **Nav links**: center or right, with dropdown menus
- **CTA buttons**: right-aligned, primary "Start Free Trial" + ghost "Sign In"
- **Mobile**: hamburger menu with slide-out drawer
- **Blur backdrop**: `backdrop-blur-sm bg-background/80`

### Hero Section

- **Layout**: two-column (text + visual) or centered
- **Title**: `text-5xl lg:text-6xl font-extrabold tracking-tight`
- **Subtitle**: `text-lg lg:text-xl text-muted-foreground max-w-2xl`
- **CTAs**: primary button + secondary ghost button
- **Social proof**: logo bar below hero ("Trusted by...")
- **Visual**: product screenshot, illustration, or video
- **Stats bar**: key metrics (e.g., "20M+ creators", "136B impressions")

### Cards

- **Background**: `bg-card` (white/dark)
- **Border**: `border border-border rounded-xl`
- **Shadow**: `shadow-sm` → `shadow-md` on hover
- **Hover**: `transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`
- **Padding**: `p-6 lg:p-8`
- **Content**: icon/badge → title → description → CTA link

### Buttons

| Variant | Classes | Usage |
|---------|---------|-------|
| **Primary** | `bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors` | Main CTAs |
| **Secondary** | `bg-secondary text-secondary-foreground font-medium px-5 py-2.5 rounded-lg hover:bg-secondary/80` | Supporting actions |
| **Ghost** | `text-foreground font-medium px-5 py-2.5 rounded-lg hover:bg-accent transition-colors` | Navigation, links |
| **Outline** | `border border-border font-medium px-5 py-2.5 rounded-lg hover:bg-accent` | Tertiary actions |
| **Link** | `text-primary font-medium hover:underline` | Inline CTAs |

**Sizes**: `sm` (px-4 py-2 text-sm), `md` (px-5 py-2.5 text-sm), `lg` (px-6 py-3 text-base)

### Forms

- Uses Nuxt UI's `UInput`, `USelect`, `UTextarea` components
- **Height**: 44px (h-11)
- **Border**: `border border-border rounded-lg`
- **Focus**: `ring-2 ring-ring ring-offset-2`
- **Labels**: `text-sm font-medium text-foreground mb-1.5`
- **Helper text**: `text-xs text-muted-foreground mt-1`

### Pricing Cards

- **Free tier**: subtle, muted styling
- **Popular tier**: `border-2 border-primary` with "Most Popular" badge
- **Enterprise tier**: dark background, premium feel
- **Features list**: checkmarks with `text-success`
- **CTA**: full-width primary button
- **Price**: `text-4xl font-bold` with period text

### Stats / Metrics

- **Value**: `text-3xl lg:text-4xl font-bold text-foreground`
- **Label**: `text-sm text-muted-foreground mt-1`
- **Icon**: optional, 24px, `text-primary`
- **Layout**: centered or left-aligned in grid

### Social Platform Icons

- Size: 24px (w-6 h-6)
- Grayscale by default, color on hover
- Grid layout: `flex gap-4` or `grid grid-cols-4 gap-3`

### Footer

- **Background**: `bg-secondary`
- **Border**: `border-t border-border`
- **Columns**: 4-5 link groups
- **Social icons**: bottom row
- **Newsletter**: email input + subscribe button
- **Legal**: copyright, terms, privacy

---

## Layout Patterns

### Landing Page Structure

```
Header (sticky)
├── Hero Section (2-col or centered)
├── Social Proof Bar (logo strip)
├── Features Grid (3-col)
├── How It Works (steps)
├── Stats Section (metrics)
├── Testimonials / Case Studies
├── Pricing Section
├── CTA Section (final push)
└── Footer
```

### Dashboard Structure

```
Header (sticky)
├── Sidebar (collapsible)
│   ├── Navigation links
│   └── User menu
├── Main Content
│   ├── Page header (title + actions)
│   ├── Content area
│   └── Footer
└── Modals / Overlays
```

### Content Page Structure

```
Header
├── Breadcrumb
├── Hero (title + description)
├── Content (max-w-4xl)
├── Related Content (cards)
└── Footer
```

---

## Animations

| Name | Usage | Timing |
|------|-------|--------|
| `fade-in` | Page transitions, modals | 200ms ease-out |
| `slide-up` | Elements entering viewport | 300ms ease-out |
| `scale-in` | Modals, popovers | 200ms ease-out |
| `pulse-soft` | Loading states, notifications | 2s infinite |
| `shimmer` | Skeleton loaders | 1.5s infinite |
| `accordion-down/up` | Accordion expand/collapse | 200ms ease-out |

### Micro-interactions

- Button hover: scale(1.02) or brightness change
- Card hover: shadow lift + subtle translate
- Focus ring: `ring-2 ring-ring ring-offset-2`
- Transitions: `transition-all duration-200`

---

## Responsive Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| `sm` | 640px | Mobile landscape |
| `md` | 768px | Tablet |
| `lg` | 1024px | Desktop |
| `xl` | 1280px | Large desktop |
| `2xl` | 1536px | Ultra-wide |

### Responsive Rules

- **Mobile-first**: base styles = mobile
- **Container**: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`
- **Grid**: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- **Nav**: hamburger on mobile, inline on desktop
- **Typography**: scale down on mobile (`text-3xl` → `text-4xl`)
- **Spacing**: reduce padding on mobile

---

## Page-Specific Patterns

### Homepage

- **Hero**: large title + CTA + product visual
- **Social proof**: logo bar + metrics
- **Features**: 3-column cards with icons
- **How it works**: numbered steps
- **Testimonials**: card carousel or grid
- **Pricing**: 3-tier cards
- **Final CTA**: centered text + button

### Pricing Page

- **Toggle**: monthly/annual billing
- **Cards**: 3 tiers (Starter, Growth, Scale)
- **Feature comparison**: table below cards
- **FAQ**: accordion section

### Dashboard / Scheduler

- **Calendar view**: weekly/monthly toggle
- **Post builder**: modal/drawer with form
- **Media library**: grid with drag-drop
- **Analytics**: charts + metrics cards

### Features Page

- **Hero**: feature highlight
- **Sections**: alternating text/visual layout
- **Use cases**: cards for different personas

---

## Accessibility

- Focus rings: `--ring` color, visible on all interactive elements
- Color contrast: WCAG AA minimum (checked per component)
- Keyboard navigation: all interactive elements focusable
- ARIA: labels on icon-only buttons, roles on dynamic content
- Alt text: required on all images
- Screen reader: hidden decorative elements with `aria-hidden`

---

## Design Tokens (CSS Variables)

```css
:root {
  /* Brand */
  --brand-primary: 24.6 95% 48.1%;
  --brand-secondary: 0 0% 5%;
  --brand-accent: 263 84% 58%;

  /* Light mode */
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  --card: 0 0% 100%;
  --card-foreground: 240 10% 3.9%;
  --popover: 0 0% 100%;
  --popover-foreground: 240 10% 3.9%;
  --primary: 24.6 95% 48.1%;
  --primary-foreground: 0 0% 100%;
  --secondary: 60 4.8% 95.9%;
  --secondary-foreground: 24 9.8% 10%;
  --muted: 60 4.8% 95.9%;
  --muted-foreground: 25 5.3% 44.7%;
  --accent: 60 4.8% 95.9%;
  --accent-foreground: 24 9.8% 10%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 0 0% 98%;
  --border: 20 5.9% 90%;
  --input: 20 5.9% 90%;
  --ring: 24.6 95% 53.1%;
  --radius: 0.75rem;

  /* Success */
  --success: 142 71% 45%;
  --success-foreground: 0 0% 100%;
}

.dark {
  --background: 0 0% 3.9%;
  --foreground: 0 0% 98%;
  --card: 0 0% 5.5%;
  --card-foreground: 0 0% 98%;
  --popover: 0 0% 5.5%;
  --popover-foreground: 0 0% 98%;
  --primary: 24.6 95% 48.1%;
  --primary-foreground: 0 0% 100%;
  --secondary: 0 0% 9%;
  --secondary-foreground: 0 0% 98%;
  --muted: 0 0% 9%;
  --muted-foreground: 0 0% 63.9%;
  --accent: 0 0% 9%;
  --accent-foreground: 0 0% 98%;
  --destructive: 0 72.2% 50.6%;
  --destructive-foreground: 0 0% 98%;
  --border: 0 0% 14.9%;
  --input: 0 0% 14.9%;
  --ring: 24.6 95% 53.1%;
  --success: 142 71% 45%;
  --success-foreground: 0 0% 100%;
}
```
