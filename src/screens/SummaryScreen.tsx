import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useParams } from 'react-router-dom'
import { db } from '../db/db'
import type { Metric, Observation, Photo, PresentationTheme } from '../db/types'
import {
  PRESENTATION_THEMES,
  buildPresentation,
  defaultSelectedObservationIds,
  getPresentationTheme,
} from '../domain/presentation'
import { listObservations } from '../domain/observations'
import { listMetrics, updateProject } from '../domain/projects'
import { dayLabel } from '../lib/format'
import { useProject } from '../lib/useProject'
import { PhotoImage } from '../components/PhotoImage'
import { SlidePreview } from '../components/SlidePreview'
import { Badge, Button, Card, Field, Input, Textarea, cn } from '../components/ui'

const MAX_MATERIALS = 6

const kindLabels: Partial<Record<Observation['kind'], string>> = {
  no_changes: 'Изменений не заметил',
  care: 'Уход',
}

function notePreview(observation: Observation) {
  const note = observation.note?.replace(/\s+/g, ' ').trim()
  if (note) return note
  return kindLabels[observation.kind] ?? 'Запись без заметки'
}

export function SummaryScreen() {
  const { projectId } = useParams()
  const project = useProject(projectId)

  const observations = useLiveQuery(
    () => (projectId ? listObservations(projectId) : Promise.resolve([] as Observation[])),
    [projectId],
  )
  const photos = useLiveQuery(
    () =>
      projectId
        ? db.photos.where('projectId').equals(projectId).toArray()
        : Promise.resolve([] as Photo[]),
    [projectId],
  )
  const metrics = useLiveQuery(
    () => (projectId ? listMetrics(projectId) : Promise.resolve([] as Metric[])),
    [projectId],
  )

  const [authorName, setAuthorName] = useState('')
  const [hypothesis, setHypothesis] = useState('')
  const [conclusion, setConclusion] = useState('')
  const [nextSteps, setNextSteps] = useState('')
  const [theme, setTheme] = useState<PresentationTheme>('paper')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)
  const [slideIndex, setSlideIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportedName, setExportedName] = useState<string>()
  const [error, setError] = useState('')

  useEffect(() => {
    if (!project || !observations || loaded) return
    setAuthorName(project.authorName ?? '')
    setHypothesis(project.hypothesis ?? '')
    setConclusion(project.conclusion ?? '')
    setNextSteps(project.nextSteps ?? '')
    setTheme(project.presentationTheme ?? 'paper')
    setSelectedIds(defaultSelectedObservationIds(project, observations))
    setLoaded(true)
  }, [project, observations, loaded])

  useEffect(() => {
    if (loaded) setSaved(false)
  }, [authorName, hypothesis, conclusion, nextSteps, theme, selectedIds, loaded])

  const available = useMemo(
    () => (observations ?? []).filter((observation) => observation.kind !== 'skipped'),
    [observations],
  )

  const sortedPhotos = useMemo(
    () =>
      [...(photos ?? [])].sort(
        (a, b) => a.createdAt - b.createdAt || (a.order ?? 0) - (b.order ?? 0),
      ),
    [photos],
  )

  const photosByObservation = useMemo(() => {
    const map = new Map<string, Photo>()
    for (const photo of sortedPhotos) {
      if (!map.has(photo.observationId)) map.set(photo.observationId, photo)
    }
    return map
  }, [sortedPhotos])

  const presentationProject = useMemo(() => {
    if (!project) return null
    return {
      ...project,
      authorName: authorName.trim() || undefined,
      hypothesis: hypothesis.trim() || undefined,
      conclusion: conclusion.trim() || undefined,
      nextSteps: nextSteps.trim() || undefined,
    }
  }, [project, authorName, hypothesis, conclusion, nextSteps])

  const slides = useMemo(() => {
    if (!presentationProject || !observations || !photos || !metrics) return []
    return buildPresentation({
      project: presentationProject,
      observations,
      photos: sortedPhotos,
      metrics,
      selectedIds,
    })
  }, [presentationProject, observations, photos, metrics, sortedPhotos, selectedIds])

  const themeOption = getPresentationTheme(theme)
  const safeIndex = Math.min(slideIndex, Math.max(slides.length - 1, 0))
  const currentSlide = slides[safeIndex]

  if (!project || !projectId || !observations || !photos || !metrics) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-6 w-56 animate-pulse rounded bg-line" />
        <div className="h-52 animate-pulse rounded-2xl bg-line" />
        <div className="h-52 animate-pulse rounded-2xl bg-line" />
      </div>
    )
  }

  function toggleMaterial(id: string) {
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id)
      if (current.length >= MAX_MATERIALS) return current
      return [...current, id]
    })
  }

  async function persist() {
    if (!projectId) return
    await updateProject(projectId, {
      authorName: authorName.trim() || undefined,
      hypothesis: hypothesis.trim() || undefined,
      conclusion: conclusion.trim() || undefined,
      nextSteps: nextSteps.trim() || undefined,
      presentationTheme: theme,
      selectedObservationIds: selectedIds,
    })
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      await persist()
      setSaved(true)
    } catch {
      setError('Не получилось сохранить. Попробуй ещё раз.')
    } finally {
      setSaving(false)
    }
  }

  async function handleExport() {
    if (!presentationProject) return
    setExporting(true)
    setError('')
    setExportedName(undefined)
    try {
      await persist()
      const { exportPresentation } = await import('../lib/pptx')
      const name = await exportPresentation({
        project: presentationProject,
        slides,
        theme: themeOption,
      })
      setExportedName(name)
      setSaved(true)
    } catch {
      setError('Не получилось собрать презентацию. Проверь, что в проекте есть записи, и попробуй ещё раз.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 max-w-2xl space-y-1.5">
        <p className="text-xs font-semibold tracking-wide text-forest-600 uppercase">Итог проекта</p>
        <h2 className="font-display text-2xl leading-tight text-ink">Собери историю в презентацию</h2>
        <p className="text-base leading-relaxed text-muted">
          Короткий вывод, несколько главных записей — и готовая презентация на 16:9. Можно скачать и
          показать в классе.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)]">
        <div className="min-w-0 space-y-5">
          <Card className="space-y-5 p-5">
            <div>
              <h3 className="font-display text-xl text-ink">Что я выяснил</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                Пиши своими словами — так вывод будет понятен и тебе, и слушателям.
              </p>
            </div>

            <Field label="Автор" htmlFor="author" hint="Появится на первом слайде.">
              <Input
                id="author"
                value={authorName}
                onChange={(event) => setAuthorName(event.target.value)}
                placeholder="Имя и класс"
              />
            </Field>

            <Field
              label="Предположение"
              htmlFor="hypothesis"
              hint="Что ты думал в начале? Можно оставить пустым."
            >
              <Textarea
                id="hypothesis"
                rows={2}
                value={hypothesis}
                onChange={(event) => setHypothesis(event.target.value)}
                placeholder="Мне казалось, что…"
              />
            </Field>

            <Field
              label="Вывод"
              htmlFor="conclusion"
              hint="Закончи фразу: «Я выяснил, что…». Опирайся на выбранные записи."
            >
              <Textarea
                id="conclusion"
                rows={5}
                value={conclusion}
                onChange={(event) => setConclusion(event.target.value)}
                placeholder="Наблюдая, я выяснил, что…"
              />
            </Field>

            <Field
              label="Что дальше"
              htmlFor="next"
              hint="Что осталось непонятным и что хочется проверить?"
            >
              <Textarea
                id="next"
                rows={3}
                value={nextSteps}
                onChange={(event) => setNextSteps(event.target.value)}
                placeholder="В следующий раз я хочу…"
              />
            </Field>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={handleSave} disabled={saving} size="lg">
                {saving ? 'Сохраняю…' : 'Сохранить'}
              </Button>
              {saved ? <span className="text-sm text-forest-700">Сохранено</span> : null}
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="font-display text-xl text-ink">Материалы</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  Отметь до {MAX_MATERIALS} записей, которые попадут в презентацию.
                </p>
              </div>
              <span
                className={cn(
                  'text-sm tabular-nums',
                  selectedIds.length === 0 ? 'text-amber-600' : 'text-muted',
                )}
              >
                {selectedIds.length} из {MAX_MATERIALS}
              </span>
            </div>

            {available.length === 0 ? (
              <p className="rounded-xl border border-line bg-paper px-4 py-3 text-sm leading-relaxed text-muted">
                Записей пока нет. Презентация соберётся из текста: вопроса, хода наблюдения и вывода.
              </p>
            ) : (
              <div className="space-y-2">
                {available.map((observation) => {
                  const checked = selectedIds.includes(observation.id)
                  const atLimit = !checked && selectedIds.length >= MAX_MATERIALS
                  const photo = photosByObservation.get(observation.id)

                  return (
                    <label
                      key={observation.id}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors',
                        checked
                          ? 'border-forest-300 bg-forest-50'
                          : 'border-line bg-surface hover:border-forest-200',
                        atLimit && 'cursor-not-allowed opacity-55',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={atLimit}
                        onChange={() => toggleMaterial(observation.id)}
                        className="mt-1 h-4 w-4 shrink-0 accent-forest-600"
                      />
                      {photo ? (
                        <PhotoImage
                          photo={photo}
                          className="h-14 w-14 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <span
                          className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-paper text-lg text-muted"
                          aria-hidden="true"
                        >
                          ✎
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-ink">
                            {dayLabel(observation.observedAt)}
                          </span>
                          {observation.isImportant ? <Badge tone="amber">★ Важное</Badge> : null}
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-sm leading-relaxed text-muted">
                          {notePreview(observation)}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>
            )}

            {selectedIds.length === 0 && available.length > 0 ? (
              <p
                className="rounded-xl border border-amber-200 bg-amber-100/60 px-4 py-3 text-sm leading-relaxed text-amber-600"
                role="status"
              >
                Пока не выбрано ни одной записи. Экспортировать можно — но слайд с наблюдениями будет
                без фотографий.
              </p>
            ) : null}
          </Card>
        </div>

        <div className="min-w-0 space-y-5 xl:sticky xl:top-6 xl:self-start">
          <Card className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-xl text-ink">Оформление</h3>
              <span className="text-xs text-muted">Три спокойные темы</span>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              {PRESENTATION_THEMES.map((option) => {
                const active = option.id === theme
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setTheme(option.id)}
                    aria-pressed={active}
                    className={cn(
                      'rounded-xl border p-3 text-left transition-colors',
                      active
                        ? 'border-forest-400 bg-forest-50'
                        : 'border-line bg-surface hover:border-forest-200',
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="grid h-7 w-7 place-items-center rounded-full border border-black/5"
                        style={{ backgroundColor: option.bg }}
                        aria-hidden="true"
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: option.accent }}
                        />
                      </span>
                      <span className="text-sm font-medium text-ink">{option.title}</span>
                    </span>
                    <span className="mt-1.5 block text-xs leading-relaxed text-muted">
                      {option.description}
                    </span>
                  </button>
                )
              })}
            </div>
          </Card>

          <Card className="space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-xl text-ink">Предпросмотр</h3>
              <span className="text-sm tabular-nums text-muted">
                {slides.length > 0 ? `${safeIndex + 1} из ${slides.length}` : '0 из 0'}
              </span>
            </div>

            {currentSlide ? (
              <>
                <SlidePreview slide={currentSlide} theme={themeOption} />

                <div className="flex items-center justify-between gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSlideIndex((index) => Math.max(index - 1, 0))}
                    disabled={safeIndex === 0}
                    aria-label="Предыдущий слайд"
                  >
                    ← Назад
                  </Button>

                  <span className="text-sm tabular-nums text-muted">
                    {safeIndex + 1} / {slides.length}
                  </span>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSlideIndex((index) => Math.min(index + 1, slides.length - 1))}
                    disabled={safeIndex >= slides.length - 1}
                    aria-label="Следующий слайд"
                  >
                    Вперёд →
                  </Button>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Слайды">
                  {slides.map((slide, index) => (
                    <button
                      key={slide.id}
                      type="button"
                      aria-pressed={index === safeIndex}
                      aria-label={`Слайд ${index + 1}: ${slide.title}`}
                      onClick={() => setSlideIndex(index)}
                      className={cn(
                        'w-[8.5rem] shrink-0 rounded-lg border px-2.5 py-2 text-left transition-colors',
                        index === safeIndex
                          ? 'border-forest-400 bg-forest-50'
                          : 'border-line bg-surface hover:border-forest-200',
                      )}
                    >
                      <span className="block text-[11px] font-semibold tracking-wide text-muted uppercase">
                        Слайд {index + 1}
                      </span>
                      <span className="mt-0.5 block truncate text-xs font-medium text-ink">
                        {slide.title}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="rounded-xl border border-line bg-paper px-4 py-6 text-center text-sm text-muted">
                Слайды появятся, когда будет готов текст или материалы.
              </p>
            )}
          </Card>

          <Card className="space-y-3 p-5">
            <h3 className="font-display text-xl text-ink">Скачать презентацию</h3>
            <p className="text-sm leading-relaxed text-muted">
              PPTX откроется в PowerPoint, Keynote или Google Slides. Текст и фотографии можно
              поправить после скачивания.
            </p>
            <Button onClick={handleExport} size="lg" disabled={exporting || slides.length === 0}>
              {exporting ? 'Собираю презентацию…' : 'Скачать PPTX'}
            </Button>

            {exportedName ? (
              <p className="rounded-xl border border-forest-100 bg-forest-50 px-4 py-3 text-sm text-forest-700" role="status">
                Готово: «{exportedName}». Файл уже в загрузках.
              </p>
            ) : null}

            {error ? (
              <p className="rounded-xl border border-clay/30 bg-clay/10 px-4 py-3 text-sm text-clay" role="alert">
                {error}
              </p>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  )
}
