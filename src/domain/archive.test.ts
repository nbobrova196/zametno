import { describe, expect, it } from 'vitest'
import { ARCHIVE_VERSION, parseManifest, safeArchiveName } from './archive'

function manifest(extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    app: 'zametno',
    version: ARCHIVE_VERSION,
    exportedAt: 1,
    project: { id: 'p1', title: 'Фасоль' },
    metrics: [],
    marks: [],
    observations: [],
    photos: [],
    reminders: [],
    reminderLogs: [],
    ...extra,
  })
}

describe('parseManifest', () => {
  it('читает корректный архив', () => {
    const parsed = parseManifest(manifest())
    expect(parsed.project.title).toBe('Фасоль')
    expect(parsed.version).toBe(ARCHIVE_VERSION)
  })

  it('отказывается от чужого или устаревшего архива', () => {
    expect(() => parseManifest(manifest({ app: 'other' }))).toThrow(/другого приложения/)
    expect(() => parseManifest(manifest({ version: 0 }))).toThrow(/другой версии/)
  })

  it('проверяет название проекта и записи', () => {
    expect(() => parseManifest(manifest({ project: {} }))).toThrow(/названия проекта/)
    expect(() => parseManifest(manifest({ observations: [{ note: 'x' }, 42] }))).toThrow(
      /записи наблюдений/,
    )
  })

  it('не падает на пустых списках', () => {
    const parsed = parseManifest(manifest({ metrics: undefined, photos: null }))
    expect(parsed.metrics).toEqual([])
    expect(parsed.photos).toEqual([])
  })
})

describe('safeArchiveName', () => {
  it('убирает запрещённые символы из имени файла', () => {
    expect(safeArchiveName('Фасоль / подоконник: тест')).toBe('Фасоль подоконник тест — заметно.zip')
    expect(safeArchiveName('   ')).toBe('Заметно — заметно.zip')
  })
})
