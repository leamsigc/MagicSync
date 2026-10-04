import Papa from 'papaparse'
import type { PostCreateBase } from '#layers/BaseDB/db/schema'

export type CsvRow = {
    content: string
    image_url?: string
    scheduled_time?: string
    comments?: string
}

export type CsvParseResult = {
    success: boolean
    data?: PostCreateBase[]
    errors?: string[]
}

export const parseCsvFile = async (file: File): Promise<CsvParseResult> => {
    return new Promise((resolve) => {
        Papa.parse<CsvRow>(file, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, '_'),
            complete: (results) => {
                resolve(processPapaResults(results))
            },
            error: (error) => {
                resolve({ success: false, errors: [`Failed to parse CSV: ${error.message}`] })
            }
        })
    })
}

export const parseFromBuffer = async (data: string | Buffer): Promise<CsvParseResult> => {
    return new Promise((resolve) => {
        const csvString = typeof data === 'string' ? data : data.toString('utf-8')

        Papa.parse<CsvRow>(csvString, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, '_'),
            complete: (results) => {
                resolve(processPapaResults(results))
            },
            error: (error: Error) => {
                resolve({ success: false, errors: [`Failed to parse CSV: ${error.message}`] })
            }
        })
    })
}

const processPapaResults = (results: Papa.ParseResult<CsvRow>): CsvParseResult => {
    const errors: string[] = []
    const validPosts: PostCreateBase[] = []

    // Check if CSV is empty or has no data
    if (!results.meta.fields || results.meta.fields.length === 0) {
        return { success: false, errors: ['CSV is empty'] }
    }

    if (results.data.length === 0) {
        return { success: false, errors: ['No data found in CSV'] }
    }

    // Check for required columns
    if (!results.meta.fields.includes('content')) {
        return { success: false, errors: ['Missing required column: content'] }
    }

    if (results.errors.length > 0) {
        errors.push(...results.errors.map(err => `Row ${err.row}: ${err.message}`))
    }

    results.data.forEach((row, index) => {
        const rowErrors = validateCsvRow(row, index + 1)
        if (rowErrors.length > 0) {
            errors.push(...rowErrors)
            return
        }

        const post = csvRowToPost(row)
        if (post) {
            validPosts.push(post)
        }
    })

    if (errors.length > 0) {
        return { success: false, errors }
    } else {
        return { success: true, data: validPosts }
    }
}

export const validateCsvRow = (row: CsvRow, rowNumber: number): string[] => {
    const errors: string[] = []

    if (!row.content || row.content.trim() === '') {
        errors.push(`Row ${rowNumber}: Content is required`)
    }

    if (row.content && row.content.length > 10000) {
        errors.push(`Row ${rowNumber}: Content exceeds maximum length of 10000 characters`)
    }

    if (row.image_url && !isValidUrl(row.image_url)) {
        errors.push(`Row ${rowNumber}: Invalid image URL format`)
    }

    if (row.scheduled_time && !isValidDate(row.scheduled_time)) {
        errors.push(`Row ${rowNumber}: Invalid scheduled_time format. Use ISO 8601 format (e.g., 2026-01-15T10:00:00Z)`)
    }

    return errors
}

export const csvRowToPost = (row: CsvRow): PostCreateBase | null => {
    const comments = row.comments
        ? row.comments.split(';').map(c => c.trim()).filter(c => c !== '')
        : []

    const mediaAssets = row.image_url && row.image_url.trim() !== ''
        ? [row.image_url.trim()]
        : []

    const scheduledAt = row.scheduled_time && isValidDate(row.scheduled_time)
        ? new Date(row.scheduled_time)
        : undefined

    return {
        businessId: '',
        content: row.content.trim(),
        mediaAssets,
        targetPlatforms: [],
        scheduledAt: scheduledAt ?? null,
        status: 'pending',
        comment: comments,
        platformContent: {},
        platformSettings: {},
        postFormat: 'post'
    }
}

const isValidUrl = (url: string): boolean => {
    try {
        new URL(url)
        return true
    } catch {
        return false
    }
}

const isValidDate = (dateString: string): boolean => {
    const date = new Date(dateString)
    return !isNaN(date.getTime())
}

export const convertCsvToString = (data: any[]): string => {
    return Papa.unparse(data)
}
