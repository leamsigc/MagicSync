import { defineMcpResource } from '@nuxtjs/mcp-toolkit/server'

/**
 * Document schema resource for image-editor automation: the ImageEditor
 * Document@1 JSON Schema + dynamic_fields contract, so agents can assemble
 * and validate documents without guessing.
 */
export default defineMcpResource({
  description: 'JSON Schema for the image-editor@1 design document envelope (pages, frame, fields) plus the dynamic_fields / dynamic_fields_flat render contract.',
  uri: 'magic-sync://image-editor/document-schema',
  enabled: event => !!event.context.mcp?.valid,
  async handler(uri: URL) {
    return {
      contents: [{
        uri: uri.href,
        mimeType: 'application/schema+json',
        text: JSON.stringify(SCHEMA, null, 2),
      }],
    }
  },
})

const SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'ImageEditorDocument@1',
  type: 'object',
  required: ['schema', 'frame', 'pages'],
  properties: {
    schema: { const: 'magicsync/image-editor@1' },
    version: { type: 'number' },
    frame: {
      type: 'object',
      required: ['width', 'height'],
      properties: {
        width: { type: 'number', minimum: 10, maximum: 8192 },
        height: { type: 'number', minimum: 10, maximum: 8192 },
        fill: { type: 'string' },
      },
    },
    fields: {
      type: 'array',
      description: 'Dynamic fields: layer name "{headline}" bindings or explicit linkData bindings imported from v5 templates. If empty, text layers are auto-exposed by font size as title, content, text_3…',
      items: {
        type: 'object',
        required: ['name', 'targets'],
        properties: {
          name: { type: 'string', pattern: '^[A-Za-z0-9_]+$' },
          targets: {
            type: 'array',
            items: {
              type: 'object',
              required: ['objectId', 'property'],
              properties: {
                objectId: { type: 'string' },
                property: { enum: ['text', 'image_url', 'video_url', 'color', 'font_family', 'font_size', 'visible'] },
              },
            },
          },
          default: { type: 'object' },
        },
      },
    },
    meta: { type: 'object' },
    pages: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['id', 'objects', 'animation'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          duration: { type: 'number' },
          audio: {
            type: 'object',
            description: 'Optional MP4 background music.',
            properties: {
              url: { type: 'string' },
              name: { type: 'string' },
              volume: { type: 'number', minimum: 0, maximum: 100 },
            },
          },
          objects: { type: 'array', items: { type: 'object' } },
          background: { type: 'object' },
          clipPath: { type: 'object' },
          animation: {
            type: 'object',
            properties: {
              layers: { type: 'object' },
              transition: {
                type: 'object',
                properties: {
                  type: { enum: ['none', 'fade', 'slideLeft', 'slideRight', 'wipeUp', 'zoomIn'] },
                  duration: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
  },
  $sourcesContract: {
    summary: 'render-design and batch-generate-designs accept templateId OR template OR document. template is raw fabric v5/v7 or Polotno JSON (normalized server-side). document is a full image-editor@1 envelope. Designs with no fields auto-expose text layers as title/content/text_3.',
  },
  $dynamicFieldsContract: {
    summary: 'render-design / batch-generate-designs accept dynamic_fields: [{name, ...properties}] and dynamic_fields_flat, either canonical {"fields__{name}__{suffix}": value} or plain {"name": value} where suffix ∈ text|image_url|video_url|color|font_family|font_size|visible. Plain keys are resolved against the document field target. Flat keys apply AFTER the array, so flat wins on overlap. Unknown/invalid keys are ignored and reported in bindingWarnings. Values are never persisted or echoed.',
  },
}
