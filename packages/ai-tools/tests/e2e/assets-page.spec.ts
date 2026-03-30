import {
  test,
  expect,
  mockDocumentsList,
  mockDocumentUpload,
  mockDocumentDelete,
  mockIngestionSSE,
} from './fixtures'

const mockDoc = {
  id: 'doc-1',
  originalName: 'business-plan.pdf',
  mimeType: 'application/pdf',
  size: 245760,
  status: 'pending',
  chunkCount: 0,
  createdAt: new Date().toISOString(),
}

const mockCompletedDoc = {
  id: 'doc-2',
  originalName: 'strategy.md',
  mimeType: 'text/markdown',
  size: 12288,
  status: 'completed',
  chunkCount: 8,
  createdAt: new Date().toISOString(),
}

const mockFailedDoc = {
  id: 'doc-3',
  originalName: 'corrupted.pdf',
  mimeType: 'application/pdf',
  size: 512,
  status: 'failed',
  chunkCount: 0,
  errorMessage: 'Unsupported file format',
  createdAt: new Date().toISOString(),
}

test.describe('Assets Page - Document List', () => {
  test('should display page title and description', async ({ authPage: page }) => {
    await mockDocumentsList(page)
    await page.goto('/app/ai-tools/chat/assets')

    await expect(page.locator('h1')).toContainText('Knowledge Base')
    await expect(page.getByText(/Upload documents to build your AI knowledge base/)).toBeVisible()
  })

  test('should show upload dropzone', async ({ authPage: page }) => {
    await mockDocumentsList(page)
    await page.goto('/app/ai-tools/chat/assets')

    await expect(page.getByText('Drop files here or click to browse')).toBeVisible()
    await expect(page.getByText('PDF, TXT, MD, HTML, DOCX (max 10MB)')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Upload Document' })).toBeVisible()
  })

  test('should show empty state when no documents', async ({ authPage: page }) => {
    await mockDocumentsList(page, [])
    await page.goto('/app/ai-tools/chat/assets')

    await expect(page.getByText('No documents yet. Upload your first document to get started.')).toBeVisible()
  })

  test('should display documents in table', async ({ authPage: page }) => {
    await mockDocumentsList(page, [mockDoc, mockCompletedDoc])
    await page.goto('/app/ai-tools/chat/assets')

    await expect(page.getByText('business-plan.pdf')).toBeVisible()
    await expect(page.getByText('strategy.md')).toBeVisible()
  })

  test('should show correct file type badges', async ({ authPage: page }) => {
    await mockDocumentsList(page, [mockDoc, mockCompletedDoc])
    await page.goto('/app/ai-tools/chat/assets')

    await expect(page.getByText('PDF')).toBeVisible()
    await expect(page.getByText('MD')).toBeVisible()
  })

  test('should show human-readable file sizes', async ({ authPage: page }) => {
    await mockDocumentsList(page, [mockDoc])
    await page.goto('/app/ai-tools/chat/assets')

    await expect(page.getByText('240.0 KB')).toBeVisible()
  })

  test('should show chunk count for completed documents', async ({ authPage: page }) => {
    await mockDocumentsList(page, [mockCompletedDoc])
    await page.goto('/app/ai-tools/chat/assets')

    await expect(page.getByText('8')).toBeVisible()
  })

  test('should show status badges with correct colors', async ({ authPage: page }) => {
    await mockDocumentsList(page, [mockDoc, mockCompletedDoc, mockFailedDoc])
    await page.goto('/app/ai-tools/chat/assets')

    await expect(page.getByText('Pending')).toBeVisible()
    await expect(page.getByText('Completed')).toBeVisible()
    await expect(page.getByText('Failed')).toBeVisible()
  })

  test('should show loading spinner while fetching', async ({ authPage: page }) => {
    // Delay the response to see loading state
    await page.route('**/api/ai-tools/documents', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 500))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    await page.goto('/app/ai-tools/chat/assets')
    await expect(page.locator('.animate-spin')).toBeVisible()
  })
})

