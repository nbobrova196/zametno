import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createProject } from '../domain/projects'
import { getTemplate } from '../domain/templates'
import type { ProjectMode } from '../db/types'
import { Button, Card, Field, Input, PageHeader, Textarea, cn } from '../components/ui'

const modeOptions: Array<{ id: ProjectMode; title: string; description: string }> = [
  {
    id: 'quick',
    title: 'Быстрый дневник',
    description: 'Фото, короткая заметка и отметки. Подходит для регулярных наблюдений.',
  },
  {
    id: 'research',
    title: 'Исследование',
    description: 'Вопрос, предположение, измерения и вывод. Для школьного проекта.',
  },
]

function today() {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

export function CreateProjectScreen() {
  const { templateId } = useParams()
  const navigate = useNavigate()
  const template = getTemplate(templateId)

  const [title, setTitle] = useState('')
  const [subjectName, setSubjectName] = useState('')
  const [question, setQuestion] = useState('')
  const [mode, setMode] = useState<ProjectMode>('quick')
  const [startDate, setStartDate] = useState(today())
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  if (!template) {
    return (
      <Card className="p-6">
        <h1 className="font-display text-2xl">Такой темы нет</h1>
        <p className="mt-2 text-sm text-muted">Выбери тему из списка — или начни со «Своей темы».</p>
        <Link to="/new" className="mt-4 inline-block text-sm font-medium text-forest-700 underline">
          Вернуться к выбору темы
        </Link>
      </Card>
    )
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) {
      setError('Придумай название — хотя бы одно слово.')
      return
    }
    if (!template) return

    setSaving(true)
    setError('')
    try {
      const id = await createProject({
        templateId: template.id,
        title,
        subjectName,
        question,
        mode,
        startDate,
        endDate: endDate || undefined,
      })
      navigate(`/p/${id}`, { replace: true })
    } catch {
      setError('Не получилось создать проект. Попробуй ещё раз.')
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Шаг 2 из 2"
        title="Новый проект"
        description={
          <>
            Тема: <span className="text-ink">{template.emoji} {template.title}</span>. Остальное можно
            заполнить позже.
          </>
        }
      />

      <form onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <Card className="space-y-5 p-5">
            <Field
              label="Название проекта"
              htmlFor="title"
              hint="Например: «Две недели с Тортиллой» или «Фасоль на подоконнике»."
            >
              <Input
                id="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Как назовём?"
                autoFocus
                required
              />
            </Field>

            <Field
              label="Объект наблюдения"
              htmlFor="subject"
              hint="Можно не указывать точно: «двор», «балкон», «черепаха Тортилла»."
            >
              <Input
                id="subject"
                value={subjectName}
                onChange={(event) => setSubjectName(event.target.value)}
                placeholder="За кем или за чем наблюдаем?"
              />
            </Field>

            <Field
              label="Вопрос"
              htmlFor="question"
              hint={`Пример: «${template.exampleQuestion}»`}
            >
              <Textarea
                id="question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Что хочется выяснить?"
                rows={2}
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
                    className={cn(
                      'rounded-xl border p-4 text-left transition-colors',
                      active
                        ? 'border-forest-400 bg-forest-50'
                        : 'border-line bg-surface hover:border-forest-200',
                    )}
                    aria-pressed={active}
                  >
                    <span className="block text-sm font-medium text-ink">{option.title}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted">
                      {option.description}
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="text-xs leading-relaxed text-muted">
              Режим можно поменять в любой момент — уже добавленные записи останутся.
            </p>
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
              <Field label="Завершение" htmlFor="end" hint="Можно не ставить — у личного дневника нет конца.">
                <Input
                  id="end"
                  type="date"
                  value={endDate}
                  min={startDate}
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
              {saving ? 'Создаю…' : 'Создать проект'}
            </Button>
            <Link
              to="/new"
              className="text-sm font-medium text-forest-700 underline decoration-forest-200 underline-offset-4"
            >
              Выбрать другую тему
            </Link>
          </div>
        </div>

        <aside className="hidden lg:block">
          <Card className="sticky top-10 space-y-3 p-5">
            <p className="text-xs font-semibold tracking-wide text-forest-600 uppercase">Подсказки темы</p>
            <p className="font-display text-xl text-ink">{template.title}</p>
            <ul className="space-y-2 text-sm leading-relaxed text-muted">
              {template.hints.map((hint) => (
                <li key={hint} className="flex gap-2">
                  <span className="text-forest-500">•</span>
                  <span>{hint}</span>
                </li>
              ))}
            </ul>
            <div className="rounded-xl bg-paper px-3.5 py-3">
              <p className="text-xs text-muted">Что будем отмечать</p>
              <p className="mt-1 text-sm text-ink">
                {template.marks.slice(0, 4).join(' · ')}
              </p>
            </div>
          </Card>
        </aside>
      </form>
    </div>
  )
}
