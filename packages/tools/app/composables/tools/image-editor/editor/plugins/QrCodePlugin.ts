import { FabricImage } from 'fabric';
import { BaseFabricPlugin } from '../FabricEditor';

/**
 * QrCodePlugin — insert a QR code image for a URL/text.
 *
 * Uses the public QR service (no API key), loaded with CORS so the canvas can
 * export it. The result is a normal fabric image, so it serializes, batches
 * and animates like any other layer.
 */

const QR_ENDPOINT = 'https://api.qrserver.com/v1/create-qr-code/'
const QR_ID = 'qr-code'

export class QrCodePlugin extends BaseFabricPlugin {
  static readonly pluginName = 'qrcode';
  override readonly pluginName = 'qrcode';

  override readonly exposedMethods = ['addQrCode'];

  protected init() { }

  async addQrCode(data: string, size = 320): Promise<boolean> {
    const canvas = this.canvas;
    const value = data.trim();
    if (!canvas || !value) return false

    const url = `${QR_ENDPOINT}?size=${Math.round(size)}x${Math.round(size)}&margin=0&data=${encodeURIComponent(value)}`
    const image = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' })
    const frame = canvas.getObjects().find(obj => (obj as { id?: string }).id === 'workspace')
    const frameWidth = frame?.width ?? 1080
    image.set({
      id: QR_ID,
      name: 'QR code',
      left: Math.round((frameWidth - size) / 2),
      top: 120,
    } as never)
    canvas.add(image)
    canvas.setActiveObject(image)
    canvas.requestRenderAll()
    return true
  }
}
