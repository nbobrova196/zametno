import PptxGenJS from 'pptxgenjs'
import type { Project } from '../db/types'
import type { PresentationThemeOption, Slide } from '../domain/presentation'

const PAGE_W = 10
const PAGE_H = 5.625
const MARGIN = 0.65

function hex(color: string) {
  return color.replace('#', '').toUpperCase()
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Не удалось прочитать фото'))
    reader.readAsDataURL(blob)
  })
}

function safeFileName(title: string) {
  const clean = title
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return `${clean || 'Заметно'} — презентация.pptx`
}

export async function exportPresentation({
  project,
  slides,
  theme,
}: {
  project: Project
  slides: Slide[]
  theme: PresentationThemeOption
}) {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_16x9'
  pptx.author = project.authorName || 'Заметно'
  pptx.company = 'Заметно'
  pptx.subject = project.title
  pptx.title = project.title

  const ink = hex(theme.ink)
  const muted = hex(theme.muted)
  const accent = hex(theme.accent)
  const bg = hex(theme.bg)

  for (const [index, data] of slides.entries()) {
    const slide = pptx.addSlide()
    slide.background = { color: bg }

    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: PAGE_W,
      h: 0.075,
      fill: { color: accent },
      line: { color: accent, width: 0 },
    })

    slide.addText(data.eyebrow.toUpperCase(), {
      x: MARGIN,
      y: 0.38,
      w: PAGE_W - MARGIN * 2,
      h: 0.3,
      fontFace: 'Arial',
      fontSize: 10,
      bold: true,
      charSpacing: 2,
      color: accent,
      margin: 0,
    })

    if (data.kind === 'title') {
      const photo = data.photos?.[0]
      const textWidth = photo ? 4.55 : PAGE_W - MARGIN * 2

      slide.addText(data.title, {
        x: MARGIN,
        y: 1.25,
        w: textWidth,
        h: 2.15,
        fontFace: 'Arial',
        fontSize: 34,
        bold: true,
        color: ink,
        fit: 'shrink',
        valign: 'top',
        margin: 0,
        breakLine: false,
      })

      if (data.text) {
        slide.addText(data.text, {
          x: MARGIN,
          y: 3.55,
          w: textWidth,
          h: 0.45,
          fontFace: 'Arial',
          fontSize: 16,
          color: muted,
          fit: 'shrink',
          margin: 0,
        })
      }

      if (data.footer) {
        slide.addText(data.footer, {
          x: MARGIN,
          y: 4.95,
          w: textWidth,
          h: 0.3,
          fontFace: 'Arial',
          fontSize: 11,
          color: accent,
          margin: 0,
        })
      }

      if (photo) {
        const box = { x: 5.55, y: 0.55, w: 3.85, h: 4.5 }
        const image = await blobToDataUrl(photo.photo.blob)
        slide.addImage({
          data: image,
          x: box.x,
          y: box.y,
          w: box.w,
          h: box.h,
          sizing: { type: 'cover', w: box.w, h: box.h },
        })
        slide.addText(photo.caption, {
          x: box.x,
          y: 5.1,
          w: box.w,
          h: 0.22,
          fontFace: 'Arial',
          fontSize: 8,
          color: muted,
          align: 'right',
          margin: 0,
        })
      }
      continue
    }

    slide.addText(data.title, {
      x: MARGIN,
      y: 0.78,
      w: PAGE_W - MARGIN * 2,
      h: 0.8,
      fontFace: 'Arial',
      fontSize: 26,
      bold: true,
      color: ink,
      fit: 'shrink',
      valign: 'top',
      margin: 0,
    })

    if (data.kind === 'question') {
      if (data.text) {
        slide.addText(data.text, {
          x: MARGIN,
          y: 1.85,
          w: PAGE_W - MARGIN * 2,
          h: 1.9,
          fontFace: 'Arial',
          fontSize: 24,
          color: ink,
          fit: 'shrink',
          valign: 'top',
          margin: 0,
        })
      }

      if (data.bullets?.length) {
        slide.addText(
          data.bullets.map((text) => ({
            text,
            options: { bullet: true, breakLine: true },
          })),
          {
            x: MARGIN,
            y: 3.95,
            w: PAGE_W - MARGIN * 2,
            h: 1.1,
            fontFace: 'Arial',
            fontSize: 15,
            color: muted,
            fit: 'shrink',
            paraSpaceAfter: 8,
            margin: 0,
          },
        )
      }
      continue
    }

    if (data.kind === 'method' || data.kind === 'next') {
      if (data.text) {
        slide.addText(data.text, {
          x: MARGIN,
          y: 1.7,
          w: PAGE_W - MARGIN * 2,
          h: 1,
          fontFace: 'Arial',
          fontSize: 16,
          color: muted,
          fit: 'shrink',
          margin: 0,
        })
      }

      if (data.bullets?.length) {
        slide.addText(
          data.bullets.map((text) => ({
            text,
            options: { bullet: true, breakLine: true },
          })),
          {
            x: MARGIN,
            y: data.text ? 2.7 : 1.8,
            w: PAGE_W - MARGIN * 2,
            h: data.text ? 2.45 : 3.3,
            fontFace: 'Arial',
            fontSize: data.kind === 'next' ? 19 : 18,
            color: ink,
            fit: 'shrink',
            paraSpaceAfter: 12,
            margin: 0,
          },
        )
      }

      slide.addText(String(index + 1), {
        x: PAGE_W - 1.1,
        y: PAGE_H - 0.45,
        w: 0.45,
        h: 0.25,
        fontFace: 'Arial',
        fontSize: 9,
        color: muted,
        align: 'right',
        margin: 0,
      })
      continue
    }

    if (data.kind === 'observations') {
      const photos = data.photos ?? []
      if (photos.length > 0) {
        const gap = 0.22
        const count = Math.min(photos.length, 3)
        const width = count === 1 ? 5.2 : (PAGE_W - MARGIN * 2 - gap * (count - 1)) / count
        const height = count === 1 ? 3.05 : 2.75
        const startX = count === 1 ? (PAGE_W - width) / 2 : MARGIN
        const y = 1.78

        for (let photoIndex = 0; photoIndex < count; photoIndex++) {
          const item = photos[photoIndex]
          const x = startX + photoIndex * (width + gap)
          const image = await blobToDataUrl(item.photo.blob)
          slide.addImage({
            data: image,
            x,
            y,
            w: width,
            h: height,
            sizing: { type: 'cover', w: width, h: height },
          })
          slide.addText(item.caption, {
            x,
            y: y + height + 0.12,
            w: width,
            h: 0.55,
            fontFace: 'Arial',
            fontSize: count === 3 ? 9 : 11,
            color: muted,
            align: count === 1 ? 'center' : 'left',
            fit: 'shrink',
            valign: 'top',
            margin: 0,
          })
        }
      } else if (data.bullets?.length) {
        slide.addText(
          data.bullets.map((text) => ({
            text,
            options: { bullet: true, breakLine: true },
          })),
          {
            x: MARGIN,
            y: 1.8,
            w: PAGE_W - MARGIN * 2,
            h: 3.1,
            fontFace: 'Arial',
            fontSize: 17,
            color: ink,
            fit: 'shrink',
            paraSpaceAfter: 10,
            margin: 0,
          },
        )
      }

      if (data.footer) {
        slide.addText(data.footer, {
          x: MARGIN,
          y: PAGE_H - 0.4,
          w: PAGE_W - MARGIN * 2 - 0.5,
          h: 0.22,
          fontFace: 'Arial',
          fontSize: 9,
          color: muted,
          margin: 0,
        })
      }

      slide.addText(String(index + 1), {
        x: PAGE_W - 1.1,
        y: PAGE_H - 0.45,
        w: 0.45,
        h: 0.25,
        fontFace: 'Arial',
        fontSize: 9,
        color: muted,
        align: 'right',
        margin: 0,
      })
      continue
    }

    if (data.kind === 'conclusion') {
      const length = data.text?.length ?? 0
      const fontSize = length > 320 ? 15 : length > 180 ? 18 : 22
      if (data.text) {
        slide.addText(data.text, {
          x: MARGIN,
          y: 1.8,
          w: PAGE_W - MARGIN * 2,
          h: 2.7,
          fontFace: 'Arial',
          fontSize,
          color: ink,
          fit: 'shrink',
          valign: 'top',
          margin: 0,
          lineSpacingMultiple: 1.15,
        })
      }

      if (data.bullets?.length) {
        slide.addText(data.bullets.join(' '), {
          x: MARGIN,
          y: 4.65,
          w: PAGE_W - MARGIN * 2,
          h: 0.4,
          fontFace: 'Arial',
          fontSize: 11,
          color: muted,
          fit: 'shrink',
          margin: 0,
        })
      }

      slide.addText(String(index + 1), {
        x: PAGE_W - 1.1,
        y: PAGE_H - 0.45,
        w: 0.45,
        h: 0.25,
        fontFace: 'Arial',
        fontSize: 9,
        color: muted,
        align: 'right',
        margin: 0,
      })
      continue
    }
  }

  const fileName = safeFileName(project.title)
  await pptx.writeFile({ fileName })
  return fileName
}
