import { z } from 'zod'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { accessErrorStatus, requireBusinessAccess } from '#layers/BaseDB/server/utils/business-access'
import { featureDetail, listFeatures, type FeatureSummary } from '../../../mcp/utils/tool-registry'

const FeaturesQuerySchema = z.object({
  businessId: z.string().min(1),
  /** Return the full field list for one feature. */
  feature: z.string().min(1).max(120).optional(),
  /** Narrow the list to one MCP group (posts, media, image-editor, ...). */
  group: z.string().min(1).max(80).optional(),
  /** Case-insensitive name/description search. */
  query: z.string().min(1).max(200).optional(),
})

interface FeatureGroup {
  name: string
  features: FeatureSummary[]
}

function matches(feature: FeatureSummary, group?: string, query?: string): boolean {
  if (group && feature.group !== group) return false
  if (!query) return true
  const needle = query.toLowerCase()
  return feature.name.includes(needle) || feature.description.toLowerCase().includes(needle)
}

function groupFeatures(features: FeatureSummary[]): FeatureGroup[] {
  const groups = new Map<string, FeatureSummary[]>()
  for (const feature of features) {
    const list = groups.get(feature.group) ?? []
    list.push(feature)
    groups.set(feature.group, list)
  }
  return [...groups.entries()]
    .map(([name, entries]) => ({ name, features: entries }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * The chat feature catalog: every MCP tool the session can operate, grouped and
 * searchable. `feature=<name>` returns the validated field list so the model can
 * call `use_feature` with the right arguments.
 */
export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const query = FeaturesQuerySchema.parse(getQuery(event))

  const access = await requireBusinessAccess(event, user.id, query.businessId)
  if (!access.success) {
    throw createError({ statusCode: accessErrorStatus(access.code), statusMessage: access.error })
  }

  if (query.feature) {
    const detail = featureDetail(query.feature)
    if (!detail) {
      throw createError({ statusCode: 404, statusMessage: `Unknown feature: ${query.feature}` })
    }
    return { total: 1, feature: detail, groups: groupFeatures([detail]) }
  }

  const features = listFeatures().filter(feature => matches(feature, query.group, query.query))
  return { total: features.length, groups: groupFeatures(features) }
})
