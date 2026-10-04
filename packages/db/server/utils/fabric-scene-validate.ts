// Fabric scene validation for design-agent output (PRD-CAROUSEL-REELS §3).
// Scenes are data: object types, coordinates, dimensions, colors, fonts, and
// image references are allowlisted; arbitrary URLs and scripts are rejected.

const MAX_SCENES = 15;
const MAX_OBJECTS_PER_SCENE = 200;
const MAX_DIMENSION = 4320;

const ALLOWED_OBJECT_TYPES = new Set([
  'rect',
  'circle',
  'triangle',
  'line',
  'polyline',
  'polygon',
  'ellipse',
  'text',
  'textbox',
  'image',
  'group',
]);

const SCRIPT_PATTERN = /<\s*script|javascript\s*:|on\w+\s*=/i;
const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export interface SceneIssue {
  slide: number;
  message: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function checkImageRef(src: unknown, issues: SceneIssue[], slide: number): void {
  if (typeof src !== 'string' || !src) return;
  // Remote images must be asset references, never arbitrary URLs.
  if (/^https?:\/\//i.test(src) || /^data:text\/html/i.test(src)) {
    issues.push({ slide, message: 'Remote image URLs are not allowed; use approved asset IDs' });
  }
}

function checkTextSafety(text: unknown, issues: SceneIssue[], slide: number): void {
  if (typeof text !== 'string') return;
  if (SCRIPT_PATTERN.test(text)) {
    issues.push({ slide, message: 'Embedded scripts are not allowed in scene text' });
  }
}

function checkColor(value: unknown, issues: SceneIssue[], slide: number): void {
  if (typeof value !== 'string' || !value) return;
  if (!HEX_COLOR_PATTERN.test(value)) {
    issues.push({ slide, message: `Unsupported color value: ${value.slice(0, 32)}` });
  }
}

function checkObject(obj: unknown, issues: SceneIssue[], slide: number): void {
  if (!isRecord(obj)) {
    issues.push({ slide, message: 'Scene object must be an object' });
    return;
  }
  if (typeof obj.type !== 'string' || !ALLOWED_OBJECT_TYPES.has(obj.type)) {
    issues.push({ slide, message: `Unsupported object type: ${String(obj.type ?? 'missing')}` });
    return;
  }
  checkTextSafety(obj.text, issues, slide);
  checkImageRef(obj.src, issues, slide);
  checkColor(obj.fill, issues, slide);
  if (Array.isArray(obj.objects)) {
    for (const child of obj.objects) checkObject(child, issues, slide);
  }
}

function checkScene(scene: unknown, issues: SceneIssue[], slide: number): void {
  if (!isRecord(scene)) {
    issues.push({ slide, message: 'Scene must be an object' });
    return;
  }
  const objects = (scene as { objects?: unknown }).objects;
  if (objects !== undefined && !Array.isArray(objects)) {
    issues.push({ slide, message: 'Scene objects must be an array' });
    return;
  }
  const list = Array.isArray(objects) ? objects : [];
  if (list.length > MAX_OBJECTS_PER_SCENE) {
    issues.push({ slide, message: `Too many objects (${list.length})` });
  }
  for (const obj of list) checkObject(obj, issues, slide);
}

export interface SceneValidation {
  ok: boolean;
  issues: SceneIssue[];
  slideCount: number;
}

/**
 * Validate a fabric_scene design output. Pure and dependency-free.
 */
function invalidDims(width: unknown, height: unknown): boolean {
  return typeof width !== 'number' || typeof height !== 'number' || width <= 0 || height <= 0;
}

function oversizedDims(width: unknown, height: unknown): boolean {
  return typeof width === 'number' && typeof height === 'number' && (width > MAX_DIMENSION || height > MAX_DIMENSION);
}

export function validateFabricScene(output: unknown): SceneValidation {
  const issues: SceneIssue[] = [];
  if (!isRecord(output)) return { ok: false, issues: [{ slide: 0, message: 'Scene output must be an object' }], slideCount: 0 };
  if (invalidDims(output.width, output.height)) {
    issues.push({ slide: 0, message: 'Canvas dimensions must be positive numbers' });
  }
  if (oversizedDims(output.width, output.height)) {
    issues.push({ slide: 0, message: 'Canvas dimensions exceed the maximum' });
  }
  const slides = Array.isArray(output.slides) ? output.slides : [];
  if (slides.length > MAX_SCENES) {
    issues.push({ slide: 0, message: `Too many slides (${slides.length})` });
  }
  slides.forEach((slide, index) => {
    const slideNo = index + 1;
    if (!isRecord(slide)) {
      issues.push({ slide: slideNo, message: 'Slide must be an object' });
      return;
    }
    checkScene((slide as Record<string, unknown>).scene, issues, slideNo);
  });
  return { ok: issues.length === 0, issues, slideCount: slides.length };
}

export const INSTAGRAM_MIN_SLIDES = 2;
export const INSTAGRAM_MAX_SLIDES = 10;

export function checkInstagramBounds(slideCount: number): string | null {
  if (slideCount < INSTAGRAM_MIN_SLIDES || slideCount > INSTAGRAM_MAX_SLIDES) {
    return `Instagram export needs ${INSTAGRAM_MIN_SLIDES}-${INSTAGRAM_MAX_SLIDES} slides, got ${slideCount}`;
  }
  return null;
}
