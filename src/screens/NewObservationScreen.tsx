import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { db } from '../db/db'
import type { Mark, Metric, ObservationKind } from '../db/types'
import { listObservations, saveObservation } from '../domain/observations'
import { completeReminder } from '../domain/reminderActions'
import { parseMeasurement } from '../domain/measurements'
import { formatNumber } from '../lib/format'
import { useProject } from '../lib/useProject'
import { Button, Card, Field, Input, Textarea, cn } from '../components/ui'

const kinds: Array<{ id: ObservationKind; title: string; hint: string }> = [
  { id: 'observation', title: 'Наблюдение', hint: 'Фото, заметка, отметки' },
  { id: 'no_changes', title: 'Изменений нет', hint: 'Смотрел, но всё как прежде' },
  { id: 'skipped', title: 'Не наблюдал', hint: 'Пропуск — это не наблюдение' },
]

function toLocalInput(timestamp: number) {
  const date = new Date(timestamp)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

export function NewObservationScreen() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const project = useProject(projectId)
  const reminderId = searchParams.get('reminder')
  const reminderDate = searchParams.get('date')

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
  const lastObservation = useLiveQuery(
    () => (projectId ? listObservations(projectId).then((items) => items[0]) : Promise.resolve(undefined)),
    [projectId],
  )

  const [kind, setKind] = useState<ObservationKind>('observation')
  const [observedAt, setObservedAt] = useState(() => toLocalInput(Date.now()))
  const [note, setNote] = useState('')
  const [selectedMarks, setSelectedMarks] = useState<string[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [important, setImportant] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file))
    setPreviews(urls)
    return () => urls.forEach((url) => URL.revokeObjectURL(url))
  }, [files])

  const previousValues = useMemo(() => {
    const map = new Map<string, number>()
    for (const measurement of lastObservation?.measurements ?? []) {
      map.set(measurement.metricId, measurement.value)
    }
    return map
  }, [lastObservation])

  if (!project || !projectId) return null

  const isSkipped = kind === 'skipped'

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? [])
    if (selected.length > 0) setFiles((current) => [...current, ...selected])
    event.target.value = ''
  }

  function removeFile(index: number) {
    setFiles((current) => current.filter((_, i) => i !== index))
  }

  function toggleMark(markId: string) {
    setSelectedMarks((current) =>
      current.includes(markId) ? current.filter((id) => id !== markId) : [...current, markId],
    )
  }

  async function handleSave() {
    if (!projectId) return

    const hasContent =
      files.length > 0 ||
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
      const observationId = await saveObservation({
        projectId,
        kind,
        observedAt: new Date(observedAt).getTime() || Date.now(),
        note,
        markIds: selectedMarks,
        measurements: metrics.flatMap((metric) => {
          const value = parseMeasurement(values[metric.id])
          return value === undefined ? [] : [{ metricId: metric.id, value }]
        }),
        isImportant: important && !isSkipped,
        files,
      })

      if (reminderId && reminderDate && !isSkipped) {
        await completeReminder({
          reminderId,
          projectId,
          date: reminderDate,
          observationId,
        })
      }

      navigate(reminderId ? '/today' : `/p/${projectId}/history`, { replace: true })
    } catch {
      setError('Не получилось сохранить запись. Попробуй ещё раз.')
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link
          to={`/p/${projectId}`}
          className="text-sm font-medium text-forest-700 underline decoration-forest-200 underline-offset-4"
        >
          ← К проекту
        </Link>
        <span className="text-xs text-muted">Запись сохранится на этом устройстве</span>
      </div>

      <div>
        <h1 className="font-display text-3xl text-ink">Новое наблюдение</h1>
        <p className="mt-1 text-sm text-muted">{project.title}</p>
      </div>

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

            {previews.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {previews.map((url, index) => (
                  <div key={url} className="group relative overflow-hidden rounded-xl">
                    <img
                      src={url}
                      alt={`Выбранное фото ${index + 1}`}
                      className="aspect-[4/3] w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="absolute top-1.5 right-1.5 inline-flex min-h-11 items-center rounded-full bg-ink/70 px-3 py-2 text-xs text-white backdrop-blur hover:bg-ink"
                      aria-label={`Убрать фото ${index + 1}`}
                    >
                      Убрать
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <label
              htmlFor="photoInput"
              className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-forest-200 bg-forest-50/40 px-4 py-8 text-center transition-colors hover:border-forest-300 hover:bg-forest-50"
            >
              <span className="text-2xl" aria-hidden="true">📷</span>
              <span className="text-sm font-medium text-forest-700">Добавить фото</span>
              <span className="text-xs text-muted">Из галереи или камеры — сожмём автоматически</span>
            </label>
            <input
              id="photoInput"
              type="file"
              accept="image/*"
              multiple
              onChange={handleFiles}
              className="sr-only"
            />
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
          {saving ? 'Сохраняю…' : isSkipped ? 'Отметить пропуск' : 'Сохранить наблюдение'}
        </Button>
        <Link
          to={`/p/${projectId}`}
          className="text-sm font-medium text-forest-700 underline decoration-forest-200 underline-offset-4"
        >
          Отменить
        </Link>
      </div>
    </div>
  )
}
