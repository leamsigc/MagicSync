# Screenshots gallery

A single-page view of every captured route screenshot, for both desktop and mobile
viewports. Images are served from `/img/screenshots/`.

<script setup>
import { data as shots } from './screenshots-gallery.data'
import { withBase } from 'vitepress'
</script>

<div v-if="!shots || shots.length === 0">
  <p>No screenshots captured yet. Run <code>pnpm screenshots:routes</code> and <code>pnpm screenshots:mobile</code>.</p>
</div>
<div v-else>
  <div v-for="shot in shots" :key="shot.slug" class="screenshot-route">
    <h3>{{ shot.slug }}</h3>
    <div class="screenshot-grid">
      <figure v-if="shot.desktop">
        <figcaption>Desktop</figcaption>
        <img :src="withBase('/' + shot.desktop)" :alt="shot.slug + ' desktop'" loading="lazy" />
      </figure>
      <figure v-if="shot.mobile">
        <figcaption>Mobile</figcaption>
        <img :src="withBase('/' + shot.mobile)" :alt="shot.slug + ' mobile'" loading="lazy" />
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