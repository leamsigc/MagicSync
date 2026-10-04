/**
 *
 * Layer templates — restaurant menu layouts built from editor layers.
 * Coordinates are fractions of the stage (0..1) so a template can be
 * applied at any TV size and every layer stays fully editable.
 *
 * Each template is a premium restaurant-grade design — high contrast
 * for TV readability, menu-engineered pricing, allergens, promos,
 * image slots and proper hierarchy.
 */

export type TemplateLayerType = 'text' | 'image' | 'list' | 'panel' | 'shape' | 'badge'

/** Sentinel used for the "default font" option in selects. */
export const DEFAULT_FONT_FAMILY = 'system'

/** Visual style for list layers */
export type ListStyle = 'dots' | 'leader' | 'dashes' | 'plain' | 'numbered'

export type TextAlign = 'left' | 'center' | 'right' | 'justify'
export type FontWeight = 300 | 400 | 500 | 600 | 700 | 800 | 900
export type FillType = 'solid' | 'gradient' | 'transparent'
export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'soft-light'
export type ObjectFit = 'cover' | 'contain' | 'fill' | 'none' | 'scale-down' | 'stretch'
export type BorderStyle = 'solid' | 'dashed' | 'dotted' | 'double' | 'none'

export interface TemplateLayerDef {
  type: TemplateLayerType
  name: string
  /** all values are fractions of stage width/height */
  x: number
  y: number
  w: number
  h: number
  content?: string
  items?: string[]
  // typography
  fontSizeF?: number
  fontFamily?: string
  fontWeight?: FontWeight
  fontStyle?: 'normal' | 'italic'
  textAlign?: TextAlign
  lineHeight?: number // 1 = 100%
  letterSpacing?: number // px
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
  textDecoration?: 'none' | 'underline' | 'line-through'
  // colors
  color?: string
  textColor?: string
  fill?: string
  fillType?: FillType
  gradient?: string // css gradient value e.g. linear-gradient(...)
  // layout / appearance
  opacity?: number // 0-1
  rotation?: number // degrees
  visible?: boolean
  locked?: boolean
  borderWidth?: number
  borderColor?: string
  borderStyle?: BorderStyle
  borderRadius?: number // 0-64
  boxShadow?: string // css box-shadow
  textShadow?: string // css text-shadow
  backdropBlur?: number // px
  filter?: string // css filter string e.g. brightness(1.1) contrast(1.2)
  blendMode?: BlendMode
  padding?: number // internal padding for panel/badge
  objectFit?: ObjectFit
  objectPosition?: string // e.g. "center"
  listStyle?: ListStyle
  src?: string
  // advanced
  zIndex?: number
}

export interface LayerTemplate {
  id: string
  name: string
  background: string
  layers: TemplateLayerDef[]
  category?: string
  description?: string
}

const WHITE = '#ffffff'
const DARK = '#1e293b'

