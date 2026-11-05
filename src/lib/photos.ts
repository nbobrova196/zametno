export interface CompressedPhoto {
  blob: Blob
  thumb: Blob
  width: number
  height: number
}

const MAX_SIDE = 1600
const THUMB_SIDE = 360

function fit(width: number, height: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(width, height))
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  }
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      // fall through to the <img> path
    }
  }

  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return image
  } finally {
    URL.revokeObjectURL(url)
  }
}

function drawToBlob(
  source: ImageBitmap | HTMLImageElement,
  width: number,
  height: number,
  quality: number,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Не удалось обработать фотографию')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.drawImage(source, 0, 0, width, height)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Не удалось сохранить фотографию'))),
      'image/jpeg',
      quality,
    )
  })
}

export async function compressPhoto(file: File): Promise<CompressedPhoto> {
  const source = await loadBitmap(file)
  const full = fit(source.width, source.height, MAX_SIDE)
  const small = fit(source.width, source.height, THUMB_SIDE)

  try {
    const blob = await drawToBlob(source, full.width, full.height, 0.82)
    const thumb = await drawToBlob(source, small.width, small.height, 0.72)
    return { blob, thumb, width: full.width, height: full.height }
  } finally {
    if ('close' in source) source.close()
  }
}

export function formatBytes(bytes: number) {
  if (bytes <= 0) return '0 КБ'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} МБ`
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1).replace('.', ',')} ГБ`
}
