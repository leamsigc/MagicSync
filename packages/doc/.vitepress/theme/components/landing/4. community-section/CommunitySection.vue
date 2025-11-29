<script setup lang="ts">
import CommunityCard, { type Testimonial } from './CommunityCard.vue'

const testimonials: Testimonial[] = [
  {
    name: 'MagicSync solo team',
    handle: '@leamsigc',
    avatar:
      'https://avatars.githubusercontent.com/u/23272293?s=200&v=4',
    comment: [
      `I build MagicSync beacause I needed a tool to manage the social media from my friends and family, as well as a way to learn a little bit more about how to build a big nuxt application usin Nuxt layers`,
    ],
  },
]
</script>

<template>
  <section class="community-section">
    <h2>Loved by developers?</h2>
    <h3>
      We dont have any testimonials yet, but we are working on it!, for now he is my own
    </h3>
    <div class="community-grid-container">
      <div class="community-grid">
        <CommunityCard
          :testimonial="testimonial"
          v-for="testimonial in testimonials"
          :key="testimonial.name"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.community-section {
  margin-top: 140px;
  display: none;

  @media (min-width: 768px) {
    display: block;
  }

  h2 {
    background: linear-gradient(0deg, #fff 0%, rgba(255, 255, 255, 0.76) 100%);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin: 0 auto 10px;
    text-align: center;
  }

  h3 {
    width: 455px;
    max-width: 100%;
    margin: 0 auto;
    text-align: center;
  }

  .community-grid-container {
    position: relative;
  }

  .community-grid {
    column-count: 2;
    column-gap: 25px;
    width: calc(100% - 50px);
    margin: 40px auto 0;

    @media (min-width: 1150px) {
      column-count: 3;
      width: 1100px;
    }
  }
}
</style>
