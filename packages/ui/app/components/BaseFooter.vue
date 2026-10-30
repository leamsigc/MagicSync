<script lang="ts" setup>
/**
 *
 * Footer
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
const appConfig = useAppConfig()
const { t, footerLinks } = useNavigationLinks()

const socials = appConfig.BaseUiLayer.footer.socialLinks
const companyName = appConfig.BaseUiLayer.footer.companyName
const logoUrl = appConfig.BaseUiLayer.main.logo
</script>

<template>
  <UFooter class="rounded mx-4 mb-4  z-50 relative px-5">
    <template #top>
      <div class="grid grid-cols-1 gap-12 lg:grid-cols-12">
        <!-- Left Section - About -->
        <div class="lg:col-span-5">
          <NuxtLink to="#" class="mb-5 inline-flex items-center gap-3">
            <NuxtImg :src="logoUrl" fit="contain" width="40" height="40" :alt="companyName" :title="companyName" class="h-10 object-contain" />
            <span class="text-2xl font-bold">{{ companyName }}</span>
          </NuxtLink>
          <p class="mb-6 text-muted-foreground">
            {{ t('footer.description') }}
          </p>

          <!-- Social Links -->
          <div>
            <p class="mb-3 text-sm font-semibold">{{ t('footer.followUs') }}</p>
            <div class="flex gap-3">
              <NuxtLink v-for="social in socials" :key="social.icon" :to="social.url" target="_blank"
                :aria-label="social.name" :title="social.name"
                class="flex h-10 w-10 items-center justify-center rounded-full border transition-all hover:scale-110 hover:border-primary hover:bg-primary/5">
                <Icon :name="social.icon" class="h-5 w-5" />
              </NuxtLink>
            </div>
          </div>
        </div>

        <!-- Right Section - Links -->
        <div class="grid grid-cols-2 gap-8 md:grid-cols-3 lg:col-span-7 lg:grid-cols-3">
          <div>
            <h3 class="mb-4 text-sm font-semibold tracking-wider uppercase">{{ footerLinks.platform.title }}</h3>
            <ul class="space-y-3">
              <li v-for="item in footerLinks.platform.items" :key="item.label">
                <NuxtLink :to="item.to" class="text-sm text-muted-foreground transition-colors hover:text-primary">
                  {{ item.label }}
                </NuxtLink>
              </li>
            </ul>
          </div>

          <div>
            <h3 class="mb-4 text-sm font-semibold tracking-wider uppercase">{{ footerLinks.resources.title }}</h3>
            <ul class="space-y-3">
              <li v-for="item in footerLinks.resources.items" :key="item.label">
                <NuxtLink class="text-sm text-muted-foreground transition-colors hover:text-primary" :to="item.to">
                  {{ item.label }}
                </NuxtLink>
              </li>
            </ul>
          </div>

          <div>
            <h3 class="mb-4 text-sm font-semibold tracking-wider uppercase">{{ footerLinks.company.title }}</h3>
            <ul class="space-y-3">
              <li v-for="item in footerLinks.company.items" :key="item.to">
                <NuxtLinkLocale class="text-sm text-muted-foreground transition-colors hover:text-primary"
                  :to="item.to">
                  {{ item.label }}
                </NuxtLinkLocale>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- SEO link blocks: every supported network and AI agent, one crawlable
           link each with a descriptive label. Rendered site-wide so the footer
           passes consistent anchor text to the matching landing pages. -->
      <div class="mt-12 border-t border-default pt-10">
        <section aria-labelledby="footer-social-platforms">
          <h3 id="footer-social-platforms" class="mb-5 text-sm font-semibold tracking-wider uppercase">
            {{ footerLinks.socialPlatforms.title }}
          </h3>
          <ul class="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <li v-for="item in footerLinks.socialPlatforms.items" :key="item.label">
              <NuxtLinkLocale :to="item.to" class="group flex items-start gap-2.5"
                :title="`${item.label} — ${item.description}`">
                <Icon :name="item.icon"
                  class="mt-0.5 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                <span class="min-w-0">
                  <span class="block text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                    {{ item.label }}
                  </span>
                  <span class="block text-xs leading-snug text-muted-foreground">{{ item.description }}</span>
                </span>
              </NuxtLinkLocale>
            </li>
          </ul>
        </section>

        <section aria-labelledby="footer-ai-agents" class="mt-10">
          <h3 id="footer-ai-agents" class="mb-5 text-sm font-semibold tracking-wider uppercase">
            {{ footerLinks.aiAgents.title }}
          </h3>
          <ul class="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <li v-for="item in footerLinks.aiAgents.items" :key="item.label">
              <NuxtLinkLocale :to="item.to" class="group flex items-start gap-2.5"
                :title="`${item.label} — ${item.description}`">
                <Icon :name="item.icon"
                  class="mt-0.5 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                <span class="min-w-0">
                  <span class="block text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                    {{ item.label }}
                  </span>
                  <span class="block text-xs leading-snug text-muted-foreground">{{ item.description }}</span>
                </span>
              </NuxtLinkLocale>
            </li>
          </ul>
        </section>
      </div>
    </template>

    <template #bottom>
      <div class="flex flex-col items-center justify-between gap-4 lg:flex-row">
        <p class="text-sm text-muted-foreground">
          {{ t('footer.copyrightText', { year: new Date().getFullYear(), companyName: companyName }) }}
        </p>
        <div class="flex flex-wrap gap-6 text-sm text-muted-foreground">
          <NuxtLink v-for="link in footerLinks.legal" :key="link.label" :to="link.to"
            class="transition-colors hover:text-primary">
            {{ link.label }}
          </NuxtLink>
        </div>
      </div>
    </template>
  </UFooter>
</template>
