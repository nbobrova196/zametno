import { useMemo, useState } from 'react'
import {
  FORMULAS,
  FORMULA_SOURCES,
  FORMULA_SUBJECTS,
  type Formula,
  type FormulaSubject,
} from '../domain/formulas'
import { Button, Input, cn } from './ui'

export function FormulaPicker({ onInsert }: { onInsert: (formula: Formula) => void }) {
  const [subject, setSubject] = useState<FormulaSubject>('physics')
  const [query, setQuery] = useState('')
  const [insertedId, setInsertedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('ru')
    return FORMULAS.filter((formula) => {
      if (formula.subject !== subject) return false
      if (!needle) return true
      return [formula.title, formula.expression, formula.legend, formula.topic]
        .join(' ')
        .toLocaleLowerCase('ru')
        .includes(needle)
    })
  }, [subject, query])

  const grouped = useMemo(() => {
    const map = new Map<string, Formula[]>()
    for (const formula of filtered) {
      const list = map.get(formula.topic) ?? []
      list.push(formula)
      map.set(formula.topic, list)
    }
    return [...map.entries()]
  }, [filtered])

  function handleInsert(formula: Formula) {
    onInsert(formula)
    setInsertedId(formula.id)
  }

  return (
    <div className="space-y-3 rounded-xl border border-line bg-paper p-3">
      <div className="flex flex-wrap items-center gap-2">
        {FORMULA_SUBJECTS.map((option) => {
          const active = option.id === subject
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => setSubject(option.id)}
              className={cn(
                'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors',
                active
                  ? 'border-forest-500 bg-forest-600 text-white'
                  : 'border-line bg-surface text-ink hover:border-forest-300',
              )}
            >
              <span aria-hidden="true">{option.emoji}</span>
              {option.title}
            </button>
          )
        })}
      </div>

      <Input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Найти формулу: скорость, доля, давление…"
        aria-label="Поиск формулы"
      />

      {grouped.length === 0 ? (
        <p className="rounded-lg bg-surface px-3 py-4 text-sm leading-relaxed text-muted">
          Ничего не нашлось. Попробуй другое слово — например, «масса» или «работа».
        </p>
      ) : (
        <div className="max-h-96 space-y-4 overflow-y-auto pr-1">
          {grouped.map(([topic, items]) => (
            <section key={topic} className="space-y-2">
              <h3 className="text-xs font-medium tracking-wide text-muted uppercase">{topic}</h3>
              {items.map((formula) => (
                <div key={formula.id} className="rounded-xl border border-line bg-surface p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-medium text-ink">{formula.title}</p>
                      <p className="mt-1 break-words rounded-md bg-forest-50 px-2 py-1 text-base font-medium text-forest-700">
                        {formula.expression}
                      </p>
                      <p className="mt-1 break-words text-xs leading-relaxed text-muted">
                        {formula.legend}.
                      </p>
                      <p className="break-words text-xs text-muted">Единицы: {formula.units}.</p>
                      {formula.hint ? (
                        <p className="mt-1 break-words text-xs leading-relaxed text-muted">
                          {formula.hint}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => handleInsert(formula)}
                      aria-label={`Вставить формулу «${formula.title}» в заметку`}
                    >
                      Вставить
                    </Button>
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}

      <div className="space-y-1 border-t border-line pt-2">
        <p className="text-xs leading-relaxed text-muted" aria-live="polite">
          {insertedId
            ? 'Формула добавлена в заметку. Можно вставить ещё одну.'
            : 'Выбери формулу — она добавится в заметку.'}
        </p>
        <p className="text-[11px] leading-relaxed text-muted">
          Формулы сверены с материалами ФИПИ для ОГЭ 2026:{' '}
          {FORMULA_SOURCES.map((source, index) => (
            <span key={source.id}>
              {index > 0 ? ', ' : ''}
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-forest-200 underline-offset-2 hover:text-forest-700"
              >
                {source.title}
              </a>
            </span>
          ))}
          .
        </p>
      </div>
    </div>
  )
}
