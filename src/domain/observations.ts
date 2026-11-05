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

export async function saveObservation(input: SaveObservationInput) {
  const id = crypto.randomUUID()
  const now = Date.now()
  const compressed = await Promise.all(input.files.map((file) => compressPhoto(file)))

  const observation: Observation = {
    id,
    projectId: input.projectId,
    kind: input.kind,
    observedAt: input.observedAt,
    createdAt: now,
    note: input.note.trim() || undefined,
    markIds: input.markIds,
    measurements: input.measurements,
    isImportant: input.isImportant,
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

export async function listObservations(projectId: string) {
  const observations = await db.observations.where('projectId').equals(projectId).toArray()
  return observations.sort((a, b) => b.observedAt - a.observedAt)
}

export async function listPhotos(projectId: string) {
  const photos = await db.photos.where('projectId').equals(projectId).toArray()
  return photos.sort((a, b) => a.createdAt - b.createdAt || (a.order ?? 0) - (b.order ?? 0))
}

export async function deleteObservation(observationId: string) {
  await db.transaction('rw', db.observations, db.photos, async () => {
    await db.photos.where('observationId').equals(observationId).delete()
    await db.observations.delete(observationId)
  })
}
