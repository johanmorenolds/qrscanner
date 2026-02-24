import type { ScanRecord } from '../types'

const DEDUP_WINDOW_MS = 1500

export const shouldStoreScan = (
  value: string,
  previousValue: string | null,
  previousTimestamp: number,
  now = Date.now(),
): boolean => {
  if (!value.trim()) {
    return false
  }

  if (value !== previousValue) {
    return true
  }

  return now - previousTimestamp > DEDUP_WINDOW_MS
}

export const toCsv = (rows: Array<ScanRecord & { id: number }>): string => {
  const header = ['id', 'valor', 'formato', 'fecha_iso']
  const escapeValue = (input: string) => `"${input.replaceAll('"', '""')}"`

  const body = rows.map((row) =>
    [String(row.id), row.value, row.format, row.scannedAt].map(escapeValue).join(','),
  )

  return [header.join(','), ...body].join('\n')
}

export const formatTimestamp = (isoDate: string): string =>
  new Intl.DateTimeFormat('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(isoDate))
