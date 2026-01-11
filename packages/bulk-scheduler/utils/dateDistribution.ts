export type DateDistributionOptions = {
    startDate: Date
    endDate: Date
    postsPerDay: number
    skipWeekends?: boolean
    businessHoursOnly?: boolean
    startHour?: number
    endHour?: number
}

export type DistributedDate = {
    date: Date
    index: number
}

export const distributePostsAcrossDates = (
    totalPosts: number,
    options: DateDistributionOptions
): DistributedDate[] => {
    const {
        startDate,
        endDate,
        postsPerDay,
        skipWeekends = false,
        businessHoursOnly = false,
        startHour = 9,
        endHour = 17
    } = options

    const dates: DistributedDate[] = []
    let currentDate = new Date(startDate)
    let postIndex = 0

    while (postIndex < totalPosts && currentDate <= endDate) {
        if (skipWeekends && isWeekend(currentDate)) {
            currentDate = addDays(currentDate, 1)
            continue
        }

        const postsForDay = Math.min(postsPerDay, totalPosts - postIndex)
        const timeSlots = generateTimeSlots(currentDate, postsForDay, {
            businessHoursOnly,
            startHour,
            endHour
        })

        timeSlots.forEach((time) => {
            if (postIndex < totalPosts) {
                dates.push({
                    date: time,
                    index: postIndex
                })
                postIndex++
            }
        })

        currentDate = addDays(currentDate, 1)
    }

    return dates
}

export const generateTimeSlots = (
    baseDate: Date,
    count: number,
    options: {
        businessHoursOnly?: boolean
        startHour?: number
        endHour?: number
    }
): Date[] => {
    const { businessHoursOnly = false, startHour = 9, endHour = 17 } = options
    const slots: Date[] = []

    const minHour = businessHoursOnly ? startHour : 0
    const maxHour = businessHoursOnly ? endHour : 23

    const availableHours = maxHour - minHour
    const intervalMinutes = Math.floor((availableHours * 60) / count)

    for (let i = 0; i < count; i++) {
        const minutesFromStart = i * intervalMinutes
        const hour = minHour + Math.floor(minutesFromStart / 60)
        const minute = minutesFromStart % 60

        const slotDate = new Date(baseDate)
        slotDate.setHours(hour, minute, 0, 0)

        if (slotDate.getHours() <= maxHour) {
            slots.push(slotDate)
        }
    }

    return slots
}

export const calculateTotalDays = (startDate: Date, endDate: Date, skipWeekends = false): number => {
    let count = 0
    let currentDate = new Date(startDate)

    while (currentDate <= endDate) {
        if (!skipWeekends || !isWeekend(currentDate)) {
            count++
        }
        currentDate = addDays(currentDate, 1)
    }

    return count
}

export const isWeekend = (date: Date): boolean => {
    const day = date.getDay()
    return day === 0 || day === 6
}

export const addDays = (date: Date, days: number): Date => {
    const result = new Date(date)
    result.setDate(result.getDate() + days)
    return result
}

export const estimatePostsPerDay = (totalPosts: number, startDate: Date, endDate: Date, skipWeekends = false): number => {
    const totalDays = calculateTotalDays(startDate, endDate, skipWeekends)
    return totalDays > 0 ? Math.ceil(totalPosts / totalDays) : 1
}
