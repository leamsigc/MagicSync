import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'

// Static platform catalog (replaces the Python /platforms proxy endpoint).
const PLATFORMS = [
  { name: 'twitter', display_name: 'Twitter / X', max_length: 280, recommended_length: 240, max_hashtags: 3, max_images: 4, hashtag_placement: 'inline', link_handling: 'shorten', supports_threads: true },
  { name: 'instagram', display_name: 'Instagram', max_length: 2200, recommended_length: 300, max_hashtags: 10, max_images: 10, hashtag_placement: 'end', link_handling: 'bio', supports_threads: false },
  { name: 'facebook', display_name: 'Facebook', max_length: 63206, recommended_length: 400, max_hashtags: 5, max_images: 10, hashtag_placement: 'end', link_handling: 'inline', supports_threads: false },
  { name: 'linkedin', display_name: 'LinkedIn', max_length: 3000, recommended_length: 600, max_hashtags: 5, max_images: 9, hashtag_placement: 'end', link_handling: 'inline', supports_threads: false },
  { name: 'tiktok', display_name: 'TikTok', max_length: 2200, recommended_length: 150, max_hashtags: 8, max_images: 1, hashtag_placement: 'end', link_handling: 'bio', supports_threads: false },
  { name: 'bluesky', display_name: 'Bluesky', max_length: 300, recommended_length: 260, max_hashtags: 3, max_images: 4, hashtag_placement: 'inline', link_handling: 'inline', supports_threads: false },
  { name: 'youtube', display_name: 'YouTube', max_length: 5000, recommended_length: 300, max_hashtags: 5, max_images: 1, hashtag_placement: 'end', link_handling: 'inline', supports_threads: false },
  { name: 'threads', display_name: 'Threads', max_length: 500, recommended_length: 400, max_hashtags: 3, max_images: 10, hashtag_placement: 'end', link_handling: 'inline', supports_threads: true },
]

export default defineEventHandler(async (event) => {
  await checkUserIsLogin(event)
  return PLATFORMS.map(platform => ({ ...platform, limits: { ...platform } }))
})
