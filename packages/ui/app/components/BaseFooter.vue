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
const { t } = useI18n()
const appConfig = useAppConfig()

const socials = appConfig.BaseUiLayer.footer.socialLinks
const companyName = appConfig.BaseUiLayer.footer.companyName
const logoUrl = appConfig.BaseUiLayer.main.logo

const companyLinks = [
  {
    label: t('footer.aboutUs'),
    to: '/about-us'
  },
  {
    label: t('footer.careers'),
    to: '/release-notes'
  },
  {
    label: t('footer.pressKit'),
    to: '/privacy-policy'
  },
  {
    label: t('footer.partners'),
    to: 'partners'
  },
  {
    label: t('footer.contact'),
    to: 'contact'
  },
  {
    label: t('footer.legal'),
    to: '/terms-of-use'
  }
]
</script>

<template>
  <UFooter class="px-10">
    <template #top>
      <div class="grid grid-cols-1 gap-12 lg:grid-cols-12">
        <!-- Left Section - About -->
        <div class="lg:col-span-5">
          <NuxtLink to="#" class="mb-5 inline-flex items-center gap-3">
            <img :src="logoUrl" fit="contain" :alt="companyName" :title="companyName" class="h-10 object-contain" />
            <span class="text-2xl font-bold">{{ companyName }}</span>
          </NuxtLink>
          <p class="mb-6 text-muted-foreground">
            {{ t('footer.description') }}
          </p>

          <!-- App Download Buttons -->
          <div class="mb-6 flex flex-col gap-3 sm:flex-row">
            <NuxtLink to="#"
              class="flex items-center gap-3 rounded-lg border px-4 py-2.5 transition-colors hover:border-primary hover:bg-primary/5">
              <Icon name="logos:apple-app-store" class="size-6" />
              <div class="text-left">
                <p class="text-xs text-muted-foreground">{{ t('footer.downloadOn') }}</p>
                <p class="text-sm font-semibold">{{ t('footer.appStore') }}</p>
              </div>
            </NuxtLink>
            <NuxtLink to="#"
              class="flex items-center gap-3 rounded-lg border px-4 py-2.5 transition-colors hover:border-primary hover:bg-primary/5">
              <Icon name="logos:google-play-icon" class="size-6" />
              <div class="text-left">
                <p class="text-xs text-muted-foreground">{{ t('footer.getItOn') }}</p>
                <p class="text-sm font-semibold">{{ t('footer.googlePlay') }}</p>
              </div>
            </NuxtLink>
          </div>

          <!-- Social Links -->
          <div>
            <p class="mb-3 text-sm font-semibold">{{ t('footer.followUs') }}</p>
            <div class="flex gap-3">
              <NuxtLink v-for="social in socials" :key="social.icon" :to="social.url" target="_blank"
                class="flex h-10 w-10 items-center justify-center rounded-full border transition-all hover:scale-110 hover:border-primary hover:bg-primary/5">
                <Icon :name="social.icon" class="h-5 w-5" />
              </NuxtLink>
            </div>
          </div>
        </div>

        <!-- Right Section - Links -->
        <div class="grid grid-cols-2 gap-8 md:grid-cols-3 lg:col-span-7 lg:grid-cols-3">
          <div>
            <h3 class="mb-4 text-sm font-semibold tracking-wider uppercase">{{ t('footer.platform') }}</h3>
            <ul class="space-y-3">
              <li v-for="item in [
                t('footer.overview'),
                t('footer.features'),
                t('footer.integrations'),
                t('footer.pricing'),
                t('footer.changelog'),
                t('footer.status'),
              ]" :key="item">
                <NuxtLink :to="`${item.toLowerCase().replace(/ /g, '-')}`"
                  class="text-sm text-muted-foreground transition-colors hover:text-primary">
                  {{ item }}
                </NuxtLink>
              </li>
            </ul>
          </div>

          <div>
            <h3 class="mb-4 text-sm font-semibold tracking-wider uppercase">{{ t('footer.resources') }}</h3>
            <ul class="space-y-3">
              <li v-for="item in [
                t('footer.documentation'),
                t('footer.apiReference'),
                t('footer.guides'),
                t('footer.blog'),
                t('footer.community'),
                t('footer.support'),
              ]" :key="item">
                <NuxtLink class="text-sm text-muted-foreground transition-colors hover:text-primary" to="#">
                  {{ item }}
                </NuxtLink>
              </li>
            </ul>
          </div>

          <div>
            <h3 class="mb-4 text-sm font-semibold tracking-wider uppercase">{{ t('footer.company') }}</h3>
            <ul class="space-y-3">
              <li v-for="item in companyLinks" :key="item.to">
                <NuxtLinkLocale class="text-sm text-muted-foreground transition-colors hover:text-primary"
                  :to="item.to">
                  {{ item.label }}
                </NuxtLinkLocale>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </template>

    <template #bottom>
      <div class="flex flex-col items-center justify-between gap-4 lg:flex-row">
        <p class="text-sm text-muted-foreground">
          {{ t('footer.copyrightText', { year: new Date().getFullYear(), companyName: companyName }) }}
        </p>
        <div class="flex flex-wrap gap-6 text-sm text-muted-foreground">
          <NuxtLink to="/privacy-policy" class="transition-colors hover:text-primary">{{ t('footer.privacyPolicy') }}
          </NuxtLink>
          <NuxtLink to="/terms-of-use" class="transition-colors hover:text-primary">{{ t('footer.termsOfService') }}
          </NuxtLink>
          <NuxtLink to="/privacy-policy" class="transition-colors hover:text-primary">{{ t('footer.cookiePolicy') }}
          </NuxtLink>
        </div>
      </div>
    </template>
  </UFooter>
</template>
