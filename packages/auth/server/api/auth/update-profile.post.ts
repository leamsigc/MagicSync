import { z } from 'zod'
import { auth } from '#layers/BaseAuth/lib/auth'

const updateProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  firstName: z.string().max(80).optional(),
  lastName: z.string().max(80).optional(),
  // Accepted for payload compatibility but never applied here — changing an
  // email requires re-verification and is a separate flow. Previously this was
  // validated and silently ignored, so users believed it had changed.
  email: z.string().email().optional(),
  image: z.string()
    .max(2048)
    .refine(
      value => value === '' || value.startsWith('https://') || value.startsWith('/'),
      'Image must be an https URL or a local path',
    )
    .optional(),
})

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    // Get user from session
    const user = await checkUserIsLogin(event)
    log.set({ userId: user.id })

    // Parse and validate the request body
    const body = await readBody(event)
    const validatedData = updateProfileSchema.parse(body)

    log.set({ action: 'update_profile', email: validatedData.email })

    // Update through the server API with the caller's headers — a client SDK
    // call from the server has no session and would act anonymously.
    await auth.api.updateUser({
      body: {
        name: validatedData.name,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        image: validatedData.image || undefined,
      },
      headers: getRequestHeaders(event),
    })

    log.info({ content: 'Profile updated successfully', success: true })

    return {
      success: true,
      message: 'Profile updated successfully'
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    log.error({ content: 'Failed to update profile', error: msg })

    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Validation Error',
        data: error.issues
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update profile'
    })
  }
})
