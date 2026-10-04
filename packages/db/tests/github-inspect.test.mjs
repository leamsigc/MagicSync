import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { _helpers, buildTargetPath, githubInspectService } from '#layers/BaseDB/server/services/github-inspect.service.ts'
import { validateArtifactOutput } from '#layers/BaseDB/db/content/contracts.ts'

const { detectFramework, detectContentSystem, detectContentDir, detectBlogDir, detectLanguageStrategy, extractFrontmatter, frontmatterInfo, detectTemplateInfo, slugify, parseRepo } = _helpers

describe('github-inspect helpers', () => {
  it('parses repo owner/name', () => {
    assert.deepEqual(parseRepo('owner/project'), { owner: 'owner', name: 'project' })
    assert.equal(parseRepo('bad'), null)
    assert.equal(parseRepo('owner/'), null)
  })

  it('detects nuxt framework', () => {
    const files = new Set(['nuxt.config.ts', 'package.json'])
    const pkg = { dependencies: { nuxt: '^4.0.0', '@nuxt/content': '^3.0.0' } }
    assert.equal(detectFramework(files, pkg), 'nuxt')
    assert.equal(detectFramework(new Set(['next.config.js']), { dependencies: { next: '14' } }), 'next')
    assert.equal(detectFramework(new Set(['README.md']), {}), 'unknown')
  })

  it('detects nuxt content system', () => {
    const files = new Set(['content.config.ts'])
    const pkg = { dependencies: { '@nuxt/content': '3.0.0' } }
    assert.equal(detectContentSystem(files, pkg), 'nuxt-content')
    assert.equal(detectContentSystem(new Set(['content/post.md']), {}), 'markdown')
    assert.equal(detectContentSystem(new Set([]), {}), 'unknown')
  })

  it('detects content directories preferring nuxt blog layout', () => {
    const files = [
      'content/en/blogs/article-name/index.md',
      'content/de/blogs/foo/index.md',
      'package.json',
    ]
    assert.equal(detectContentDir(files), 'content/en/blogs')
    const magicsyncLike = ['content/en/blogs/x/index.md', 'content/es/blogs/y/index.md']
    assert.equal(detectContentDir(magicsyncLike), 'content/en/blogs')
    const simple = ['content/blog/my-article.md', 'content/blog/other.md']
    assert.equal(detectContentDir(simple), 'content/blog')
    const bare = ['content/my-article.md']
    assert.equal(detectContentDir(bare), 'content')
  })

  it('detects blog dir', () => {
    const files = ['content/en/blogs/a/index.md', 'content/en/blogs/b/index.md']
    assert.equal(detectBlogDir(files, 'content'), 'content/en/blogs')
    const files2 = ['content/blog/post.md']
    assert.equal(detectBlogDir(files2, 'content'), 'content/blog')
    assert.equal(detectBlogDir(['content/foo.md'], 'content'), null)
  })

  it('detects language strategy prefix vs suffix vs none', () => {
    const prefix = ['content/en/blogs/a/index.md', 'content/de/blogs/a/index.md', 'content/es/blogs/a/index.md']
    const pref = detectLanguageStrategy(prefix)
    assert.equal(pref.type, 'prefix')
    assert.deepEqual(pref.languages.sort(), ['de', 'en', 'es'])

    const suffix = ['content/blog/de/my-article.md', 'content/blog/es/my-article.md']
    const suff = detectLanguageStrategy(suffix)
    assert.equal(suff.type, 'suffix')

    const none = ['content/blog/my-article.md', 'README.md']
    const n = detectLanguageStrategy(none)
    assert.equal(n.type, 'none')
  })

  it('parses frontmatter and detects required fields', () => {
    const md = `---
title: "Hello"
description: "Desc"
date: "2026-01-01"
tags:
  - one
  - two
---
Body here`
    const parsed = extractFrontmatter(md)
    assert.equal(parsed.data.title, 'Hello')
    assert.equal(parsed.body.trim(), 'Body here')
    const info = frontmatterInfo({ path: 'content/en/blogs/hello/index.md', content: md })
    assert.ok(info.fields.includes('title'))
    assert.ok(info.required.includes('title'))
  })

  it('detects template filename convention', () => {
    const samples = [
      { path: 'content/en/blogs/hello/index.md', content: '---\ntitle: Hi\n---\nBody' },
      { path: 'content/blog/other.md', content: '---\ntitle: Hi2\n---\nBody2' },
    ]
    const tpl = detectTemplateInfo(samples)
    assert.equal(tpl?.filenameConvention, 'folder-index')
    assert.equal(tpl?.path, 'content/en/blogs/hello/index.md')
    const tpl2 = detectTemplateInfo([samples[1]])
    assert.equal(tpl2?.filenameConvention, 'flat-md')
  })

  it('slugifies titles', () => {
    assert.equal(slugify('Hello World!'), 'hello-world')
    assert.equal(slugify(''), 'untitled')
    assert.equal(slugify('  ***  '), 'untitled')
  })

  it('builds target paths for en/de/es with different structures', () => {
    const base = {
      repository: 'owner/repo',
      branch: 'main',
      framework: 'nuxt',
      contentSystem: 'nuxt-content',
      contentDir: 'content',
      blogDir: 'content/en/blogs',
      language: { type: 'prefix', pattern: 'content/{lang}/blogs', languages: ['en', 'de', 'es'], defaultLanguage: 'en' },
      template: { path: 'content/en/blogs/example/index.md', frontmatter: { fields: [], required: [], optional: [], example: {}, rawExample: '' }, bodySnippet: '', filenameConvention: 'folder-index' },
      frontmatter: null,
      sampleFiles: [],
      workflows: [],
      detectedFiles: [],
    }
    // MagicSync-like prefix layout: content/{lang}/blogs
    let target = buildTargetPath(base, { language: 'de', slug: 'my-article' })
    assert.ok(target.includes('content/de'), `de target should contain content/de, got ${target}`)
    assert.ok(target.endsWith('my-article/index.md'), `should use folder-index, got ${target}`)

    target = buildTargetPath(base, { language: 'en', slug: 'my-article' })
    assert.ok(target.includes('content/en'), `en target ${target}`)

    target = buildTargetPath(base, { language: 'es', slug: 'my-article' })
    assert.ok(target.includes('content/es'), `es target ${target}`)

    // Flat suffix layout: content/blog/{lang}
    const suffix = {
      ...base,
      contentDir: 'content/blog',
      blogDir: 'content/blog',
      language: { type: 'suffix', pattern: 'content/blog/{lang}/...', languages: ['de', 'en'], defaultLanguage: 'en' },
      template: { ...base.template, filenameConvention: 'flat-md' },
    }
    target = buildTargetPath(suffix, { language: 'de', slug: 'my-article' })
    assert.equal(target, 'content/blog/de/my-article.md')

    // No language folders
    const none = {
      ...base,
      language: { type: 'none', pattern: 'content/...', languages: ['en'], defaultLanguage: null },
      contentDir: 'content',
      blogDir: null,
      template: { ...base.template, filenameConvention: 'flat-md' },
    }
    target = buildTargetPath(none, { language: 'de', slug: 'my-article' })
    assert.equal(target, 'content/my-article.md')
  })

  it('validates new artifact contracts', () => {
    const github = {
      outputKind: 'github_article',
      title: 'Test',
      description: 'Desc',
      slug: 'test',
      language: 'en',
      targetPath: 'content/en/blogs/test/index.md',
      repository: 'owner/repo',
      branch: 'main',
      frontmatter: { title: 'Test' },
      markdown: '# Test\nBody',
      rawMarkdown: 'Body',
    }
    assert.equal(validateArtifactOutput('github_article', github).ok, true)
    const wp = {
      outputKind: 'wordpress_article',
      title: 'WP',
      slug: 'wp',
      language: 'en',
      content: 'Hello',
      excerpt: '',
      category: '',
      tags: [],
      featuredImage: '',
      status: 'draft',
      wordpressUrl: '',
    }
    assert.equal(validateArtifactOutput('wordpress_article', wp).ok, true)
    assert.equal(validateArtifactOutput('github_article', { outputKind: 'github_article', title: '' }).ok, false)
  })
})

