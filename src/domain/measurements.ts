export function parseMeasurement(raw: string | undefined | null): number | undefined {
  if (raw === undefined || raw === null) return undefined
  const normalized = raw.trim().replace(',', '.')
  if (!normalized) return undefined
  const value = Number(normalized)
  return Number.isFinite(value) ? value : undefined
}
