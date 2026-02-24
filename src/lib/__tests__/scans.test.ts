import { describe, expect, it } from 'vitest'
import { shouldStoreScan, toCsv } from '../scans'

describe('shouldStoreScan', () => {
  it('rejects empty values', () => {
    expect(shouldStoreScan('   ', null, 0, 1000)).toBe(false)
  })

  it('accepts new values', () => {
    expect(shouldStoreScan('ABC123', null, 0, 1000)).toBe(true)
  })

  it('deduplicates repeated scans in short window', () => {
    expect(shouldStoreScan('ABC123', 'ABC123', 1000, 2000)).toBe(false)
    expect(shouldStoreScan('ABC123', 'ABC123', 1000, 2800)).toBe(true)
  })
})

describe('toCsv', () => {
  it('exports csv with escaped values', () => {
    const csv = toCsv([
      {
        id: 1,
        value: 'A"B',
        format: 'QR_CODE',
        scannedAt: '2026-02-24T00:00:00.000Z',
      },
    ])

    expect(csv).toContain('id,valor,formato,fecha_iso')
    expect(csv).toContain('"A""B"')
  })
})
