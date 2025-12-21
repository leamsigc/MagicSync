import { socialMediaAccountService } from "#layers/BaseDB/server/services/social-media-account.service"


export default defineEventHandler(async (event) => {
  try {
    // Get user from session
    const user = await checkUserIsLogin(event)

    const accountId = getRouterParam(event, 'id')

    if (!accountId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Account ID is required'
      })
    }

    // Get the account to verify ownership
    const account = await socialMediaAccountService.getAccountById(accountId)

    if (!account) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Social media account not found'
      })
    }

    // Verify user owns this account
    if (account.userId !== user.id) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Access denied'
      })
    }

    // Delete the account (hard delete)
    const deleted = await socialMediaAccountService.deleteAccount(accountId)

    if (!deleted) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to delete social media account'
      })
    }

    return {
      success: true,
      message: 'Social media account disconnected successfully'
    }
  } catch (error) {
    console.error('Error deleting social media account:', error)

    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to disconnect social media account'
    })
  }
})
