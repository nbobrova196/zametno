import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/db'
import type { Observation, Photo, Project } from '../db/types'
import { deleteObservation, groupPhotosByObservation, saveObservation, updateObservation } from './observations'

const project: Project = {
  id: 'p1',
  title: 'Фасоль на подоконнике',
  subjectName: 'фасоль',
  templateId: 'plant',
  mode: 'research',
  status: 'active',
  color: '#1f5f4f',
  createdAt: 1,
  updatedAt: 1,
}

function photo(id: string, observationId: string, createdAt: number): Photo {
  return {
    id,
    projectId: project.id,
    observationId,
    blob: new Blob(['photo']),
    thumb: new Blob(['thumb']),
    width: 100,
    height: 100,
    order: 0,
    createdAt,
  }
}

beforeEach(async () => {
  await db.delete()
  await db.open()
  await db.projects.add(project)
})

describe('наблюдения', () => {
  it('создаёт запись и обновляет проект', async () => {
    const id = await saveObservation({
      projectId: project.id,
      kind: 'observation',
      observedAt: 100,
      note: '  Первый лист  ',
      markIds: ['m1'],
      measurements: [{ metricId: 'x1', value: 12 }],
      isImportant: true,
      files: [],
    })

    const saved = await db.observations.get(id)
    expect(saved?.note).toBe('Первый лист')
    expect(saved?.markIds).toEqual(['m1'])
    expect(saved?.measurements).toEqual([{ metricId: 'x1', value: 12 }])
    expect(saved?.isImportant).toBe(true)
    expect((await db.projects.get(project.id))?.updatedAt).toBeGreaterThan(1)
  })

  it('обновляет поля записи и не теряет проект', async () => {
    const id = await saveObservation({
      projectId: project.id,
      kind: 'observation',
      observedAt: 100,
      note: 'Было',
      markIds: [],
      measurements: [],
      isImportant: false,
      files: [],
    })

    await updateObservation({
      id,
      kind: 'no_changes',
      observedAt: 200,
      note: '  Стало  ',
      markIds: ['m2'],
      measurements: [{ metricId: 'x2', value: 7 }],
      isImportant: true,
      files: [],
      removedPhotoIds: [],
    })

    const updated = await db.observations.get(id)
    expect(updated).toMatchObject({
      id,
      projectId: project.id,
      kind: 'no_changes',
      observedAt: 200,
      note: 'Стало',
      markIds: ['m2'],
      measurements: [{ metricId: 'x2', value: 7 }],
      isImportant: true,
    })
    expect((await db.projects.get(project.id))?.updatedAt).toBeGreaterThan(1)
  })

  it('удаляет запись и её фотографии', async () => {
    const id = await saveObservation({
      projectId: project.id,
      kind: 'observation',
      observedAt: 100,
      note: '',
      markIds: [],
      measurements: [],
      isImportant: false,
      files: [],
    })
    await db.photos.bulkAdd([photo('ph1', id, 10), photo('ph2', id, 11)])
    await db.projects.update(project.id, { coverPhotoId: 'ph1' })

    await deleteObservation(id)

    expect(await db.observations.get(id)).toBeUndefined()
    expect(await db.photos.where('observationId').equals(id).count()).toBe(0)
    expect((await db.projects.get(project.id))?.coverPhotoId).toBeUndefined()
  })

  it('назначает новую обложку, если удалили фото с обложки', async () => {
    const first = await saveObservation({
      projectId: project.id,
      kind: 'observation',
      observedAt: 100,
      note: '',
      markIds: [],
      measurements: [],
      isImportant: false,
      files: [],
    })
    const second: Observation = {
      id: 'o2',
      projectId: project.id,
      kind: 'observation',
      observedAt: 200,
      createdAt: 2,
      markIds: [],
      measurements: [],
      isImportant: false,
    }
    await db.observations.add(second)
    await db.photos.bulkAdd([
      photo('cover', first, 10),
      photo('kept', second.id, 20),
    ])
    await db.projects.update(project.id, { coverPhotoId: 'cover' })

    await deleteObservation(first)

    expect((await db.projects.get(project.id))?.coverPhotoId).toBe('kept')
  })

  it('при редактировании удаляет только отмеченные фото', async () => {
    const id = await saveObservation({
      projectId: project.id,
      kind: 'observation',
      observedAt: 100,
      note: '',
      markIds: [],
      measurements: [],
      isImportant: false,
      files: [],
    })
    await db.photos.bulkAdd([photo('a', id, 10), photo('b', id, 11)])
    await db.projects.update(project.id, { coverPhotoId: 'a' })

    await updateObservation({
      id,
      kind: 'observation',
      observedAt: 100,
      note: 'Без первого фото',
      markIds: [],
      measurements: [],
      isImportant: false,
      files: [],
      removedPhotoIds: ['a'],
    })

    expect(await db.photos.get('a')).toBeUndefined()
    expect(await db.photos.get('b')).toBeDefined()
    expect((await db.projects.get(project.id))?.coverPhotoId).toBe('b')
  })

  it('меняет порядок фото по photoOrder', async () => {
    const id = await saveObservation({
      projectId: project.id,
      kind: 'observation',
      observedAt: 100,
      note: '',
      markIds: [],
      measurements: [],
      isImportant: false,
      files: [],
    })
    await db.photos.bulkAdd([photo('first', id, 10), photo('second', id, 11), photo('third', id, 12)])

    await updateObservation({
      id,
      kind: 'observation',
      observedAt: 100,
      note: '',
      markIds: [],
      measurements: [],
      isImportant: false,
      files: [],
      removedPhotoIds: [],
      photoOrder: ['third', 'first', 'second'],
    })

    expect((await db.photos.get('third'))?.order).toBe(0)
    expect((await db.photos.get('first'))?.order).toBe(1)
    expect((await db.photos.get('second'))?.order).toBe(2)

    const grouped = groupPhotosByObservation(await db.photos.where('projectId').equals(project.id).toArray())
    expect(grouped.get(id)?.map((item) => item.id)).toEqual(['third', 'first', 'second'])
  })

  it('сортирует фото в группе по порядку, а не по id', async () => {
    const grouped = groupPhotosByObservation([
      { ...photo('b', 'o1', 10), order: 1 },
      { ...photo('a', 'o1', 10), order: 0 },
      { ...photo('d', 'o2', 10), order: 1 },
      { ...photo('c', 'o2', 10), order: 0 },
    ])

    expect(grouped.get('o1')?.map((item) => item.id)).toEqual(['a', 'b'])
    expect(grouped.get('o2')?.map((item) => item.id)).toEqual(['c', 'd'])
  })
})
