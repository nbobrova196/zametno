import { Link } from 'react-router-dom'
import { TEMPLATES } from '../domain/templates'
import { metricsWord } from '../lib/format'
import { Badge, Card, PageHeader } from '../components/ui'

export function TemplatePickerScreen() {
  return (
    <div>
      <PageHeader
        eyebrow="Шаг 1 из 2"
        title="С чего начнём?"
        description="Выбери готовую тему — животное, растение, погода, физика или химия — либо свою. Поля и подсказки потом можно будет изменить."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {TEMPLATES.map((template) => (
          <Link
            key={template.id}
            to={`/new/${template.id}`}
            className="group rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-400 focus-visible:ring-offset-2"
          >
            <Card className="flex h-full flex-col gap-3 p-5 transition-transform group-hover:-translate-y-0.5">
              <div className="flex items-start justify-between gap-3">
                <span className="text-4xl" aria-hidden="true">
                  {template.emoji}
                </span>
                <div className="flex flex-wrap items-start justify-end gap-1.5">
                  {template.hasFormulas ? <Badge tone="green">с формулами</Badge> : null}
                  <Badge tone="neutral">
                    {template.metrics.length > 0
                      ? `${template.metrics.length} ${metricsWord(template.metrics.length)}`
                      : 'без измерений'}
                  </Badge>
                </div>
              </div>

              <div className="space-y-1">
                <h2 className="font-display text-2xl text-ink">{template.title}</h2>
                <p className="text-sm leading-relaxed text-muted">{template.summary}</p>
              </div>

              <div className="mt-auto rounded-xl bg-paper px-3.5 py-3">
                <p className="text-xs text-muted">Пример вопроса</p>
                <p className="mt-0.5 text-sm leading-relaxed text-ink">«{template.exampleQuestion}»</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <p className="mt-6 text-sm leading-relaxed text-muted">
        В темах «Физика» и «Химия» в заметку можно вставить формулу — кнопка «Вставить формулу». Не
        знаешь, что выбрать? Начни со «Своей темы»: название и вопрос можно придумать по ходу.
      </p>
    </div>
  )
}
