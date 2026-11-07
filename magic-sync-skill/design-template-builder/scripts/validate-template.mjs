#!/usr/bin/env node
/**
 * Validate a MagicSync image-editor document before import.
 *
 * Usage:
 *   node scripts/validate-template.mjs template.json
 *   node scripts/validate-template.mjs template.json --json
 *   cat template.json | node scripts/validate-template.mjs -
 *
 * Accepts a raw document, `{ document }`, or a seeded `{ id, title, doc }`
 * wrapper. Exits 1 on errors, 0 on warnings only.
 */
import {
  BUNDLED_FONTS,
  DOCUMENT_SCHEMA,
  FIELD_SUFFIXES,
  GENERIC_FONTS,
  SUPPORTED_TYPES,
  contrastRatio,
  isHexColor,
  parseArgs,
  readJson,
  unwrapDocument,
  walkObjects,
} from './_shared.mjs'

const args = parseArgs(process.argv.slice(2))
const input = args._[0] ?? '-'
const parsed = await readJson(input)
const doc = unwrapDocument(parsed)
const result = validateDocument(doc, parsed)

if (args.json) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
} else {
  printHuman(result, input)
}
process.exit(result.valid ? 0 : 1)

function validateDocument(document, wrapper) {
  const errors = []
  const warnings = []
  const ids = new Map()

  validateFrame(document, errors, warnings)
  validatePages(document, ids, errors, warnings)
  validateFields(document, ids, errors, warnings)
  validateWrapper(wrapper, errors)

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    fields: Array.isArray(document.fields)
      ? document.fields.map(field => ({ name: field.name, targets: field.targets?.length ?? 0 }))
      : [],
  }
}

function validateFrame(document, errors, warnings) {
  if (document.schema !== DOCUMENT_SCHEMA) {
    errors.push(`schema must be "${DOCUMENT_SCHEMA}"`)
  }
  const frame = document.frame
  if (!frame || typeof frame !== 'object') {
    errors.push('frame is required')
    return
  }
  if (!isDimension(frame.width)) errors.push('frame.width must be a number between 10 and 8192')
  if (!isDimension(frame.height)) errors.push('frame.height must be a number between 10 and 8192')
  if (typeof frame.fill !== 'string') warnings.push('frame.fill is missing; the renderer falls back to white')
}

function validatePages(document, ids, errors, warnings) {
  if (!Array.isArray(document.pages) || document.pages.length === 0) {
    errors.push('pages must contain at least one page')
    return
  }
  document.pages.forEach((page, index) => validatePage(page, index, document, ids, errors, warnings))
}

function validatePage(page, index, document, ids, errors, warnings) {
  if (!isRecord(page)) {
    errors.push(`pages[${index}] must be an object`)
    return
  }
  validatePageBasics(page, index, errors, warnings)
  validateBackgroundOrder(page, index, warnings)
  const background = page.background?.fill ?? document.frame?.fill
  validateObjects(page.objects, document.frame, background, ids, errors, warnings, `pages[${index}].objects`)
}

function validatePageBasics(page, index, errors, warnings) {
  if (typeof page.id !== 'string' || page.id.length === 0) warnings.push(`pages[${index}].id is missing`)
  if (!Array.isArray(page.objects)) errors.push(`pages[${index}].objects must be an array`)
  if (!isRecord(page.animation)) warnings.push(`pages[${index}].animation.layers is missing; add { "layers": {} }`)
  if (page.duration !== undefined && (!Number.isFinite(page.duration) || page.duration <= 0)) {
    warnings.push(`pages[${index}].duration must be a positive number of milliseconds`)
  }
  if (page.background !== undefined && !isRecord(page.background)) warnings.push(`pages[${index}].background must be an object`)
}

function validateBackgroundOrder(page, index, warnings) {
  if (!Array.isArray(page.objects)) return
  const position = page.objects.findIndex(object => isRecord(object) && object.id === '__background')
  if (position > 0) warnings.push(`pages[${index}]: "__background" should be the first object`)
}

