import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/db'
import type { Observation, Photo, Project } from '../db/types'
import {
  ARCHIVE_VERSION,
  exportAllProjectsArchive,
  exportProjectArchive,
  importArchive,
  parseManifest,
  safeArchiveName,
} from './archive'

function makeProject(id: string, title: string, updatedAt: number): Project {
  return {
    id,
    title,
    subjectName: `${title} — объект`,
    templateId: 'plant',
    mode: 'research',
    status: 'active',
    color: '#1f5f4f',
    createdAt: updatedAt,
    updatedAt,
  }
}

function makePhoto(id: string, projectId: string, observationId: string): Photo {
  return {
    id,
    projectId,
    observationId,
    blob: new Blob(['фотография']),
    thumb: new Blob(['миниатюра']),
    width: 100,
    height: 80,
    order: 0,
    createdAt: 10,
  }
}

beforeEach(async () => {
  await db.delete()
  await db.open()
})

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

describe('архив всех проектов', () => {
  async function seed() {
    await db.projects.bulkAdd([
      makeProject('p1', 'Фасоль', 20),
      makeProject('p2', 'Погода за окном', 10),
    ])

    const observations: Observation[] = [
      {
        id: 'o1',
        projectId: 'p1',
        kind: 'observation',
        observedAt: 5,
        createdAt: 5,
        note: 'Первый лист',
        markIds: [],
        measurements: [],
        isImportant: false,
      },
      {
        id: 'o2',
        projectId: 'p2',
        kind: 'observation',
        observedAt: 6,
        createdAt: 6,
        note: 'Облачно',
        markIds: [],
        measurements: [],
        isImportant: false,
      },
    ]
    await db.observations.bulkAdd(observations)
    await db.photos.bulkAdd([makePhoto('ph1', 'p1', 'o1'), makePhoto('ph2', 'p2', 'o2')])
  }

  it('собирает все проекты в один ZIP и импортирует их обратно', async () => {
    await seed()

    const { blob, filename } = await exportAllProjectsArchive()
    expect(filename).toMatch(/все проекты/)
    expect(blob.size).toBeGreaterThan(0)

    const result = await importArchive(new File([blob], 'all.zip', { type: 'application/zip' }))
    expect(result.bundle).toBe(true)
    expect(result.projectIds).toHaveLength(2)

    const imported = await db.projects.toArray()
    expect(imported).toHaveLength(4)
    expect(imported.map((project) => project.title).sort()).toEqual([
      'Погода за окном',
      'Погода за окном',
      'Фасоль',
      'Фасоль',
    ])

    for (const projectId of result.projectIds) {
      const photos = await db.photos.where('projectId').equals(projectId).toArray()
      expect(photos).toHaveLength(1)
      expect(await photos[0].blob.text()).toBe('фотография')
    }
  })

  it('по-прежнему импортирует архив одного проекта', async () => {
    await seed()

    const { blob } = await exportProjectArchive('p1')
    const result = await importArchive(new File([blob], 'one.zip', { type: 'application/zip' }))

    expect(result.bundle).toBe(false)
    expect(result.projectIds).toHaveLength(1)
    expect((await db.projects.get(result.projectIds[0]))?.title).toBe('Фасоль')
  })

  it('не принимает пустую полку', async () => {
    await expect(exportAllProjectsArchive()).rejects.toThrow(/нет проектов/)
  })
})
