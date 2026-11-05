import { Link } from 'react-router-dom'
import { buttonStyles, Card } from '../components/ui'

export function NotFoundScreen() {
  return (
    <div className="mx-auto max-w-xl">
      <Card className="space-y-3 p-8 text-center">
        <p className="text-4xl" aria-hidden="true">
          🧭
        </p>
        <h1 className="font-display text-2xl text-ink">Страница не нашлась</h1>
        <p className="text-sm leading-relaxed text-muted">
          Возможно, ссылка устарела. Вернись на полку — там все проекты.
        </p>
        <Link to="/" className={buttonStyles('primary', 'md', 'mt-2')}>
          На полку
        </Link>
      </Card>
    </div>
  )
}
