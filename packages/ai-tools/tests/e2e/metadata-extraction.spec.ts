import {
  test,
  expect,
  mockDocumentsList,
  mockIngestionWithMetadata,
  mockMetadataExtraction,
  mockRetrieval,
} from './fixtures'

const mockDoc = {
  id: 'doc-meta-1',
  originalName: 'guide.pdf',
  mimeType: 'application/pdf',
  size: 51200,
  status: 'pending',
  chunkCount: 0,
  createdAt: new Date().toISOString(),
}

const mockDocWithMeta = {
  id: 'doc-meta-2',
  originalName: 'strategy.md',
  mimeType: 'text/markdown',
  size: 12288,
  status: 'completed',
  chunkCount: 8,
  metadata: JSON.stringify({
    title: 'Growth Strategy Guide',
    author: 'Jane Doe',
    language: 'en',
    topics: ['marketing', 'growth', 'social media'],
    summary: 'A guide for social media growth strategies.',
    document_type: 'guide',
    extractedAt: '2026-03-30T12:00:00Z',
  }),
  createdAt: new Date().toISOString(),
}

test.describe('Metadata Extraction - Ingestion Flow', () => {
  test('should show extracting status during ingestion', async ({ authPage: page }) => {
    await mockDocumentsList(page, [mockDoc])
    await mockIngestionWithMetadata(page, mockDoc.id, 5)
    await page.goto('/app/ai-tools/chat/assets')

    // Click ingest
    await page.getByRole('button', { name: 'Ingest' }).click()

    // Should show metadata extraction step
    await expect(page.getByText('Extracting document metadata...')).toBeVisible({ timeout: 5000 })
  })

  test('should show extracted title in SSE message', async ({ authPage: page }) => {
    await mockDocumentsList(page, [mockDoc])
    await mockIngestionWithMetadata(page, mockDoc.id, 5, { title: 'My Custom Title' })
    await page.goto('/app/ai-tools/chat/assets')

    await page.getByRole('button', { name: 'Ingest' }).click()

    await expect(page.getByText('Metadata extracted: "My Custom Title"')).toBeVisible({ timeout: 5000 })
  })

  test('should complete ingestion with metadata extraction', async ({ authPage: page }) => {
    await mockDocumentsList(page, [mockDoc])
    await mockIngestionWithMetadata(page, mockDoc.id, 3)
    await page.goto('/app/ai-tools/chat/assets')

    await page.getByRole('button', { name: 'Ingest' }).click()

    // Should show success after extraction
    await expect(page.getByText('Ingested 3 chunks')).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Metadata Extraction - API', () => {
  test('extract-metadata endpoint should return structured metadata', async ({ authPage: page }) => {
    await mockMetadataExtraction(page, 'doc-api-1', {
      title: 'API Test Doc',
      topics: ['api', 'testing'],
    })
    await page.goto('/app/ai-tools/chat/assets')

    const result = await page.evaluate(async () => {
      const response = await fetch('/api/ai-tools/documents/doc-api-1/extract-metadata', {
        method: 'POST',
      })
      return response.json()
    })

    expect(result.title).toBe('API Test Doc')
    expect(result.topics).toEqual(['api', 'testing'])
    expect(result.language).toBe('en')
    expect(result.summary).toBeTruthy()
  })
})

test.describe('Filtered Retrieval', () => {
  test('retrieval should return metadata in results', async ({ authPage: page }) => {
    await mockRetrieval(page, [
      {
        content: 'Social media marketing is essential for growth.',
        documentId: 'doc-1',
        similarity: 0.12,
        metadata: {
          documentId: 'doc-1',
          source: 'guide.pdf',
          topics: ['marketing', 'growth'],
        },
      },
    ])
    await page.goto('/app/ai-tools/chat/assets')

    const result = await page.evaluate(async () => {
      const response = await fetch('/api/ai-tools/retrieve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'social media marketing' }),
      })
      return response.json()
    })

    expect(result.results).toHaveLength(1)
    expect(result.results[0].content).toContain('Social media marketing')
    expect(result.results[0].metadata).toBeTruthy()
    expect(result.results[0].metadata.topics).toEqual(['marketing', 'growth'])
  })

  test('retrieval should support document_id filter', async ({ authPage: page }) => {
    await mockRetrieval(page, [
      {
        content: 'Content from specific document.',
        documentId: 'doc-filtered',
        similarity: 0.05,
        metadata: { source: 'filtered.pdf' },
      },
    ])
    await page.goto('/app/ai-tools/chat/assets')

    const result = await page.evaluate(async () => {
      const response = await fetch('/api/ai-tools/retrieve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'content',
          document_id: 'doc-filtered',
        }),
      })
      return response.json()
    })

    expect(result.results).toHaveLength(1)
    expect(result.results[0].documentId).toBe('doc-filtered')
  })

  test('retrieval should support metadata key/value filter', async ({ authPage: page }) => {
    await mockRetrieval(page, [
      {
        content: 'Filtered by metadata.',
        documentId: 'doc-1',
        similarity: 0.1,
        metadata: { language: 'en', topics: ['testing'] },
      },
    ])
    await page.goto('/app/ai-tools/chat/assets')

    const result = await page.evaluate(async () => {
      const response = await fetch('/api/ai-tools/retrieve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'testing',
          metadata_key: 'language',
          metadata_value: 'en',
        }),
      })
      return response.json()
    })

    expect(result.results).toHaveLength(1)
    expect(result.results[0].metadata.language).toBe('en')
  })
})
