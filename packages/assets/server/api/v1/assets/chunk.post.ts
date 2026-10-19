import { assetService } from '#layers/BaseShared/server/services/asset.service';
import { assetBlobKey, useAssetBlobStore } from '#layers/BaseShared/server/services/asset-blob-store';
import { readMultipartFormData } from 'h3';
import dayjs from 'dayjs';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const CHUNKS_ROOT = join(process.cwd(), 'upload', 'chunks');
const SAFE_SEGMENT = /^[A-Za-z0-9_-]+$/;

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
    const mimeType = get('mimeType') || 'application/octet-stream';
    const fileSize = Number(get('fileSize') || 0);
    const businessId = get('businessId') || undefined;

    if (!SAFE_SEGMENT.test(uploadId)) throw createError({ statusCode: 400, statusMessage: 'Invalid uploadId' });
    if (Number.isNaN(chunkIndex) || Number.isNaN(totalChunks) || chunkIndex < 0 || totalChunks < 1 || chunkIndex >= totalChunks) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid chunk indices' });
    }

    const chunkPart = formData.find((p) => p.name === 'chunk' && p.data);
    if (!chunkPart) throw createError({ statusCode: 400, statusMessage: 'No chunk data' });

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

    const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'bin';
    const uniqueFilename = randomUUID();
    const fullFilename = `${uniqueFilename}.${fileExtension}`;
    const resolvedMime = mimeType || 'application/octet-stream';

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
