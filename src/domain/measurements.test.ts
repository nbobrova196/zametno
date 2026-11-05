import { describe, expect, it } from 'vitest'
import { parseMeasurement } from './measurements'

describe('parseMeasurement', () => {
  it('читает целые и дробные числа с точкой и запятой', () => {
    expect(parseMeasurement('4')).toBe(4)
    expect(parseMeasurement('4,2')).toBe(4.2)
    expect(parseMeasurement(' 4.2 ')).toBe(4.2)
    expect(parseMeasurement('0,5')).toBe(0.5)
  })

  it('пропускает пустые и нечисловые значения', () => {
    expect(parseMeasurement('')).toBeUndefined()
    expect(parseMeasurement('   ')).toBeUndefined()
    expect(parseMeasurement(undefined)).toBeUndefined()
    expect(parseMeasurement('около пяти')).toBeUndefined()
    expect(parseMeasurement(',')).toBeUndefined()
  })
})
