export interface StorageInfo {
  usage: number
  quota: number
  persisted: boolean
}

export async function getStorageInfo(): Promise<StorageInfo | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null

  try {
    const estimate = await navigator.storage.estimate()
    const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false
    return {
      usage: estimate.usage ?? 0,
      quota: estimate.quota ?? 0,
      persisted,
    }
  } catch {
    return null
  }
}

export async function requestPersistentStorage() {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false
  try {
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

let autoRequest: Promise<boolean> | null = null

/**
 * Тихо просит браузер защитить хранилище от автоматической очистки.
 * Вызывается при запуске и после установки приложения. Если браузер
 * откажет, остаётся ручная кнопка в настройках проекта.
 */
export function ensurePersistentStorage(force = false) {
  if (force) autoRequest = null
  if (!autoRequest) {
    autoRequest = (async () => {
      if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false
      try {
        if (navigator.storage.persisted && (await navigator.storage.persisted())) return true
        return await navigator.storage.persist()
      } catch {
        return false
      }
    })()
  }
  return autoRequest
}

/** Переполнение хранилища браузер сообщает по-разному в разных движках. */
export function isQuotaExceededError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const value = error as { name?: string; code?: number; inner?: unknown }
  if (
    value.name === 'QuotaExceededError' ||
    value.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    value.code === 22 ||
    value.code === 1014
  ) {
    return true
  }
  return value.inner ? isQuotaExceededError(value.inner) : false
}

export const QUOTA_ERROR_MESSAGE =
  'На устройстве не хватает места для новых фотографий. Скачай архив проекта, удали лишние фото или освободи место на устройстве и попробуй снова.'

export function storageErrorMessage(error: unknown, fallback: string) {
  return isQuotaExceededError(error) ? QUOTA_ERROR_MESSAGE : fallback
}
