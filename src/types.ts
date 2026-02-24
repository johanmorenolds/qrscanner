export type ScanRecord = {
  id?: number
  value: string
  format: string
  scannedAt: string
}

export type ScannerStatus = 'idle' | 'starting' | 'running' | 'error'