function validateObjects(objects, frame, background, ids, errors, warnings, path) {
  if (!Array.isArray(objects)) return
  objects.forEach((object, index) => {
    if (!isRecord(object)) {
      errors.push(`${path}[${index}] must be an object`)
      return
    }
    validateObject(object, frame, background, objects, index, ids, errors, warnings, `${path}[${index}]`)
  })
}

function validateObject(object, frame, background, siblings, index, ids, errors, warnings, path) {
  registerId(object, ids, errors, path)
  validateObjectType(object, frame, background, siblings, index, ids, errors, warnings, path)
  validateCommon(object, errors, warnings, path)
  validateBounds(object, frame, warnings, path)
}

function registerId(object, ids, errors, path) {
  if (typeof object.id !== 'string' || object.id.length === 0) {
    errors.push(`${path}.id is required (use a stable, unique id)`)
    return
  }
  if (ids.has(object.id)) {
    errors.push(`${path}.id "${object.id}" is duplicated (already used at ${ids.get(object.id)})`)
    return
  }
  ids.set(object.id, path)
}

function validateObjectType(object, frame, background, siblings, index, ids, errors, warnings, path) {
  const type = String(object.type ?? '').toLowerCase()
  if (!type) {
    errors.push(`${path}.type is required`)
    return
  }
  object.type = type
  if (type === 'textbox') {
    validateTextBox(object, background, siblings, index, warnings, path, errors)
    return
  }
  if (type === 'image') {
    validateImage(object, errors, path)
    return
  }
  if (type === 'group') {
    validateGroup(object, frame, background, ids, errors, warnings, path)
    return
  }
  if (SUPPORTED_TYPES.has(type) && type !== 'group') {
    validateShape(object, errors, warnings, path)
    return
  }
  errors.push(`${path}.type "${type}" is not a fabric type the editor can build`)
}

function validateTextBox(object, background, siblings, index, warnings, path, errors) {
  validateTextContent(object, errors, path)
  validateFont(object, warnings, path)
  validateContrast(object, background, siblings, index, warnings, path)
}

function validateTextContent(object, errors, path) {
  if (typeof object.text !== 'string') errors.push(`${path}.text must be a string`)
  if (!Number.isFinite(object.width) || object.width <= 0) errors.push(`${path}.width must be a positive number (text wrapping)`)
  if (!Number.isFinite(object.fontSize) || object.fontSize <= 0) errors.push(`${path}.fontSize must be a positive number`)
  if (typeof object.fontFamily !== 'string' || object.fontFamily.length === 0) errors.push(`${path}.fontFamily is required`)
  if (typeof object.fill !== 'string') errors.push(`${path}.fill must be a color string`)
}

function validateFont(object, warnings, path) {
  if (BUNDLED_FONTS.has(object.fontFamily) || GENERIC_FONTS.has(object.fontFamily)) return
  warnings.push(`${path}.fontFamily "${object.fontFamily}" is not bundled; the renderer will try Google Fonts. Prefer a bundled family.`)
}

function validateContrast(object, pageFill, siblings, index, warnings, path) {
  const background = findBackdrop(object, siblings, index) ?? pageFill
  if (!background || !isHexColor(object.fill)) return
  const ratio = contrastRatio(object.fill, background)
  if (ratio === null) return
  const minimum = Number(object.fontSize) >= 32 ? 3 : 4.5
  if (ratio < minimum) warnings.push(`${path}: contrast ${ratio.toFixed(2)}:1 is below ${minimum}:1`)
}

/** Use the nearest filled shape behind the text instead of the page fill. */
function findBackdrop(object, siblings, index) {
  if (!Array.isArray(siblings)) return null
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const candidate = siblings[cursor]
    if (!isRecord(candidate) || !isHexColor(candidate.fill)) continue
    if (covers(candidate, object)) return candidate.fill
  }
  return null
}

