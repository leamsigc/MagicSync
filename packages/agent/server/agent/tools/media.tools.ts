import { readFile } from 'node:fs/promises'
import { defineTool, type ToolDefinition } from '@flue/runtime'
import * as v from 'valibot'
import { validatePublicSiteUrl } from '#layers/BaseDB/server/utils/url-allowlist'
import { downloadVideo } from '../../utils/ytdlp'
import type { AgentToolContext } from '../tool-context'
import { toolFailure, toolResult } from './tool-result'

const toolError = (code: string | undefined, message: string): never => toolFailure(code, message, 'MEDIA_ERROR')

/** Persist the downloaded file in the business asset library. */
async function storeDownload(ctx: AgentToolContext, download: { filePath: string, bytes: number, id: string }) {
  const { assetService } = await import('#layers/BaseShared/server/services/asset.service')
  const buffer = await readFile(download.filePath)
  const stored = await assetService.createFromBase64(ctx.userId, {
    data: buffer.toString('base64'),
    mimeType: 'video/mp4',
    businessId: ctx.businessId,
    originalName: `${download.id}.mp4`,
  })
  if (!stored.success) toolError(stored.code, stored.error)
  return {
    assetId: stored.success ? stored.data.id : null,
    bytes: download.bytes,
    url: stored.success ? stored.data.url : null,
  }
}

async function loadAssets() {
  const { assetService } = await import('#layers/BaseShared/server/services/asset.service')
  return assetService
}

/** List the business asset library, optionally filtered by mime prefix. */
async function listBusinessAssets(ctx: AgentToolContext, limit: number, prefix: string | undefined) {
  const assetService = await loadAssets()
  const result = await assetService.findByBusinessId(ctx.businessId, ctx.userId, {
    pagination: { page: 1, limit },
  })
  if (!result.success) toolError(result.error, 'Failed to list assets')
  const normalized = prefix?.toLowerCase()
  return (result.data ?? [])
    .filter(asset => !normalized || asset.mimeType.toLowerCase().startsWith(normalized))
    .map(asset => ({
      id: asset.id,
      name: asset.originalName || asset.filename,
      mimeType: asset.mimeType,
      size: asset.size,
      url: asset.url,
    }))
}

/** Delete one asset, refusing anything outside the active business. */
async function deleteBusinessAsset(ctx: AgentToolContext, assetId: string) {
  const assetService = await loadAssets()
  const found = await assetService.findById(assetId, ctx.userId)
  if (!found.success || !found.data) toolError(found.code, found.error ?? 'Asset not found')
  if (found.data.businessId !== ctx.businessId) {
    toolError('FORBIDDEN', 'Asset does not belong to this business')
  }
  const deleted = await assetService.delete(assetId, ctx.userId)
  if (!deleted.success) toolError(deleted.code, deleted.error)
  return { deleted: true, assetId }
}

/**
 * `download_video` for one run. The pi `onUpdate` progress callback becomes
 * Flue's `toolCtx.log` — progress lines are streamed into the conversation as
 * `log` events and never reach the model, so the two stages stay invisible to
 * the prompt.
 */
export function createMediaTools(ctx: AgentToolContext): ToolDefinition[] {
  return [
    defineTool({
      name: 'download_video',
      description: 'Download a video from a safe public URL into the business asset library.',
      input: v.object({
        url: v.pipe(v.string(), v.description('Public http(s) video URL')),
        itemId: v.optional(v.pipe(v.string(), v.description('Content card id the video belongs to'))),
      }),
      run: async (toolCtx) => {
        const { url, itemId } = toolCtx.data
        // validatePublicSiteUrl returns an error string when the URL is
        // rejected and null when it passes.
        const rejection = await validatePublicSiteUrl(url)
        if (rejection) toolError('SSRF_BLOCKED', 'URL is not allowed')

        toolCtx.log.info(JSON.stringify({ stage: 'downloading' }))

        let download: Awaited<ReturnType<typeof downloadVideo>> | null = null
        try {
          download = await downloadVideo(url.trim())
          toolCtx.log.info(JSON.stringify({ stage: 'storing' }))
          const stored = await storeDownload(ctx, download)
          return toolResult({ ...stored, itemId: itemId ?? null })
        }
        finally {
          await download?.cleanup()
        }
      },
    }),
    defineTool({
      name: 'list_media',
      description: 'List the business asset library (images, videos, documents).',
      input: v.object({
        mimeType: v.optional(v.pipe(v.string(), v.description('Filter by mime prefix, e.g. image or video'))),
        limit: v.optional(v.pipe(v.number(), v.description('Max assets (default 20, max 50)'))),
      }),
      run: async (toolCtx) => {
        const limit = Math.min(Math.max(toolCtx.data.limit ?? 20, 1), 50)
        const assets = await listBusinessAssets(ctx, limit, toolCtx.data.mimeType)
        return toolResult({ assets })
      },
    }),
    defineTool({
      name: 'delete_media',
      description: 'Delete one asset from the business library by id. This cannot be undone.',
      input: v.object({
        assetId: v.pipe(v.string(), v.description('Asset id to delete')),
      }),
      run: async toolCtx => toolResult(await deleteBusinessAsset(ctx, toolCtx.data.assetId)),
    }),
  ]
}
