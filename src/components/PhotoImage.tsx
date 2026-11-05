import { useEffect, useState } from 'react'
import type { Photo } from '../db/types'
import { cn } from './ui'

export function PhotoImage({
  photo,
  full = false,
  className,
  alt = 'Фотография наблюдения',
}: {
  photo: Photo
  full?: boolean
  className?: string
  alt?: string
}) {
  const [url, setUrl] = useState<string>()

  useEffect(() => {
    const objectUrl = URL.createObjectURL(full ? photo.blob : photo.thumb)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [photo, full])

  if (!url) {
    return <div className={cn('animate-pulse bg-line', className)} aria-hidden="true" />
  }

  return <img src={url} alt={alt} className={className} loading="lazy" />
}
