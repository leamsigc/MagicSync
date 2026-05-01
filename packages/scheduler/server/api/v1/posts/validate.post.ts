import { socialMediaAccountService } from "#layers/BaseDB/server/services/social-media-account.service"
import type { PostContent } from "#layers/BaseDB/server/services/types"

interface ValidationResult {
  isValid: boolean;
  warnings?: string[];
  errors?: string[];
}

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    // Get user from session
    const session = await getUserSessionFromEvent(event)

    // Get request body
    const body = await readBody(event)

    if (!body.content) {
      log.set({ validationError: true, message: 'Content is required for validation' })
      throw createError({
        statusCode: 400,
        statusMessage: 'Content is required for validation'
      })
    }

    if (!body.platforms && !body.socialAccountIds) {
      log.set({ validationError: true, message: 'Either platforms or socialAccountIds must be provided' })
      throw createError({
        statusCode: 400,
        statusMessage: 'Either platforms or socialAccountIds must be provided'
      })
    }

    log.set({ 
      userId: session?.user?.id, 
      platforms: body.platforms, 
      socialAccountIds: body.socialAccountIds,
      contentLength: body.content?.length 
    })
    // Prepare content for validation
    const content: PostContent = {
      text: body.content,
      mediaUrls: body.mediaUrls || []
    }

    let validationResults: Record<string, ValidationResult & { platform?: string, accountName?: string }> = {}

    if (body.platforms) {
      // Validate against specific platforms
      for (const platform of body.platforms) {
        const validation = validateContentForPlatform(platform, content)
        validationResults[platform] = validation
      }
    }

    if (body.socialAccountIds) {
      // Get social accounts and validate against their platforms
      const accounts = await Promise.all(
        body.socialAccountIds.map((id: string) =>
          socialMediaAccountService.getAccountById(id)
        )
      )

      const platforms = accounts
        .filter(account => account !== null)
        .map(account => account!.platform)

      // Validate cross-platform content
      const crossPlatformValidation = validateCrossPlatformContent(content, platforms)

      for (let i = 0; i < accounts.length; i++) {
        const account = accounts[i]
        if (account) {
          const validation = validateContentForPlatform(account.platform, content)
          validationResults[body.socialAccountIds[i]] = {
            ...validation,
            platform: account.platform,
            accountName: account.accountName
          }
        }
      }

      validationResults._crossPlatform = crossPlatformValidation
    }

    // Calculate overall validation status
    const allValidations = Object.values(validationResults).filter(v => v.isValid !== undefined)
    const overallValid = allValidations.every((v: any) => v.isValid)
    const hasWarnings = allValidations.some((v: any) => v.warnings && v.warnings.length > 0)

    log.set({ success: true, overallValid, hasWarnings })
    return {
      success: true,
      data: {
        isValid: overallValid,
        hasWarnings,
        validations: validationResults,
        summary: {
          totalPlatforms: allValidations.length,
          validPlatforms: allValidations.filter((v: any) => v.isValid).length,
          invalidPlatforms: allValidations.filter((v: any) => !v.isValid).length
        }
      }
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    log.error({ content: 'Validate post error', error: String(error) })
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})

function validateContentForPlatform(platform: any, content: PostContent): ValidationResult {
  // This is a placeholder. Real implementation would validate content against platform rules.
  return { isValid: true, warnings: [], errors: [] }
}

function validateCrossPlatformContent(content: PostContent, platforms: any[]): ValidationResult {
  // This is a placeholder. Real implementation would validate content across platforms.
  return { isValid: true, warnings: [], errors: [] }
}
