import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * The one place asset bytes are written. `AssetService.storeBuffer` is the funnel
 * every asset-creation path already runs through (direct upload, URL import,
 * base64 inline image, CLI post media, MCP upload), so putting the seam here
 * reaches every call site without touching one of them.
 *
 * `key` is an object key of the shape `userFiles/<userId>/<filename>`. Local storage
 * maps that layout straight onto `upload/files/userFiles/<userId>/<filename>`, which
 * is the byte-identical path the local driver has always written.
 */
export interface AssetBlobStore {
  put(key: string, body: Buffer, contentType: string): Promise<{ url: string }>
  get(key: string): Promise<Buffer>
}

export const ASSET_KEY_PREFIX = 'userFiles'

const FILE_STORAGE_MOUNT = process.env.NUXT_FILE_STORAGE_MOUNT || './upload/files'
const SERVE_URL_PREFIX = '/api/v1/assets/serve/'

/** The single source of truth for the object-key shape both drivers agree on. */
export function assetBlobKey(userId: string, filename: string): string {
  return `${ASSET_KEY_PREFIX}/${userId}/${filename}`
}

function splitKey(key: string): { userId: string; filename: string } {
  const [prefix, userId, filename] = key.split('/')
  if (prefix !== ASSET_KEY_PREFIX || !userId || !filename) {
    throw new Error(`Malformed asset blob key: ${key}`)
  }
  return { userId, filename }
}

class LocalAssetBlobStore implements AssetBlobStore {
  private dir(userId: string): string {
    return join(process.cwd(), FILE_STORAGE_MOUNT, ASSET_KEY_PREFIX, userId)
  }

  async put(key: string, body: Buffer): Promise<{ url: string }> {
    const { userId, filename } = splitKey(key)
    const dir = this.dir(userId)
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, filename), body)
    return { url: `${SERVE_URL_PREFIX}${filename}` }
  }

  async get(key: string): Promise<Buffer> {
    const { userId, filename } = splitKey(key)
    return readFile(join(this.dir(userId), filename))
  }
}

type S3Config = {
  driver: 's3'
  endpoint: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  publicBaseUrl?: string
}

type AssetStorageConfig = { driver: 'local' } | S3Config

const S3_SDK_MODULE = '@aws-sdk/client-s3'

/**
 * One adapter for AWS S3, Cloudflare R2, MinIO and Backblaze B2 — they share the S3
 * REST API, so `forcePathStyle` plus an explicit endpoint reaches all four.
 *
 * The SDK is imported behind a variable specifier with `@vite-ignore` so the local
 * driver never loads it and the bundler never has to resolve it. Add
 * `@aws-sdk/client-s3` to `packages/shared/package.json` before using this driver.
 */
class S3AssetBlobStore implements AssetBlobStore {
  private client: { send(command: unknown): Promise<unknown> } | null = null

  constructor(private config: S3Config) {}

  private async s3Client() {
    const existing = this.client
    if (existing) return existing
    const { S3Client } = await import(/* @vite-ignore */ S3_SDK_MODULE)
    const created = new S3Client({
      endpoint: this.config.endpoint,
      region: this.config.region,
      forcePathStyle: true,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
    })
    this.client = created
    return created
  }

  publicUrl(key: string): string {
    const base = this.config.publicBaseUrl
      ?? `${this.config.endpoint.replace(/\/$/, '')}/${this.config.bucket}`
    return `${base.replace(/\/$/, '')}/${key}`
  }

  async put(key: string, body: Buffer, contentType: string): Promise<{ url: string }> {
    const sdk = await import(/* @vite-ignore */ S3_SDK_MODULE)
    const client = await this.s3Client()
    await client.send(new sdk.PutObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }))
    return { url: this.publicUrl(key) }
  }

  async get(key: string): Promise<Buffer> {
    const sdk = await import(/* @vite-ignore */ S3_SDK_MODULE)
    const client = await this.s3Client()
    const result = await client.send(new sdk.GetObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
    })) as { Body?: { transformToByteArray(): Promise<Uint8Array> } }
    if (!result.Body) throw new Error(`Asset blob not found: ${key}`)
    return Buffer.from(await result.Body.transformToByteArray())
  }
}

function requiredEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key]?.trim()
  if (!value) throw new Error(`Missing required asset storage env var: ${key}`)
  return value
}

/** Validated once, at construction. Defaults to local so existing installs are unaffected. */
export function parseAssetStorageConfig(env: NodeJS.ProcessEnv): AssetStorageConfig {
  const driver = (env.NUXT_ASSET_STORAGE_DRIVER || 'local').trim()
  if (driver !== 's3') return { driver: 'local' }
  return {
    driver: 's3',
    endpoint: requiredEnv(env, 'NUXT_ASSET_STORAGE_S3_ENDPOINT'),
    region: requiredEnv(env, 'NUXT_ASSET_STORAGE_S3_REGION'),
    bucket: requiredEnv(env, 'NUXT_ASSET_STORAGE_S3_BUCKET'),
    accessKeyId: requiredEnv(env, 'NUXT_ASSET_STORAGE_S3_ACCESS_KEY_ID'),
    secretAccessKey: requiredEnv(env, 'NUXT_ASSET_STORAGE_S3_SECRET_ACCESS_KEY'),
    publicBaseUrl: env.NUXT_ASSET_STORAGE_S3_PUBLIC_BASE_URL?.trim() || undefined,
  }
}

function buildStore(config: AssetStorageConfig): AssetBlobStore {
  if (config.driver === 's3') return new S3AssetBlobStore(config)
  return new LocalAssetBlobStore()
}

let store: AssetBlobStore | null = null

/**
 * Constructed on first use rather than at import time: a misconfigured S3 env var
 * should fail the first asset write, not every route in the server.
 */
export function useAssetBlobStore(): AssetBlobStore {
  if (!store) {
    const config = parseAssetStorageConfig(process.env)
    store = buildStore(config)
    log.info({ message: 'asset blob store ready', driver: config.driver })
  }
  return store
}