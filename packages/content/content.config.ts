import { defineContentConfig, defineCollection } from '@nuxt/content'
import { defineRobotsSchema } from '@nuxtjs/robots/content'
import { defineSitemapSchema } from '@nuxtjs/sitemap/content'
import { defineOgImageSchema } from 'nuxt-og-image/content'
import { defineSchemaOrgSchema } from 'nuxt-schema-org/content'
import { z } from 'zod'

/*
 * @see https://content.nuxtjs.org/api/configuration
 * To add new languages to the content, you can add a new collection for each language.
 *
 */

const blogSchema = z.object({
  robots: defineRobotsSchema(),
  sitemap: defineSitemapSchema(),
  ogImage: defineOgImageSchema(),
  schemaOrg: defineSchemaOrgSchema(),
  layout: z.enum(['default', 'blog-layout']).default('blog-layout'),
  title: z.string(),
  description: z.string(),
  image: z.object({
    src: z.string(),
    alt: z.string()
  }),
  tags: z.array(z.string()).optional(),
  date: z.string(),
  publishedAt: z.string(),
  head: z.object({
    meta: z.array(z.object({
      name: z.string(),
      content: z.string()
    })),
    htmlAttrs: z.object({
      lang: z.string()
    }).optional(),
    bodyAttrs: z.object({
      class: z.string()
    }).optional(),
  }),
  category: z.string(),
  featured: z.boolean().default(false),
  author: z.object({
    name: z.string(),
    role: z.string(),
    avatar: z.string(),
    social: z.string()
  }),
  // ogImage: z.object({
  //   component: z.enum(['BlogOgImage', 'Video']).default('BlogOgImage'),
  //   props: z.object({
  //     title: z.string(),
  //     description: z.string(),
  //     image: z.string()
  //   })
  // })
});

export const collections = {
  content_en: defineCollection({
    type: 'page',
    source: {
      include: 'en/**',
      exclude: ["en/blogs/**"],
      prefix: '',
    },
    schema: blogSchema
  }),

  blog_en: defineCollection({
    type: 'page',
    source: {
      include: 'en/blogs/**',
      prefix: '',
    },
    schema: blogSchema
  }),
  content_es: defineCollection({
    type: 'page',
    source: {
      include: 'es/**',
      exclude: ["es/blogs/**"],
      prefix: '',
    },
    schema: blogSchema
  }),

  blog_es: defineCollection({
    type: 'page',
    source: {
      include: 'es/blogs/**',
      prefix: '',
    },
    schema: blogSchema
  })
}
