import type { PostCreateBase } from '#layers/BaseDB/db/schema'
import type { CsvRow } from './csvParser'

export type ValidationError = {
    field: string
    message: string
    row?: number
}

export const validateBulkPosts = (posts: PostCreateBase[]): ValidationError[] => {
    const errors: ValidationError[] = []

    posts.forEach((post, index) => {
        const postErrors = validateSinglePost(post, index + 1)
        errors.push(...postErrors)
    })

    return errors
}

export const validateSinglePost = (post: PostCreateBase, rowNumber?: number): ValidationError[] => {
    const errors: ValidationError[] = []

    if (!post.content || post.content.trim() === '') {
        errors.push({
            field: 'content',
            message: 'Content is required',
            row: rowNumber
        })
    }

    if (post.content && post.content.length > 10000) {
        errors.push({
            field: 'content',
            message: 'Content exceeds maximum length of 10000 characters',
            row: rowNumber
        })
    }

    if (!post.targetPlatforms || post.targetPlatforms.length === 0) {
        errors.push({
            field: 'targetPlatforms',
            message: 'At least one target platform is required',
            row: rowNumber
        })
    }

    if (!post.businessId || post.businessId.trim() === '') {
        errors.push({
            field: 'businessId',
            message: 'Business ID is required',
            row: rowNumber
        })
    }

    if (post.scheduledAt && !(post.scheduledAt instanceof Date)) {
        errors.push({
            field: 'scheduledAt',
            message: 'Scheduled date must be a valid Date object',
            row: rowNumber
        })
    }

    if (post.scheduledAt && post.scheduledAt < new Date()) {
        errors.push({
            field: 'scheduledAt',
            message: 'Scheduled date cannot be in the past',
            row: rowNumber
        })
    }

    return errors
}

export const validateDateRange = (startDate: Date, endDate: Date): ValidationError[] => {
    const errors: ValidationError[] = []

    if (!(startDate instanceof Date) || isNaN(startDate.getTime())) {
        errors.push({
            field: 'startDate',
            message: 'Start date must be a valid date'
        })
    }

    if (!(endDate instanceof Date) || isNaN(endDate.getTime())) {
        errors.push({
            field: 'endDate',
            message: 'End date must be a valid date'
        })
    }

    if (startDate >= endDate) {
        errors.push({
            field: 'dateRange',
            message: 'End date must be after start date'
        })
    }

    if (startDate < new Date()) {
        errors.push({
            field: 'startDate',
            message: 'Start date cannot be in the past'
        })
    }

    return errors
}

export const validatePlatformCompatibility = (
    content: string,
    platforms: string[]
): ValidationError[] => {
    const errors: ValidationError[] = []

    const platformLimits: Record<string, number> = {
        twitter: 280,
        instagram: 2200,
        facebook: 63206,
        linkedin: 3000,
        tiktok: 2200,
        youtube: 5000
    }

    platforms.forEach(platform => {
        const limit = platformLimits[platform.toLowerCase()]
        if (limit && content.length > limit) {
            errors.push({
                field: 'content',
                message: `Content exceeds ${platform} character limit of ${limit}`
            })
        }
    })

    return errors
}

export const validateCsvData = (data: CsvRow[]): ValidationError[] => {
    const errors: ValidationError[] = []

    if (!data || data.length === 0) {
        errors.push({
            field: 'csv',
            message: 'CSV file is empty or could not be parsed'
        })
        return errors
    }

    data.forEach((row, index) => {
        if (!row.content || row.content.trim() === '') {
            errors.push({
                field: 'content',
                message: 'Content is required',
                row: index + 1
            })
        }
    })

    return errors
}
