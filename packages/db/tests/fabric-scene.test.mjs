import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

// T90 — Fabric scene validation (pure, no database).
// Run: node --test --import ./tests/register-hook.mjs --import ./tests/globals.mjs tests/fabric-scene.test.mjs

import { validateFabricScene, checkInstagramBounds } from '../server/utils/fabric-scene-validate.ts'

function scene(objects = [{ type: 'rect', fill: '#ffffff' }]) {
  return {
    width: 1080,
    height: 1350,
    slides: [{ scene: { version: 1, objects }, altText: 'Slide', templateKey: 'title-kicker' }],
  }
}

describe('fabric scene validation (T90)', () => {
  it('accepts a clean scene', () => {
    const result = validateFabricScene(scene())
    assert.equal(result.ok, true)
    assert.equal(result.slideCount, 1)
  })

  it('rejects scripts and remote images', () => {
    const evil = scene([{ type: 'text', text: '<script>alert(1)</script>' }])
    assert.equal(validateFabricScene(evil).ok, false)
    const remote = scene([{ type: 'image', src: 'https://evil.test/x.png' }])
    assert.equal(validateFabricScene(remote).ok, false)
  })

  it('rejects unknown types, bad colors, and oversized canvases', () => {
    assert.equal(validateFabricScene(scene([{ type: 'video' }])).ok, false)
    assert.equal(validateFabricScene(scene([{ type: 'rect', fill: 'red' }])).ok, false)
    assert.equal(validateFabricScene({ ...scene(), width: 99999 }).ok, false)
  })

  it('rejects too many slides and non-objects', () => {
    const many = scene()
    many.slides = Array.from({ length: 16 }, (_, i) => ({ scene: { objects: [] }, altText: `s${i}` }))
    assert.equal(validateFabricScene(many).ok, false)
    assert.equal(validateFabricScene(null).ok, false)
  })

  it('enforces Instagram bounds before side effects', () => {
    assert.equal(checkInstagramBounds(1) !== null, true)
    assert.equal(checkInstagramBounds(2), null)
    assert.equal(checkInstagramBounds(10), null)
    assert.equal(checkInstagramBounds(11) !== null, true)
  })
})
