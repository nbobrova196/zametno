import { describe, expect, it } from 'vitest'
import { isQuotaExceededError, storageErrorMessage, QUOTA_ERROR_MESSAGE } from './storage'
import { getLastBackupAt, isBackupStale, markBackupDone } from './backup'

describe('ошибка нехватки места', () => {
  it('узнаёт QuotaExceededError по имени и коду', () => {
    expect(isQuotaExceededError({ name: 'QuotaExceededError' })).toBe(true)
    expect(isQuotaExceededError({ name: 'NS_ERROR_DOM_QUOTA_REACHED' })).toBe(true)
    expect(isQuotaExceededError({ code: 22 })).toBe(true)
    expect(isQuotaExceededError({ code: 1014 })).toBe(true)
    expect(isQuotaExceededError({ inner: { name: 'QuotaExceededError' } })).toBe(true)
  })

  it('не принимает обычную ошибку за переполнение', () => {
    expect(isQuotaExceededError(new Error('network'))).toBe(false)
    expect(isQuotaExceededError(null)).toBe(false)
    expect(storageErrorMessage(new Error('network'), 'Не получилось')).toBe('Не получилось')
  })

  it('подставляет понятный текст при переполнении', () => {
    expect(storageErrorMessage({ name: 'QuotaExceededError' }, 'Не получилось')).toBe(
      QUOTA_ERROR_MESSAGE,
    )
  })
})

describe('напоминание об архиве', () => {
  it('считает копию устаревшей после двух недель', () => {
    const now = Date.UTC(2026, 10, 5)
    const day = 24 * 60 * 60 * 1000
    expect(isBackupStale(null, now)).toBe(true)
    expect(isBackupStale(now - 3 * day, now)).toBe(false)
    expect(isBackupStale(now - 14 * day, now)).toBe(true)
  })

  it('запоминает дату копии', () => {
    markBackupDone('backup-test-project', 123)
    expect(getLastBackupAt('backup-test-project')).toBe(123)
  })
})
