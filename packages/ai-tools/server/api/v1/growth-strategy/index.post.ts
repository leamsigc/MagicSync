import { z } from 'zod'

const bodySchema = z.object({
    topic: z.string().min(1),
    script: z.string().min(1),
    hook: z.string().min(1),
    ideas: z.string().optional().default(''),
})

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const parsed = bodySchema.safeParse(body)

    if (!parsed.success) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Validation Error',
            data: parsed.error.flatten().fieldErrors,
        })
    }

    return { success: true, message: 'Draft saved successfully.' }
})
