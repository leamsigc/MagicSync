import type { SlideData } from './templates'
import type { DeckPalette } from './composables/useCarouselDeck'
import type { LayerSpec } from './layers/types'

export interface DeckSlideSpec {
  templateKey: string
  data: SlideData
  /** Layer-based deck slides (new format). When present, `templateKey`/`data` are ignored. */
  layers?: LayerSpec[]
  /** AI-generated full slide HTML. When present, becomes an html layer. */
  html?: string
}

export interface DeckTemplate {
  key: string
  title: string
  description: string
  palette: DeckPalette
  pattern?: string
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
  {
    key: 'anime-punch',
    title: 'Anime Punch',
    description: '6 pages — shonen energy: hot pink on indigo, speed lines, bold Trebuchet',
    palette: { bg: '#17082e', text: '#fdf4ff', accent: '#ff2e88', font: 'Trebuchet MS' },
    pattern: 'diagonal',
    slides: [
      { templateKey: 'split-band', data: { kicker: 'アニメ ENERGY', headline: 'Level Up Your Feed', body: 'Main-character energy for your content — no filler episodes.', footer: '' } },
      { templateKey: 'big-statement', data: { headline: 'Every post is a new episode. Make it canon.' } },
      { templateKey: 'tips-list', data: { kicker: 'POWER-UP #1', headline: 'Awaken your hook', items: ['Open mid-action, never with a warm-up', 'Name the villain: the problem your reader has', 'Cliffhanger every slide'] } },
      { templateKey: 'photo-left', data: { headline: 'Your origin story arc', body: 'Show the before, the training montage, and the transformation.' } },
      { templateKey: 'stat-cards', data: { headline: 'The power scaling', items: ['Hook in 0.8s or they swipe', 'Saves beat likes 5 to 1', 'Endings fuel follows'] } },
      { templateKey: 'cta', data: { headline: 'Join the guild', body: 'New quests (carousels) drop every week.', cta: 'Follow the journey' } },
    ],
  },
  {
    key: 'midnight-dark',
    title: 'Midnight Dark',
    description: '5 pages — pure black, neon green accents, Impact headlines',
    palette: { bg: '#000000', text: '#ededed', accent: '#22c55e', font: 'Impact' },
    pattern: 'grid-fine',
    slides: [
      { templateKey: 'big-statement', data: { headline: 'Dark mode is a design statement. So is restraint.' } },
      { templateKey: 'quote', data: { headline: 'On simplicity', quote: 'Perfection is achieved when there is nothing left to take away.', author: 'Antoine de Saint-Exupéry' } },
      { templateKey: 'comparison', data: { headline: 'Noise vs Signal', items: ['Ten fonts fighting', 'Rainbow palettes', 'Walls of text', 'One typeface', 'Two colors', 'One idea per slide'] } },
      { templateKey: 'stat-highlight', data: { headline: 'Contrast converts', stat: '21:1', statLabel: 'the max contrast ratio — pure black on pure white', body: 'Legibility is the whole trick.' } },
      { templateKey: 'cta', data: { headline: 'Go dark', body: 'Steal this deck and make it yours.', cta: 'Use this template' } },
    ],
  },
  {
    key: 'neo-futurist',
    title: 'Neo Futuristic',
    description: '6 pages — terminal cyan on void navy, Courier type, blueprint grid',
    palette: { bg: '#05070f', text: '#a5f3fc', accent: '#00e5ff', font: 'Courier New' },
    pattern: 'blueprint',
    slides: [
      { templateKey: 'title-kicker', data: { kicker: '// SYSTEM BOOT', headline: 'The Future of Content Is Automated', body: '> initializing creativity protocol…' } },
      { templateKey: 'steps', data: { headline: 'EXECUTE SEQUENCE', items: ['SCAN — collect what your audience asks', 'SYNTHESIZE — one idea per frame', 'DEPLOY — publish everywhere at once'] } },
      { templateKey: 'checklist', data: { headline: 'PRE-FLIGHT CHECK', items: ['Headline under 7 words', 'Contrast ratio locked', 'CTA vector aimed'] } },
      { templateKey: 'qa', data: { headline: 'Will AI replace designers?', body: 'Negative. It replaces blank pages. Taste remains human.' } },
      { templateKey: 'stat-cards', data: { headline: 'TELEMETRY', items: ['10× faster drafts', '0 excuses left', '∞ iterations'] } },
      { templateKey: 'cta', data: { headline: 'JACK IN', body: 'The tools are ready. The only missing variable is you.', cta: 'Start building' } },
    ],
  },
  {
    key: 'kids-fun',
    title: 'Kids Fun',
    description: '5 pages — sunshine yellow, bubblegum accents, Comic Sans energy',
    palette: { bg: '#fef9c3', text: '#713f12', accent: '#f472b6', font: 'Comic Sans MS' },
    pattern: 'confetti',
    slides: [
      { templateKey: 'title-kicker', data: { kicker: 'HEY FRIENDS!', headline: '5 Rainy Day Crafts', body: 'Paper, glue and a little bit of magic!' } },
      { templateKey: 'tips-list', data: { kicker: 'CRAFT TIME', headline: 'Sock puppet pals', items: ['Find a lonely sock', 'Glue on googly eyes', 'Put on a show!'] } },
      { templateKey: 'photo-grid', data: { kicker: 'LOOK!', headline: 'Our craft gallery', images: [] } },
      { templateKey: 'polaroid', data: { headline: 'Masterpiece Monday', body: 'Snap a photo of your creation and tag us!' } },
      { templateKey: 'cta', data: { headline: 'Show us yours!', body: 'Grown-ups: share it with #LittleMakers', cta: 'Tag us!' } },
    ],
  },
  {
    key: 'fiesta-mexicana',
    title: 'Fiesta Mexicana',
    description: '6 pages — papel picado rose & gold, Palatino warmth',
    palette: { bg: '#be123c', text: '#fef9c3', accent: '#facc15', font: 'Palatino' },
    pattern: 'zigzag',
    slides: [
      { templateKey: 'split-band', data: { kicker: '¡VÁMONOS!', headline: 'La Receta Abuela Nunca Escribió', body: 'Tres generaciones, un mole, y todos los secretos.', footer: '' } },
      { templateKey: 'tips-list', data: { kicker: 'PASO A PASO', headline: 'El secreto está en el caldo', items: ['Tuesta los chiles sin quemarlos', 'Muele en metate, nunca licuadora', 'Paciencia: dos horas mínimo'] } },
      { templateKey: 'quote', data: { headline: 'Dicho de la casa', quote: 'El que sabe, sabe. Y el que no, aprende en la cocina.', author: 'Abuela Carmen' } },
      { templateKey: 'photo-grid', data: { kicker: 'LA COCINA', headline: 'Ingredientes con historia', images: [] } },
      { templateKey: 'stat-cards', data: { headline: 'Datos del mole', items: ['20 ingredientes', '2 horas de cocción', '1 sola olla'] } },
      { templateKey: 'cta', data: { headline: '¡Buen provecho!', body: 'Sígueme para más recetas de la abuela.', cta: 'Sígueme' } },
    ],
  },
  {
    key: 'retro-sunshine',
    title: 'Retro Sunshine',
    description: '5 pages — 70s amber & cream, Century Gothic grooves',
    palette: { bg: '#fde68a', text: '#78350f', accent: '#ea580c', font: 'Century Gothic' },
    pattern: 'waves',
    slides: [
      { templateKey: 'big-statement', data: { headline: 'Good vibes only. Bad kerning never.' } },
      { templateKey: 'quote', data: { headline: 'From the vault', quote: 'The best way to predict the future is to invent it.', author: 'Alan Kay' } },
      { templateKey: 'photo-left', data: { headline: 'Analog soul, digital speed', body: 'Take the warmth of film and the reach of the feed.' } },
      { templateKey: 'stat-highlight', data: { headline: 'Groovy math', stat: '45', statLabel: 'seconds is all a stranger gives your first slide', body: 'Make every spin of the record count.' } },
      { templateKey: 'cta', data: { headline: 'Keep it mellow', body: 'Follow along for weekly retro-flavored design tips.', cta: 'Ride along' } },
    ],
  },
  {
    key: 'luxe-gold',
    title: 'Luxe Gold',
    description: '5 pages — obsidian black, champagne gold, Georgia serif',
    palette: { bg: '#0a0a0a', text: '#faf5eb', accent: '#d4af37', font: 'Georgia' },
    pattern: 'rings',
    slides: [
      { templateKey: 'title-kicker', data: { kicker: 'MAISON NOIR', headline: 'Craft Over Noise', body: 'A quiet approach to loud results' } },
      { templateKey: 'quote', data: { headline: 'House philosophy', quote: 'Luxury is not a price. It is a standard.', author: 'The Atelier' } },
      { templateKey: 'polaroid', data: { headline: 'The Signature Piece', body: 'One object, photographed like it matters — because it does.' } },
      { templateKey: 'stat-highlight', data: { headline: 'By the numbers', stat: '1%', statLabel: 'of brands publish with true editorial consistency', body: 'Exclusivity is a habit, not a budget.' } },
      { templateKey: 'cta', data: { headline: 'Request the catalogue', body: 'Private list. No noise, ever.', cta: 'Join the list' } },
    ],
  },
  {
    key: 'cyber-neon',
    title: 'Cyber Neon',
    description: '5 pages — magenta glow on deep violet, mono type, zigzag static',
    palette: { bg: '#12071f', text: '#f0abfc', accent: '#e879f9', font: 'Courier New' },
    pattern: 'crosshatch',
    slides: [
      { templateKey: 'title-kicker', data: { kicker: 'SIGNAL // 404', headline: 'Design Rules From the Neon District', body: 'Break them after you master them' } },
      { templateKey: 'myth-fact', data: { headline: 'Transmission 01', items: ['Neon means unreadable', 'Glow is fine — contrast is non-negotiable'] } },
      { templateKey: 'comparison', data: { headline: 'Chrome vs Soul', items: ['Template everything', 'Stock everything', 'Post and pray', 'System + spark', 'Custom moments', 'Post with intent'] } },
      { templateKey: 'qa', data: { headline: 'Too many effects?', body: 'If the message needs sunglasses to read, dial it back 40%.' } },
      { templateKey: 'cta', data: { headline: 'Enter the district', body: 'Weekly drops from the neon side of design.', cta: 'Plug in' } },
    ],
  },
  {
    key: 'swiss-minimal',
    title: 'Swiss Minimal',
    description: '5 pages — white space, Helvetica discipline, single red accent',
    palette: { bg: '#ffffff', text: '#111111', accent: '#ef4444', font: 'Arial Black' },
    pattern: 'none',
    slides: [
      { templateKey: 'big-statement', data: { headline: 'Grid. Type. Space. Nothing else.' } },
      { templateKey: 'steps', data: { headline: 'The method', items: ['Define one message', 'Set it in one typeface', 'Remove one more element than feels safe'] } },
      { templateKey: 'stat-highlight', data: { headline: 'Less, measured', stat: '-38%', statLabel: 'fewer elements, +52% recall in layout studies', body: 'Subtraction is a feature.' } },
      { templateKey: 'checklist', data: { headline: 'Before export', items: ['Margins are equal', 'Baseline holds', 'Red used once'] } },
      { templateKey: 'cta', data: { headline: 'Make it exact.', body: 'Precision ships.', cta: 'Begin' } },
    ],
  },
  {
    key: 'nature-calm',
    title: 'Nature Calm',
    description: '5 pages — sage on cream, Palatino serenity, photo-first',
    palette: { bg: '#ecfdf5', text: '#064e3b', accent: '#10b981', font: 'Palatino' },
    pattern: 'dots-dense',
    slides: [
      { templateKey: 'title-kicker', data: { kicker: 'SLOW LIVING', headline: 'Grow Your Feed Like a Garden', body: 'Plant, water, wait, harvest' } },
      { templateKey: 'photo-grid', data: { kicker: 'FROM THE PLOT', headline: 'This week outside', images: [] } },
      { templateKey: 'quote', data: { headline: 'On patience', quote: 'A society grows great when old men plant trees whose shade they know they shall never sit in.', author: 'Greek proverb' } },
      { templateKey: 'checklist', data: { headline: 'Weekly tending', items: ['One honest post', 'Five real comments', 'Zero doomscrolling'] } },
      { templateKey: 'cta', data: { headline: 'Breathe. Then build.', body: 'Slow content compounds fastest.', cta: 'Walk with me' } },
    ],
  },
  // ── Five new high-performance decks (2025 IG data) ──
  {
    key: 'cheat-sheet-pro',
    title: 'Cheat-Sheet Save Magnet',
    description: '6 pages — dense value stack, saves 3.1× avg. For tutorials & resource drops',
    palette: { bg: '#0a0a0a', text: '#fafaf9', accent: '#facc15', font: 'Arial Black' },
    pattern: 'grid-fine',
    slides: [
      { templateKey: 'title-kicker', data: { kicker: 'CHEAT SHEET', headline: 'The Only Carousel Formula You Need', body: 'Save this — you’ll use it every week' } },
      { templateKey: 'number-hero', data: { headline: 'Hook in 6 words or less', body: 'If they don’t stop in 1.2s, they never will.', items: ['Use a number or bold claim', 'Promise a transformation', 'Tease the payoff'] } },
      { templateKey: 'number-hero', data: { headline: 'One idea per slide', body: 'Don’t cram. Each swipe earns the next one.', items: ['1 headline = 1 takeaway', '3 lines max per page', 'White space is your friend'] } },
      { templateKey: 'feature-highlight', data: { kicker: 'SAVE THIS STACK', headline: 'The 3-part value loop', body: 'Teach → prove → ask', items: ['Teach something useful', 'Prove it works', 'Ask for a save'] } },
      { templateKey: 'stat-highlight', data: { headline: 'Saves beat likes', stat: '3.1×', statLabel: 'more reach when carousels are saved, not just liked', body: 'Design for saves first.' } },
      { templateKey: 'cta', data: { headline: 'Steal this system', body: 'Follow for a new cheat sheet every Tuesday.', cta: 'Save & follow' } },
    ],
  },
  {
    key: 'before-after-glow',
    title: 'Before / After Glow-Up',
    description: '5 pages — transformation story, shares 2.8× avg. For glow-ups & case studies',
    palette: { bg: '#fffbeb', text: '#451a03', accent: '#ea580c', font: 'Georgia' },
    pattern: 'waves',
    slides: [
      { templateKey: 'split-band', data: { kicker: 'GLOW-UP', headline: 'From 0 → 10k in 90 Days', body: 'No ads. No team. Just this system.', footer: '' } },
      { templateKey: 'comparison', data: { headline: 'Before vs After', items: ['0 followers', 'No offer', 'Posting randomly', '10k engaged', 'Waitlist full', 'Posting with system'] } },
      { templateKey: 'timeline', data: { headline: 'The 4 phases', body: 'What changed in order', items: ['Audit: killed what didn’t work', 'System: one theme per week', 'Proof: posted daily for 30 days', 'Compounding: followers became fans'] } },
      { templateKey: 'testimonial', data: { headline: 'I went from invisible to booked out', quote: 'This carousel system changed how I show up. Every post now has a purpose.', author: 'Alex — Coach', body: 'DM “SYSTEM” for the template', images: [] } },
      { templateKey: 'cta', data: { headline: 'Your glow-up starts', body: 'Save this carousel and start day one today.', cta: 'Start now' } },
    ],
  },
  {
    key: 'hot-take-debate',
    title: 'Hot Take Debate',
    description: '6 pages — polarizing takes, comments 4× avg. Spark the conversation',
    palette: { bg: '#0f0a0a', text: '#ffe4e6', accent: '#ef4444', font: 'Impact' },
    pattern: 'diagonal',
    slides: [
      { templateKey: 'title-kicker', data: { kicker: 'HOT TAKE', headline: 'Posting Daily Is Killing Your Growth', body: 'And the algorithm agrees' } },
      { templateKey: 'myth-fact', data: { headline: 'Hot Take #1', items: ['You must post every day to grow', 'You must post better, not more. 3 great carousels beat 7 rushed posts.'] } },
      { templateKey: 'myth-fact', data: { headline: 'Hot Take #2', items: ['More hashtags = more reach', '3 hyper-relevant hashtags > 20 generic ones. Relevance beats spray.'] } },
      { templateKey: 'qa', data: { headline: 'But won’t I lose momentum?', body: 'You gain trust. One carousel saved is worth ten scrolled past. Quality compounds; quantity just tires you out.' } },
      { templateKey: 'stat-highlight', data: { headline: 'The data', stat: '4×', statLabel: 'more comments on polarizing vs safe posts', body: 'Safe posts get likes. Brave posts get conversations.' } },
      { templateKey: 'cta', data: { headline: 'Agree or disagree?', body: 'Drop your hot take in the comments — I read every one.', cta: 'Comment below' } },
    ],
  },
  {
    key: 'build-in-public',
    title: 'Build In Public Diary',
    description: '6 pages — founder diary, completion 92%. Behind-the-scenes that connects',
    palette: { bg: '#f0fdfa', text: '#042f2e', accent: '#14b8a6', font: 'Palatino' },
    pattern: 'dots',
    slides: [
      { templateKey: 'title-kicker', data: { kicker: 'DAY 147', headline: 'We Hit $1k MRR Then Lost It All', body: 'Here’s what nobody posts about' } },
      { templateKey: 'quote', data: { headline: 'On the hard days', quote: 'If you’re not embarrassed by your first version, you started too late.', author: 'My co-founder, at 2am' } },
      { templateKey: 'photo-grid', data: { kicker: 'BEHIND THE SCENES', headline: 'The real office', images: [] } },
      { templateKey: 'timeline', data: { headline: 'What we learned', items: ['Ship before you’re ready', 'Talk to users daily', 'Write the story as you live it'] } },
      { templateKey: 'stat-cards', data: { headline: 'By the numbers', items: ['147 days building', '342 users today', '1 lesson per day'] } },
      { templateKey: 'cta', data: { headline: 'Follow the build', body: 'I share one real lesson every morning.', cta: 'Follow the journey' } },
    ],
  },
  {
    key: 'vs-battle',
    title: 'This vs That Showdown',
    description: '5 pages — head-to-head comparison, shares + saves monster',
    palette: { bg: '#1e1b4b', text: '#e0e7ff', accent: '#f97316', font: 'Trebuchet MS' },
    pattern: 'crosshatch',
    slides: [
      { templateKey: 'split-band', data: { kicker: 'SHOWDOWN', headline: 'Freelancer vs Agency', body: 'Which path actually gets you to $10k/month faster?', footer: '' } },
      { templateKey: 'comparison', data: { headline: 'Freelancer', items: ['Keep 100% of profit', 'Move at your speed', 'Learn every skill', 'No overhead', 'Wear all hats', 'Lonely at times'] } },
      { templateKey: 'comparison', data: { headline: 'Agency', items: ['Scale with team', 'System over hustle', 'Specialize deeply', 'Hire = leverage', 'Processes = freedom', 'Overhead early'] } },
      { templateKey: 'feature-highlight', data: { kicker: 'THE VERDICT', headline: 'Start freelance, systemize to agency', body: 'Proof before process', items: ['Freelance to learn', 'Systemize to earn', 'Team to scale'] } },
      { templateKey: 'cta', data: { headline: 'Which side are you on?', body: 'Save this for when you choose — and follow the playbook.', cta: 'Follow' } },
    ],
  },
]
