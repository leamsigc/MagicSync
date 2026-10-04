// Shared types for business information extraction
// Originally defined in scheduler/server/api/v1/ai/information/index.post.ts
// Extracted here so connect, auth, and other layers can import without scheduler dependency.

export interface TargetAudience {
  primarySegment?: string
  demographics?: Record<string, unknown>
  psychographics?: Record<string, unknown>
  painPoints?: string[]
  motivations?: string[]
  buyingTriggers?: string[]
  preferredPlatforms?: string[]
  contentPreferences?: string[]
  secondarySegments?: Array<{ name: string; description?: string }>
  [key: string]: unknown
}

export interface InformationSchemaBusinessCore {
  businessProfile: {
    name: string
    description?: string
    address?: string
    phone?: string
    website?: string
    category?: string
  }
  companyInformation: string
  targetAudience?: TargetAudience
}

export interface InformationSchemaBusinessCompetitive {
  competitors: Array<{
    name: string
    description: string
    strengths: string[]
    weaknesses: string[]
    positioning: string
  }>
  marketPosition: string
  uniqueSellingPoints: string[]
}

export interface InformationSchemaBusinessContent {
  contentStrategy: string
  messagingFramework: string
  contentPillars: string[]
  toneOfVoice: Record<string, unknown>
}

export interface InformationSchemaBusinessResponse {
  businessCore: InformationSchemaBusinessCore
  brandDetails: Record<string, unknown>
  competitive: InformationSchemaBusinessCompetitive
  contentStrategy: InformationSchemaBusinessContent
  notes?: string
  confidence?: number
}

// Matches actual usage: parsed.type === 'complete' | 'error', parsed.message for errors
export interface InformationExtractionEvent {
  type: 'start' | 'progress' | 'complete' | 'error'
  progress?: number
  data?: InformationSchemaBusinessResponse
  message?: string
}
