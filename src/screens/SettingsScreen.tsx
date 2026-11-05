import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deleteProjectCascade } from '../db/db'
import type { ProjectMode } from '../db/types'
import { updateProject } from '../domain/projects'
import { formatBytes } from '../lib/photos'
import { getStorageInfo, requestPersistentStorage, type StorageInfo } from '../lib/storage'
import { useProject } from '../lib/useProject'
import { Button, Badge, Card, Field, Input, Textarea, cn } from '../components/ui'

const modeOptions: Array<{ id: ProjectMode; title: string; description: string }> = [
  {
    id: 'quick',
    title: 'Быстрый дневник',
    description: 'Фото и короткая заметка — для регулярных наблюдений.',
  },
  {
    id: 'research',
    title: 'Исследование',
    description: 'Вопрос, измерения и вывод — для школьного проекта.',
  },
]

export function SettingsScreen() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const project = useProject(projectId)

  const [title, setTitle] = useState('')
  const [subjectName, setSubjectName] = useState('')
  const [question, setQuestion] = useState('')
  const [mode, setMode] = useState<ProjectMode>('quick')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [confirmingComplete, setConfirmingComplete] = useState(false)
  const [error, setError] = useState('')
  const [archiveBusy, setArchiveBusy] = useState(false)
  const [archiveMessage, setArchiveMessage] = useState('')
  const [archiveError, setArchiveError] = useState('')
  const [storage, setStorage] = useState<StorageInfo | null>()
  const [protecting, setProtecting] = useState(false)
  const [protectMessage, setProtectMessage] = useState('')

  useEffect(() => {
    void getStorageInfo().then(setStorage)
  }, [])

  useEffect(() => {
    if (!project || loaded) return
    setTitle(project.title)
    setSubjectName(project.subjectName)
    setQuestion(project.question ?? '')
    setMode(project.mode)
    setStartDate(project.startDate ?? '')
    setEndDate(project.endDate ?? '')
    setLoaded(true)
  }, [project, loaded])

  if (!project || !projectId) return null

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) {
      setError('Название не может быть пустым.')
      return
    }
    if (!projectId) return

    setSaving(true)
    setError('')
    setSaved(false)
    try {
      await updateProject(projectId, {
        title: title.trim(),
        subjectName: subjectName.trim(),
        question: question.trim() || undefined,
        mode,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      })
      setSaved(true)
    } catch {
      setError('Не получилось сохранить изменения. Попробуй ещё раз.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!projectId) return
    await deleteProjectCascade(projectId)
    navigate('/', { replace: true })
  }

  async function handleExportArchive() {
    if (!projectId) return
    setArchiveBusy(true)
    setArchiveError('')
    setArchiveMessage('')
    try {
      const { downloadBlob, exportProjectArchive } = await import('../domain/archive')
      const { blob, filename } = await exportProjectArchive(projectId)
      downloadBlob(blob, filename)
      setArchiveMessage(`Архив «${filename}» скачан. Сохрани его как резервную копию.`)
    } catch {
      setArchiveError('Не получилось собрать архив. Попробуй ещё раз.')
    } finally {
      setArchiveBusy(false)
    }
  }

  async function handleProtect() {
    setProtecting(true)
    try {
      const granted = await requestPersistentStorage()
      setStorage(await getStorageInfo())
      setProtectMessage(
        granted
          ? 'Готово: браузер будет реже удалять данные при нехватке места.'
          : 'Браузер пока не подтвердил защиту. Обычно она включается после установки приложения и нескольких визитов. Архив всё равно стоит скачать.',
      )
    } finally {
      setProtecting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <form onSubmit={handleSubmit} className="space-y-5">
        <Card className="space-y-5 p-5">
          <div>
            <h2 className="font-display text-2xl text-ink">О проекте</h2>
            <p className="mt-1 text-sm text-muted">
              Название и вопрос можно уточнять по ходу — записи останутся на месте.
            </p>
          </div>

          <Field label="Название" htmlFor="title">
            <Input id="title" value={title} onChange={(event) => setTitle(event.target.value)} />
          </Field>

          <Field label="Объект наблюдения" htmlFor="subject">
            <Input
              id="subject"
              value={subjectName}
              onChange={(event) => setSubjectName(event.target.value)}
              placeholder="За кем или за чем наблюдаем?"
            />
          </Field>

          <Field label="Вопрос" htmlFor="question" hint="На него ответит история наблюдений.">
            <Textarea
              id="question"
              rows={2}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
          </Field>
        </Card>

        <Card className="space-y-4 p-5">
          <h2 className="text-sm font-medium text-ink">Режим</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {modeOptions.map((option) => {
              const active = mode === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setMode(option.id)}
                  aria-pressed={active}
                  className={cn(
                    'rounded-xl border p-4 text-left transition-colors',
                    active
                      ? 'border-forest-400 bg-forest-50'
                      : 'border-line bg-surface hover:border-forest-200',
                  )}
                >
                  <span className="block text-sm font-medium text-ink">{option.title}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted">
                    {option.description}
                  </span>
                </button>
              )
            })}
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <h2 className="text-sm font-medium text-ink">Срок</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Начало" htmlFor="start">
              <Input
                id="start"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </Field>
            <Field label="Завершение" htmlFor="end" hint="Можно оставить пустым.">
              <Input
                id="end"
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </Field>
          </div>
        </Card>

        {error ? (
          <p className="rounded-xl border border-clay/30 bg-clay/10 px-4 py-3 text-sm text-clay" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" disabled={saving}>
            {saving ? 'Сохраняю…' : 'Сохранить'}
          </Button>
          <Link
            to={`/p/${projectId}`}
            className="text-sm font-medium text-forest-700 underline decoration-forest-200 underline-offset-4"
          >
            К проекту
          </Link>
          {saved ? <span className="text-sm text-forest-700">Сохранено</span> : null}
        </div>
      </form>

      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl text-ink">Состояние проекта</h2>
          {project.status === 'active' ? <Badge tone="green">В работе</Badge> : null}
          {project.status === 'paused' ? <Badge tone="amber">Пауза</Badge> : null}
          {project.status === 'completed' ? <Badge tone="neutral">Завершён</Badge> : null}
        </div>
        <p className="text-sm leading-relaxed text-muted">
          На паузе и после завершения напоминания не появляются на экране «Сегодня». История и
          фотографии остаются на месте.
        </p>

        <div className="flex flex-wrap gap-2">
          {project.status === 'active' ? (
            <Button
              variant="secondary"
              onClick={() => void updateProject(projectId, { status: 'paused' })}
            >
              Поставить на паузу
            </Button>
          ) : (
            <Button
              variant="secondary"
              onClick={() => void updateProject(projectId, { status: 'active' })}
            >
              Вернуть в работу
            </Button>
          )}

          {project.status !== 'completed' ? (
            confirmingComplete ? (
              <>
                <Button
                  onClick={async () => {
                    await updateProject(projectId, { status: 'completed' })
                    setConfirmingComplete(false)
                  }}
                >
                  Да, завершить
                </Button>
                <Button variant="secondary" onClick={() => setConfirmingComplete(false)}>
                  Оставить в работе
                </Button>
              </>
            ) : (
              <Button variant="ghost" onClick={() => setConfirmingComplete(true)}>
                Завершить проект…
              </Button>
            )
          ) : null}
        </div>
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl text-ink">Архив проекта</h2>
          <Badge tone="neutral">ZIP</Badge>
        </div>
        <p className="text-sm leading-relaxed text-muted">
          Один файл со всеми записями, фотографиями, измерениями и расписанием. Пригодится как
          резервная копия или чтобы перенести проект на другое устройство.
        </p>
        <Button variant="secondary" onClick={handleExportArchive} disabled={archiveBusy}>
          {archiveBusy ? 'Собираю архив…' : 'Скачать архив'}
        </Button>
        {archiveMessage ? (
          <p
            className="rounded-xl border border-forest-100 bg-forest-50 px-4 py-3 text-sm text-forest-700"
            role="status"
          >
            {archiveMessage}
          </p>
        ) : null}
        {archiveError ? (
          <p
            className="rounded-xl border border-clay/30 bg-clay/10 px-4 py-3 text-sm text-clay"
            role="alert"
          >
            {archiveError}
          </p>
        ) : null}
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl text-ink">Память на устройстве</h2>
          {storage?.persisted ? <Badge tone="green">Защищено</Badge> : null}
        </div>
        <p className="text-sm leading-relaxed text-muted">
          Фотографии и записи занимают место в браузере. Если браузеру не хватит места, новые
          фотографии могут не сохраниться — тогда освободи место или скачай архив.
        </p>

        {storage === undefined ? (
          <p className="text-sm text-muted">Считаю занятое место…</p>
        ) : storage === null ? (
          <p className="text-sm text-muted">Браузер не сообщает, сколько места занято.</p>
        ) : (
          <>
            <div
              className="h-2 overflow-hidden rounded-full bg-line"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={
                storage.quota > 0 ? Math.min(100, Math.round((storage.usage / storage.quota) * 100)) : 0
              }
              aria-label="Занятое место"
            >
              <div
                className="h-full rounded-full bg-forest-500"
                style={{
                  width: `${
                    storage.quota > 0
                      ? Math.min(100, Math.max(1, (storage.usage / storage.quota) * 100))
                      : 1
                  }%`,
                }}
              />
            </div>
            <p className="text-sm text-muted">
              Занято {formatBytes(storage.usage)}
              {storage.quota > 0 ? ` из ${formatBytes(storage.quota)}` : ''}
            </p>
            {storage.quota > 0 && storage.usage / storage.quota > 0.8 ? (
              <p className="rounded-xl border border-amber-200 bg-amber-100/60 px-4 py-3 text-sm text-amber-600">
                Места почти не осталось. Скачай архив и удали старые фотографии, чтобы новые записи
                сохранялись.
              </p>
            ) : null}
            {!storage.persisted ? (
              <Button variant="secondary" onClick={handleProtect} disabled={protecting}>
                {protecting ? 'Запрашиваю…' : 'Защитить данные от очистки'}
              </Button>
            ) : null}
            {protectMessage ? (
              <p className="rounded-xl border border-line bg-paper px-4 py-3 text-sm leading-relaxed text-muted" role="status">
                {protectMessage}
              </p>
            ) : null}
          </>
        )}
      </Card>

      <Card className="space-y-3 border-clay/20 p-5">
        <h2 className="text-sm font-medium text-ink">Удалить проект</h2>
        <p className="text-sm leading-relaxed text-muted">
          Удалятся все наблюдения и фотографии. Восстановить их не получится — это действие нельзя
          отменить.
        </p>
        {confirming ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="danger" onClick={handleDelete}>
              Да, удалить всё
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Оставить проект
            </Button>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => setConfirming(true)}>
            Удалить проект…
          </Button>
        )}
      </Card>
    </div>
  )
}
