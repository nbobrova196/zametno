import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useParams } from 'react-router-dom'
import { useState } from 'react'
import { db } from '../db/db'
import type { Observation, Photo } from '../db/types'
import { groupPhotosByObservation } from '../domain/observations'
import { formatFull } from '../lib/format'
import { PhotoImage } from '../components/PhotoImage'
import { EmptyState, buttonStyles, Card } from '../components/ui'

interface Item {
  photo: Photo
  at: number
  note?: string
}

export function CompareScreen() {
  const { projectId } = useParams()
  const photos = useLiveQuery(
    () => (projectId ? db.photos.where('projectId').equals(projectId).toArray() : Promise.resolve([] as Photo[])),
    [projectId],
    [],
  )
  const observations = useLiveQuery(
    () =>
      projectId
        ? db.observations.where('projectId').equals(projectId).toArray()
        : Promise.resolve([] as Observation[]),
    [projectId],
    [],
  )

  const [leftId, setLeftId] = useState('')
  const [rightId, setRightId] = useState('')

  if (!projectId) return null

  const observationsById = new Map<string, Observation>(
    observations.map((observation) => [observation.id, observation]),
  )
  const photosByObservation = groupPhotosByObservation(photos)

  // Сравниваем разные наблюдения, а не два кадра одной записи.
  const observationItems: Item[] = observations
    .filter((observation) => photosByObservation.has(observation.id))
    .map((observation) => ({
      photo: photosByObservation.get(observation.id)![0],
      at: observation.observedAt,
      note: observation.note,
    }))
    .sort((a, b) => b.at - a.at)

  const photoItems: Item[] = photos
    .map((photo) => {
      const observation = observationsById.get(photo.observationId)
      return {
        photo,
        at: observation?.observedAt ?? photo.createdAt,
        note: observation?.note,
      }
    })
    .sort((a, b) => b.at - a.at)

  const items = observationItems.length >= 2 ? observationItems : photoItems

  if (items.length < 2) {
    return (
      <EmptyState
        emoji="🎞️"
        title="Нужны два фото"
        description="Сравнение появится, когда в проекте будет хотя бы два снимка. Добавь наблюдение с фотографией — и возвращайся."
        action={
          <Link to={`/p/${projectId}/add`} className={buttonStyles('primary', 'lg')}>
            Добавить наблюдение
          </Link>
        }
      />
    )
  }

  const right = items.find((item) => item.photo.id === rightId) ?? items[0]
  const left = items.find((item) => item.photo.id === leftId) ?? items[1] ?? items[0]

  const older = left.at <= right.at ? left : right
  const newer = left.at <= right.at ? right : left

  function renderSelect(value: string, onChange: (id: string) => void, label: string) {
    return (
      <label className="flex flex-col gap-1 text-xs text-muted">
        {label}
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-11 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-forest-400 focus:outline-none focus:ring-2 focus:ring-forest-100"
        >
          {items.map((item) => (
            <option key={item.photo.id} value={item.photo.id}>
              {formatFull(item.at)}
            </option>
          ))}
        </select>
      </label>
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {renderSelect(older.photo.id, setLeftId, 'Слева — раньше')}
        {renderSelect(newer.photo.id, setRightId, 'Справа — позже')}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {[older, newer].map((item, index) => (
          <Card key={item.photo.id} className="overflow-hidden">
            <PhotoImage
              photo={item.photo}
              full
              className="aspect-[4/3] w-full bg-paper object-contain"
              alt={index === 0 ? 'Фотография раньше' : 'Фотография позже'}
            />
            <div className="space-y-1 px-4 py-3">
              <p className="text-xs font-medium tracking-wide text-forest-600 uppercase">
                {index === 0 ? 'Раньше' : 'Позже'}
              </p>
              <p className="text-sm text-ink">{formatFull(item.at)}</p>
              {item.note ? (
                <p className="line-clamp-2 text-xs leading-relaxed text-muted">{item.note}</p>
              ) : null}
            </div>
          </Card>
        ))}
      </div>

      <p className="text-sm leading-relaxed text-muted">
        Сравнивай снимки с одного места и ракурса — так изменения видны честнее. Даты всегда
        подписаны, чтобы не перепутать порядок.
      </p>
    </div>
  )
}
