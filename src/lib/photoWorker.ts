const MAX_SIDE = 1600
const THUMB_SIDE = 360

interface CompressRequest {
  id: number
  file: File
}

interface CompressResponse {
  id: number
  ok: boolean
  blob?: Blob
  thumb?: Blob
  width?: number
  height?: number
}

const worker = self as unknown as {
  onmessage: ((event: MessageEvent<CompressRequest>) => void) | null
  postMessage: (message: CompressResponse) => void
}

function fit(width: number, height: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(width, height))
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  }
}

async function drawToBlob(
  source: ImageBitmap,
  width: number,
  height: number,
  quality: number,
): Promise<Blob> {
  const canvas = new OffscreenCanvas(width, height)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Не удалось обработать фотографию')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.drawImage(source, 0, 0, width, height)
  return canvas.convertToBlob({ type: 'image/jpeg', quality })
}

worker.onmessage = async (event) => {
  const { id, file } = event.data

  try {
    const source = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const full = fit(source.width, source.height, MAX_SIDE)
    const small = fit(source.width, source.height, THUMB_SIDE)

    try {
      const blob = await drawToBlob(source, full.width, full.height, 0.82)
      const thumb = await drawToBlob(source, small.width, small.height, 0.72)
      worker.postMessage({
        id,
        ok: true,
        blob,
        thumb,
        width: full.width,
        height: full.height,
      })
    } finally {
      source.close()
    }
  } catch {
    worker.postMessage({ id, ok: false })
  }
}
