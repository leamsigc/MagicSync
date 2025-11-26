import { z } from 'zod'
import { auth } from '#layers/BaseAuth/lib/auth'
import { authClient } from '#layers/BaseAuth/lib/auth-client';

const updateProfileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email('Invalid email address'),
  image: z.string().url().optional().or(z.literal(''))
})

export default defineEventHandler(async (event) => {
  try {
    // Get user from session
    const user = await checkUserIsLogin(event)

    // Parse and validate the request body
    const body = await readBody(event)
    const validatedData = updateProfileSchema.parse(body)

    // Update user profile using Better Auth
    await authClient.updateUser({
      name: validatedData.name,
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      image: validatedData.image
    })

    return {
      success: true,
      message: 'Profile updated successfully'
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Validation Error',
        data: error.issues
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to update profile'
    })
  }
})
