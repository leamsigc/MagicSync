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

// Optimal posting times for social media engagement
const OPTIMAL_POSTING_HOURS = [9, 12, 15, 18, 21]

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

  if (count === 1) {
    // For single post, use optimal time
    const optimalHour = OPTIMAL_POSTING_HOURS[Math.floor(Math.random() * OPTIMAL_POSTING_HOURS.length)] || startHour
    const slotDate = new Date(baseDate)
    slotDate.setHours(optimalHour, 0, 0, 0)
    slots.push(slotDate)
    return slots
  }

  // For multiple posts, distribute across optimal times
  const availableHours = businessHoursOnly
    ? OPTIMAL_POSTING_HOURS.filter(h => h >= startHour && h <= endHour)
    : OPTIMAL_POSTING_HOURS

  for (let i = 0; i < count; i++) {
    const hourIndex = i % availableHours.length
    const hour = availableHours[hourIndex] || startHour
    const minute = Math.floor(Math.random() * 60) // Random minute within the hour

    const slotDate = new Date(baseDate)
    slotDate.setHours(hour, minute, 0, 0)

    slots.push(slotDate)
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
