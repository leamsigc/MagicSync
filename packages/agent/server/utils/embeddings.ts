import { embedMany } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import type { RequestLogger } from 'evlog'
import type { ServiceResponse } from '#layers/BaseShared/server/types/service.types'
import { captureEmbedUsage } from '#layers/BaseShared/server/utils/evlog'
import { userLlmConfigService } from '#layers/BaseDB/server/services/user-llm-config.service'
import type { AgentEmbedder } from '../agent/tool-context'

/** Embeddings for RAG, built from the per-business provider config. */
export async function resolveEmbedder(userId: string, businessId: string, opts?: { log?: RequestLogger }): Promise<ServiceResponse<AgentEmbedder>> {
  const llm = await userLlmConfigService.getEffectiveConfig(userId, businessId)
  const provider = llm.data?.provider ?? 'openai'
  const apiKey = llm.data?.apiKey ?? process.env.OPENAI_API_KEY ?? process.env.NUXT_OPENAI_API_KEY
  if (!apiKey) {
    return { success: false, error: 'No embedding provider key configured', code: 'EMBEDDING_NOT_CONFIGURED' }
  }

  const modelId = provider === 'google' ? 'text-embedding-004' : 'text-embedding-3-small'
  const model = provider === 'google'
    ? createGoogleGenerativeAI({ apiKey }).textEmbeddingModel('text-embedding-004')
    : provider === 'openai'
      ? createOpenAI({ apiKey }).textEmbeddingModel('text-embedding-3-small')
      : null
  if (!model) {
    return { success: false, error: `Embeddings are not supported for provider ${provider}`, code: 'EMBEDDING_PROVIDER_UNSUPPORTED' }
  }

  return {
    success: true,
    data: async (texts) => {
      const { embeddings, usage } = await embedMany({ model, values: texts })
      captureEmbedUsage(opts?.log, {
        tokens: usage.tokens,
        model: modelId,
        dimensions: embeddings[0]?.length,
        count: texts.length,
      })
      return embeddings
    },
  }
}

export type { AgentEmbedder }
