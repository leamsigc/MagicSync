import sharp from 'sharp';
import { promises as fs } from 'node:fs'


const baseUrl = process.env.NUXT_BASE_URL
export const getPublicUrlForAsset = (assetUrl: string) => {

  return `${baseUrl}${assetUrl.replace('/api/v1/assets/serve/', '/assets/public/')}`
}
export const fetchedImageBase64 = async (url: string) => {
  // Request the image then save to base64 in the server
  const response = await fetch(url)
  const buffer = await response.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')

  return `data:image/jpeg;base64,${base64}`;
}

/**
 * Reduces an image from a given URL to a given maximum size (in KB)
 * by prioritizing compression over resizing to minimize quality loss.
 *
 * @param {string} url The URL of the image to reduce
 * @param {number} [maxSizeKB=976] //976kb is approximately 0.95MB
 *
 * @returns {Promise<{width: number, height: number, buffer: Buffer}>}
 * A promise that resolves with an object containing the reduced image's width, height, and buffer.
 */
export async function reduceImageBySize(url: string, maxSizeKB = 976) {
  try {
    // Fetch the image from the URL
    const fileContent = await fs.readFile(url)

    let imageBuffer = Buffer.from(fileContent);

    // Use sharp to get the metadata of the image
    const metadata = await sharp(imageBuffer).metadata();
    let width = metadata.width!;
    let height = metadata.height!;
    const format = metadata.format;

    // First attempt: Optimize/compress without resizing
    let optimizedBuffer = await optimizeImage(imageBuffer, format, maxSizeKB);
    if (optimizedBuffer.length / 1024 <= maxSizeKB) {
      return { width, height, buffer: optimizedBuffer };
    }

    // Second attempt: Progressive compression with quality reduction
    const qualityLevels = [90, 80, 70, 60, 50];
    for (const quality of qualityLevels) {
      optimizedBuffer = await compressImage(imageBuffer, format, quality);
      if (optimizedBuffer.length / 1024 <= maxSizeKB) {
        return { width, height, buffer: optimizedBuffer };
      }
    }

    // Last resort: Resize with minimal quality loss
    let currentBuffer = optimizedBuffer;
    while (currentBuffer.length / 1024 > maxSizeKB && width > 100 && height > 100) {
      width = Math.floor(width * 0.95); // Reduce dimensions by 5% for finer control
      height = Math.floor(height * 0.95);

      currentBuffer = await sharp(currentBuffer)
        .resize({ width, height, withoutEnlargement: true })
        .jpeg({ quality: 85 }) // Maintain reasonable quality even when resizing
        .toBuffer();

      if (width < 100 || height < 100) break; // Prevent overly small dimensions
    }

    return { width, height, buffer: currentBuffer };
  } catch (error) {
    console.error('Error processing image:', error);
    throw error;
  }
}

/**
 * Optimizes image using format-specific lossless or minimal-loss techniques
 * Prioritizes JPEG and PNG for maximum social media compatibility
 */
export async function optimizeImage(buffer: Buffer, format: string | undefined, maxSizeKB: number): Promise<Buffer> {
  const sharpInstance = sharp(buffer);

  switch (format) {
    case 'jpeg':
    case 'jpg':
      return await sharpInstance
        .jpeg({ quality: 95, progressive: true, mozjpeg: true })
        .toBuffer();
    case 'png':
      return await sharpInstance
        .png({ compressionLevel: 9, palette: true })
        .toBuffer();
    case 'webp':
      // Convert WebP to JPEG for better compatibility
      return await sharpInstance
        .jpeg({ quality: 95, progressive: true, mozjpeg: true })
        .toBuffer();
    case 'gif':
      // Convert GIF to PNG to preserve any transparency
      return await sharpInstance
        .png({ compressionLevel: 9 })
        .toBuffer();
    default:
      // For other formats, convert to JPEG (most compatible)
      return await sharpInstance
        .jpeg({ quality: 95, progressive: true, mozjpeg: true })
        .toBuffer();
  }
}

/**
 * Compresses image with specified quality level
 * Maintains format compatibility for social media platforms
 */
export async function compressImage(buffer: Buffer, format: string | undefined, quality: number): Promise<Buffer> {
  const sharpInstance = sharp(buffer);

  switch (format) {
    case 'jpeg':
    case 'jpg':
      return await sharpInstance
        .jpeg({ quality, progressive: true, mozjpeg: true })
        .toBuffer();
    case 'png':
      // PNG doesn't support quality, use higher compression instead
      return await sharpInstance
        .png({ compressionLevel: Math.min(9, Math.max(1, Math.floor(quality / 10))) })
        .toBuffer();
    case 'webp':
      // Convert WebP to JPEG for compression
      return await sharpInstance
        .jpeg({ quality, progressive: true, mozjpeg: true })
        .toBuffer();
    case 'gif':
      // Convert GIF to compressed PNG
      return await sharpInstance
        .png({ compressionLevel: Math.min(9, Math.max(1, Math.floor(quality / 10))) })
        .toBuffer();
    default:
      // Convert other formats to JPEG
      return await sharpInstance
        .jpeg({ quality, progressive: true, mozjpeg: true })
        .toBuffer();
  }
}
