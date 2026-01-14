<script lang="ts" setup>
/**
 *
 * Links to all the components in the application
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */

interface ComponentInfo {
  name: string;
  description: string;
  componentName: string;
  icon: string;
}

const components = ref<ComponentInfo[]>([
  { name: 'Banner Promo', description: 'Banner promo for other pages.', componentName: 'BaseBannerPromo', icon: 'lucide:megaphone' },
  { name: 'Beams', description: 'Dynamic Tyndall effect component with customizable streaks.', componentName: 'BaseBeams', icon: 'lucide:zap' },
  { name: 'Benefits', description: 'Benefits section component with icons and descriptions.', componentName: 'BaseBenefits', icon: 'lucide:check-circle' },
  { name: 'Blue Sky Comments', description: 'Comments component for Blue Sky social platform.', componentName: 'BaseBlueSkyComments', icon: 'lucide:messages-square' },
  { name: 'Button', description: 'Customizable button component.', componentName: 'BaseButton', icon: 'lucide:mouse-pointer' },
  { name: 'Chart', description: 'Interactive chart component using ECharts.', componentName: 'BaseChart', icon: 'lucide:bar-chart-3' },
  { name: 'Comments', description: 'Comments component for the application.', componentName: 'BaseComments', icon: 'lucide:message-square' },
  { name: 'Community', description: 'Community section with join links.', componentName: 'BaseCommunity', icon: 'lucide:users' },
  { name: 'Contact', description: 'Contact form section component.', componentName: 'BaseContact', icon: 'lucide:mail' },
  { name: 'Dashboard Overview Cards', description: 'Dashboard overview with metrics and charts.', componentName: 'BaseDashboardOverviewCards', icon: 'lucide:layout-dashboard' },
  { name: 'FAQ', description: 'Frequently asked questions accordion component.', componentName: 'BaseFaq', icon: 'lucide:help-circle' },
  { name: 'Features', description: 'Features section component with icons.', componentName: 'BaseFeatures', icon: 'lucide:star' },
  { name: 'Header', description: 'Application header with navigation menu.', componentName: 'BaseHeader', icon: 'lucide:layout-navbar' },
  { name: 'Hero', description: 'Hero section component with image and actions.', componentName: 'BaseHero', icon: 'lucide:image' },
  { name: 'Hero B', description: 'Alternative hero component with different styling.', componentName: 'BaseHeroB', icon: 'lucide:image-plus' },
  { name: 'How It Works', description: 'Step-by-step process component.', componentName: 'BaseHowItWorks', icon: 'lucide:list-ordered' },
  { name: 'Not Found View', description: '404 error page component.', componentName: 'BaseNotFoundView', icon: 'lucide:file-x' },
  { name: 'Pricing', description: 'Pricing plans component.', componentName: 'BasePricing', icon: 'lucide:dollar-sign' },
  { name: 'Review Card', description: 'Testimonial card component.', componentName: 'BaseReviewCard', icon: 'lucide:quote' },
  { name: 'Root Page', description: 'Base root page component.', componentName: 'BaseRootPage', icon: 'lucide:home' },
  { name: 'Services', description: 'Services section component.', componentName: 'BaseServices', icon: 'lucide:briefcase' },
  { name: 'Shiny Card', description: 'Card with shiny hover effects.', componentName: 'BaseShinyCard', icon: 'lucide:sparkles' },
  { name: 'Team', description: 'Team members showcase component.', componentName: 'BaseTeam', icon: 'lucide:users' },
  { name: 'Testimonials', description: 'Customer testimonials carousel.', componentName: 'BaseTestimonials', icon: 'lucide:star' },
  { name: 'Translation Menu', description: 'Locale selection component.', componentName: 'BaseTranslationMenu', icon: 'lucide:languages' },
  { name: 'Tyndall Effect', description: 'Dynamic Tyndall effect component.', componentName: 'BaseTyndallEffect', icon: 'lucide:sun' },
]);
</script>

<template>
  <div class="container mx-auto py-24 sm:py-32">
    <div class="text-center mb-8">
      <h1 class="text-4xl md:text-5xl font-bold">
        UI Components Preview
      </h1>
      <p class="mt-4 text-lg text-muted-foreground">
        Browse and preview all available UI components
      </p>
      <p class="mt-4 text-lg text-muted-foreground">
        Documentation related to Magic Sync here <a href="https://leamsigc.github.io/MagicSync/">
          https://leamsigc.github.io/MagicSync/</a>
      </p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      <UCard v-for="component in components" :key="component.componentName"
        class="group cursor-pointer hover:shadow-lg transition-shadow"
        @click="$router.push(`/ui-preview/${component.componentName}`)">
        <template #header>
          <div class="flex items-center gap-3">
            <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
              <!-- cSpell:disable-next-line -->
              <UIcon :name="component.icon" class="w-5 h-5" />
            </div>
            <div>
              <h3 class="font-medium text-sm">{{ component.name }}</h3>
              <p class="text-xs text-muted-foreground">{{ component.componentName }}</p>
            </div>
          </div>
        </template>

        <div class="text-sm text-muted-foreground line-clamp-3">
          {{ component.description }}
        </div>

        <template #footer>
          <div class="flex justify-between items-center">
            <span class="text-xs text-primary font-medium">Preview</span>
            <UIcon name="lucide:arrow-right" class="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </template>
      </UCard>
    </div>
  </div>
</template>
<style scoped></style>