function covers(candidate, object) {
  const pointX = Number(object.left ?? 0) + 4
  const pointY = Number(object.top ?? 0) + Number(object.fontSize ?? 16) / 2
  if (candidate.type === 'circle') {
    const radius = Number(candidate.radius ?? 0)
    return pointX >= Number(candidate.left ?? 0) && pointX <= Number(candidate.left ?? 0) + radius * 2
      && pointY >= Number(candidate.top ?? 0) && pointY <= Number(candidate.top ?? 0) + radius * 2
  }
  if (candidate.type !== 'rect' && candidate.type !== 'triangle') return false
  const left = Number(candidate.left ?? 0)
  const top = Number(candidate.top ?? 0)
  return pointX >= left && pointX <= left + Number(candidate.width ?? 0)
    && pointY >= top && pointY <= top + Number(candidate.height ?? 0)
}

function validateImage(object, errors, path) {
  if (typeof object.src !== 'string' || object.src.length === 0) {
    errors.push(`${path}.src is required for image layers`)
    return
  }
  validateSource(object.src, errors, path)
  if (!Number.isFinite(object.width) || object.width <= 0) errors.push(`${path}.width must be a positive number`)
  if (!Number.isFinite(object.height) || object.height <= 0) errors.push(`${path}.height must be a positive number`)
}

function validateSource(src, errors, path) {
  if (src.startsWith('data:image/') || src.startsWith('https://') || src.startsWith('/api/v1/image-editor/assets/')) return
  if (src.startsWith('http://')) {
    errors.push(`${path}.src uses http://; use https:// (or a data URL / design asset)`)
    return
  }
  errors.push(`${path}.src must be https://, a data:image URL, or /api/v1/image-editor/assets/…`)
}

function validateShape(object, errors, warnings, path) {
  if (object.type === 'circle') {
    if (!Number.isFinite(object.radius) || object.radius <= 0) errors.push(`${path}.radius must be a positive number`)
    return
  }
  if (object.type === 'path') {
    if (!Array.isArray(object.path) && typeof object.path !== 'string') warnings.push(`${path}.path is empty; the layer may render invisible`)
    return
  }
  if (object.type === 'line') return
  if (!Number.isFinite(object.width) || !Number.isFinite(object.height)) {
    warnings.push(`${path}: width/height are missing; the shape may not render`)
  }
}

function validateGroup(object, frame, background, ids, errors, warnings, path) {
  if (!Array.isArray(object.objects)) {
    errors.push(`${path}.objects must be an array for group layers`)
    return
  }
  validateObjects(object.objects, frame, background, ids, errors, warnings, `${path}.objects`)
}

function validateCommon(object, errors, warnings, path) {
  if (!Number.isFinite(object.left)) warnings.push(`${path}.left is missing; defaulting to 0`)
  if (!Number.isFinite(object.top)) warnings.push(`${path}.top is missing; defaulting to 0`)
  if (object.visible !== undefined && typeof object.visible !== 'boolean') errors.push(`${path}.visible must be true or false`)
  if (object.opacity !== undefined && (!Number.isFinite(object.opacity) || object.opacity < 0 || object.opacity > 1)) {
    warnings.push(`${path}.opacity should be between 0 and 1`)
  }
}

function validateBounds(object, frame, warnings, path) {
  if (!isRecord(frame)) return
  const width = Number(object.width)
  const height = Number(object.height)
  if (!Number.isFinite(width) || !Number.isFinite(height)) return
  if (Number.isFinite(object.left) && object.left + width > frame.width + 1) warnings.push(`${path} extends past the right edge`)
  if (Number.isFinite(object.top) && object.top + height > frame.height + 1) warnings.push(`${path} extends past the bottom edge`)
  if (Number.isFinite(object.left) && object.left < 0) warnings.push(`${path} starts left of the frame`)
}

