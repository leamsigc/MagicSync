import type { InjectionKey } from 'vue'
import type { InformationSchemaBusinessResponse } from '#layers/BaseShared/server/types/information-schema';

export interface BusinessFormState {
  businessDetails: Partial<{
    name: string
    description: string
    phone: string
    address: string
    website: string
    category: string
  }>
  companyInformation: string
  brandDetails: string
}

/** Render the extracted target audience as a Markdown section */
function renderTargetAudienceSection(
  audience: NonNullable<InformationSchemaBusinessResponse['targetAudience']>
): string {
  const lines: string[] = ['', '## Target Audience', '']

  if (audience.primarySegment) {
    lines.push(`**Primary segment:** ${audience.primarySegment}`, '')
  }

  const demographics = audience.demographics as Record<string, unknown> | undefined
  if (demographics && Object.keys(demographics).length) {
    lines.push('### Demographics', '')
    for (const [key, value] of Object.entries(demographics)) {
      if (value == null || value === '') continue
      lines.push(`- **${key.replace(/([A-Z])/g, ' $1').toLowerCase()}:** ${value}`)
    }
    lines.push('')
  }

  const listFields: Array<[string, unknown]> = [
    ['Pain Points', audience.painPoints],
    ['Motivations', audience.motivations],
    ['Buying Triggers', audience.buyingTriggers],
    ['Preferred Platforms', audience.preferredPlatforms],
    ['Content Preferences', audience.contentPreferences]
  ]

  for (const [title, value] of listFields) {
    if (Array.isArray(value) && value.length) {
      lines.push(`### ${title}`, '', ...value.map((item) => `- ${item}`), '')
    }
  }

  if (Array.isArray(audience.secondarySegments) && audience.secondarySegments.length) {
    lines.push('### Secondary Segments', '')
    for (const segment of audience.secondarySegments) {
      lines.push(`- **${segment.name}**${segment.description ? ` — ${segment.description}` : ''}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

export interface BusinessFormActions {
  updateBusinessDetails: (details: Partial<BusinessFormState['businessDetails']>) => void
  updateCompanyInformation: (content: string) => void
  updateBrandDetails: (content: string) => void
  resetForm: (response: InformationSchemaBusinessResponse) => void
  getFormData: () => BusinessFormState
}

export const BusinessFormProviderKey: InjectionKey<{
  state: BusinessFormState
  actions: BusinessFormActions
}> = Symbol('BusinessFormProvider')

export function useBusinessFormProvider() {
  const state = reactive<BusinessFormState>({
    businessDetails: {},
    companyInformation: '',
    brandDetails: '{}'
  })

  const actions: BusinessFormActions = {
    updateBusinessDetails(details) {
      Object.assign(state.businessDetails, details)
    },

    updateCompanyInformation(content) {
      state.companyInformation = content
    },

    updateBrandDetails(content) {
      state.brandDetails = content
    },

    resetForm(response: InformationSchemaBusinessResponse) {
      // Initialize with extracted data
      state.businessDetails = {
        name: response.businessProfile?.name || '',
        description: response.businessProfile?.description || '',
        phone: response.businessProfile?.phone || '',
        address: response.businessProfile?.address || '',
        website: response.businessProfile?.website || '',
        category: response.businessProfile?.category || ''
      }
      const audienceSection = response.targetAudience
        ? renderTargetAudienceSection(response.targetAudience)
        : ''
      state.companyInformation = `${response.companyInformation || ''}${audienceSection}`
      state.brandDetails = JSON.stringify(response.brandDetails || {}, null, 2)
    },

    getFormData() {
      return { ...state }
    }
  }

  return {
    state,
    actions
  }
}