describe('github-inspect API helpers', () => {
  let realFetch
  function stubFetch(routes) {
    globalThis.fetch = async (url, init = {}) => {
      const key = `${init.method || 'GET'} ${url}`
      for (const [match, response] of routes) {
        if (key.includes(match)) {
          return {
            ok: response.status < 300,
            status: response.status,
            json: async () => response.body ?? {},
            text: async () => JSON.stringify(response.body ?? {}),
          }
        }
      }
      throw new Error(`unexpected fetch: ${key}`)
    }
  }
  before(() => { realFetch = globalThis.fetch })
  after(() => { globalThis.fetch = realFetch })

  it('checks existing file via GitHub contents API', async () => {
    stubFetch([
      ['GET https://api.github.com/repos/owner/repo/contents/content%2Fen%2Fblogs%2Ftest%2Findex.md', { status: 200, body: { sha: 'abc' } }],
    ])
    const res = await githubInspectService.checkExistingFile('owner/repo', 'main', 'content/en/blogs/test/index.md', 'tok')
    assert.equal(res.success, true)
    assert.equal(res.data.exists, true)
    assert.equal(res.data.sha, 'abc')
  })

  it('reports missing file as not exists', async () => {
    stubFetch([
      ['GET https://api.github.com/repos/owner/repo/contents/missing.md', { status: 404, body: {} }],
    ])
    const res = await githubInspectService.checkExistingFile('owner/repo', 'main', 'missing.md', 'tok')
    assert.equal(res.success, true)
    assert.equal(res.data.exists, false)
  })
})
