import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'public/icons')
mkdirSync(outDir, { recursive: true })

const BG = [31, 95, 79]
const LEAF = [247, 244, 238]
const VIEW = 32
const SS = 4

function cubic(p0, c1, c2, p1, steps = 40) {
  const points = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const mt = 1 - t
    points.push([
      mt * mt * mt * p0[0] + 3 * mt * mt * t * c1[0] + 3 * mt * t * t * c2[0] + t * t * t * p1[0],
      mt * mt * mt * p0[1] + 3 * mt * mt * t * c1[1] + 3 * mt * t * t * c2[1] + t * t * t * p1[1],
    ])
  }
  return points
}

// Лист: контур из двух кривых, черешок и прожилки.
const outline = [
  ...cubic([26, 5], [26, 17], [19, 25], [9, 25]),
  ...cubic([9, 25], [9, 15], [17, 5], [26, 5]).slice(1),
]
const stem = cubic([9, 25], [7.7, 27.5], [5.7, 29.2], [4.2, 29.5], 16)
const vein = cubic([10.2, 23.8], [14.5, 18.5], [19.5, 12], [25.8, 5.5], 24)
const sideVeins = [
  cubic([17.5, 15], [18.4, 16.3], [19.4, 17.5], [20.6, 18.6], 8),
  cubic([17.5, 15], [16.5, 13.8], [15.3, 12.8], [14.1, 12], 8),
]

function paintCapsule(buffer, n, x1, y1, x2, y2, radius, color) {
  const minX = Math.max(0, Math.floor(Math.min(x1, x2) - radius))
  const maxX = Math.min(n - 1, Math.ceil(Math.max(x1, x2) + radius))
  const minY = Math.max(0, Math.floor(Math.min(y1, y2) - radius))
  const maxY = Math.min(n - 1, Math.ceil(Math.max(y1, y2) + radius))
  const dx = x2 - x1
  const dy = y2 - y1
  const lengthSquared = dx * dx + dy * dy
  const radiusSquared = radius * radius

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5
      const py = y + 0.5
      const t =
        lengthSquared === 0
          ? 0
          : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared))
      const offsetX = px - (x1 + t * dx)
      const offsetY = py - (y1 + t * dy)
      if (offsetX * offsetX + offsetY * offsetY > radiusSquared) continue

      const index = (y * n + x) * 4
      buffer[index] = color[0]
      buffer[index + 1] = color[1]
      buffer[index + 2] = color[2]
      buffer[index + 3] = 255
    }
  }
}

function paintPolyline(buffer, n, points, radius, color, unit, offset) {
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i]
    const [x2, y2] = points[i + 1]
    paintCapsule(
      buffer,
      n,
      offset + x1 * unit,
      offset + y1 * unit,
      offset + x2 * unit,
      offset + y2 * unit,
      radius * unit,
      color,
    )
  }
}

function renderLayer(size, contentScale) {
  const n = size * SS
  const buffer = new Uint8ClampedArray(n * n * 4)
  const unit = (n / VIEW) * contentScale
  const offset = (n * (1 - contentScale)) / 2

  for (let i = 0; i < n * n; i++) {
    buffer[i * 4] = BG[0]
    buffer[i * 4 + 1] = BG[1]
    buffer[i * 4 + 2] = BG[2]
    buffer[i * 4 + 3] = 255
  }

  paintPolyline(buffer, n, outline, 1.05, LEAF, unit, offset)
  paintPolyline(buffer, n, stem, 1.05, LEAF, unit, offset)
  paintPolyline(buffer, n, vein, 0.7, LEAF, unit, offset)
  for (const sideVein of sideVeins) {
    paintPolyline(buffer, n, sideVein, 0.55, LEAF, unit, offset)
  }

  return { data: buffer, width: n }
}

function downsample(layer, size) {
  const out = new Uint8ClampedArray(size * size * 4)
  const n = layer.width
  const factor = n / size

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let sy = 0; sy < factor; sy++) {
        for (let sx = 0; sx < factor; sx++) {
          const i = ((y * factor + sy) * n + (x * factor + sx)) * 4
          r += layer.data[i]
          g += layer.data[i + 1]
          b += layer.data[i + 2]
          a += layer.data[i + 3]
        }
      }
      const count = factor * factor
      const o = (y * size + x) * 4
      out[o] = r / count
      out[o + 1] = g / count
      out[o + 2] = b / count
      out[o + 3] = a / count
    }
  }
  return out
}

const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([length, typeBuf, data, crc])
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0
    Buffer.from(rgba.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function writeIcon(name, size, contentScale = 1) {
  const layer = renderLayer(size, contentScale)
  const rgba = downsample(layer, size)
  writeFileSync(resolve(outDir, name), encodePng(size, rgba))
  console.log(`icons/${name}  ${size}x${size}`)
}

writeIcon('icon-192.png', 192)
writeIcon('icon-512.png', 512)
writeIcon('icon-maskable-512.png', 512, 0.78)
writeIcon('apple-touch-icon.png', 180)
