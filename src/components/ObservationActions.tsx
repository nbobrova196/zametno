import { useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteObservation } from '../domain/observations'
import { Button, buttonStyles } from './ui'

export function ObservationActions({
  projectId,
  observationId,
}: {
  projectId: string
  observationId: string
}) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    setDeleting(true)
    setError('')
    try {
      await deleteObservation(observationId)
    } catch {
      setError('Не получилось удалить запись. Попробуй ещё раз.')
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {confirming ? (
        <>
          <span className="text-xs text-muted">Удалить запись и её фото?</span>
          <Button variant="danger" size="sm" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Удаляю…' : 'Да, удалить'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setConfirming(false)}
            disabled={deleting}
          >
            Отмена
          </Button>
        </>
      ) : (
        <>
          <Link
            to={`/p/${projectId}/edit/${observationId}`}
            className={buttonStyles('secondary', 'sm')}
          >
            Изменить
          </Link>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
            Удалить
          </Button>
        </>
      )}
      {error ? (
        <span className="text-xs text-clay" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  )
}
