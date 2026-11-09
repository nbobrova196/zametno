import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { db } from '../db/db'
import type { Mark, Metric, Observation, ObservationKind, Photo } from '../db/types'
import { listObservations, saveObservation, updateObservation } from '../domain/observations'
import { completeReminder } from '../domain/reminderActions'
import { parseMeasurement } from '../domain/measurements'
import { formatDay, formatNumber, formatTime } from '../lib/format'
import { getStorageInfo, storageErrorMessage } from '../lib/storage'
import { useProject } from '../lib/useProject'
import { PhotoImage } from '../components/PhotoImage'
import { Button, Card, Field, Input, Textarea, cn } from '../components/ui'

const kinds: Array<{ id: ObservationKind; title: string; hint: string }> = [
  { id: 'observation', title: 'Наблюдение', hint: 'Фото, заметка, отметки' },
  { id: 'no_changes', title: 'Изменений нет', hint: 'Смотрел, но всё как прежде' },
  { id: 'skipped', title: 'Не наблюдал', hint: 'Пропуск — это не наблюдение' },
]

interface PickedPhoto {
  id: string
  file: File
  url: string
}

interface ObservationDraft {
  savedAt: number
  kind: ObservationKind
  observedAt: string
  note: string
  markIds: string[]
  values: Record<string, string>
  important: boolean
}

const DRAFT_PREFIX = 'zametno:draft:'

function draftKey(projectId: string) {
  return `${DRAFT_PREFIX}${projectId}`
}

function readDraft(projectId: string): ObservationDraft | null {
  try {
    const raw = window.localStorage.getItem(draftKey(projectId))
    if (!raw) return null
    const data = JSON.parse(raw) as Partial<ObservationDraft>
    if (!data || typeof data !== 'object') return null
    return {
      savedAt: typeof data.savedAt === 'number' ? data.savedAt : Date.now(),
      kind:
        data.kind === 'no_changes' || data.kind === 'skipped' || data.kind === 'care'
          ? data.kind
          : 'observation',
      observedAt: typeof data.observedAt === 'string' ? data.observedAt : toLocalInput(Date.now()),
      note: typeof data.note === 'string' ? data.note : '',
      markIds: Array.isArray(data.markIds) ? data.markIds.filter((id) => typeof id === 'string') : [],
      values:
        data.values && typeof data.values === 'object'
          ? Object.fromEntries(
              Object.entries(data.values).filter(([, value]) => typeof value === 'string'),
            )
          : {},
      important: Boolean(data.important),
    }
  } catch {
    return null
  }
}

function writeDraft(projectId: string, draft: ObservationDraft) {
  try {
    window.localStorage.setItem(draftKey(projectId), JSON.stringify(draft))
  } catch {
    // Черновик — вспомогательная функция: если localStorage недоступен, просто не сохраняем.
  }
}

function clearDraft(projectId: string) {
  try {
    window.localStorage.removeItem(draftKey(projectId))
  } catch {
    // см. writeDraft
  }
}

