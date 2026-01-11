import { describe, it, expect, vi } from 'vitest'
import { parseCsvFile, validateCsvRow, csvRowToPost, type CsvRow } from '../csvParser'

describe('csvParser', () => {
    describe('validateCsvRow', () => {
        it('should validate a valid row', () => {
            const row: CsvRow = {
                content: 'Test post content',
                image_url: 'https://example.com/image.jpg',
                scheduled_time: '2026-01-15T10:00:00Z',
                comments: 'First comment;Second comment'
            }

            const errors = validateCsvRow(row, 1)
            expect(errors).toHaveLength(0)
        })

        it('should return error for empty content', () => {
            const row: CsvRow = {
                content: '',
                image_url: 'https://example.com/image.jpg'
            }

            const errors = validateCsvRow(row, 1)
            expect(errors).toHaveLength(1)
            expect(errors[0]).toContain('Content is required')
        })

        it('should return error for invalid URL', () => {
            const row: CsvRow = {
                content: 'Test content',
                image_url: 'not-a-valid-url'
            }

            const errors = validateCsvRow(row, 1)
            expect(errors).toHaveLength(1)
            expect(errors[0]).toContain('Invalid image URL')
        })

        it('should return error for invalid date', () => {
            const row: CsvRow = {
                content: 'Test content',
                scheduled_time: 'not-a-date'
            }

            const errors = validateCsvRow(row, 1)
            expect(errors).toHaveLength(1)
            expect(errors[0]).toContain('Invalid scheduled_time format')
        })

        it('should return error for content exceeding max length', () => {
            const row: CsvRow = {
                content: 'a'.repeat(10001)
            }

            const errors = validateCsvRow(row, 1)
            expect(errors).toHaveLength(1)
            expect(errors[0]).toContain('exceeds maximum length')
        })
    })

    describe('csvRowToPost', () => {
        it('should convert valid CSV row to PostCreateBase', () => {
            const row: CsvRow = {
                content: 'Test post content',
                image_url: 'https://example.com/image.jpg',
                scheduled_time: '2026-01-15T10:00:00Z',
                comments: 'First comment;Second comment'
            }

            const post = csvRowToPost(row)
            expect(post).not.toBeNull()
            expect(post?.content).toBe('Test post content')
            expect(post?.mediaAssets).toEqual(['https://example.com/image.jpg'])
            expect(post?.comment).toEqual(['First comment', 'Second comment'])
            expect(post?.scheduledAt).toBeInstanceOf(Date)
        })

        it('should handle empty optional fields', () => {
            const row: CsvRow = {
                content: 'Test post content'
            }

            const post = csvRowToPost(row)
            expect(post).not.toBeNull()
            expect(post?.mediaAssets).toEqual([])
            expect(post?.comment).toEqual([])
            expect(post?.scheduledAt).toBeNull()
        })

        it('should filter empty comments', () => {
            const row: CsvRow = {
                content: 'Test content',
                comments: 'Comment 1;;Comment 2;'
            }

            const post = csvRowToPost(row)
            expect(post?.comment).toEqual(['Comment 1', 'Comment 2'])
        })
    })

    describe('parseCsvFile', () => {
        it('should parse valid CSV file', async () => {
            const csvContent = `content,image_url,scheduled_time,comments
Test post 1,https://example.com/1.jpg,2026-01-15T10:00:00Z,Comment 1
Test post 2,https://example.com/2.jpg,2026-01-16T14:00:00Z,Comment 2`

            const file = new File([csvContent], 'test.csv', { type: 'text/csv' })
            const result = await parseCsvFile(file)

            expect(result.success).toBe(true)
            expect(result.data).toHaveLength(2)
            expect(result.data?.[0].content).toBe('Test post 1')
        })

        it('should return errors for invalid rows', async () => {
            const csvContent = `content,image_url
,invalid-url`

            const file = new File([csvContent], 'test.csv', { type: 'text/csv' })
            const result = await parseCsvFile(file)

            expect(result.success).toBe(false)
            expect(result.errors).toBeDefined()
            expect(result.errors!.length).toBeGreaterThan(0)
        })

        it('should handle empty CSV files', async () => {
            const csvContent = ''
            const file = new File([csvContent], 'empty.csv', { type: 'text/csv' })
            const result = await parseCsvFile(file)

            expect(result.success).toBe(false)
            expect(result.errors?.[0]).toContain('CSV is empty')
        })

        it('should handle CSV with only headers', async () => {
            const csvContent = 'content,image_url,scheduled_time,comments'
            const file = new File([csvContent], 'headers.csv', { type: 'text/csv' })
            const result = await parseCsvFile(file)

            expect(result.success).toBe(false)
            expect(result.errors?.[0]).toContain('No data found in CSV')
        })

        it('should return errors if required columns are missing', async () => {
            const csvContent = 'image_url,comments\nhttps://example.com/img.jpg,comment'
            const file = new File([csvContent], 'missing_col.csv', { type: 'text/csv' })
            const result = await parseCsvFile(file)

            expect(result.success).toBe(false)
            expect(result.errors?.[0]).toContain('Missing required column: content')
        })

        it('should handle mixed valid and invalid rows', async () => {
            const csvContent = `content,image_url
Valid content,https://example.com/valid.jpg
,https://example.com/invalid.jpg`

            const file = new File([csvContent], 'mixed.csv', { type: 'text/csv' })
            const result = await parseCsvFile(file)

            expect(result.success).toBe(false)
            expect(result.errors).toHaveLength(1)
            expect(result.errors?.[0]).toContain('Row 2')
        })
    })
})
