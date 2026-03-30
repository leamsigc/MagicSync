import {
  test,
  expect,
  mockDocumentsList,
  mockIngestionSSE,
  mockIngestionSkipped,
  mockIngestionIncremental,
} from './fixtures'

const mockCompletedDoc = {
  id: 'doc-rm-1',
  originalName: 'strategy.md',
  mimeType: 'text/markdown',
  size: 12288,
  status: 'completed',
  chunkCount: 8,
  contentHash: 'abc123hash',
  createdAt: new Date().toISOString(),
}

const mockPendingDoc = {
  id: 'doc-rm-2',
  originalName: 'report.pdf',
  mimeType: 'application/pdf',
  size: 245760,
  status: 'pending',
  chunkCount: 0,
  contentHash: null,
  createdAt: new Date().toISOString(),
}

test.describe('Record Manager - Change Detection', () => {
  test('should show skipped message when document content is unchanged', async ({ authPage: page }) => {
    await mockDocumentsList(page, [mockCompletedDoc])
    await mockIngestionSkipped(page, mockCompletedDoc.id, 8)
    await page.goto('/app/ai-tools/chat/assets')

    // Click re-ingest
    await page.getByRole('button', { name: 'Re-ingest' }).click()

    // Should show "No changes detected" toast
    await expect(page.getByText('Document content unchanged, skipping re-ingestion')).toBeVisible({ timeout: 5000 })
  })

  test('should refresh document list after skip', async ({ authPage: page }) => {
    await mockDocumentsList(page, [mockCompletedDoc])
    await mockIngestionSkipped(page, mockCompletedDoc.id, 8)
    await page.goto('/app/ai-tools/chat/assets')

    // Click re-ingest
    await page.getByRole('button', { name: 'Re-ingest' }).click()

    // Wait for completion and refresh
    await page.waitForTimeout(1000)
    // The document should still show as completed
    await expect(page.getByText('Completed')).toBeVisible()
  })

  test('should process document when content has changed', async ({ authPage: page }) => {
    await mockDocumentsList(page, [mockCompletedDoc])
    await mockIngestionSSE(page, mockCompletedDoc.id, 10)
    await page.goto('/app/ai-tools/chat/assets')

    // Click re-ingest
    await page.getByRole('button', { name: 'Re-ingest' }).click()

    // Should show processing messages (not skip)
    await expect(page.getByText('Reading file...')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Chunking and embedding...')).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Record Manager - Incremental Processing', () => {
  test('should show incremental update stats during re-ingestion', async ({ authPage: page }) => {
    await mockDocumentsList(page, [mockCompletedDoc])
    await mockIngestionIncremental(page, mockCompletedDoc.id, {
      totalChunks: 10,
      unchanged: 7,
      changed: 3,
      removed: 1,
    })
    await page.goto('/app/ai-tools/chat/assets')

    // Click re-ingest
    await page.getByRole('button', { name: 'Re-ingest' }).click()

    // Should show incremental stats
    await expect(page.getByText('7 unchanged, 3 new/changed, 1 removed')).toBeVisible({ timeout: 5000 })
  })

  test('should show completion with new and unchanged chunk counts', async ({ authPage: page }) => {
    await mockDocumentsList(page, [mockCompletedDoc])
    await mockIngestionIncremental(page, mockCompletedDoc.id, {
      totalChunks: 10,
      unchanged: 7,
      changed: 3,
      removed: 1,
    })
    await page.goto('/app/ai-tools/chat/assets')

    // Click re-ingest and wait for completion
    await page.getByRole('button', { name: 'Re-ingest' }).click()

    // Should complete and show success toast
    await expect(page.getByText('Ingested 10 chunks (3 new, 7 unchanged)')).toBeVisible({ timeout: 5000 })
  })

  test('should handle full re-ingestion when no existing chunks match', async ({ authPage: page }) => {
    await mockDocumentsList(page, [mockPendingDoc])
    await mockIngestionSSE(page, mockPendingDoc.id, 5)
    await page.goto('/app/ai-tools/chat/assets')

    // Click ingest (first time)
    await page.getByRole('button', { name: 'Ingest' }).click()

    // Should show full processing (no incremental stats)
    await expect(page.getByText('Reading file...')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/Storing.*chunks/)).toBeVisible({ timeout: 5000 })
  })

  test('should handle incremental update where all chunks are unchanged', async ({ authPage: page }) => {
    await mockDocumentsList(page, [mockCompletedDoc])
    await mockIngestionIncremental(page, mockCompletedDoc.id, {
      totalChunks: 8,
      unchanged: 8,
      changed: 0,
      removed: 0,
    })
    await page.goto('/app/ai-tools/chat/assets')

    await page.getByRole('button', { name: 'Re-ingest' }).click()

    // Should show stats with 0 changed
    await expect(page.getByText('8 unchanged, 0 new/changed, 0 removed')).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Record Manager - API via page.evaluate', () => {
  test('ingest endpoint should return skipped status for unchanged document', async ({ authPage: page }) => {
    await mockIngestionSkipped(page, 'doc-test-1', 5)
    await page.goto('/app/ai-tools/chat/assets')

    const result = await page.evaluate(async () => {
      const response = await fetch('/api/ai-tools/documents/doc-test-1/ingest', { method: 'POST' })
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      const events: any[] = []

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const text = decoder.decode(value)
          const lines = text.split('\n').filter(l => l.startsWith('data: '))
          for (const line of lines) {
            const json = line.replace('data: ', '')
            if (json !== '[DONE]') {
              events.push(JSON.parse(json))
            }
          }
        }
      }
      return events
    })

    const skippedEvent = result.find(e => e.status === 'skipped')
    expect(skippedEvent).toBeTruthy()
    expect(skippedEvent.message).toContain('unchanged')
    expect(skippedEvent.total_chunks).toBe(5)
  })

  test('ingest endpoint should return incremental stats', async ({ authPage: page }) => {
    await mockIngestionIncremental(page, 'doc-test-2', {
      totalChunks: 10,
      unchanged: 6,
      changed: 4,
      removed: 2,
    })
    await page.goto('/app/ai-tools/chat/assets')

    const result = await page.evaluate(async () => {
      const response = await fetch('/api/ai-tools/documents/doc-test-2/ingest', { method: 'POST' })
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      const events: any[] = []

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const text = decoder.decode(value)
          const lines = text.split('\n').filter(l => l.startsWith('data: '))
          for (const line of lines) {
            const json = line.replace('data: ', '')
            if (json !== '[DONE]') {
              events.push(JSON.parse(json))
            }
          }
        }
      }
      return events
    })

    const storingEvent = result.find(e => e.status === 'storing' && e.unchanged !== undefined)
    expect(storingEvent).toBeTruthy()
    expect(storingEvent.unchanged).toBe(6)
    expect(storingEvent.changed).toBe(4)
    expect(storingEvent.removed).toBe(2)

    const completedEvent = result.find(e => e.status === 'completed')
    expect(completedEvent).toBeTruthy()
    expect(completedEvent.new_chunks).toBe(4)
    expect(completedEvent.unchanged_chunks).toBe(6)
  })
})
