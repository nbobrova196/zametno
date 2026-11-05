import { useState } from 'react'
import { APP_NAME, APP_TAGLINE, APP_VERSION } from '../app/config'
import { db } from '../db/db'
import { Button, Card, PageHeader } from '../components/ui'

const steps = [
  {
    emoji: '💻',
    title: 'Компьютер: Chrome или Edge',
    text: 'Открой адрес приложения и нажми значок установки в адресной строке. Или меню ⋮ → «Установить приложение». Появится отдельное окно и значок на рабочем столе.',
  },
  {
    emoji: '📱',
    title: 'Android-планшет: Chrome',
    text: 'Меню ⋮ → «Установить приложение» (на старых версиях — «Добавить на главный экран»). Значок появится на главном экране, приложение откроется без адресной строки.',
  },
  {
    emoji: '☎️',
    title: 'Телефон',
    text: 'Поддержка телефона появится после первой версии. Пока лучше открывать на компьютере или планшете: так удобнее смотреть фотографии и историю.',
  },
]

export function InstallScreen() {
  const [confirming, setConfirming] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [error, setError] = useState('')

  async function handleClearAll() {
    setClearing(true)
    setError('')
    try {
      await db.delete()
      window.location.assign(import.meta.env.BASE_URL)
    } catch {
      setClearing(false)
      setError('Не получилось удалить данные. Закрой приложение и попробуй ещё раз.')
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Установка"
        title="Заметно — рядом"
        description="Приложение работает без интернета и хранит всё на устройстве. Устанавливать не обязательно, но так удобнее: открывается в один клик."
      />

      <div className="space-y-4">
        {steps.map((step) => (
          <Card key={step.title} className="flex gap-4 p-5">
            <span className="text-3xl" aria-hidden="true">
              {step.emoji}
            </span>
            <div className="space-y-1">
              <h2 className="font-display text-xl text-ink">{step.title}</h2>
              <p className="text-sm leading-relaxed text-muted">{step.text}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-5 space-y-2 bg-forest-50/50 p-5">
        <h2 className="text-sm font-medium text-ink">Что важно знать</h2>
        <ul className="space-y-2 text-sm leading-relaxed text-muted">
          <li>
            Проекты хранятся в браузере на этом устройстве. Если очистить данные сайта, записи
            исчезнут — удалять их стоит осознанно.
          </li>
          <li>
            Один проект — одно устройство. Чтобы открыть дневник на другом устройстве, скачай архив
            в настройках проекта и импортируй его на полке: «Импортировать».
          </li>
          <li>
            {APP_NAME} не отправляет фотографии в интернет: всё остаётся на устройстве.
          </li>
        </ul>
      </Card>

      <Card className="mt-5 space-y-3 p-5">
        <h2 className="font-display text-xl text-ink">О приложении</h2>
        <p className="text-sm leading-relaxed text-muted">
          {APP_NAME} — {APP_TAGLINE}, версия {APP_VERSION}. Приложение работает офлайн, без
          аккаунтов и без отправки данных в интернет.
        </p>

        <div className="space-y-2 border-t border-line pt-3">
          <h3 className="text-sm font-medium text-ink">Удалить все данные</h3>
          <p className="text-sm leading-relaxed text-muted">
            Удалятся все проекты, фотографии, наблюдения и напоминания на этом устройстве. Сначала
            скачай архивы проектов, которые нужны: восстановить данные без архива не получится.
          </p>
          {error ? (
            <p
              className="rounded-xl border border-clay/30 bg-clay/10 px-4 py-3 text-sm text-clay"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          {confirming ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="danger" onClick={handleClearAll} disabled={clearing}>
                {clearing ? 'Удаляю…' : 'Да, удалить всё'}
              </Button>
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                Оставить данные
              </Button>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => setConfirming(true)}>
              Удалить все данные…
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}
