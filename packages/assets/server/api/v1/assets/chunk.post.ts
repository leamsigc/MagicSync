import { assetService } from '#layers/BaseShared/server/services/asset.service';
import { assetBlobKey, useAssetBlobStore } from '#layers/BaseShared/server/services/asset-blob-store';
import { readMultipartFormData } from 'h3';
import dayjs from 'dayjs';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const CHUNKS_ROOT = join(process.cwd(), 'upload', 'chunks');
const SAFE_SEGMENT = /^[A-Za-z0-9_-]+$/;
const MAX_TOTAL_CHUNKS = 2000;
const MAX_CHUNK_BYTES = 10 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 250 * 1024 * 1024;
const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
  pdf: 'application/pdf',
  txt: 'text/plain',
}

/** Extension is derived server-side; a client filename can never choose the path. */
function safeExtension(fileName: string): string | null {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? ''
  return MIME_BY_EXTENSION[extension] ? extension : null
}

export default defineEventHandler(async (event) => {
  const log = useLogger(event);
  try {
    const user = await checkUserIsLogin(event);
    log.set({ userId: user.id });

    const formData = await readMultipartFormData(event);
    if (!formData) throw createError({ statusCode: 400, statusMessage: 'No form data' });

    const get = (name: string) => formData.find((p) => p.name === name)?.data?.toString();
    const uploadId = get('uploadId') || randomUUID();
    const chunkIndex = Number(get('chunkIndex'));
    const totalChunks = Number(get('totalChunks'));
    const fileName = get('fileName') || 'file';
    const fileSize = Number(get('fileSize') || 0);
    const businessId = get('businessId') || undefined;

    if (!SAFE_SEGMENT.test(uploadId)) throw createError({ statusCode: 400, statusMessage: 'Invalid uploadId' });
    if (Number.isNaN(chunkIndex) || Number.isNaN(totalChunks) || chunkIndex < 0 || totalChunks < 1 || chunkIndex >= totalChunks) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid chunk indices' });
    }
    if (totalChunks > MAX_TOTAL_CHUNKS) throw createError({ statusCode: 413, statusMessage: 'Too many chunks' });
    if (fileSize > MAX_UPLOAD_BYTES) throw createError({ statusCode: 413, statusMessage: 'File too large' });

    const chunkPart = formData.find((p) => p.name === 'chunk' && p.data);
    if (!chunkPart) throw createError({ statusCode: 400, statusMessage: 'No chunk data' });
    if (chunkPart.data.length > MAX_CHUNK_BYTES) throw createError({ statusCode: 413, statusMessage: 'Chunk too large' });

    const dir = join(CHUNKS_ROOT, uploadId);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${chunkIndex}.part`), Buffer.from(chunkPart.data));

    const allPresent = await Promise.all(
      Array.from({ length: totalChunks }, (_, i) =>
        readFile(join(dir, `${i}.part`)).then(() => true).catch(() => false)
      )
    ).then((results) => results.every(Boolean));

    if (!allPresent) {
      return { success: true, data: null, chunkReceived: chunkIndex };
    }

    const buffers: Buffer[] = [];
    for (let i = 0; i < totalChunks; i++) {
      const buf = await readFile(join(dir, `${i}.part`));
      buffers.push(buf);
    }
    const buffer = Buffer.concat(buffers);
    if (buffer.length > MAX_UPLOAD_BYTES) {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
      throw createError({ statusCode: 413, statusMessage: 'File too large' });
    }

    const fileExtension = safeExtension(fileName);
    if (!fileExtension) {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
      throw createError({ statusCode: 415, statusMessage: 'Unsupported file extension' });
    }
    const uniqueFilename = randomUUID();
    const fullFilename = `${uniqueFilename}.${fileExtension}`;
    const resolvedMime = MIME_BY_EXTENSION[fileExtension] ?? 'application/octet-stream';

    const { url: fileUrl } = await useAssetBlobStore().put(
      assetBlobKey(user.id, fullFilename),
      buffer,
      resolvedMime,
    );

    const assetData = {
      businessId,
      filename: uniqueFilename,
      originalName: fileName,
      mimeType: resolvedMime,
      size: fileSize || buffer.length,
      url: fileUrl,
      metadata: { uploadedAt: dayjs().toDate(), originalSize: fileSize || buffer.length, storedPath: fullFilename },
    };
    const result = await assetService.create(user.id, assetData);

    await rm(dir, { recursive: true, force: true }).catch(() => {});

    if (!result.success) throw createError({ statusCode: 400, statusMessage: 'Failed to create asset' });
    return { success: true, data: [result.data], message: 'Upload complete' };
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    log.error('Chunk upload error', { error });
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' });
  }
});
