import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { useBarcodeScanner } from './hooks/useBarcodeScanner'
import { addScan, clearScans, deleteScan, listScans } from './lib/storage'
import { formatTimestamp, shouldStoreScan, toCsv } from './lib/scans'
import type { ScanRecord } from './types'

type PersistedScan = ScanRecord & { id: number }

const downloadCsv = (content: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  const timestamp = new Date().toISOString().replaceAll(':', '-')

  anchor.href = url
  anchor.download = `lecturas-${timestamp}.csv`
  anchor.click()

  URL.revokeObjectURL(url)
}

function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const [scans, setScans] = useState<PersistedScan[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [manualValue, setManualValue] = useState('')
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined)

  const [lastScanValue, setLastScanValue] = useState<string | null>(null)
  const [lastScanTimestamp, setLastScanTimestamp] = useState(0)

  const onDecoded = useCallback(
    async ({ value, format }: { value: string; format: string }) => {
      const now = Date.now()
      if (!shouldStoreScan(value, lastScanValue, lastScanTimestamp, now)) {
        return
      }

      const newRecord: ScanRecord = {
        value,
        format,
        scannedAt: new Date(now).toISOString(),
      }

      const persisted = await addScan(newRecord)
      setScans((current) => [persisted, ...current])
      setLastScanValue(value)
      setLastScanTimestamp(now)
    },
    [lastScanTimestamp, lastScanValue],
  )

  const { status, errorMessage, devices, start, stop } = useBarcodeScanner(onDecoded, selectedDeviceId)

  useEffect(() => {
    const load = async () => {
      const stored = await listScans()
      setScans(stored)
      setLoading(false)
    }

    void load()
  }, [])

  useEffect(() => {
    if (status !== 'running') {
      return
    }

    return () => {
      stop()
    }
  }, [status, stop])

  const filteredScans = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) {
      return scans
    }

    return scans.filter((scan) => {
      const searchable = `${scan.value} ${scan.format} ${scan.scannedAt}`.toLowerCase()
      return searchable.includes(normalized)
    })
  }, [query, scans])

  const uniqueCount = useMemo(() => new Set(scans.map((scan) => scan.value)).size, [scans])

  const handleToggleScanner = async () => {
    if (status === 'running' || status === 'starting') {
      stop()
      return
    }

    await start(videoRef.current)
  }

  const handleDelete = async (id: number) => {
    await deleteScan(id)
    setScans((current) => current.filter((scan) => scan.id !== id))
  }

  const handleClear = async () => {
    await clearScans()
    setScans([])
  }

  const handleManualAdd = async () => {
    if (!manualValue.trim()) {
      return
    }

    const newRecord: ScanRecord = {
      value: manualValue.trim(),
      format: 'MANUAL',
      scannedAt: new Date().toISOString(),
    }

    const persisted = await addScan(newRecord)
    setScans((current) => [persisted, ...current])
    setManualValue('')
  }

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <h1>Lector de QR y Códigos de Barra</h1>
          <p>Escaneo en tiempo real con almacenamiento local en tabla.</p>
        </div>
        <div className="stats">
          <span>Total: {scans.length}</span>
          <span>Únicos: {uniqueCount}</span>
        </div>
      </header>

      <section className="panel scanner-panel">
        <div className="actions">
          <button type="button" onClick={handleToggleScanner}>
            {status === 'running' || status === 'starting' ? 'Detener cámara' : 'Iniciar cámara'}
          </button>

          <select
            value={selectedDeviceId ?? ''}
            onChange={(event) => setSelectedDeviceId(event.target.value || undefined)}
            disabled={status === 'running'}
          >
            <option value="">Cámara trasera automática</option>
            {devices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Cámara ${device.deviceId.slice(0, 6)}`}
              </option>
            ))}
          </select>
        </div>

        <div className="video-frame">
          <video ref={videoRef} muted playsInline />
          <div className={`status-chip ${status}`}>Estado: {status}</div>
        </div>

        {errorMessage ? <p className="error">{errorMessage}</p> : null}

        <div className="manual-row">
          <input
            type="text"
            value={manualValue}
            onChange={(event) => setManualValue(event.target.value)}
            placeholder="Agregar código manualmente"
          />
          <button type="button" onClick={handleManualAdd}>
            Agregar
          </button>
        </div>
      </section>

      <section className="panel table-panel">
        <div className="table-actions">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por valor o formato"
          />

          <div className="button-row">
            <button type="button" onClick={() => downloadCsv(toCsv(scans))} disabled={scans.length === 0}>
              Exportar CSV
            </button>
            <button type="button" onClick={handleClear} disabled={scans.length === 0} className="danger">
              Vaciar tabla
            </button>
          </div>
        </div>

        {loading ? (
          <p>Cargando lecturas...</p>
        ) : filteredScans.length === 0 ? (
          <p>No hay registros para mostrar.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Valor</th>
                  <th>Formato</th>
                  <th>Fecha</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {filteredScans.map((scan) => (
                  <tr key={scan.id}>
                    <td>{scan.id}</td>
                    <td className="value-cell">{scan.value}</td>
                    <td>{scan.format}</td>
                    <td>{formatTimestamp(scan.scannedAt)}</td>
                    <td>
                      <button type="button" className="link-danger" onClick={() => handleDelete(scan.id)}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}

export default App