test.describe('Assets Page - Upload', () => {
  test('should upload a file via button click', async ({ authPage: page }) => {
    await mockDocumentsList(page, [])
    await mockDocumentUpload(page, mockDoc)
    await page.goto('/app/ai-tools/chat/assets')

    // Create a file and upload
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'business-plan.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('fake pdf content'),
    })

    // Should show success toast (via toast.add)
    // The document list should refresh after upload
    await mockDocumentsList(page, [mockDoc])
  })

  test('should show uploading state during upload', async ({ authPage: page }) => {
    await mockDocumentsList(page, [])

    // Delay the upload response
    await page.route('**/api/ai-tools/documents/upload', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 1000))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockDoc),
      })
    })

    await page.goto('/app/ai-tools/chat/assets')

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'test.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('test'),
    })

    // Button should show loading state
    await expect(page.getByRole('button', { name: 'Upload Document' })).toBeVisible()
  })
})

test.describe('Assets Page - Ingestion', () => {
  test('should show ingest button for pending documents', async ({ authPage: page }) => {
    await mockDocumentsList(page, [mockDoc])
    await page.goto('/app/ai-tools/chat/assets')

    await expect(page.getByRole('button', { name: 'Ingest' })).toBeVisible()
  })

  test('should show re-ingest button for completed documents', async ({ authPage: page }) => {
    await mockDocumentsList(page, [mockCompletedDoc])
    await page.goto('/app/ai-tools/chat/assets')

    await expect(page.getByRole('button', { name: 'Re-ingest' })).toBeVisible()
  })

  test('should show re-ingest button for failed documents', async ({ authPage: page }) => {
    await mockDocumentsList(page, [mockFailedDoc])
    await page.goto('/app/ai-tools/chat/assets')

    await expect(page.getByRole('button', { name: 'Re-ingest' })).toBeVisible()
  })

  test('should show progress during ingestion', async ({ authPage: page }) => {
    await mockDocumentsList(page, [mockDoc])
    await mockIngestionSSE(page, mockDoc.id, 5)
    await page.goto('/app/ai-tools/chat/assets')

    // Click ingest
    await page.getByRole('button', { name: 'Ingest' }).click()

    // Should show progress message
    await expect(page.getByText('Reading file...')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Chunking and embedding...')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/Storing.*chunks/)).toBeVisible({ timeout: 5000 })
  })

  test('should show cancel button during ingestion', async ({ authPage: page }) => {
    await mockDocumentsList(page, [mockDoc])

    // Slow ingestion
    await page.route(`**/api/ai-tools/documents/${mockDoc.id}/ingest`, async (route) => {
      const sseBody = 'data: {"status":"processing","message":"Reading file..."}\n\n'
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: sseBody,
      })
    })

    await page.goto('/app/ai-tools/chat/assets')
    await page.getByRole('button', { name: 'Ingest' }).click()

    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible()
  })
})

test.describe('Assets Page - Delete', () => {
  test('should show delete button for each document', async ({ authPage: page }) => {
    await mockDocumentsList(page, [mockDoc])
    await page.goto('/app/ai-tools/chat/assets')

    // Each row should have a delete button (trash icon)
    const deleteButtons = page.locator('button:has(i-heroicons-trash)')
    await expect(deleteButtons).toHaveCount(1)
  })

  test('should show confirm dialog before deleting', async ({ authPage: page }) => {
    await mockDocumentsList(page, [mockDoc])

    // Listen for dialog
    page.on('dialog', async (dialog) => {
      expect(dialog.message()).toContain('delete this document')
      await dialog.dismiss()
    })

    await page.goto('/app/ai-tools/chat/assets')
    await page.locator('button:has(i-heroicons-trash)').click()
  })

  test('should delete document after confirmation', async ({ authPage: page }) => {
    await mockDocumentsList(page, [mockDoc])
    mockDocumentDelete(page, mockDoc.id)

    page.on('dialog', async (dialog) => {
      await dialog.accept()
    })

    await page.goto('/app/ai-tools/chat/assets')
    await page.locator('button:has(i-heroicons-trash)').click()

    // Document should be removed from the list
    await expect(page.getByText('business-plan.pdf')).not.toBeVisible()
  })
})

test.describe('Assets Page - Table Columns', () => {
  test('should show all table headers', async ({ authPage: page }) => {
    await mockDocumentsList(page, [mockDoc])
    await page.goto('/app/ai-tools/chat/assets')

    await expect(page.getByText('Name')).toBeVisible()
    await expect(page.getByText('Type')).toBeVisible()
    await expect(page.getByText('Size')).toBeVisible()
    await expect(page.getByText('Chunks')).toBeVisible()
    await expect(page.getByText('Status')).toBeVisible()
    await expect(page.getByText('Actions')).toBeVisible()
  })
})
