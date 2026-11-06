import { db } from '../db/db'
import type { Measurement, Observation, ObservationKind } from '../db/types'
import { compressPhoto } from '../lib/photos'

export interface SaveObservationInput {
  projectId: string
  kind: ObservationKind
  observedAt: number
  note: string
  markIds: string[]
  measurements: Measurement[]
  isImportant: boolean
  files: File[]
}

export interface UpdateObservationInput {
  id: string
  kind: ObservationKind
  observedAt: number
  note: string
  markIds: string[]
  measurements: Measurement[]
  isImportant: boolean
  files: File[]
  removedPhotoIds: string[]
}

function observationFields(input: {
  kind: ObservationKind
  observedAt: number
  note: string
  markIds: string[]
  measurements: Measurement[]
  isImportant: boolean
}) {
  return {
    kind: input.kind,
    observedAt: input.observedAt,
    note: input.note.trim() || undefined,
    markIds: input.markIds,
    measurements: input.measurements,
    isImportant: input.isImportant,
  }
}

export async function saveObservation(input: SaveObservationInput) {
  const id = crypto.randomUUID()
  const now = Date.now()
  const compressed = await Promise.all(input.files.map((file) => compressPhoto(file)))

  const observation: Observation = {
    id,
    projectId: input.projectId,
    createdAt: now,
    ...observationFields(input),
  }

  await db.transaction('rw', db.observations, db.photos, db.projects, async () => {
    const project = await db.projects.get(input.projectId)
    await db.observations.add(observation)

    let firstPhotoId: string | undefined
    if (compressed.length > 0) {
      const newPhotos = compressed.map((photo, index) => ({
        id: crypto.randomUUID(),
        projectId: input.projectId,
        observationId: id,
        blob: photo.blob,
        thumb: photo.thumb,
        width: photo.width,
        height: photo.height,
        order: index,
        createdAt: now,
      }))

      await db.photos.bulkAdd(newPhotos)
      firstPhotoId = newPhotos[0]?.id
    }

    await db.projects.update(input.projectId, {
      updatedAt: now,
      ...(!project?.coverPhotoId && firstPhotoId ? { coverPhotoId: firstPhotoId } : {}),
    })
  })

  return id
}

export async function updateObservation(input: UpdateObservationInput) {
  const compressed = await Promise.all(input.files.map((file) => compressPhoto(file)))
  const now = Date.now()

  await db.transaction('rw', db.observations, db.photos, db.projects, async () => {
    const existing = await db.observations.get(input.id)
    if (!existing) throw new Error('Запись не найдена')

    const project = await db.projects.get(existing.projectId)
    const observation: Observation = {
      ...existing,
      ...observationFields(input),
    }
    await db.observations.put(observation)

    if (input.removedPhotoIds.length > 0) {
      await db.photos.bulkDelete(input.removedPhotoIds)
    }

    if (compressed.length > 0) {
      const current = await db.photos.where('observationId').equals(input.id).toArray()
      const maxOrder = current.reduce((max, photo) => Math.max(max, photo.order ?? 0), -1)
      const newPhotos = compressed.map((photo, index) => ({
        id: crypto.randomUUID(),
        projectId: existing.projectId,
        observationId: input.id,
        blob: photo.blob,
        thumb: photo.thumb,
        width: photo.width,
        height: photo.height,
        order: maxOrder + 1 + index,
        createdAt: now,
      }))
      await db.photos.bulkAdd(newPhotos)
    }

    let coverPhotoId = project?.coverPhotoId
    if (coverPhotoId && input.removedPhotoIds.includes(coverPhotoId)) {
      const remaining = await db.photos.where('projectId').equals(existing.projectId).sortBy('createdAt')
      coverPhotoId = remaining[0]?.id
    }

    await db.projects.update(existing.projectId, {
      updatedAt: now,
      ...(coverPhotoId !== project?.coverPhotoId ? { coverPhotoId } : {}),
    })
  })
}

export async function listObservations(projectId: string) {
  const observations = await db.observations.where('projectId').equals(projectId).toArray()
  return observations.sort((a, b) => b.observedAt - a.observedAt)
}

export async function listPhotos(projectId: string) {
  const photos = await db.photos.where('projectId').equals(projectId).toArray()
  return photos.sort((a, b) => a.createdAt - b.createdAt || (a.order ?? 0) - (b.order ?? 0))
}

export async function deleteObservation(observationId: string) {
  await db.transaction('rw', db.observations, db.photos, db.projects, async () => {
    const observation = await db.observations.get(observationId)
    if (!observation) return

    const project = await db.projects.get(observation.projectId)
    const photosToDelete = await db.photos.where('observationId').equals(observationId).toArray()

    await db.photos.bulkDelete(photosToDelete.map((photo) => photo.id))
    await db.observations.delete(observationId)

    const deletedCover =
      project?.coverPhotoId !== undefined &&
      photosToDelete.some((photo) => photo.id === project.coverPhotoId)

    if (deletedCover) {
      const remaining = await db.photos.where('projectId').equals(observation.projectId).sortBy('createdAt')
      await db.projects.update(observation.projectId, {
        coverPhotoId: remaining[0]?.id,
        updatedAt: Date.now(),
      })
    } else {
      await db.projects.update(observation.projectId, { updatedAt: Date.now() })
    }
  })
}