function toLocalInput(timestamp: number) {
  const date = new Date(timestamp)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

export function NewObservationScreen() {
  const { projectId, observationId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const project = useProject(projectId)
  const reminderId = searchParams.get('reminder')
  const reminderDate = searchParams.get('date')
  const editing = Boolean(observationId)

  const metrics = useLiveQuery(
    () => (projectId ? db.metrics.where('projectId').equals(projectId).toArray() : Promise.resolve([] as Metric[])),
    [projectId],
    [],
  )
  const marks = useLiveQuery(
    () => (projectId ? db.marks.where('projectId').equals(projectId).toArray() : Promise.resolve([] as Mark[])),
    [projectId],
    [],
  )
  const previousObservation = useLiveQuery(
    () =>
      projectId
        ? listObservations(projectId).then((items) =>
            items.find((item) => item.id !== observationId),
          )
        : Promise.resolve(undefined),
    [projectId, observationId],
  )
  const existing = useLiveQuery<Observation | null>(
    async () => {
      if (!observationId) return null
      return (await db.observations.get(observationId)) ?? null
    },
    [observationId],
  )
  const existingPhotos = useLiveQuery(
    () =>
      observationId
        ? db.photos.where('observationId').equals(observationId).toArray()
        : Promise.resolve([] as Photo[]),
    [observationId],
    [],
  )

  const [kind, setKind] = useState<ObservationKind>('observation')
  const [observedAt, setObservedAt] = useState(() => toLocalInput(Date.now()))
  const [note, setNote] = useState('')
  const [selectedMarks, setSelectedMarks] = useState<string[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [important, setImportant] = useState(false)
  const [picked, setPicked] = useState<PickedPhoto[]>([])
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([])
  const [existingOrder, setExistingOrder] = useState<string[] | null>(null)
  const [dragging, setDragging] = useState(false)
  const [draftRestoredAt, setDraftRestoredAt] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const pickedUrls = useRef(new Set<string>())

  // Восстанавливаем черновик до того, как эффект сохранения успеет его перезаписать.
  useEffect(() => {
    if (editing || !projectId) return
    const draft = readDraft(projectId)
    if (!draft) return

    setKind(draft.kind === 'care' ? 'observation' : draft.kind)
    setObservedAt(draft.observedAt)
    setNote(draft.note)
    setSelectedMarks(draft.markIds)
    setValues(draft.values)
    setImportant(draft.important)
    setDraftRestoredAt(draft.savedAt)
  }, [editing, projectId])

  // Сохраняем черновик с задержкой, чтобы не писать в localStorage на каждую букву.
  useEffect(() => {
    if (editing || !projectId) return
    const timer = window.setTimeout(() => {
      const hasContent =
        note.trim().length > 0 ||
        selectedMarks.length > 0 ||
        Object.values(values).some((value) => value.trim() !== '') ||
        important ||
        kind !== 'observation'

      if (!hasContent) {
        clearDraft(projectId)
        return
      }

      writeDraft(projectId, {
        savedAt: Date.now(),
        kind,
        observedAt,
        note,
        markIds: selectedMarks,
        values,
        important,
      })
    }, 500)

    return () => window.clearTimeout(timer)
  }, [editing, projectId, kind, observedAt, note, selectedMarks, values, important])

  // Освобождаем blob-адреса выбранных фото, когда они больше не нужны.
  useEffect(() => {
    const current = new Set(picked.map((item) => item.url))
    for (const url of pickedUrls.current) {
      if (!current.has(url)) URL.revokeObjectURL(url)
    }
    pickedUrls.current = current
  }, [picked])

  useEffect(() => {
    return () => {
      for (const url of pickedUrls.current) URL.revokeObjectURL(url)
    }
  }, [])

  useEffect(() => {
    if (!observationId || !existing || loaded) return
    setKind(existing.kind === 'care' ? 'observation' : existing.kind)
    setObservedAt(toLocalInput(existing.observedAt))
    setNote(existing.note ?? '')
    setSelectedMarks(existing.markIds)
    setValues(
      Object.fromEntries(existing.measurements.map((measurement) => [measurement.metricId, String(measurement.value)])),
    )
    setImportant(existing.isImportant)
    setLoaded(true)
  }, [observationId, existing, loaded])

  const previousValues = useMemo(() => {
    const map = new Map<string, number>()
    for (const measurement of previousObservation?.measurements ?? []) {
      map.set(measurement.metricId, measurement.value)
    }
    return map
  }, [previousObservation])

  const visibleExistingPhotos = useMemo(() => {
    const removed = new Set(removedPhotoIds)
    return existingPhotos
      .filter((photo) => !removed.has(photo.id))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt)
  }, [existingPhotos, removedPhotoIds])

  const orderedExistingPhotos = useMemo(() => {
    const byId = new Map(visibleExistingPhotos.map((photo) => [photo.id, photo]))
    const natural = visibleExistingPhotos.map((photo) => photo.id)
    const base = existingOrder ? existingOrder.filter((id) => byId.has(id)) : natural
    const merged = [...base, ...natural.filter((id) => !base.includes(id))]
    return merged.flatMap((id) => {
      const photo = byId.get(id)
      return photo ? [photo] : []
    })
  }, [visibleExistingPhotos, existingOrder])

  if (observationId && existing === null) {
    return (
      <Card className="mx-auto max-w-3xl p-8 text-center">
        <p className="text-3xl" aria-hidden="true">🫥</p>
        <h1 className="mt-3 font-display text-2xl text-ink">Запись не найдена</h1>
        <p className="mt-2 text-sm text-muted">Возможно, её уже удалили.</p>
        <Link
          to={`/p/${projectId}/history`}
          className="mt-5 inline-block text-sm font-medium text-forest-700 underline decoration-forest-200 underline-offset-4"
        >
          К истории наблюдений
        </Link>
      </Card>
    )
  }

  if (observationId && (existing === undefined || !loaded)) {
    return (
      <div className="mx-auto max-w-3xl space-y-4" aria-busy="true">
        <div className="h-4 w-40 animate-pulse rounded bg-line" />
        <div className="h-9 w-72 animate-pulse rounded-lg bg-line" />
        <div className="h-40 animate-pulse rounded-2xl bg-line" />
        <div className="h-56 animate-pulse rounded-2xl bg-line" />
      </div>
    )
  }

  if (!project || !projectId) return null

  const isSkipped = kind === 'skipped'
  const totalPhotos = orderedExistingPhotos.length + picked.length

  function addFiles(list: File[]) {
    const images = list.filter((file) => file.type.startsWith('image/'))
    if (images.length === 0) return
    setPicked((current) => [
      ...current,
      ...images.map((file) => ({
        id: crypto.randomUUID(),
        file,
        url: URL.createObjectURL(file),
      })),
    ])
  }

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.target.files ?? []))
    event.target.value = ''
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    if (!Array.from(event.dataTransfer.types).includes('Files')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setDragging(true)
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
    setDragging(false)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    addFiles(Array.from(event.dataTransfer.files))
  }

  function removePicked(id: string) {
    setPicked((current) => current.filter((item) => item.id !== id))
  }

  function removeExistingPhoto(id: string) {
    setRemovedPhotoIds((current) => [...current, id])
  }

  function moveExisting(id: string, direction: -1 | 1) {
    const ids = orderedExistingPhotos.map((photo) => photo.id)
    const index = ids.indexOf(id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= ids.length) return
    const next = [...ids]
    ;[next[index], next[target]] = [next[target], next[index]]
    setExistingOrder(next)
  }

  function movePicked(id: string, direction: -1 | 1) {
    setPicked((current) => {
      const index = current.findIndex((item) => item.id === id)
      const target = index + direction
      if (index < 0 || target < 0 || target >= current.length) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function toggleMark(markId: string) {
    setSelectedMarks((current) =>
      current.includes(markId) ? current.filter((id) => id !== markId) : [...current, markId],
    )
  }

  function discardDraft() {
    if (!projectId) return
    clearDraft(projectId)
    setDraftRestoredAt(null)
    setKind('observation')
    setObservedAt(toLocalInput(Date.now()))
    setNote('')
    setSelectedMarks([])
    setValues({})
    setImportant(false)
  }

  async function handleSave() {
    if (!projectId) return

    const hasContent =
      picked.length > 0 ||
      orderedExistingPhotos.length > 0 ||
      note.trim().length > 0 ||
      selectedMarks.length > 0 ||
      Object.values(values).some((value) => value.trim() !== '')

    if (kind === 'observation' && !hasContent) {
      setError('Добавь хотя бы фото, заметку или отметку — иначе записывать нечего.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const filesToSave = isSkipped ? [] : picked.map((item) => item.file)

      if (filesToSave.length > 0) {
        const info = await getStorageInfo()
        if (info && info.quota > 0 && info.quota - info.usage < 5 * 1024 * 1024) {
          setError(
            'На устройстве почти не осталось места. Скачай архив проекта и освободи место, чтобы не потерять новые фотографии.',
          )
          setSaving(false)
          return
        }
      }

      const payload = {
        kind,
        observedAt: new Date(observedAt).getTime() || Date.now(),
        note,
        markIds: selectedMarks,
        measurements: metrics.flatMap((metric) => {
          const value = parseMeasurement(values[metric.id])
          return value === undefined ? [] : [{ metricId: metric.id, value }]
        }),
        isImportant: important && !isSkipped,
      }

      const toast = isSkipped
        ? 'Пропуск отмечен'
        : editing
          ? 'Изменения сохранены'
          : 'Наблюдение сохранено'

      if (editing && observationId) {
        await updateObservation({
          id: observationId,
          ...payload,
          files: filesToSave,
          removedPhotoIds,
          photoOrder: orderedExistingPhotos.map((photo) => photo.id),
        })
        navigate(`/p/${projectId}/history`, { replace: true, state: { toast } })
        return
      }

      const createdId = await saveObservation({
        projectId,
        ...payload,
        files: filesToSave,
      })

      clearDraft(projectId)

      if (reminderId && reminderDate && !isSkipped) {
        await completeReminder({
          reminderId,
          projectId,
          date: reminderDate,
          observationId: createdId,
        })
      }

      navigate(reminderId ? '/today' : `/p/${projectId}/history`, {
        replace: true,
        state: { toast },
      })
    } catch (saveError) {
      setError(
        storageErrorMessage(
          saveError,
          editing
            ? 'Не получилось сохранить изменения. Попробуй ещё раз.'
            : 'Не получилось сохранить запись. Попробуй ещё раз.',
        ),
      )
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link
          to={editing ? `/p/${projectId}/history` : `/p/${projectId}`}
          onClick={() => {
            if (!editing) clearDraft(projectId)
          }}
          className="text-sm font-medium text-forest-700 underline decoration-forest-200 underline-offset-4"
        >
          ← {editing ? 'К истории' : 'К проекту'}
        </Link>
        <span className="text-xs text-muted">Запись сохранится на этом устройстве</span>
      </div>

      <div>
        <h1 className="font-display text-3xl text-ink">
          {editing ? 'Изменить наблюдение' : 'Новое наблюдение'}
        </h1>
        <p className="mt-1 break-words text-sm text-muted">{project.title}</p>
      </div>

      {draftRestoredAt ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-forest-100 bg-forest-50 px-4 py-3">
          <p className="text-sm leading-relaxed text-forest-700">
            Черновик от {formatDay(draftRestoredAt)}, {formatTime(draftRestoredAt)}. Текст,
            отметки и измерения восстановлены — фото нужно выбрать заново.
          </p>
          <Button variant="secondary" size="sm" onClick={discardDraft}>
            Очистить
          </Button>
        </div>
      ) : null}

      <Card className="space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          {kinds.map((option) => {
            const active = kind === option.id
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setKind(option.id)}
                aria-pressed={active}
                className={cn(
                  'rounded-xl border px-3.5 py-3 text-left transition-colors',
                  active
                    ? 'border-forest-400 bg-forest-50'
                    : 'border-line bg-surface hover:border-forest-200',
                )}
              >
                <span className="block text-sm font-medium text-ink">{option.title}</span>
                <span className="mt-0.5 block text-xs leading-snug text-muted">{option.hint}</span>
              </button>
            )
          })}
        </div>

        <Field
          label="Когда наблюдал"
          htmlFor="observedAt"
          hint="Если записываешь позже — поставь настоящее время наблюдения."
        >
          <Input
            id="observedAt"
            type="datetime-local"
            value={observedAt}
            onChange={(event) => setObservedAt(event.target.value)}
            className="sm:max-w-xs"
          />
        </Field>
      </Card>

      {isSkipped ? (
        <Card className="space-y-4 p-5">
          <p className="rounded-xl bg-paper px-4 py-3 text-sm leading-relaxed text-muted">
            Пропуск не станет наблюдением и не попадёт в сравнения. Так честнее: в истории будет
            видно, что в этот день ты не наблюдал.
          </p>
          <Field label="Комментарий" htmlFor="skipNote" hint="Необязательно.">
            <Textarea
              id="skipNote"
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Например: не было времени или уезжал"
            />
          </Field>
        </Card>
      ) : (
        <>
          <Card className="space-y-4 p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-medium text-ink">Фото</h2>
              <span className="text-xs text-muted">Можно несколько · сжимаются автоматически</span>
            </div>

            {totalPhotos > 0 ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {orderedExistingPhotos.map((photo, index) => (
                  <div
                    key={photo.id}
                    className="overflow-hidden rounded-xl border border-line bg-surface"
                  >
                    <div className="relative">
                      <PhotoImage
                        photo={photo}
                        className="aspect-[4/3] w-full object-cover"
                        alt={`Фото из записи ${index + 1}`}
                      />
                      <button
                        type="button"
                        onClick={() => removeExistingPhoto(photo.id)}
                        className="absolute top-1.5 right-1.5 inline-flex min-h-11 items-center rounded-full bg-ink/70 px-3 py-2 text-xs text-white backdrop-blur hover:bg-ink"
                        aria-label={`Убрать фото ${index + 1} из записи`}
                      >
                        Убрать
                      </button>
                    </div>
                    {totalPhotos > 1 ? (
                      <div className="flex items-center justify-between px-1">
                        <button
                          type="button"
                          onClick={() => moveExisting(photo.id, -1)}
                          disabled={index === 0}
                          aria-label={`Переместить фото ${index + 1} влево`}
                          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-paper hover:text-ink disabled:opacity-30"
                        >
                          ←
                        </button>
                        <span className="text-xs text-muted" aria-hidden="true">
                          {index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => moveExisting(photo.id, 1)}
                          disabled={index === orderedExistingPhotos.length - 1}
                          aria-label={`Переместить фото ${index + 1} вправо`}
                          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-paper hover:text-ink disabled:opacity-30"
                        >
                          →
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
                {picked.map((item, index) => (
                  <div
                    key={item.id}
                    className="overflow-hidden rounded-xl border border-line bg-surface"
                  >
                    <div className="relative">
                      <img
                        src={item.url}
                        alt={`Выбранное фото ${orderedExistingPhotos.length + index + 1}`}
                        className="aspect-[4/3] w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removePicked(item.id)}
                        className="absolute top-1.5 right-1.5 inline-flex min-h-11 items-center rounded-full bg-ink/70 px-3 py-2 text-xs text-white backdrop-blur hover:bg-ink"
                        aria-label={`Убрать фото ${orderedExistingPhotos.length + index + 1}`}
                      >
                        Убрать
                      </button>
                    </div>
                    {totalPhotos > 1 ? (
                      <div className="flex items-center justify-between px-1">
                        <button
                          type="button"
                          onClick={() => movePicked(item.id, -1)}
                          disabled={index === 0}
                          aria-label={`Переместить фото ${orderedExistingPhotos.length + index + 1} влево`}
                          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-paper hover:text-ink disabled:opacity-30"
                        >
                          ←
                        </button>
                        <span className="text-xs text-muted" aria-hidden="true">
                          {orderedExistingPhotos.length + index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => movePicked(item.id, 1)}
                          disabled={index === picked.length - 1}
                          aria-label={`Переместить фото ${orderedExistingPhotos.length + index + 1} вправо`}
                          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-paper hover:text-ink disabled:opacity-30"
                        >
                          →
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <label
                htmlFor="photoInput"
                className={cn(
                  'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-4 py-8 text-center transition-colors',
                  dragging
                    ? 'border-forest-500 bg-forest-50'
                    : 'border-forest-200 bg-forest-50/40 hover:border-forest-300 hover:bg-forest-50',
                )}
              >
                <span className="text-2xl" aria-hidden="true">📷</span>
                <span className="text-sm font-medium text-forest-700">
                  {dragging ? 'Отпусти фото' : 'Добавить фото'}
                </span>
                <span className="text-xs text-muted">
                  Нажми, чтобы выбрать из галереи или камеры. На компьютере можно перетащить файлы
                  сюда.
                </span>
              </label>
              <input
                id="photoInput"
                type="file"
                accept="image/*"
                multiple
                onChange={handleFiles}
                className="sr-only"
              />
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <Field label="Заметка" htmlFor="note" hint="Своими словами: что заметил, что удивило.">
              <Textarea
                id="note"
                rows={3}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Например: сегодня лист развернулся почти полностью"
              />
            </Field>

            {marks.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-ink">Быстрые отметки</p>
                <div className="flex flex-wrap gap-2">
                  {marks.map((mark) => {
                    const active = selectedMarks.includes(mark.id)
                    return (
                      <button
                        key={mark.id}
                        type="button"
                        onClick={() => toggleMark(mark.id)}
                        aria-pressed={active}
                        className={cn(
                          'inline-flex min-h-11 items-center rounded-full border px-3.5 py-1.5 text-sm transition-colors',
                          active
                            ? 'border-forest-500 bg-forest-600 text-white'
                            : 'border-line bg-surface text-ink hover:border-forest-300',
                        )}
                      >
                        {mark.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </Card>

          {metrics.length > 0 ? (
            <Card className="space-y-4 p-5">
              <div>
                <h2 className="text-sm font-medium text-ink">Измерения</h2>
                <p className="mt-0.5 text-xs text-muted">
                  Заполняй то, что удалось измерить. Пустые поля — это нормально, пропуски не
                  выдумываются.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {metrics.map((metric) => {
                  const previous = previousValues.get(metric.id)
                  return (
                    <Field
                      key={metric.id}
                      label={metric.name}
                      htmlFor={`metric-${metric.id}`}
                      hint={previous !== undefined ? `В прошлый раз: ${formatNumber(previous)} ${metric.unit}` : undefined}
                    >
                      <div className="flex items-center gap-2">
                        <Input
                          id={`metric-${metric.id}`}
                          inputMode="decimal"
                          value={values[metric.id] ?? ''}
                          onChange={(event) =>
                            setValues((current) => ({ ...current, [metric.id]: event.target.value }))
                          }
                          placeholder="—"
                        />
                        <span className="w-10 shrink-0 text-sm text-muted">{metric.unit}</span>
                      </div>
                    </Field>
                  )
                })}
              </div>
            </Card>
          ) : null}

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 shadow-soft">
            <input
              type="checkbox"
              checked={important}
              onChange={(event) => setImportant(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-forest-600"
            />
            <span>
              <span className="block text-sm font-medium text-ink">Это важное событие</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                Попадёт в подборку для презентации: первый росток, новая птица, неожиданное
                изменение.
              </span>
            </span>
          </label>
        </>
      )}

      {error ? (
        <p className="rounded-xl border border-clay/30 bg-clay/10 px-4 py-3 text-sm text-clay" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 pb-6">
        <Button size="lg" onClick={handleSave} disabled={saving}>
          {saving
            ? 'Сохраняю…'
            : editing
              ? 'Сохранить изменения'
              : isSkipped
                ? 'Отметить пропуск'
                : 'Сохранить наблюдение'}
        </Button>
        <Link
          to={editing ? `/p/${projectId}/history` : `/p/${projectId}`}
          onClick={() => {
            if (!editing) clearDraft(projectId)
          }}
          className="text-sm font-medium text-forest-700 underline decoration-forest-200 underline-offset-4"
        >
          Отменить
        </Link>
      </div>
    </div>
  )
}