function validateFields(document, ids, errors, warnings) {
  if (!Array.isArray(document.fields)) {
    errors.push('fields must be an array (use [] when the template has no variables)')
    return
  }
  if (document.fields.length === 0) warnings.push('No fields declared; batch generation will have no variables to fill')
  const names = new Set()
  document.fields.forEach((field, index) => validateField(field, index, ids, names, errors, warnings))
  validateAutoNames(document, names, warnings)
}

function validateField(field, index, ids, names, errors, warnings) {
  if (!isRecord(field)) {
    errors.push(`fields[${index}] must be an object`)
    return
  }
  validateFieldName(field, index, names, errors)
  if (!Array.isArray(field.targets) || field.targets.length === 0) {
    errors.push(`fields[${index}] must have at least one target`)
    return
  }
  field.targets.forEach(target => validateTarget(target, field.name, ids, errors, warnings))
}

function validateFieldName(field, index, names, errors) {
  if (typeof field.name !== 'string' || !/^[A-Za-z0-9_]+$/.test(field.name)) {
    errors.push(`fields[${index}].name must match [A-Za-z0-9_]+`)
    return
  }
  if (field.name.includes('__')) errors.push(`fields[${index}].name must not contain "__"`)
  if (names.has(field.name)) errors.push(`fields[${index}].name "${field.name}" is duplicated`)
  names.add(field.name)
}

function validateTarget(target, name, ids, errors, warnings) {
  if (!isRecord(target)) {
    errors.push(`field "${name}" target must be an object`)
    return
  }
  if (typeof target.objectId !== 'string' || !ids.has(target.objectId)) {
    errors.push(`field "${name}" targets missing object "${target.objectId}"`)
  }
  if (!FIELD_SUFFIXES.includes(target.property)) {
    errors.push(`field "${name}" property "${target.property}" is invalid (${FIELD_SUFFIXES.join(', ')})`)
  }
}

function validateAutoNames(document, names, warnings) {
  const pages = Array.isArray(document.pages) ? document.pages : []
  walkObjects(pages.flatMap(page => page?.objects ?? []), (object) => {
    if (typeof object.name !== 'string') return
    const match = /^\{([A-Za-z0-9_]+)(?::[a-z_]+)?\}$/.exec(object.name.trim())
    if (match && !names.has(match[1])) warnings.push(`Layer "${object.id}" uses {${match[1]}} but no field "${match[1]}" is declared`)
  })
}

function validateWrapper(wrapper, errors) {
  if (wrapper?.id !== undefined && (typeof wrapper.id !== 'string' || wrapper.id.length === 0)) {
    errors.push('wrapper.id must be a non-empty string')
  }
  if (wrapper?.title !== undefined && (typeof wrapper.title !== 'string' || wrapper.title.length === 0)) {
    errors.push('wrapper.title must be a non-empty string')
  }
  try {
    const bytes = Buffer.byteLength(JSON.stringify(wrapper), 'utf8')
    if (bytes > 4 * 1024 * 1024) errors.push(`Import payload is ${(bytes / 1024 / 1024).toFixed(1)} MB; the import limit is 4 MB`)
  } catch {
    errors.push('Input cannot be serialized to JSON')
  }
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isDimension(value) {
  return Number.isFinite(value) && value >= 10 && value <= 8192
}

function printHuman(result, input) {
  const label = input === '-' ? 'stdin' : input
  if (result.valid) {
    console.log(`✓ ${label}: valid document (${result.fields.length} field${result.fields.length === 1 ? '' : 's'})`)
  } else {
    console.error(`✗ ${label}: ${result.errors.length} error${result.errors.length === 1 ? '' : 's'}`)
  }
  for (const message of result.errors) console.error(`  error: ${message}`)
  for (const message of result.warnings) console.warn(`  warning: ${message}`)
}
