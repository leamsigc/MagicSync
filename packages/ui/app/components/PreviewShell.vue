<script lang="ts" setup>

/**
 *
 * Individual component preview page
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
interface Props {
  componentName?: string;
}
const router = useRouter();

const { componentName = 'BaseHero' } =
  defineProps<Props>();

const componentDescriptions: Record<string, { name: string; description: string }> = {
  'BaseBannerPromo': { name: 'Banner Promo', description: 'Banner promo for other pages.' },
  'BaseBeams': { name: 'Beams', description: 'Dynamic Tyndall effect component with customizable streaks.' },
  'BaseBenefits': { name: 'Benefits', description: 'Benefits section component with icons and descriptions.' },
  'BaseBlueSkyComment': { name: 'Blue Sky Comment', description: 'Single comment component for Blue Sky social platform.' },
  'BaseBlueSkyComments': { name: 'Blue Sky Comments', description: 'Comments component for Blue Sky social platform.' },
  'BaseButton': { name: 'Button', description: 'Customizable button component.' },
  'BaseChart': { name: 'Chart', description: 'Interactive chart component using ECharts.' },
  'BaseComments': { name: 'Comments', description: 'Comments component for the application.' },
  'BaseCommunity': { name: 'Community', description: 'Community section with join links.' },
  'BaseContact': { name: 'Contact', description: 'Contact form section component.' },
  'BaseDashboardOverviewCards': { name: 'Dashboard Overview Cards', description: 'Dashboard overview with metrics and charts.' },
  'BaseFaq': { name: 'FAQ', description: 'Frequently asked questions accordion component.' },
  'BaseFeatures': { name: 'Features', description: 'Features section component with icons.' },
  'BaseHeader': { name: 'Header', description: 'Application header with navigation menu.' },
  'BaseHero': { name: 'Hero', description: 'Hero section component with image and actions.' },
  'BaseHeroB': { name: 'Hero B', description: 'Alternative hero component with different styling.' },
  'BaseHowItWorks': { name: 'How It Works', description: 'Step-by-step process component.' },
  'BaseNotFoundView': { name: 'Not Found View', description: '404 error page component.' },
  'BasePricing': { name: 'Pricing', description: 'Pricing plans component.' },
  'BaseReviewCard': { name: 'Review Card', description: 'Testimonial card component.' },
  'BaseRootPage': { name: 'Root Page', description: 'Base root page component.' },
  'BaseServices': { name: 'Services', description: 'Services section component.' },
  'BaseShinyCard': { name: 'Shiny Card', description: 'Card with shiny hover effects.' },
  'BaseTeam': { name: 'Team', description: 'Team members showcase component.' },
  'BaseTestimonials': { name: 'Testimonials', description: 'Customer testimonials carousel.' },
  'BaseTranslationMenu': { name: 'Translation Menu', description: 'Locale selection component.' },
  'BaseTyndallEffect': { name: 'Tyndall Effect', description: 'Dynamic Tyndall effect component.' },
};

const currentComponent = computed(() => componentDescriptions[componentName]);


const goBack = () => {
  router.push('/ui-preview');
};
</script>

<template>
  <div class="container mx-auto py-8">
    <!-- Go Back Button -->
    <div class="flex items-center gap-4 mb-8">
      <UButton variant="outline" @click="goBack" class="flex items-center gap-2">
        <UIcon name="lucide:arrow-left" class="w-4 h-4" />
        Back to Components
      </UButton>
      <div>
        <h1 class="text-2xl font-bold">{{ currentComponent?.name }}</h1>
        <p class="text-muted-foreground">{{ currentComponent?.description }}</p>
      </div>
    </div>

    <!-- Component Preview -->
    <UCard class="min-h-screen">
      <template #header>
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold">{{ componentName }}</h2>
            <p class="text-sm text-muted-foreground">Live component preview</p>
          </div>
          <UBadge variant="outline">{{ currentComponent?.name }}</UBadge>
        </div>
      </template>

      <div class="border rounded-lg p-8 bg-muted/20 min-h-[600px]">
        <slot />
      </div>
    </UCard>
  </div>
</template>

<style scoped></style>
