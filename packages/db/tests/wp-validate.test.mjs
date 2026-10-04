import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { validateArtifactOutput } from '#layers/BaseDB/db/content/contracts.ts'

describe('wp validate', () => {
  it('validates wordpress', () => {
    const wp = {
      outputKind: 'wordpress_article',
      title: 'Clean Post',
      slug: 'clean-post',
      language: 'en',
      content: 'This is a clean post about social media automation for developers.',
      excerpt: '',
      category: '',
      tags: [],
      featuredImage: '',
      status: 'draft',
      wordpressUrl: ''
    }
    console.log(validateArtifactOutput('wordpress_article', wp))
    assert.equal(validateArtifactOutput('wordpress_article', wp).ok, true)
  })
})
