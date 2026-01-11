import { describe, it, expect } from 'vitest'
import {
    distributePostsAcrossDates,
    generateTimeSlots,
    calculateTotalDays,
    isWeekend,
    addDays,
    estimatePostsPerDay
} from '../dateDistribution'

describe('dateDistribution', () => {
    describe('isWeekend', () => {
        it('should identify Saturday as weekend', () => {
            const saturday = new Date('2026-01-10T12:00:00Z')
            expect(isWeekend(saturday)).toBe(true)
        })

        it('should identify Sunday as weekend', () => {
            const sunday = new Date('2026-01-11T12:00:00Z')
            expect(isWeekend(sunday)).toBe(true)
        })

        it('should identify Monday as not weekend', () => {
            const monday = new Date('2026-01-12T12:00:00Z')
            expect(isWeekend(monday)).toBe(false)
        })
    })

    describe('addDays', () => {
        it('should add days correctly', () => {
            const date = new Date('2026-01-12T12:00:00Z')
            const result = addDays(date, 5)
            expect(result.getDate()).toBe(17)
        })

        it('should handle month boundaries', () => {
            const date = new Date('2026-01-30T12:00:00Z')
            const result = addDays(date, 5)
            expect(result.getMonth()).toBe(1)
            expect(result.getDate()).toBe(4)
        })
    })

    describe('calculateTotalDays', () => {
        it('should calculate total days without skipping weekends', () => {
            const start = new Date('2026-01-12T00:00:00Z')
            const end = new Date('2026-01-18T00:00:00Z')
            const total = calculateTotalDays(start, end, false)
            expect(total).toBe(7)
        })

        it('should calculate total days skipping weekends', () => {
            const start = new Date('2026-01-12T00:00:00Z')
            const end = new Date('2026-01-18T00:00:00Z')
            const total = calculateTotalDays(start, end, true)
            expect(total).toBe(5)
        })
    })

    describe('generateTimeSlots', () => {
        it('should generate time slots within business hours', () => {
            const baseDate = new Date('2026-01-12T00:00:00Z')
            const slots = generateTimeSlots(baseDate, 3, {
                businessHoursOnly: true,
                startHour: 9,
                endHour: 17
            })

            expect(slots).toHaveLength(3)
            slots.forEach(slot => {
                expect(slot.getHours()).toBeGreaterThanOrEqual(9)
                expect(slot.getHours()).toBeLessThanOrEqual(17)
            })
        })

        it('should generate time slots throughout the day', () => {
            const baseDate = new Date('2026-01-12T00:00:00Z')
            const slots = generateTimeSlots(baseDate, 5, {
                businessHoursOnly: false
            })

            expect(slots).toHaveLength(5)
        })

        it('should space slots evenly', () => {
            const baseDate = new Date('2026-01-12T00:00:00Z')
            const slots = generateTimeSlots(baseDate, 2, {
                businessHoursOnly: true,
                startHour: 9,
                endHour: 17
            })

            expect(slots[0].getHours()).toBeLessThan(slots[1].getHours())
        })
    })

    describe('distributePostsAcrossDates', () => {
        it('should distribute posts across date range', () => {
            const start = new Date('2026-01-12T00:00:00Z')
            const end = new Date('2026-01-15T23:59:59Z')
            const result = distributePostsAcrossDates(10, {
                startDate: start,
                endDate: end,
                postsPerDay: 3
            })

            expect(result).toHaveLength(10)
            expect(result[0].index).toBe(0)
            expect(result[9].index).toBe(9)
        })

        it('should skip weekends when configured', () => {
            const start = new Date('2026-01-09T00:00:00Z')
            const end = new Date('2026-01-13T23:59:59Z')
            const result = distributePostsAcrossDates(6, {
                startDate: start,
                endDate: end,
                postsPerDay: 2,
                skipWeekends: true
            })

            result.forEach(dist => {
                expect(isWeekend(dist.date)).toBe(false)
            })
        })

        it('should respect business hours when configured', () => {
            const start = new Date('2026-01-12T00:00:00Z')
            const end = new Date('2026-01-13T23:59:59Z')
            const result = distributePostsAcrossDates(4, {
                startDate: start,
                endDate: end,
                postsPerDay: 2,
                businessHoursOnly: true,
                startHour: 9,
                endHour: 17
            })

            result.forEach(dist => {
                expect(dist.date.getHours()).toBeGreaterThanOrEqual(9)
                expect(dist.date.getHours()).toBeLessThanOrEqual(17)
            })
        })
    })

    describe('estimatePostsPerDay', () => {
        it('should calculate posts per day', () => {
            const start = new Date('2026-01-12T00:00:00Z')
            const end = new Date('2026-01-16T23:59:59Z')
            const estimate = estimatePostsPerDay(10, start, end, false)
            expect(estimate).toBe(2)
        })

        it('should return 1 for zero days', () => {
            const start = new Date('2026-01-12T00:00:00Z')
            const end = new Date('2026-01-11T00:00:00Z')
            const estimate = estimatePostsPerDay(10, start, end, false)
            expect(estimate).toBe(1)
        })
    })
})
