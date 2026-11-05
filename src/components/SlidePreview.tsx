import type { PresentationThemeOption, Slide } from '../domain/presentation'
import { PhotoImage } from './PhotoImage'
import { cn } from './ui'

const titleSize = 'clamp(1.15rem, 4.1cqw, 2.9rem)'
const bodySize = 'clamp(0.75rem, 2.05cqw, 1.2rem)'
const smallSize = 'clamp(0.6rem, 1.45cqw, 0.85rem)'
const captionSize = 'clamp(0.55rem, 1.3cqw, 0.78rem)'

export function SlidePreview({
  slide,
  theme,
}: {
  slide: Slide
  theme: PresentationThemeOption
}) {
  const eyebrowStyle = {
    color: theme.accent,
    fontSize: smallSize,
    letterSpacing: '0.16em',
  }
  const titleStyle = {
    color: theme.ink,
    fontSize: titleSize,
  }
  const bodyStyle = {
    color: theme.ink,
    fontSize: bodySize,
  }
  const mutedStyle = {
    color: theme.muted,
    fontSize: bodySize,
  }

  return (
    <div
      className="slide-canvas relative aspect-video w-full overflow-hidden rounded-2xl border border-line shadow-soft"
      style={{ backgroundColor: theme.bg, color: theme.ink }}
    >
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: theme.accent }}
        aria-hidden="true"
      />

      <div className="flex h-full flex-col p-[5.5%]">
        <p className="font-semibold uppercase" style={eyebrowStyle}>
          {slide.eyebrow}
        </p>
        <h3 className="mt-[1.2%] font-display leading-tight font-semibold" style={titleStyle}>
          {slide.title}
        </h3>

        {slide.kind === 'title' ? (
          <div className="mt-[3.5%] flex min-h-0 flex-1 gap-[4%]">
            <div className="flex min-w-0 flex-1 flex-col">
              {slide.text ? (
                <p className="leading-relaxed" style={mutedStyle}>
                  {slide.text}
                </p>
              ) : null}
              {slide.footer ? (
                <p className="mt-auto font-medium" style={{ ...eyebrowStyle, letterSpacing: '0.04em' }}>
                  {slide.footer}
                </p>
              ) : null}
            </div>

            {slide.photos?.[0] ? (
              <figure className="flex w-[42%] min-w-0 flex-col gap-1">
                <div
                  className="min-h-0 flex-1 overflow-hidden rounded-lg"
                  style={{ backgroundColor: theme.photoBg }}
                >
                  <PhotoImage
                    photo={slide.photos[0].photo}
                    full
                    className="h-full w-full object-cover"
                    alt={slide.photos[0].caption}
                  />
                </div>
                <figcaption className="line-clamp-2" style={{ ...mutedStyle, fontSize: captionSize }}>
                  {slide.photos[0].caption}
                </figcaption>
              </figure>
            ) : null}
          </div>
        ) : null}

        {slide.kind === 'question' ? (
          <div className="mt-[3%] flex min-h-0 flex-1 flex-col">
            {slide.text ? (
              <p className="leading-snug font-medium" style={{ ...bodyStyle, fontSize: 'clamp(0.9rem, 2.7cqw, 1.55rem)' }}>
                {slide.text}
              </p>
            ) : null}
            {slide.bullets?.length ? (
              <ul className="mt-auto space-y-1.5" style={mutedStyle}>
                {slide.bullets.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span style={{ color: theme.accent }}>•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {slide.kind === 'method' || slide.kind === 'next' ? (
          <div className="mt-[3%] flex min-h-0 flex-1 flex-col">
            {slide.text ? (
              <p className="mb-3 leading-relaxed" style={mutedStyle}>
                {slide.text}
              </p>
            ) : null}
            {slide.bullets?.length ? (
              <ul className="space-y-2 leading-snug" style={bodyStyle}>
                {slide.bullets.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span style={{ color: theme.accent }}>•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {slide.kind === 'observations' ? (
          <div className="mt-[3%] flex min-h-0 flex-1 flex-col">
            {slide.photos?.length ? (
              <div className="flex min-h-0 flex-1 gap-[2%]">
                {slide.photos.map((item) => (
                  <figure
                    key={item.photo.id}
                    className={
                      slide.photos && slide.photos.length === 1
                        ? 'mx-auto flex w-[72%] min-w-0 flex-col gap-1'
                        : 'flex min-w-0 flex-1 flex-col gap-1'
                    }
                  >
                    <div
                      className="min-h-0 flex-1 overflow-hidden rounded-lg"
                      style={{ backgroundColor: theme.photoBg }}
                    >
                      <PhotoImage
                        photo={item.photo}
                        full
                        className="h-full w-full object-cover"
                        alt={item.caption}
                      />
                    </div>
                    <figcaption
                      className={cn(
                        'line-clamp-2',
                        slide.photos && slide.photos.length === 1 && 'text-center',
                      )}
                      style={{ ...mutedStyle, fontSize: captionSize }}
                    >
                      {item.caption}
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <ul className="space-y-2 leading-snug" style={bodyStyle}>
                {slide.bullets?.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span style={{ color: theme.accent }}>•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}

            {slide.footer ? (
              <p className="mt-2" style={{ ...mutedStyle, fontSize: captionSize }}>
                {slide.footer}
              </p>
            ) : null}
          </div>
        ) : null}

        {slide.kind === 'conclusion' ? (
          <div className="mt-[3%] flex min-h-0 flex-1 flex-col">
            {slide.text ? (
              <p className="leading-relaxed" style={bodyStyle}>
                {slide.text}
              </p>
            ) : null}
            {slide.bullets?.length ? (
              <p className="mt-auto" style={{ ...mutedStyle, fontSize: captionSize }}>
                {slide.bullets.join(' ')}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
