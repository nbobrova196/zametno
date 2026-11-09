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

async function compressPhotoOnMainThread(file: File): Promise<CompressedPhoto> {
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

interface WorkerResponse {
  id: number
  ok: boolean
  blob?: Blob
  thumb?: Blob
  width?: number
  height?: number
}

interface PendingRequest {
  resolve: (photo: CompressedPhoto) => void
  reject: (error: Error) => void
  timer: number
}

let worker: Worker | null = null
let workerUnavailable = false
let nextRequestId = 1
const pending = new Map<number, PendingRequest>()

function failPending(error: Error) {
  for (const request of pending.values()) {
    window.clearTimeout(request.timer)
    request.reject(error)
  }
  pending.clear()
}

function getWorker(): Worker | null {
  if (workerUnavailable) return null
  if (worker) return worker
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    workerUnavailable = true
    return null
  }

  try {
    const instance = new Worker(new URL('./photoWorker.ts', import.meta.url), { type: 'module' })
    instance.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const data = event.data
      const request = pending.get(data.id)
      if (!request) return
      pending.delete(data.id)
      window.clearTimeout(request.timer)

      if (data.ok && data.blob && data.thumb && data.width && data.height) {
        request.resolve({
          blob: data.blob,
          thumb: data.thumb,
          width: data.width,
          height: data.height,
        })
      } else {
        request.reject(new Error('Не удалось обработать фотографию'))
      }
    }
    instance.onerror = () => {
      workerUnavailable = true
      instance.terminate()
      worker = null
      failPending(new Error('Сжатие фотографий недоступно'))
    }
    worker = instance
    return instance
  } catch {
    workerUnavailable = true
    return null
  }
}

function compressInWorker(file: File): Promise<CompressedPhoto> {
  const instance = getWorker()
  if (!instance) return Promise.reject(new Error('Сжатие в фоне недоступно'))

  const id = nextRequestId++
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pending.delete(id)
      reject(new Error('Сжатие фотографии заняло слишком много времени'))
    }, 20_000)

    pending.set(id, { resolve, reject, timer })
    instance.postMessage({ id, file })
  })
}

/** Сжимает фото в Web Worker, а если он недоступен — на основном потоке. */
export async function compressPhoto(file: File): Promise<CompressedPhoto> {
  try {
    return await compressInWorker(file)
  } catch {
    return compressPhotoOnMainThread(file)
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
