import { z } from 'zod'

const bodySchema = z.object({
    topic: z.string().min(1, 'Topic is required'),
    hookName: z.string().min(1, 'Hook name is required'),
    hooks: z.array(z.object({ name: z.string(), template: z.string() })),
    script: z.string().min(1, 'Script is required'),
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

    const { topic, hookName, hooks, script } = parsed.data
    const service = useGrowthStrategyService()

    return service.checkHookHealth({ topic, hookName, hooks, script })
})
