<script lang="ts" setup>
/**
 * Preview page for MagicImageGallery.
 *
 * `featured` selects the curated, already-deployed marketing screenshots, so
 * the preview renders before fresh screenshots are committed and published.
 * The component defaults to the full generated list when `featured` is off.
 */
</script>

<template>
  <PreviewShell component-name="MagicImageGallery">
    <MagicImageGallery featured />
  </PreviewShell>
</template>
