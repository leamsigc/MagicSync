# Screenshots gallery

A single-page view of every captured route screenshot, for both desktop and mobile
viewports. Images are served from `/img/screenshots/`.

<script setup>
import { ref, onMounted } from 'vue'

const desktop = ref(null)
const mobile = ref(null)
const loading = ref(true)

const fetchManifest = async (name) => {
  try {
    const res = await fetch(`/img/screenshots/${name}`)
    if (!res.ok) return null
    return await res.json()
  } catch (e) {
    return null
  }
}

onMounted(async () => {
  desktop.value = await fetchManifest('manifest.json')
  mobile.value = await fetchManifest('manifest-mobile.json')
  loading.value = false
})

const desktopBySlug = (slug) => desktop.value?.entries?.find((e) => e.slug === slug) ?? null
const mobileBySlug = (slug) => mobile.value?.entries?.find((e) => e.slug === slug) ?? null
const allSlugs = () => {
  const set = new Set()
  for (const e of desktop.value?.entries ?? []) set.add(e.slug)
  for (const e of mobile.value?.entries ?? []) set.add(e.slug)
  return [...set].sort()
}
</script>

<div v-if="loading">Loading screenshots…</div>
<div v-else>
  <p v-if="!desktop && !mobile">No screenshots captured yet. Run <code>pnpm screenshots:routes</code> and <code>pnpm screenshots:mobile</code>.</p>
  <div v-for="slug in allSlugs()" :key="slug" class="screenshot-route">
    <h3>{{ slug }}</h3>
    <div class="screenshot-grid">
      <figure v-if="desktopBySlug(slug)?.file">
        <figcaption>Desktop</figcaption>
        <img :src="`/img/screenshots/${desktopBySlug(slug).file}`" :alt="slug + ' desktop'" loading="lazy" />
      </figure>
      <figure v-if="mobileBySlug(slug)?.file">
        <figcaption>Mobile</figcaption>
        <img :src="`/img/screenshots/${mobileBySlug(slug).file}`" :alt="slug + ' mobile'" loading="lazy" />
      </figure>
    </div>
  </div>
</div>

<style scoped>
.screenshot-route { margin: 1.5rem 0; }
.screenshot-grid { display: flex; gap: 1rem; flex-wrap: wrap; }
.screenshot-grid figure { margin: 0; flex: 1 1 320px; min-width: 200px; }
.screenshot-grid img { max-width: 100%; border: 1px solid var(--vp-c-divider); border-radius: 8px; }
.screenshot-grid figcaption { font-size: 0.85rem; color: var(--vp-c-text-2); margin-bottom: 0.25rem; }
</style>