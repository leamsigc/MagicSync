import type { SlideData } from './templates'
import type { DeckPalette } from './composables/useCarouselDeck'

export interface DeckSlideSpec {
  templateKey: string
  data: SlideData
}

export interface DeckTemplate {
  key: string
  title: string
  description: string
  palette: DeckPalette
  slides: DeckSlideSpec[]
}

export const CAROUSEL_DECK_TEMPLATES: DeckTemplate[] = [
  {
    key: 'creator-tips',
    title: 'Creator Tips',
    description: '6-page educational thread — hook, tips, checklist, proof, CTA',
    palette: { bg: '#0f0e0d', text: '#fafaf9', accent: '#f97316' },
    slides: [
      { templateKey: 'title-kicker', data: { kicker: 'CREATOR TIPS', headline: '5 Mistakes First-Time Founders Make', body: 'And how to fix them before you launch' } },
      { templateKey: 'tips-list', data: { kicker: 'MISTAKE #1', headline: 'Building in silence', body: '', items: ['No audience on day one', 'Feedback comes too late', 'Launch feels like shouting into nothing'] } },
      { templateKey: 'checklist', data: { headline: 'Fix: Build in public', items: ['Share weekly progress', 'Post 1 lesson per week', 'Collect 50 emails pre-launch'] } },
      { templateKey: 'quote', data: { headline: 'Trust beats features', quote: 'People don’t buy products. They buy better versions of themselves.', author: 'Samuel Hulick' } },
      { templateKey: 'stat-highlight', data: { headline: 'Trust drives purchase', stat: '87%', statLabel: 'said trust in the creator mattered more than features', body: 'Be the trusted guide, not just a seller.' } },
      { templateKey: 'cta', data: { headline: 'Your audience is waiting', body: 'Start sharing your journey — one post at a time.', cta: 'Follow for more' } },
    ],
  },
  {
    key: 'product-showcase',
    title: 'Product Showcase',
    description: '5 pages — hero, feature, comparison, stat, CTA. Perfect for launches',
    palette: { bg: '#0c1e35', text: '#e0f2fe', accent: '#38bdf8' },
    slides: [
      { templateKey: 'full-photo', data: { kicker: 'NEW DROP', headline: 'Meet MagicSync', body: 'Schedule posts everywhere in one click.' } },
      { templateKey: 'photo-left', data: { headline: 'One editor, every platform', body: 'Write once. We format for Instagram, LinkedIn, X and more.' } },
      { templateKey: 'comparison', data: { headline: 'Before vs After', items: ['Manual posting ×5', 'Copy-paste errors', 'No preview', 'Unified composer', 'Auto-formatting', 'Live preview'] } },
      { templateKey: 'stat-highlight', data: { headline: 'Time saved', stat: '6h', statLabel: 'per week for teams posting daily', body: 'Reclaim your creative time.' } },
      { templateKey: 'cta', data: { headline: 'Start scheduling free', body: 'No signup required — create your first carousel in minutes.', cta: 'Try it now' } },
    ],
  },
  {
    key: 'minimal-quotes',
    title: 'Minimal Quotes',
    description: '4-page refined deck — statement, quotes, stat, CTA',
    palette: { bg: '#fafaf7', text: '#1c1917', accent: '#ea580c' },
    slides: [
      { templateKey: 'big-statement', data: { headline: 'Simplicity is not simple' } },
      { templateKey: 'quote', data: { headline: 'Simplicity quote', quote: 'Simplicity is the ultimate sophistication.', author: 'Leonardo da Vinci' } },
      { templateKey: 'quote', data: { headline: 'Less is more', quote: 'Make it simple, but significant.', author: 'Don Draper' } },
      { templateKey: 'cta', data: { headline: 'Create with intent', body: 'Less clutter. More meaning.', cta: 'Start designing' } },
    ],
  },
  {
    key: 'how-to-guide',
    title: 'How-To Guide',
    description: '6 pages — cover, steps, tips, checklist, QA, CTA',
    palette: { bg: '#0d1f16', text: '#dcfce7', accent: '#4ade80' },
    slides: [
      { templateKey: 'title-kicker', data: { kicker: 'GUIDE', headline: 'How to Plan a Viral Carousel', body: 'A proven 5-step workflow' } },
      { templateKey: 'steps', data: { headline: '3 Steps to Flow', items: ['Hook with a bold promise', 'Teach one idea per slide', 'End with a clear next step'] } },
      { templateKey: 'tips-list', data: { kicker: 'STEP 1', headline: 'Nail the hook', items: ['Use a number or bold claim', 'Add a sub-line that teases value', 'Keep it to 6 words'] } },
      { templateKey: 'checklist', data: { headline: 'Before you export', items: ['All text inside safe area', 'Contrast passes AAA', 'CTA is actionable'] } },
      { templateKey: 'qa', data: { headline: 'How many slides?', body: '5–7 is the sweet spot. Under 4 feels thin; over 10 drops completion.' } },
      { templateKey: 'cta', data: { headline: 'Your turn', body: 'Apply this framework to your next idea.', cta: 'Save template' } },
    ],
  },
  {
    key: 'myth-buster',
    title: 'Myth Buster',
    description: '5 pages — myth vs fact series with finale',
    palette: { bg: '#1e1035', text: '#f3e8ff', accent: '#c084fc' },
    slides: [
      { templateKey: 'title-kicker', data: { kicker: 'MYTH BUSTERS', headline: '3 Myths About Posting Daily', body: 'And what actually works' } },
      { templateKey: 'myth-fact', data: { headline: 'Myth 1', items: ['You must post every day to grow', 'Consistency means quality × cadence. 3 great posts beat 7 rushed ones.'] } },
      { templateKey: 'myth-fact', data: { headline: 'Myth 2', items: ['More hashtags = more reach', '2-3 relevant hashtags outperform 20 generic ones.'] } },
      { templateKey: 'stat-highlight', data: { headline: 'Reality check', stat: '3×', statLabel: 'higher saves with useful carousels vs promos', body: 'Teach first, sell second.' } },
      { templateKey: 'cta', data: { headline: 'Save this carousel', body: 'Follow for a new myth-buster every week.', cta: 'Follow' } },
    ],
  },
]
