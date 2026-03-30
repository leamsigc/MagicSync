import {
  test,
  expect,
  mockDocumentsList,
  mockDocumentUpload,
  mockIngestionSSE,
} from './fixtures'

const mockPdfDoc = {
  id: 'doc-pdf-1',
  originalName: 'report.pdf',
  mimeType: 'application/pdf',
  size: 51200,
  status: 'pending',
  chunkCount: 0,
  createdAt: new Date().toISOString(),
}

const mockDocxDoc = {
  id: 'docx-1',
  originalName: 'specification.docx',
  mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  size: 32768,
  status: 'pending',
  chunkCount: 0,
  createdAt: new Date().toISOString(),
}

const mockHtmlDoc = {
  id: 'html-1',
  originalName: 'page.html',
  mimeType: 'text/html',
  size: 8192,
  status: 'pending',
  chunkCount: 0,
  createdAt: new Date().toISOString(),
}

const mockMarkdownDoc = {
  id: 'md-1',
  originalName: 'readme.md',
  mimeType: 'text/markdown',
  size: 4096,
  status: 'pending',
  chunkCount: 0,
  createdAt: new Date().toISOString(),
}

const mockTextDoc = {
  id: 'txt-1',
  originalName: 'notes.txt',
  mimeType: 'text/plain',
  size: 2048,
  status: 'pending',
  chunkCount: 0,
  createdAt: new Date().toISOString(),
}

test.describe('Multi-Format Upload', () => {
  test('should upload a PDF file', async ({ authPage: page }) => {
    await mockDocumentsList(page, [])
    await mockDocumentUpload(page, mockPdfDoc)
    await page.goto('/app/ai-tools/chat/assets')

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'report.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 fake content'),
    })

    // Upload should succeed
    await mockDocumentsList(page, [mockPdfDoc])
    await expect(page.getByText('report.pdf')).toBeVisible({ timeout: 5000 })
  })

  test('should upload a DOCX file', async ({ authPage: page }) => {
    await mockDocumentsList(page, [])
    await mockDocumentUpload(page, mockDocxDoc)
    await page.goto('/app/ai-tools/chat/assets')

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'specification.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: Buffer.from('PK fake docx content'),
    })

    await mockDocumentsList(page, [mockDocxDoc])
    await expect(page.getByText('specification.docx')).toBeVisible({ timeout: 5000 })
  })

  test('should upload an HTML file', async ({ authPage: page }) => {
    await mockDocumentsList(page, [])
    await mockDocumentUpload(page, mockHtmlDoc)
    await page.goto('/app/ai-tools/chat/assets')

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'page.html',
      mimeType: 'text/html',
      buffer: Buffer.from('<html><body>Test</body></html>'),
    })

    await mockDocumentsList(page, [mockHtmlDoc])
    await expect(page.getByText('page.html')).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Multi-Format Ingestion', () => {
  test('should ingest PDF document', async ({ authPage: page }) => {
    await mockDocumentsList(page, [mockPdfDoc])
    await mockIngestionSSE(page, mockPdfDoc.id, 12)
    await page.goto('/app/ai-tools/chat/assets')

    await expect(page.getByText('PDF')).toBeVisible()
    await page.getByRole('button', { name: 'Ingest' }).click()

    await expect(page.getByText('Reading file...')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Ingested 12 chunks')).toBeVisible({ timeout: 5000 })
  })

  test('should ingest DOCX document', async ({ authPage: page }) => {
    await mockDocumentsList(page, [mockDocxDoc])
    await mockIngestionSSE(page, mockDocxDoc.id, 8)
    await page.goto('/app/ai-tools/chat/assets')

    await expect(page.getByText('DOCX')).toBeVisible()
    await page.getByRole('button', { name: 'Ingest' }).click()

    await expect(page.getByText('Ingested 8 chunks')).toBeVisible({ timeout: 5000 })
  })

  test('should ingest HTML document', async ({ authPage: page }) => {
    await mockDocumentsList(page, [mockHtmlDoc])
    await mockIngestionSSE(page, mockHtmlDoc.id, 3)
    await page.goto('/app/ai-tools/chat/assets')

    await expect(page.getByText('HTML')).toBeVisible()
    await page.getByRole('button', { name: 'Ingest' }).click()

    await expect(page.getByText('Ingested 3 chunks')).toBeVisible({ timeout: 5000 })
  })

  test('should ingest Markdown document', async ({ authPage: page }) => {
    await mockDocumentsList(page, [mockMarkdownDoc])
    await mockIngestionSSE(page, mockMarkdownDoc.id, 5)
    await page.goto('/app/ai-tools/chat/assets')

    await expect(page.getByText('MD')).toBeVisible()
    await page.getByRole('button', { name: 'Ingest' }).click()

    await expect(page.getByText('Ingested 5 chunks')).toBeVisible({ timeout: 5000 })
  })

  test('should ingest plain text document', async ({ authPage: page }) => {
    await mockDocumentsList(page, [mockTextDoc])
    await mockIngestionSSE(page, mockTextDoc.id, 2)
    await page.goto('/app/ai-tools/chat/assets')

    await expect(page.getByText('TXT')).toBeVisible()
    await page.getByRole('button', { name: 'Ingest' }).click()

    await expect(page.getByText('Ingested 2 chunks')).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Multi-Format Type Badges', () => {
  test('should show correct type badges for all formats', async ({ authPage: page }) => {
    await mockDocumentsList(page, [
      mockPdfDoc,
      mockDocxDoc,
      mockHtmlDoc,
      mockMarkdownDoc,
      mockTextDoc,
    ])
    await page.goto('/app/ai-tools/chat/assets')

    await expect(page.getByText('PDF')).toBeVisible()
    await expect(page.getByText('DOCX')).toBeVisible()
    await expect(page.getByText('HTML')).toBeVisible()
    await expect(page.getByText('MD')).toBeVisible()
    await expect(page.getByText('TXT')).toBeVisible()
  })
})