export const LAYER_TEMPLATES: LayerTemplate[] = [
  // ── HERO: Classic Bistro (upgraded with Figma props) ──
  {
    id: 'replica-classic-bistro',
    name: 'Classic Bistro',
    background: '#5c1a1a',
    category: 'Fine Dining',
    description: 'Burgundy & gold, two-column starters/mains, wine sidebar',
    layers: [
      { type: 'panel', name: 'Left Sidebar', x: 0, y: 0, w: 0.28, h: 1, fill: '#5c1a1a', borderRadius: 0 },
      { type: 'panel', name: 'Wine Badge', x: 0.09, y: 0.07, w: 0.1, h: 0.15, fill: '#c9a86b', borderRadius: 9999, boxShadow: '0 8px 24px rgba(0,0,0,0.35)' },
      { type: 'text', name: 'Wine Icon', x: 0.09, y: 0.11, w: 0.1, h: 0.08, content: '🍷', fontFamily: "Georgia, 'Times New Roman', serif", fontSizeF: 0.05, color: '#5c1a1a', textAlign: 'center', fontWeight: 700 },
      { type: 'text', name: 'Restaurant Name', x: 0.03, y: 0.28, w: 0.22, h: 0.14, content: 'Maison\nBelle', fontFamily: "Georgia, 'Times New Roman', serif", fontSizeF: 0.055, color: '#f5f0e1', textAlign: 'center', fontWeight: 700, lineHeight: 1.05, letterSpacing: 0.5 },
      { type: 'text', name: 'Est Label', x: 0.03, y: 0.44, w: 0.22, h: 0.05, content: 'EST. 1987  •  LYON', fontFamily: "Georgia, 'Times New Roman', serif", fontSizeF: 0.018, color: '#d4af37', textAlign: 'center', letterSpacing: 4, textTransform: 'uppercase', fontWeight: 600 },
      { type: 'text', name: 'Special Note', x: 0.03, y: 0.60, w: 0.22, h: 0.20, content: '★ Today’s Special\nCoq au Vin — $18\nFree glass of Bordeaux', fontFamily: "Georgia, 'Times New Roman', serif", fontSizeF: 0.021, color: '#d4af37', textAlign: 'center', lineHeight: 1.4, borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)', borderStyle: 'solid', borderRadius: 12, padding: 10 },
      { type: 'panel', name: 'Divider', x: 0.32, y: 0.13, w: 0.006, h: 0.74, fill: '#d4af37', borderRadius: 99, opacity: 0.9 },
      { type: 'text', name: 'Starters Heading', x: 0.34, y: 0.08, w: 0.30, h: 0.07, content: 'STARTERS', fontFamily: "Georgia, 'Times New Roman', serif", fontSizeF: 0.038, color: '#d4af37', textTransform: 'uppercase', letterSpacing: 6, fontWeight: 700, textAlign: 'left' },
      { type: 'list', name: 'Starters List', x: 0.34, y: 0.17, w: 0.30, h: 0.68, items: ['French Onion Soup | $8 · gruyère & sourdough', 'Escargots de Bourgogne | $11 · garlic-herb butter', 'Salade Niçoise | $12 · seared tuna, olives', 'Duck Rillettes | $10 · cornichons, toast'], fontFamily: "Georgia, 'Times New Roman', serif", fontSizeF: 0.024, color: '#d4af37', textColor: '#f5f0e1', listStyle: 'leader', lineHeight: 1.6 },
      { type: 'panel', name: 'Divider 2', x: 0.66, y: 0.13, w: 0.006, h: 0.74, fill: '#d4af37', borderRadius: 99, opacity: 0.9 },
      { type: 'text', name: 'Mains Heading', x: 0.68, y: 0.08, w: 0.30, h: 0.07, content: 'MAINS', fontFamily: "Georgia, 'Times New Roman', serif", fontSizeF: 0.038, color: '#d4af37', textTransform: 'uppercase', letterSpacing: 6, fontWeight: 700 },
      { type: 'list', name: 'Mains List', x: 0.68, y: 0.17, w: 0.30, h: 0.68, items: ['Steak Frites | $24 · prime sirloin', 'Coq au Vin | $18 · braised, pearl onions', 'Ratatouille | $15 · Provençal, couscous', 'Sea Bass | $22 · beurre blanc'], fontFamily: "Georgia, 'Times New Roman', serif", fontSizeF: 0.024, color: '#d4af37', textColor: '#f5f0e1', listStyle: 'leader', lineHeight: 1.6 },
    ],
  },
  // ── HERO: Dark Steakhouse ──
  {
    id: 'replica-dark-steakhouse',
    name: 'Dark Steakhouse',
    background: '#121014',
    category: 'Steakhouse',
    description: 'Charred elegance, tomahawk hero, whisky pairing',
    layers: [
      { type: 'image', name: 'Fire Photo', x: 0, y: 0, w: 0.32, h: 1, objectFit: 'cover', filter: 'brightness(0.85) contrast(1.1)', borderRadius: 0 },
      { type: 'panel', name: 'Photo Gradient', x: 0, y: 0, w: 0.32, h: 1, fill: 'transparent', fillType: 'gradient', gradient: 'linear-gradient(90deg, transparent 40%, #121014 92%)' },
      { type: 'text', name: 'Brand Name', x: 0.36, y: 0.06, w: 0.42, h: 0.09, content: 'EMBER & OAK', fontFamily: "'Playfair Display', Didot, Georgia, serif", fontSizeF: 0.055, color: '#f3ece1', letterSpacing: 8, fontWeight: 700, textTransform: 'uppercase' },
      { type: 'text', name: 'Brand Subtitle', x: 0.62, y: 0.075, w: 0.34, h: 0.05, content: 'STEAKHOUSE · GRILL · OPEN FIRE', fontFamily: "'Playfair Display', Didot, Georgia, serif", fontSizeF: 0.018, color: '#d3a94e', letterSpacing: 3, textTransform: 'uppercase' },
      { type: 'panel', name: 'Header Divider', x: 0.36, y: 0.155, w: 0.59, h: 0.004, fill: '#3a3340', borderRadius: 99, opacity: 0.8 },
      { type: 'list', name: 'Cuts List', x: 0.36, y: 0.22, w: 0.59, h: 0.55, items: ['Ribeye 400g | $38 · dry-aged 30 days', 'Filet Mignon 250g | $42 · grass-fed, charred leek', 'Tomahawk for Two | $78 · smoked bone marrow butter', 'Lamb Rack | $36 · pistachio crust, mint jus'], fontFamily: "'Playfair Display', Didot, Georgia, serif", fontSizeF: 0.032, color: '#3a3340', textColor: '#f3ece1', listStyle: 'leader', lineHeight: 1.7 },
      { type: 'panel', name: 'Footer Divider', x: 0.36, y: 0.85, w: 0.59, h: 0.004, fill: '#3a3340', borderRadius: 99, opacity: 0.6 },
      { type: 'text', name: 'Footer Extras', x: 0.36, y: 0.88, w: 0.59, h: 0.06, content: '🥃 Whisky Flight — $22   ·   🥔 Truffle Pommes — $9   ·   All mains include fire-roasted bread', fontFamily: "'Playfair Display', Didot, Georgia, serif", fontSizeF: 0.019, color: '#b7a993', textAlign: 'center', letterSpacing: 0.5 },
    ],
  },
  // ── HERO: Café Morning ──
  {
    id: 'replica-cafe-morning',
    name: 'Café Morning',
    background: '#fdf6ec',
    category: 'Café',
    description: 'Warm pastry tones, breakfast plates, coffee bar',
    layers: [
      { type: 'panel', name: 'Logo Badge', x: 0.04, y: 0.04, w: 0.055, h: 0.14, fill: '#8a5a33', borderRadius: 9999, boxShadow: '0 6px 16px rgba(138,90,51,0.25)' },
      { type: 'text', name: 'Logo Icon', x: 0.04, y: 0.07, w: 0.055, h: 0.08, content: '☕', fontFamily: "'Trebuchet MS', Verdana, sans-serif", fontSizeF: 0.05, color: '#fdf6ec', textAlign: 'center' },
      { type: 'text', name: 'Cafe Name', x: 0.105, y: 0.04, w: 0.35, h: 0.09, content: 'Sunrise Café', fontFamily: "'Trebuchet MS', Verdana, sans-serif", fontSizeF: 0.052, color: '#3d2c23', fontWeight: 800 },
      { type: 'text', name: 'Tagline', x: 0.107, y: 0.125, w: 0.35, h: 0.04, content: 'BREAKFAST · PASTRY · COFFEE · EST. 2014', fontFamily: "'Trebuchet MS', Verdana, sans-serif", fontSizeF: 0.017, color: '#8a5a33', letterSpacing: 2.5, textTransform: 'uppercase', fontWeight: 600 },
      { type: 'panel', name: 'Happy Hour Pill', x: 0.72, y: 0.05, w: 0.23, h: 0.09, fill: '#8a5a33', borderRadius: 9999, boxShadow: '0 4px 12px rgba(138,90,51,0.2)', rotation: -1 },
      { type: 'text', name: 'Happy Hour Text', x: 0.72, y: 0.07, w: 0.23, h: 0.06, content: '☕ HAPPY HOUR 7–9 AM  -20%', fontFamily: "'Trebuchet MS', Verdana, sans-serif", fontSizeF: 0.021, color: '#fdf6ec', textAlign: 'center', fontWeight: 700, letterSpacing: 0.5 },
      { type: 'panel', name: 'Plates Card', x: 0.04, y: 0.2, w: 0.53, h: 0.74, fill: '#fffdf8', borderRadius: 20, boxShadow: '0 10px 30px rgba(90,61,38,0.12)', borderWidth: 1, borderColor: 'rgba(138,90,51,0.08)', borderStyle: 'solid' },
      { type: 'text', name: 'Breakfast Heading', x: 0.07, y: 0.24, w: 0.40, h: 0.06, content: 'BREAKFAST PLATES', fontFamily: "'Trebuchet MS', Verdana, sans-serif", fontSizeF: 0.032, color: '#8a5a33', letterSpacing: 3, fontWeight: 700, textTransform: 'uppercase' },
      { type: 'list', name: 'Breakfast List', x: 0.07, y: 0.33, w: 0.47, h: 0.56, items: ['Big Sunrise Platter | $13 · eggs, bacon, hash brown', 'Avocado Smash Toast | $10 · sourdough, chilli', 'Buttermilk Pancakes | $9 · maple, berries', 'Veggie Omelette | $11 · spinach, feta'], fontFamily: "'Trebuchet MS', Verdana, sans-serif", fontSizeF: 0.025, color: '#d9c4a6', textColor: '#3d2c23', listStyle: 'leader', lineHeight: 1.5 },
      { type: 'panel', name: 'Coffee Card', x: 0.62, y: 0.2, w: 0.34, h: 0.44, fill: '#8a5a33', borderRadius: 20, boxShadow: '0 10px 30px rgba(90,61,38,0.18)' },
      { type: 'text', name: 'Coffee Heading', x: 0.65, y: 0.24, w: 0.28, h: 0.06, content: 'COFFEE BAR', fontFamily: "'Trebuchet MS', Verdana, sans-serif", fontSizeF: 0.028, color: '#fdf6ec', letterSpacing: 3, fontWeight: 700, textTransform: 'uppercase', textAlign: 'center' },
      { type: 'list', name: 'Coffee List', x: 0.65, y: 0.32, w: 0.28, h: 0.28, items: ['Flat White | $4', 'Caramel Latte | $5', 'Cold Brew Tonic | $5.50', 'Espresso | $3'], fontFamily: "'Trebuchet MS', Verdana, sans-serif", fontSizeF: 0.023, color: '#fdf6ec', textColor: '#fdf6ec', listStyle: 'plain', lineHeight: 1.5 },
      { type: 'panel', name: 'Oven Card', x: 0.62, y: 0.68, w: 0.34, h: 0.26, fill: '#fffdf8', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(138,90,51,0.10)', borderStyle: 'dashed' },
      { type: 'text', name: 'Oven Text', x: 0.65, y: 0.71, w: 0.28, h: 0.20, content: '🥐 Fresh From The Oven\nButter croissants & cinnamon rolls — baked daily at 6 AM.', fontFamily: "'Trebuchet MS', Verdana, sans-serif", fontSizeF: 0.021, color: '#7a6a58', textAlign: 'center', lineHeight: 1.4 },
    ],
  },
  // ── UPGRADED: Bistro Élégance (was classic-bistro-simple) ──
  {
    id: 'classic-bistro-simple',
    name: 'Bistro Élégance',
    background: '#7a1f1f',
    category: 'Fine Dining',
    description: 'Burgundy grandeur, header band, starters & mains with desc',
    layers: [
      { type: 'panel', name: 'Header Band', x: 0.06, y: 0.05, w: 0.88, h: 0.16, fill: DARK, borderRadius: 16, boxShadow: '0 10px 24px rgba(0,0,0,0.35)', borderWidth: 1, borderColor: 'rgba(212,169,68,0.25)', borderStyle: 'solid' },
      { type: 'text', name: 'Restaurant Name', x: 0.1, y: 0.07, w: 0.80, h: 0.12, content: 'Maison Belle  —  EST. 1987', fontSizeF: 0.055, color: '#f7f2e8', fontFamily: "Georgia, 'Times New Roman', serif", textAlign: 'center', letterSpacing: 3, fontWeight: 700, textTransform: 'uppercase' },
      { type: 'panel', name: 'Gold Rule', x: 0.35, y: 0.215, w: 0.30, h: 0.004, fill: '#d4a944', borderRadius: 99, opacity: 0.8 },
      { type: 'text', name: 'Starters Heading', x: 0.08, y: 0.28, w: 0.40, h: 0.07, content: 'ENTRÉES  •  $8–13', fontSizeF: 0.038, color: '#f7f2e8', fontFamily: "Georgia, 'Times New Roman', serif", letterSpacing: 4, fontWeight: 700, textTransform: 'uppercase', textAlign: 'center', textShadow: '0 2px 8px rgba(0,0,0,0.35)' },
      { type: 'list', name: 'Starters List', x: 0.08, y: 0.37, w: 0.40, h: 0.50, items: ['French Onion Soup | $8 · gruyère, sourdough', 'Escargots Bourguignon | $11 · herb butter', 'Salade Niçoise | $12 · tuna, olive, egg'], fontSizeF: 0.028, color: '#d4a944', textColor: WHITE, fontFamily: "Georgia, 'Times New Roman', serif", listStyle: 'leader', lineHeight: 1.6 },
      { type: 'panel', name: 'Vertical Divider', x: 0.495, y: 0.30, w: 0.006, h: 0.56, fill: 'rgba(255,255,255,0.18)', borderRadius: 99 },
      { type: 'text', name: 'Mains Heading', x: 0.52, y: 0.28, w: 0.40, h: 0.07, content: 'PLATS  •  $15–26', fontSizeF: 0.038, color: '#f7f2e8', fontFamily: "Georgia, 'Times New Roman', serif", letterSpacing: 4, fontWeight: 700, textTransform: 'uppercase', textAlign: 'center', textShadow: '0 2px 8px rgba(0,0,0,0.35)' },
      { type: 'list', name: 'Mains List', x: 0.52, y: 0.37, w: 0.40, h: 0.50, items: ['Steak Frites | $24 · sirloin, maître d\'', 'Coq au Vin | $18 · pearl onions', 'Ratatouille | $15 · herbed couscous', 'Dessert: Crème Brûlée | $7'], fontSizeF: 0.028, color: '#d4a944', textColor: WHITE, fontFamily: "Georgia, 'Times New Roman', serif", listStyle: 'leader', lineHeight: 1.6 },
      { type: 'panel', name: 'Footer Pill', x: 0.32, y: 0.90, w: 0.36, h: 0.06, fill: '#d4a944', borderRadius: 9999, boxShadow: '0 6px 14px rgba(0,0,0,0.25)' },
      { type: 'text', name: 'Footer Text', x: 0.32, y: 0.915, w: 0.36, h: 0.04, content: '🍷 Wine pairing +$7  •  All prices include VAT', fontSizeF: 0.016, color: '#5c1a1a', fontWeight: 700, textAlign: 'center' },
    ],
  },
  // ── UPGRADED: Café Artisan Deluxe ──
  {
    id: 'sunrise-cafe-simple',
    name: 'Café Artisan Deluxe',
    background: '#fdf6ec',
    category: 'Café',
    description: 'Warm oak, breakfast hero, coffee bar vertical',
    layers: [
      { type: 'panel', name: 'Warm Texture', x: 0, y: 0, w: 1, h: 1, fill: '#fdf6ec', fillType: 'gradient', gradient: 'linear-gradient(135deg,#fdf6ec 0%,#f5e6cf 100%)' },
      { type: 'text', name: 'Cafe Name', x: 0.05, y: 0.08, w: 0.45, h: 0.12, content: 'Sunrise Café', fontSizeF: 0.065, color: '#8a5a33', fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 800, letterSpacing: 0.5 },
      { type: 'text', name: 'Subtitle', x: 0.05, y: 0.185, w: 0.45, h: 0.04, content: 'EST. 2014  •  PASTRY • BRUNCH • COFFEE', fontSizeF: 0.016, color: '#a0714a', letterSpacing: 3, textTransform: 'uppercase', fontWeight: 600 },
      { type: 'panel', name: 'Breakfast Card', x: 0.05, y: 0.26, w: 0.45, h: 0.60, fill: WHITE, borderRadius: 20, boxShadow: '0 12px 28px rgba(138,90,51,0.12)', borderWidth: 1, borderColor: 'rgba(138,90,51,0.08)', borderStyle: 'solid', padding: 12 },
      { type: 'text', name: 'Breakfast Heading', x: 0.07, y: 0.29, w: 0.40, h: 0.07, content: 'BREAKFAST PLATES', fontSizeF: 0.036, color: DARK, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', textAlign: 'left' },
      { type: 'list', name: 'Breakfast List', x: 0.07, y: 0.38, w: 0.41, h: 0.42, items: ['Big Sunrise Platter | $13 · eggs, bacon, hash', 'Avocado Smash Toast | $10 · chilli, poach', 'Buttermilk Pancakes | $9 · maple, berries', 'Veggie Omelette | $11 · feta, peppers'], fontSizeF: 0.026, color: '#d9c4a6', textColor: DARK, listStyle: 'leader', lineHeight: 1.55 },
      { type: 'panel', name: 'Coffee Panel', x: 0.55, y: 0.08, w: 0.40, h: 0.78, fill: '#8a5a33', borderRadius: 20, boxShadow: '0 12px 28px rgba(138,90,51,0.22)', padding: 14 },
      { type: 'text', name: 'Coffee Heading', x: 0.58, y: 0.14, w: 0.34, h: 0.08, content: '☕ COFFEE BAR', fontSizeF: 0.036, color: WHITE, fontWeight: 800, letterSpacing: 2, textAlign: 'center', textTransform: 'uppercase' },
      { type: 'list', name: 'Coffee List', x: 0.58, y: 0.24, w: 0.34, h: 0.46, items: ['Espresso | $3 · single/double', 'Flat White | $4 · velvety', 'Caramel Latte | $5 · house caramel', 'Cold Brew Tonic | $5.50 · citrus'], fontSizeF: 0.025, color: 'rgba(255,255,255,0.85)', textColor: WHITE, listStyle: 'plain', lineHeight: 1.6 },
      { type: 'panel', name: 'Oven Callout', x: 0.58, y: 0.74, w: 0.34, h: 0.09, fill: '#fff8e7', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(138,90,51,0.12)', borderStyle: 'dashed' },
      { type: 'text', name: 'Oven Note', x: 0.59, y: 0.765, w: 0.32, h: 0.05, content: '🥐 Baked at 6 AM daily — ask for vegan', fontSizeF: 0.015, color: '#8a5a33', textAlign: 'center', fontStyle: 'italic' },
    ],
  },
  // ── UPGRADED: Grill House Prime ──
  {
    id: 'steakhouse-night-simple',
    name: 'Grill House Prime',
    background: '#0f0f0f',
    category: 'Steakhouse',
    description: 'Charcoal, gold foil, sides vault',
    layers: [
      { type: 'panel', name: 'Spotlight', x: 0, y: 0, w: 1, h: 1, fill: 'transparent', fillType: 'gradient', gradient: 'radial-gradient(ellipse at 20% 20%, rgba(212,169,68,0.10), transparent 55%)' },
      { type: 'text', name: 'Title', x: 0.08, y: 0.06, w: 0.60, h: 0.10, content: 'THE GRILL HOUSE', fontSizeF: 0.060, color: '#d4a944', fontWeight: 800, letterSpacing: 6, textTransform: 'uppercase', textShadow: '0 4px 18px rgba(212,169,68,0.35)' },
      { type: 'panel', name: 'Accent Bar', x: 0.08, y: 0.16, w: 0.30, h: 0.015, fill: '#d4a944', borderRadius: 99, boxShadow: '0 2px 10px rgba(212,169,68,0.45)' },
      { type: 'text', name: 'Subtitle', x: 0.08, y: 0.19, w: 0.50, h: 0.04, content: 'DRY-AGED • GRASS-FED • CHARRED TO ORDER', fontSizeF: 0.015, color: '#9ca3af', letterSpacing: 3, textTransform: 'uppercase', fontWeight: 600 },
      { type: 'list', name: 'Steaks', x: 0.08, y: 0.26, w: 0.50, h: 0.62, items: ['Ribeye 400g | $32 · charred leek, marrow', 'Filet Mignon 250g | $36 · pistachio, jus', 'T-Bone 600g | $34 · chimichurri', 'Wagyu Striploin | $48 · A5, wasabi'], fontSizeF: 0.030, color: '#d4a944', textColor: WHITE, listStyle: 'leader', lineHeight: 1.65, fontWeight: 500 },
      { type: 'panel', name: 'Sides Panel', x: 0.64, y: 0.26, w: 0.30, h: 0.62, fill: '#1c1c1c', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(212,169,68,0.18)', borderStyle: 'solid', boxShadow: '0 10px 28px rgba(0,0,0,0.45)' },
      { type: 'text', name: 'Sides Heading', x: 0.67, y: 0.30, w: 0.24, h: 0.07, content: 'SIDES', fontSizeF: 0.028, color: '#d4a944', fontWeight: 700, letterSpacing: 4, textTransform: 'uppercase', textAlign: 'center' },
      { type: 'list', name: 'Sides List', x: 0.67, y: 0.39, w: 0.24, h: 0.40, items: ['Truffle Fries | $7', 'Grilled Asparagus | $8', 'Garlic Mash | $6', 'Charred Corn | $6'], fontSizeF: 0.022, color: '#e5e5e5', textColor: '#e5e5e5', listStyle: 'dots', lineHeight: 1.6 },
      { type: 'text', name: 'Footer', x: 0.64, y: 0.85, w: 0.30, h: 0.04, content: 'All steaks rested 8 min • GF on request', fontSizeF: 0.013, color: '#9ca3af', textAlign: 'center', fontStyle: 'italic' },
    ],
  },
  // ── UPGRADED: Pizzeria Forno ──
  {
    id: 'pizzeria-layers',
    name: 'Pizzeria Forno',
    background: '#b3401f',
    category: 'Pizzeria',
    description: 'Wood-fired, cream panel, Tuesday deal',
    layers: [
      { type: 'panel', name: 'Wood Texture', x: 0, y: 0, w: 1, h: 1, fill: '#b3401f', fillType: 'gradient', gradient: 'radial-gradient(ellipse at 10% 10%, #d95b2e 0%, #b3401f 55%, #7a2a12 100%)' },
      { type: 'text', name: 'Title', x: 0.05, y: 0.05, w: 0.55, h: 0.12, content: '🍕 Bella Napoli  •  WOOD-FIRED', fontSizeF: 0.060, color: '#ffe8c9', fontWeight: 800, letterSpacing: 1, textShadow: '0 3px 12px rgba(0,0,0,0.35)' },
      { type: 'text', name: 'Subtitle', x: 0.05, y: 0.155, w: 0.55, h: 0.04, content: '450°C  •  90-SECOND BAKE  •  DOP SAN MARZANO', fontSizeF: 0.015, color: '#ffd166', letterSpacing: 3, fontWeight: 700, textTransform: 'uppercase' },
      { type: 'panel', name: 'Menu Panel', x: 0.05, y: 0.22, w: 0.55, h: 0.70, fill: '#fff8ef', borderRadius: 20, boxShadow: '0 16px 36px rgba(60,20,8,0.28)', borderWidth: 1, borderColor: 'rgba(122,42,18,0.08)', borderStyle: 'solid' },
      { type: 'list', name: 'Pizza List', x: 0.08, y: 0.27, w: 0.49, h: 0.58, items: ['Margherita | $10 · fior di latte, basil', 'Diavola | $13 · spicy salami, honey', 'Quattro Formaggi | $14 · gorgonzola, honey', 'Capricciosa | $15 · artichoke, ham, olive'], fontSizeF: 0.028, color: '#7a2a12', textColor: '#5a1f0d', listStyle: 'leader', lineHeight: 1.55, fontWeight: 600 },
      { type: 'panel', name: 'Deal Panel', x: 0.65, y: 0.22, w: 0.30, h: 0.30, fill: '#ffd166', borderRadius: 16, boxShadow: '0 12px 24px rgba(60,20,8,0.28)', rotation: 1 },
      { type: 'text', name: 'Deal Badge', x: 0.67, y: 0.235, w: 0.26, h: 0.04, content: '★ TUESDAY DEAL', fontSizeF: 0.015, color: '#7a2a12', fontWeight: 800, letterSpacing: 2, textAlign: 'center', textTransform: 'uppercase' },
      { type: 'text', name: 'Deal Text', x: 0.67, y: 0.28, w: 0.26, h: 0.16, content: '2 Pizzas\n$20', fontSizeF: 0.042, color: '#7a2a12', fontWeight: 800, textAlign: 'center', lineHeight: 1.1 },
      { type: 'image', name: 'Oven Photo', x: 0.65, y: 0.56, w: 0.30, h: 0.36, src: 'https://picsum.photos/seed/pizza-oven/600/500', objectFit: 'cover', borderRadius: 16, boxShadow: '0 12px 24px rgba(0,0,0,0.28)' },
      { type: 'panel', name: 'Oven Label', x: 0.68, y: 0.86, w: 0.24, h: 0.05, fill: 'rgba(0,0,0,0.72)', borderRadius: 9999, backdropBlur: 6 },
      { type: 'text', name: 'Oven Text', x: 0.68, y: 0.87, w: 0.24, h: 0.04, content: '🔥 Wood-fired daily 11am–11pm', fontSizeF: 0.013, color: WHITE, textAlign: 'center', fontWeight: 600 },
    ],
  },
  // ── UPGRADED: Sushi Omakase ──
  {
    id: 'sushi-bar-layers',
    name: 'Sushi Omakase',
    background: '#101820',
    category: 'Japanese',
    description: 'Slate, ink, vermilion, nigiri + rolls + omakase',
    layers: [
      { type: 'panel', name: 'Top Rule', x: 0, y: 0.04, w: 1, h: 0.002, fill: 'rgba(232,201,135,0.25)', borderRadius: 99 },
      { type: 'text', name: 'Title', x: 0.05, y: 0.06, w: 0.50, h: 0.10, content: '浪  KAIYO  •  OMAKASE', fontSizeF: 0.055, color: '#e8c987', fontWeight: 300, letterSpacing: 6, textTransform: 'uppercase' },
      { type: 'text', name: 'Subtitle', x: 0.05, y: 0.145, w: 0.50, h: 0.04, content: 'EDO-MAE  •  HAND-PRESSED  •  BINCHOTAN', fontSizeF: 0.014, color: '#7a8a9a', letterSpacing: 3, fontWeight: 600 },
      { type: 'panel', name: 'Nigiri Card', x: 0.05, y: 0.22, w: 0.42, h: 0.68, fill: 'rgba(255,255,255,0.04)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(232,201,135,0.18)', borderStyle: 'solid' },
      { type: 'text', name: 'Nigiri Heading', x: 0.07, y: 0.25, w: 0.38, h: 0.07, content: 'NIGIRI  ·  2 PC', fontSizeF: 0.032, color: '#e8c987', fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', borderWidth: 0 },
      { type: 'list', name: 'Nigiri List', x: 0.07, y: 0.34, w: 0.38, h: 0.50, items: ['Salmon — $4.5 · sake, yuzu kosho', 'Tuna — $5 · maguro, aged 7 days', 'Hamachi — $5.5 · yellowtail, lime', 'Eel — $5 · unagi, sansho'], fontSizeF: 0.024, color: 'rgba(232,201,135,0.55)', textColor: WHITE, listStyle: 'leader', lineHeight: 1.6 },
      { type: 'panel', name: 'Rolls Card', x: 0.53, y: 0.22, w: 0.42, h: 0.68, fill: 'rgba(232,201,135,0.08)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(232,201,135,0.14)', borderStyle: 'solid' },
      { type: 'text', name: 'Rolls Heading', x: 0.55, y: 0.25, w: 0.38, h: 0.07, content: 'SIGNATURE ROLLS', fontSizeF: 0.032, color: '#e8c987', fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase' },
      { type: 'list', name: 'Rolls List', x: 0.55, y: 0.34, w: 0.38, h: 0.50, items: ['Dragon Roll — $14 · eel, avocado', 'Rainbow Roll — $13 · six fish, yuzu', 'Spicy Tuna Crisp — $11 · tempura, aioli'], fontSizeF: 0.024, color: 'rgba(232,201,135,0.55)', textColor: WHITE, listStyle: 'leader', lineHeight: 1.6 },
      { type: 'panel', name: 'Omakase Pill', x: 0.40, y: 0.88, w: 0.20, h: 0.06, fill: '#c0392b', borderRadius: 9999, boxShadow: '0 8px 18px rgba(192,57,43,0.35)' },
      { type: 'text', name: 'Omakase Text', x: 0.40, y: 0.895, w: 0.20, h: 0.04, content: 'OMAKASE $65 — 9 courses', fontSizeF: 0.015, color: WHITE, textAlign: 'center', fontWeight: 700, letterSpacing: 0.5 },
    ],
  },
  // ── UPGRADED: Boulangerie Dawn ──
  {
    id: 'bakery-morning-layers',
    name: 'Boulangerie Dawn',
    background: '#f5e6d3',
    category: 'Bakery',
    description: 'Warm flour, banner, pastry theatre',
    layers: [
      { type: 'panel', name: 'Banner', x: 0, y: 0, w: 1, h: 0.18, fill: '#a0622d', borderRadius: 0, boxShadow: '0 8px 18px rgba(0,0,0,0.12)' },
      { type: 'text', name: 'Banner Sub', x: 0, y: 0.035, w: 1, h: 0.04, content: 'FRESH AT 6AM  •  WOOD-FIRED  •  ORGANIC FLOUR', fontSizeF: 0.013, color: 'rgba(255,255,255,0.85)', textAlign: 'center', letterSpacing: 4, fontWeight: 600, textTransform: 'uppercase' },
      { type: 'text', name: 'Bakery Name', x: 0.20, y: 0.06, w: 0.60, h: 0.10, content: '🥐  Golden Crust Bakery', fontSizeF: 0.050, color: '#fff8ef', fontWeight: 800, textAlign: 'center', letterSpacing: 0.5, textShadow: '0 2px 8px rgba(0,0,0,0.18)' },
      { type: 'panel', name: 'Pastry Card', x: 0.06, y: 0.26, w: 0.88, h: 0.64, fill: WHITE, borderRadius: 20, boxShadow: '0 14px 32px rgba(90,45,15,0.14)', borderWidth: 1, borderColor: 'rgba(160,98,45,0.10)', borderStyle: 'solid' },
      { type: 'panel', name: 'Badge', x: 0.70, y: 0.23, w: 0.20, h: 0.07, fill: '#f5e6d3', borderRadius: 9999, borderWidth: 1, borderColor: 'rgba(160,98,45,0.18)', borderStyle: 'dashed', rotation: 2 },
      { type: 'text', name: 'Badge Text', x: 0.70, y: 0.245, w: 0.20, h: 0.05, content: '🥖 Sourdough $6', fontSizeF: 0.017, color: '#a0622d', textAlign: 'center', fontWeight: 700 },
      { type: 'list', name: 'Pastry List', x: 0.10, y: 0.32, w: 0.80, h: 0.50, items: ['Butter Croissant | $3.50 · VG · laminated, 3-day', 'Cinnamon Roll | $4 · house glaze', 'Blueberry Muffin | $3.50 · VG · organic', 'Artisan Sourdough | $6 · 24h ferment', 'Éclair | $4.50 · vanilla, dark choc'], fontSizeF: 0.028, color: '#a0622d', textColor: '#5c3a1e', listStyle: 'leader', lineHeight: 1.55, fontWeight: 500 },
      { type: 'text', name: 'Allergen Note', x: 0.10, y: 0.85, w: 0.80, h: 0.04, content: 'VG = vegan  •  Ask about allergens (14)  •  Takeaway -10%', fontSizeF: 0.014, color: '#9c7a55', textAlign: 'center', fontStyle: 'italic' },
    ],
  },
  // ── UPGRADED: Cantina Fiesta ──
  {
    id: 'mexican-cantina-layers',
    name: 'Cantina Fiesta',
    background: '#f4a261',
    category: 'Mexican',
    description: 'Terracotta + jalapa, tacos vs aguas',
    layers: [
      { type: 'panel', name: 'Page Papel', x: 0, y: 0, w: 1, h: 1, fill: '#f4a261', fillType: 'gradient', gradient: 'radial-gradient(ellipse at 50% 0%, #f7c08a 0%, #f4a261 45%, #e76f51 100%)' },
      { type: 'panel', name: 'Left Panel', x: 0.05, y: 0.08, w: 0.42, h: 0.84, fill: '#9b2226', borderRadius: 20, boxShadow: '0 14px 28px rgba(0,0,0,0.22)', borderWidth: 3, borderColor: '#641616', borderStyle: 'solid' },
      { type: 'panel', name: 'Right Panel', x: 0.53, y: 0.08, w: 0.42, h: 0.84, fill: '#005f73', borderRadius: 20, boxShadow: '0 14px 28px rgba(0,0,0,0.22)', borderWidth: 3, borderColor: '#003d4d', borderStyle: 'solid' },
      { type: 'text', name: 'Tacos Heading', x: 0.08, y: 0.13, w: 0.36, h: 0.09, content: '🌮  TACOS', fontSizeF: 0.042, color: '#fee440', fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase', textAlign: 'center', textShadow: '0 2px 6px rgba(0,0,0,0.35)' },
      { type: 'panel', name: 'Taco Rule', x: 0.12, y: 0.215, w: 0.28, h: 0.003, fill: '#fee440', borderRadius: 99, opacity: 0.7 },
      { type: 'list', name: 'Tacos List', x: 0.08, y: 0.25, w: 0.36, h: 0.58, items: ['Carne Asada | $4 · chipotle, onion', 'Al Pastor | $3.50 · pineapple, cilantro', 'Pescado Baja | $4.50 · slaw, lime crema', 'Hongos | $3.50 · VG · salsa macha'], fontSizeF: 0.025, color: '#fee440', textColor: WHITE, listStyle: 'dots', lineHeight: 1.6 },
      { type: 'text', name: 'Drinks Heading', x: 0.56, y: 0.13, w: 0.36, h: 0.09, content: '🍹  AGUA FRESCA', fontSizeF: 0.042, color: '#fee440', fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase', textAlign: 'center', textShadow: '0 2px 6px rgba(0,0,0,0.35)' },
      { type: 'panel', name: 'Drinks Rule', x: 0.60, y: 0.215, w: 0.28, h: 0.003, fill: '#fee440', borderRadius: 99, opacity: 0.7 },
      { type: 'list', name: 'Drinks List', x: 0.56, y: 0.25, w: 0.36, h: 0.58, items: ['Horchata | $3.50 · cinnamon, rice', 'Jamaica | $3.50 · hibiscus, lime', 'Margarita | $7 · reposado', 'Flan | $4 · cajeta'], fontSizeF: 0.025, color: '#fee440', textColor: WHITE, listStyle: 'dots', lineHeight: 1.6 },
      { type: 'panel', name: 'Tuesday Pill', x: 0.30, y: 0.86, w: 0.40, h: 0.07, fill: '#fee440', borderRadius: 9999, boxShadow: '0 8px 16px rgba(0,0,0,0.18)', rotation: -1 },
      { type: 'text', name: 'Tuesday Text', x: 0.30, y: 0.875, w: 0.40, h: 0.05, content: '🌮 TUESDAY  ALL TACOS $2.50  •  5–9PM', fontSizeF: 0.016, color: '#9b2226', fontWeight: 800, textAlign: 'center', letterSpacing: 0.5 },
    ],
  },
  // ── UPGRADED: Golden Diner Deluxe ──
  {
    id: 'breakfast-diner-simple',
    name: 'Golden Diner Deluxe',
    background: '#ffffff',
    category: 'Diner',
    description: 'Checker diner, two-col plates + sides',
    layers: [
      { type: 'panel', name: 'Checker', x: 0, y: 0, w: 1, h: 0.14, fill: '#2a9d8f', borderRadius: 0, boxShadow: '0 6px 14px rgba(0,0,0,0.12)' },
      { type: 'text', name: 'Header Text', x: 0.20, y: 0.02, w: 0.60, h: 0.10, content: '☀️  ALL-DAY BREAKFAST  •  EST. 1964', fontSizeF: 0.042, color: WHITE, fontWeight: 800, letterSpacing: 2, textAlign: 'center', textTransform: 'uppercase', textShadow: '0 2px 6px rgba(0,0,0,0.22)' },
      { type: 'panel', name: 'Plates Card', x: 0.04, y: 0.20, w: 0.46, h: 0.72, fill: '#fffef8', borderRadius: 16, borderWidth: 2, borderColor: '#2a9d8f', borderStyle: 'solid', boxShadow: '0 8px 20px rgba(0,0,0,0.06)' },
      { type: 'text', name: 'Plates Heading', x: 0.06, y: 0.23, w: 0.42, h: 0.06, content: 'HOUSE PLATES', fontSizeF: 0.026, color: '#2a9d8f', fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase', textAlign: 'center' },
      { type: 'list', name: 'Plates List', x: 0.06, y: 0.31, w: 0.42, h: 0.50, items: ['Classic Eggs Benedict | $12 · hollandaise', 'Stack of Pancakes | $9 · maple, butter', 'Veggie Omelette | $11 · feta, peppers', 'Steak & Eggs | $16 · sirloin'], fontSizeF: 0.024, color: '#2a9d8f', textColor: DARK, listStyle: 'dashes', lineHeight: 1.6 },
      { type: 'panel', name: 'Sides Card', x: 0.52, y: 0.20, w: 0.44, h: 0.72, fill: '#e9fdfb', borderRadius: 16, borderWidth: 2, borderColor: 'rgba(42,157,143,0.22)', borderStyle: 'dashed' },
      { type: 'text', name: 'Sides Heading', x: 0.54, y: 0.23, w: 0.40, h: 0.06, content: 'SIDES & SIPS', fontSizeF: 0.026, color: '#2a9d8f', fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase', textAlign: 'center' },
      { type: 'list', name: 'Sides List', x: 0.54, y: 0.31, w: 0.40, h: 0.50, items: ['Bacon Strips | $5 · applewood', 'Hash Browns | $4 · crisp', 'Fresh Fruit Cup | $5 · seasonal', 'Bottomless Coffee | $3.50'], fontSizeF: 0.024, color: '#2a9d8f', textColor: DARK, listStyle: 'dashes', lineHeight: 1.6 },
      { type: 'panel', name: 'Kids Ribbon', x: 0.25, y: 0.94, w: 0.50, h: 0.05, fill: '#ffd166', borderRadius: 9999, boxShadow: '0 4px 10px rgba(0,0,0,0.10)' },
      { type: 'text', name: 'Ribbon Text', x: 0.25, y: 0.95, w: 0.50, h: 0.04, content: '★ Kids eat FREE on Sundays — ask about pie of the day ★', fontSizeF: 0.015, color: DARK, textAlign: 'center', fontWeight: 700 },
    ],
  },
  // ── UPGRADED: Chef's Special Spotlight ──
  {
    id: 'daily-specials-layers',
    name: "Chef's Special Spotlight",
    background: '#111827',
    category: 'Specials',
    description: 'Dark glow, salmon bowl hero, allergen tip',
    layers: [
      { type: 'panel', name: 'Glow Panel', x: 0.15, y: 0.10, w: 0.70, h: 0.80, fill: '#1f2937', borderRadius: 24, boxShadow: '0 24px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.14)', borderStyle: 'solid', backdropBlur: 8 },
      { type: 'panel', name: 'Gold Halo', x: 0.42, y: 0.08, w: 0.16, h: 0.09, fill: '#fbbf24', borderRadius: 9999, opacity: 0.95, boxShadow: '0 8px 18px rgba(251,191,36,0.35)' },
      { type: 'text', name: 'Halo Text', x: 0.42, y: 0.105, w: 0.16, h: 0.04, content: 'LIMITED', fontSizeF: 0.014, color: DARK, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase', textAlign: 'center' },
      { type: 'text', name: 'Special Title', x: 0.20, y: 0.20, w: 0.60, h: 0.10, content: "⭐  Today’s Special  ⭐", fontSizeF: 0.042, color: '#fbbf24', fontWeight: 800, textAlign: 'center', letterSpacing: 3, textTransform: 'uppercase', textShadow: '0 2px 12px rgba(251,191,36,0.35)' },
      { type: 'text', name: 'Dish Name', x: 0.20, y: 0.36, w: 0.60, h: 0.12, content: 'Grilled Salmon Bowl', fontSizeF: 0.055, color: WHITE, fontWeight: 800, textAlign: 'center', letterSpacing: 0.5, textShadow: '0 2px 10px rgba(0,0,0,0.35)' },
      { type: 'text', name: 'Dish Desc', x: 0.20, y: 0.50, w: 0.60, h: 0.16, content: 'Atlantic salmon  •  jasmine rice\navocado & citrus glaze  •  GF', fontSizeF: 0.026, color: '#9ca3af', textAlign: 'center', lineHeight: 1.5, fontStyle: 'italic' },
      { type: 'panel', name: 'Price Pill', x: 0.36, y: 0.70, w: 0.28, h: 0.12, fill: '#34d399', borderRadius: 9999, boxShadow: '0 8px 18px rgba(52,211,153,0.35)' },
      { type: 'text', name: 'Price', x: 0.36, y: 0.72, w: 0.28, h: 0.08, content: '$16.99', fontSizeF: 0.048, color: '#062e22', fontWeight: 800, textAlign: 'center' },
      { type: 'text', name: 'Foot Note', x: 0.20, y: 0.85, w: 0.60, h: 0.04, content: 'Add miso soup +$2  •  Vegan option: tofu +$0', fontSizeF: 0.014, color: '#6b7280', textAlign: 'center', fontStyle: 'italic' },
    ],
  },
  // ── UPGRADED: Midnight Mixology ──
  {
    id: 'cocktail-bar-layers',
    name: 'Midnight Mixology',
    background: '#0b132b',
    category: 'Bar',
    description: 'Neon lounge, classics left, signatures vault',
    layers: [
      { type: 'panel', name: 'Neon Grad', x: 0, y: 0, w: 1, h: 1, fill: 'transparent', fillType: 'gradient', gradient: 'radial-gradient(ellipse at 70% 0%, rgba(91,192,190,0.12), transparent 55%)' },
      { type: 'text', name: 'Bar Title', x: 0.05, y: 0.05, w: 0.60, h: 0.12, content: '🍸  Midnight Lounge', fontSizeF: 0.055, color: '#5bc0be', fontWeight: 800, letterSpacing: 1, textShadow: '0 0 18px rgba(91,192,190,0.45)' },
      { type: 'text', name: 'Bar Sub', x: 0.05, y: 0.15, w: 0.50, h: 0.04, content: 'CRAFT COCKTAILS  •  5PM – LATE  •  HAPPY HOUR 5–7', fontSizeF: 0.014, color: '#7a9aad', letterSpacing: 3, textTransform: 'uppercase', fontWeight: 600 },
      { type: 'panel', name: 'Classics Rule', x: 0.05, y: 0.21, w: 0.44, h: 0.003, fill: 'rgba(91,192,190,0.35)', borderRadius: 99 },
      { type: 'list', name: 'Classics List', x: 0.05, y: 0.24, w: 0.44, h: 0.66, items: ['Old Fashioned | $12 · bourbon, angostura', 'Negroni | $11 · gin, vermouth, campari', 'Mojito | $10 · rum, mint, lime', 'Whisky Sour | $11 · egg white'], fontSizeF: 0.026, color: 'rgba(91,192,190,0.55)', textColor: '#c3f0ca', listStyle: 'leader', lineHeight: 1.6 },
      { type: 'panel', name: 'Signature Panel', x: 0.55, y: 0.24, w: 0.40, h: 0.66, fill: '#1c2541', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(91,192,190,0.22)', borderStyle: 'solid', boxShadow: '0 14px 28px rgba(0,0,0,0.35)', backdropBlur: 6 },
      { type: 'text', name: 'Signature Heading', x: 0.58, y: 0.28, w: 0.34, h: 0.07, content: '✦  SIGNATURES', fontSizeF: 0.028, color: '#5bc0be', fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', textAlign: 'center' },
      { type: 'list', name: 'Signature List', x: 0.58, y: 0.37, w: 0.34, h: 0.46, items: ['Smoked Pear | $14 · mezcal, pear', 'Velvet Espresso | $13 · vodka, cold brew', 'Golden Hour | $15 · gin, yuzu, honey'], fontSizeF: 0.023, color: 'rgba(91,192,190,0.55)', textColor: WHITE, listStyle: 'plain', lineHeight: 1.6 },
      { type: 'panel', name: 'Happy Pill', x: 0.58, y: 0.86, w: 0.34, h: 0.06, fill: '#5bc0be', borderRadius: 9999, boxShadow: '0 6px 14px rgba(91,192,190,0.35)' },
      { type: 'text', name: 'Happy Text', x: 0.58, y: 0.875, w: 0.34, h: 0.04, content: 'HAPPY HOUR  2 FOR 1  5–7PM', fontSizeF: 0.014, color: '#0b132b', fontWeight: 800, textAlign: 'center', letterSpacing: 1 },
    ],
  },
  // ── UPGRADED: Little Explorers Kids ──
  {
    id: 'kids-menu-layers',
    name: 'Little Explorers Kids',
    background: '#fef9c3',
    category: 'Kids',
    description: 'Sky blue hero, orange list, activity footer',
    layers: [
      { type: 'panel', name: 'Sky Panel', x: 0.05, y: 0.06, w: 0.90, h: 0.16, fill: '#38bdf8', borderRadius: 20, boxShadow: '0 8px 18px rgba(56,189,248,0.25)', borderWidth: 3, borderColor: WHITE, borderStyle: 'solid' },
      { type: 'text', name: 'Kids Title', x: 0.10, y: 0.08, w: 0.80, h: 0.12, content: '🎈  Little Explorers Menu  🎈', fontSizeF: 0.050, color: WHITE, fontWeight: 800, textAlign: 'center', letterSpacing: 0.5, textShadow: '0 2px 6px rgba(0,0,0,0.18)' },
      { type: 'panel', name: 'List Card', x: 0.08, y: 0.26, w: 0.84, h: 0.60, fill: WHITE, borderRadius: 20, boxShadow: '0 12px 28px rgba(234,88,12,0.14)', borderWidth: 2, borderColor: 'rgba(234,88,12,0.12)', borderStyle: 'solid' },
      { type: 'list', name: 'Kids List', x: 0.12, y: 0.32, w: 0.76, h: 0.46, items: ['Mini Burger & Fries | $6 · beef or veg', 'Chicken Dippers | $5.50 · ketchup', 'Mac & Cheese | $5 · creamy cheddar', 'Fish Sticks | $5.50 · tartar', 'Ice Cream Sundae | $3 · sprinkles'], fontSizeF: 0.028, color: '#38bdf8', textColor: '#c2410c', listStyle: 'dots', lineHeight: 1.55, fontWeight: 600 },
      { type: 'panel', name: 'Activity Footer', x: 0.12, y: 0.82, w: 0.76, h: 0.10, fill: '#fef3c7', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(234,88,12,0.14)', borderStyle: 'dashed' },
      { type: 'text', name: 'Activity Text', x: 0.12, y: 0.835, w: 0.76, h: 0.07, content: '🖍️  Colouring sheet + crayons free  •  Allergens: ask staff  •  All kids meals include juice', fontSizeF: 0.015, color: '#9a3412', textAlign: 'center', fontStyle: 'italic', lineHeight: 1.3 },
      { type: 'image', name: 'Mascot', x: 0.82, y: 0.62, w: 0.14, h: 0.22, src: 'https://picsum.photos/seed/kids-mascot/300/400', objectFit: 'cover', borderRadius: 16, boxShadow: '0 8px 16px rgba(0,0,0,0.12)', rotation: 3 },
    ],
  },
  // ── NEW: Ramen Izakaya ──
  {
    id: 'ramen-izakaya',
    name: 'Ramen Izakaya',
    background: '#1a0f0a',
    category: 'Japanese',
    description: 'Noren curtains, 3 ramen, spice levels',
    layers: [
      { type: 'panel', name: 'Noren Top', x: 0, y: 0, w: 1, h: 0.16, fill: '#c0392b', borderRadius: 0, boxShadow: '0 8px 18px rgba(0,0,0,0.28)' },
      { type: 'text', name: 'Noren Text', x: 0.10, y: 0.04, w: 0.80, h: 0.09, content: 'ラーメン  •  IZAKAYA  •  RAMEN BAR', fontSizeF: 0.038, color: '#fde68a', fontWeight: 300, letterSpacing: 6, textAlign: 'center', textTransform: 'uppercase' },
      { type: 'panel', name: 'Shoyu Card', x: 0.05, y: 0.22, w: 0.28, h: 0.68, fill: '#fdf6ec', borderRadius: 16, boxShadow: '0 12px 28px rgba(0,0,0,0.35)', borderWidth: 1, borderColor: 'rgba(192,57,43,0.12)', borderStyle: 'solid' },
      { type: 'text', name: 'Shoyu Heading', x: 0.07, y: 0.25, w: 0.24, h: 0.07, content: 'SHOYU', fontSizeF: 0.034, color: '#7a2a12', fontWeight: 800, letterSpacing: 3, textAlign: 'center' },
      { type: 'list', name: 'Shoyu List', x: 0.07, y: 0.34, w: 0.24, h: 0.46, items: ['Classic Shoyu | $14', 'Chashu Deluxe | $16', 'Veg Shoyu | $13'], fontSizeF: 0.023, color: '#c0392b', textColor: '#1a0f0a', listStyle: 'plain', lineHeight: 1.6 },
      { type: 'panel', name: 'Miso Card', x: 0.36, y: 0.22, w: 0.28, h: 0.68, fill: '#c0392b', borderRadius: 16, boxShadow: '0 12px 28px rgba(0,0,0,0.35)' },
      { type: 'text', name: 'Miso Heading', x: 0.38, y: 0.25, w: 0.24, h: 0.07, content: 'MISO  ★', fontSizeF: 0.034, color: '#fde68a', fontWeight: 800, letterSpacing: 3, textAlign: 'center' },
      { type: 'list', name: 'Miso List', x: 0.38, y: 0.34, w: 0.24, h: 0.46, items: ['Red Miso | $15', 'Spicy Miso | $15 · 🌶🌶', 'Corn Butter | $16'], fontSizeF: 0.023, color: '#fde68a', textColor: '#fff8e7', listStyle: 'plain', lineHeight: 1.6 },
      { type: 'panel', name: 'Tonkotsu Card', x: 0.67, y: 0.22, w: 0.28, h: 0.68, fill: '#fdf6ec', borderRadius: 16, boxShadow: '0 12px 28px rgba(0,0,0,0.35)' },
      { type: 'text', name: 'Tonkotsu Heading', x: 0.69, y: 0.25, w: 0.24, h: 0.07, content: 'TONKOTSU', fontSizeF: 0.034, color: '#7a2a12', fontWeight: 800, letterSpacing: 3, textAlign: 'center' },
      { type: 'list', name: 'Tonkotsu List', x: 0.69, y: 0.34, w: 0.24, h: 0.46, items: ['Original | $15', 'Black Garlic | $16', 'Tantanmen | $15'], fontSizeF: 0.023, color: '#c0392b', textColor: '#1a0f0a', listStyle: 'plain', lineHeight: 1.6 },
      { type: 'panel', name: 'Spice Footer', x: 0.22, y: 0.92, w: 0.56, h: 0.06, fill: '#fde68a', borderRadius: 9999, boxShadow: '0 6px 14px rgba(0,0,0,0.18)' },
      { type: 'text', name: 'Spice Text', x: 0.22, y: 0.935, w: 0.56, h: 0.04, content: '🌶  Spice: 1 mild  •  2 medium  •  3 fire  •  Add egg +$1.5', fontSizeF: 0.014, color: '#7a2a12', textAlign: 'center', fontWeight: 600 },
    ],
  },
  // ── NEW: Vegan Bowl Co. ──
  {
    id: 'vegan-bowl-co',
    name: 'Vegan Bowl Co.',
    background: '#f0fdf4',
    category: 'Healthy',
    description: 'Fresh green, 6 bowls, protein & cal',
    layers: [
      { type: 'panel', name: 'Header', x: 0, y: 0, w: 1, h: 0.15, fill: '#166534', borderRadius: 0 },
      { type: 'text', name: 'Header Title', x: 0.05, y: 0.03, w: 0.60, h: 0.09, content: '🌱  GREEN BOWL CO.', fontSizeF: 0.048, color: '#dcfce7', fontWeight: 800, letterSpacing: 2, textShadow: '0 2px 8px rgba(0,0,0,0.18)' },
      { type: 'text', name: 'Header Sub', x: 0.05, y: 0.105, w: 0.60, h: 0.04, content: 'PLANT-POWERED  •  HIGH PROTEIN  •  GF OPTIONS', fontSizeF: 0.014, color: '#86efac', letterSpacing: 3, fontWeight: 600 },
      { type: 'panel', name: 'Badge', x: 0.72, y: 0.04, w: 0.23, h: 0.08, fill: '#facc15', borderRadius: 9999, boxShadow: '0 6px 14px rgba(0,0,0,0.12)', rotation: 1 },
      { type: 'text', name: 'Badge Text', x: 0.72, y: 0.06, w: 0.23, h: 0.05, content: 'BUILD YOUR OWN +$2', fontSizeF: 0.016, color: '#14532d', fontWeight: 800, textAlign: 'center' },
      { type: 'list', name: 'Bowls Col 1', x: 0.05, y: 0.20, w: 0.44, h: 0.70, items: ['Buddha Bowl | $13 · 520kcal · 18g protein', 'Mediterranean | $14 · 480kcal · 16g', 'Spicy Peanut | $14 · 560kcal · 20g'], fontSizeF: 0.024, color: '#16a34a', textColor: '#14532d', listStyle: 'leader', lineHeight: 1.6 },
      { type: 'list', name: 'Bowls Col 2', x: 0.52, y: 0.20, w: 0.44, h: 0.70, items: ['Green Goddess | $13 · 450kcal · 15g', 'Chipotle Black Bean | $12 · 510kcal · 19g', 'Sesame Tofu | $13 · 490kcal · 17g'], fontSizeF: 0.024, color: '#16a34a', textColor: '#14532d', listStyle: 'leader', lineHeight: 1.6 },
      { type: 'panel', name: 'Addons', x: 0.05, y: 0.88, w: 0.91, h: 0.08, fill: WHITE, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(22,101,52,0.10)', borderStyle: 'dashed', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' },
      { type: 'text', name: 'Addons Text', x: 0.05, y: 0.90, w: 0.91, h: 0.06, content: 'Add: Avocado +$1.5  •  Extra Tofu +$1  •  Hemp Seeds +$0.5  •  Ask about allergens', fontSizeF: 0.015, color: '#15803d', textAlign: 'center', fontStyle: 'italic' },
      { type: 'image', name: 'Bowl Photo', x: 0.70, y: 0.38, w: 0.25, h: 0.30, src: 'https://picsum.photos/seed/vegan-bowl/500/500', objectFit: 'cover', borderRadius: 16, boxShadow: '0 12px 24px rgba(0,0,0,0.12)', rotation: 2 },
    ],
  },
  // ── NEW: Wine Bar Tasting ──
  {
    id: 'wine-bar-tasting',
    name: 'Wine Bar Tasting',
    background: '#1a1210',
    category: 'Bar',
    description: 'Burgundy cellar, flights, cheese pairing',
    layers: [
      { type: 'panel', name: 'Left Vine', x: 0, y: 0, w: 0.30, h: 1, fill: '#722f37', borderRadius: 0 },
      { type: 'image', name: 'Vineyard', x: 0, y: 0, w: 0.30, h: 1, src: 'https://picsum.photos/seed/vineyard/600/1100', objectFit: 'cover', opacity: 0.38, filter: 'contrast(1.15) brightness(0.9)' },
      { type: 'panel', name: 'Vine Overlay', x: 0, y: 0, w: 0.30, h: 1, fill: 'transparent', fillType: 'gradient', gradient: 'linear-gradient(90deg, transparent, #1a1210 92%)' },
      { type: 'text', name: 'Wine Title', x: 0.34, y: 0.06, w: 0.62, h: 0.08, content: 'VIN · CAVE À VIN', fontSizeF: 0.045, color: '#d4a373', fontWeight: 300, letterSpacing: 6, textTransform: 'uppercase', textAlign: 'center' },
      { type: 'panel', name: 'Gold Rule', x: 0.45, y: 0.145, w: 0.40, h: 0.002, fill: '#d4a373', borderRadius: 99, opacity: 0.5 },
      { type: 'text', name: 'Flight Heading', x: 0.34, y: 0.18, w: 0.28, h: 0.06, content: 'TASTING FLIGHTS', fontSizeF: 0.024, color: '#d4a373', fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase' },
      { type: 'list', name: 'Flights', x: 0.34, y: 0.26, w: 0.28, h: 0.44, items: ['Old World | $18 · 3× 75ml', 'New World | $16 · 3× 75ml', 'Natural | $20 · 3× 75ml'], fontSizeF: 0.022, color: '#d4a373', textColor: '#f5e8d5', listStyle: 'plain', lineHeight: 1.6 },
      { type: 'text', name: 'By Glass Heading', x: 0.66, y: 0.18, w: 0.30, h: 0.06, content: 'BY THE GLASS', fontSizeF: 0.024, color: '#d4a373', fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase' },
      { type: 'list', name: 'By Glass', x: 0.66, y: 0.26, w: 0.30, h: 0.44, items: ['Chablis | $9', 'Pinot Noir | $11', 'Orange | $10'], fontSizeF: 0.022, color: '#d4a373', textColor: '#f5e8d5', listStyle: 'leader', lineHeight: 1.6 },
      { type: 'panel', name: 'Cheese Card', x: 0.34, y: 0.74, w: 0.62, h: 0.18, fill: 'rgba(212,163,115,0.10)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(212,163,115,0.22)', borderStyle: 'solid', backdropBlur: 4 },
      { type: 'text', name: 'Cheese Heading', x: 0.36, y: 0.77, w: 0.58, h: 0.05, content: '🧀  Cheese & Charcuterie  +$14', fontSizeF: 0.019, color: '#d4a373', fontWeight: 700, letterSpacing: 1, textAlign: 'center' },
      { type: 'text', name: 'Cheese Desc', x: 0.36, y: 0.82, w: 0.58, h: 0.06, content: 'Comté 18 mo  •  Saucisson  •  Cornichons  •  Sourdough', fontSizeF: 0.015, color: '#e7d5b8', textAlign: 'center', fontStyle: 'italic' },
    ],
  },
  // ── NEW: Brunch Feast ──
  {
    id: 'brunch-feast',
    name: 'Brunch Feast',
    background: '#fff7ed',
    category: 'Brunch',
    description: 'Mimosa bar, eggs 4 ways, bottomless',
    layers: [
      { type: 'panel', name: 'Top Banner', x: 0, y: 0, w: 1, h: 0.14, fill: '#ea580c', borderRadius: 0, boxShadow: '0 6px 14px rgba(0,0,0,0.10)' },
      { type: 'text', name: 'Banner Title', x: 0.05, y: 0.02, w: 0.60, h: 0.10, content: '☀️  WEEKEND BRUNCH  •  9AM–3PM', fontSizeF: 0.040, color: WHITE, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', textShadow: '0 2px 6px rgba(0,0,0,0.18)' },
      { type: 'panel', name: 'Mimosa Pill', x: 0.70, y: 0.035, w: 0.25, h: 0.08, fill: '#fff7ed', borderRadius: 9999, boxShadow: '0 6px 14px rgba(0,0,0,0.12)', rotation: 1 },
      { type: 'text', name: 'Mimosa Text', x: 0.70, y: 0.055, w: 0.25, h: 0.05, content: '🥂  MIMOSA $5  •  FREE REFILL', fontSizeF: 0.017, color: '#9a3412', fontWeight: 800, textAlign: 'center' },
      { type: 'list', name: 'Eggs List', x: 0.05, y: 0.20, w: 0.44, h: 0.68, items: ['Eggs Benedict | $12 · hollandaise', 'Shakshuka | $11 · sourdough, feta', 'Avocado Toast | $10 · poach, chilli', 'Pancakes | $9 · maple, berries'], fontSizeF: 0.024, color: '#fb923c', textColor: '#7c2d12', listStyle: 'leader', lineHeight: 1.6 },
      { type: 'list', name: 'Sweet List', x: 0.52, y: 0.20, w: 0.44, h: 0.68, items: ['Acai Bowl | $10 · granola, honey', 'French Toast | $9 · brioche, cinnamon', 'Fruit Parfait | $8 · yoghurt', 'Croissant | $3.50 · butter'], fontSizeF: 0.024, color: '#fb923c', textColor: '#7c2d12', listStyle: 'leader', lineHeight: 1.6 },
      { type: 'panel', name: 'Bottom Bar', x: 0.05, y: 0.90, w: 0.91, h: 0.06, fill: '#7c2d12', borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.10)' },
      { type: 'text', name: 'Bottom Text', x: 0.05, y: 0.915, w: 0.91, h: 0.04, content: 'Bottomless coffee +$2  •  Add bacon +$3  •  Vegan options 🌱  •  Kids brunch $6', fontSizeF: 0.015, color: '#ffedd5', textAlign: 'center', fontWeight: 600 },
      { type: 'image', name: 'Brunch Photo', x: 0.36, y: 0.42, w: 0.28, h: 0.32, src: 'https://picsum.photos/seed/brunch/600/600', objectFit: 'cover', borderRadius: 16, boxShadow: '0 12px 24px rgba(0,0,0,0.16)', rotation: -1, borderWidth: 3, borderColor: WHITE, borderStyle: 'solid' },
    ],
  },
]

export interface InstantiatedLayer {
  id: string
  type: TemplateLayerType
  name: string
  x: number
  y: number
  width: number
  height: number
  content: string
  src: string
  items: string[]
  fontSize: number
  color: string
  fill: string
  fontFamily: string
  fontWeight: FontWeight
  fontStyle: 'normal' | 'italic'
  textAlign: TextAlign
  lineHeight: number
  letterSpacing: number
  textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
  textDecoration: 'none' | 'underline' | 'line-through'
  listStyle: ListStyle
  textColor: string
  fillType: FillType
  gradient: string
  opacity: number
  rotation: number
  visible: boolean
  locked: boolean
  borderWidth: number
  borderColor: string
  borderStyle: BorderStyle
  borderRadius: number
  boxShadow: string
  textShadow: string
  backdropBlur: number
  filter: string
  blendMode: BlendMode
  padding: number
  objectFit: ObjectFit
  objectPosition: string
}

/** Map a template layer definition onto absolute pixels for the given stage size. */
export function instantiateTemplateLayers(
  template: LayerTemplate,
  stageW: number,
  stageH: number,
): InstantiatedLayer[] {
  const uid = (): string => Math.random().toString(36).slice(2, 10)
  return template.layers.map(def => ({
    id: uid(),
    type: def.type,
    name: def.name,
    x: Math.round(def.x * stageW),
    y: Math.round(def.y * stageH),
    width: Math.round(def.w * stageW),
    height: Math.round(def.h * stageH),
    content: def.content ?? '',
    src: def.type === 'image' ? (def.src ?? 'https://picsum.photos/seed/menu-placeholder/600/400') : (def.src ?? ''),
    items: def.items ? [...def.items] : [],
    fontSize: Math.round((def.fontSizeF ?? 0.03) * stageH),
    color: def.color ?? WHITE,
    fill: def.fill ?? 'transparent',
    fontFamily: def.fontFamily ?? DEFAULT_FONT_FAMILY,
    fontWeight: def.fontWeight ?? (def.type === 'text' ? 700 : 400),
    fontStyle: def.fontStyle ?? 'normal',
    textAlign: def.textAlign ?? 'left',
    lineHeight: def.lineHeight ?? 1.15,
    letterSpacing: def.letterSpacing ?? 0,
    textTransform: def.textTransform ?? 'none',
    textDecoration: def.textDecoration ?? 'none',
    listStyle: def.listStyle ?? 'dots',
    textColor: def.textColor ?? def.color ?? WHITE,
    fillType: def.fillType ?? (def.fill ? 'solid' : 'transparent'),
    gradient: def.gradient ?? '',
    opacity: def.opacity ?? 1,
    rotation: def.rotation ?? 0,
    visible: def.visible ?? true,
    locked: def.locked ?? false,
    borderWidth: def.borderWidth ?? 0,
    borderColor: def.borderColor ?? 'transparent',
    borderStyle: def.borderStyle ?? 'solid',
    borderRadius: def.borderRadius ?? (def.type === 'panel' ? 16 : 0),
    boxShadow: def.boxShadow ?? '',
    textShadow: def.textShadow ?? '',
    backdropBlur: def.backdropBlur ?? 0,
    filter: def.filter ?? '',
    blendMode: def.blendMode ?? 'normal',
    padding: def.padding ?? 0,
    objectFit: def.objectFit ?? 'cover',
    objectPosition: def.objectPosition ?? 'center',
  }))
}
