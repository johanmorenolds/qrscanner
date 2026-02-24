import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BarcodeFormat,
  DecodeHintType,
  type Exception,
  NotFoundException,
} from '@zxing/library'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import type { ScannerStatus } from '../types'

type DecodedValue = {
  value: string
  format: string
}

type LegacyNavigator = Navigator & {
  getUserMedia?: (
    constraints: MediaStreamConstraints,
    success: (stream: MediaStream) => void,
    error: (err: unknown) => void,
  ) => void
  webkitGetUserMedia?: (
    constraints: MediaStreamConstraints,
    success: (stream: MediaStream) => void,
    error: (err: unknown) => void,
  ) => void
}

const SUPPORTED_FORMATS = [
  BarcodeFormat.QR_CODE,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.CODE_93,
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.ITF,
  BarcodeFormat.CODABAR,
]

export const useBarcodeScanner = (
  onDecoded: (data: DecodedValue) => void,
  preferredDeviceId?: string,
) => {
  const [status, setStatus] = useState<ScannerStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])

  const controlsRef = useRef<IScannerControls | null>(null)

  const hints = useMemo(() => {
    const map = new Map<DecodeHintType, unknown>()
    map.set(DecodeHintType.POSSIBLE_FORMATS, SUPPORTED_FORMATS)
    return map
  }, [])

  const readerRef = useRef(
    new BrowserMultiFormatReader(hints, {
      delayBetweenScanAttempts: 120,
      delayBetweenScanSuccess: 600,
    }),
  )

  const hasCameraApi = () =>
    typeof navigator !== 'undefined' &&
    (typeof navigator.mediaDevices?.getUserMedia === 'function' ||
      typeof (navigator as LegacyNavigator).webkitGetUserMedia === 'function' ||
      typeof (navigator as LegacyNavigator).getUserMedia === 'function')

  const isSecureOrigin = () =>
    typeof window !== 'undefined' &&
    (window.isSecureContext ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1')

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setDevices([])
      return
    }

    try {
      const mediaDevices = await BrowserMultiFormatReader.listVideoInputDevices()
      setDevices(mediaDevices)
    } catch {
      setDevices([])
    }
  }, [])

  const stop = useCallback(() => {
    controlsRef.current?.stop()
    controlsRef.current = null
    setStatus('idle')
  }, [])

  const requestUserMedia = useCallback((constraints: MediaStreamConstraints): Promise<MediaStream> => {
    if (navigator.mediaDevices?.getUserMedia) {
      return navigator.mediaDevices.getUserMedia(constraints)
    }

    const legacyNavigator = navigator as LegacyNavigator
    const legacyGetUserMedia = legacyNavigator.webkitGetUserMedia ?? legacyNavigator.getUserMedia

    if (!legacyGetUserMedia) {
      throw new Error('No hay API de cámara disponible en este navegador.')
    }

    return new Promise((resolve, reject) => {
      legacyGetUserMedia.call(legacyNavigator, constraints, resolve, reject)
    })
  }, [])

  const start = useCallback(
    async (videoElement: HTMLVideoElement | null) => {
      if (!videoElement) {
        return
      }

      stop()
      setStatus('starting')
      setErrorMessage(null)

      try {
        if (!isSecureOrigin()) {
          throw new Error(
            'La cámara requiere HTTPS en iPhone/Safari. Abre la app con un enlace https:// y vuelve a intentar.',
          )
        }

        if (!hasCameraApi()) {
          throw new Error(
            'Este navegador no expone navigator.mediaDevices.getUserMedia. Verifica permisos de cámara y usa Safari actualizado.',
          )
        }

        const constraints: MediaStreamConstraints = preferredDeviceId
          ? { video: { deviceId: { exact: preferredDeviceId } } }
          : { video: { facingMode: { ideal: 'environment' } } }

        const mediaStream = await requestUserMedia(constraints)

        const controls = await readerRef.current.decodeFromStream(
          mediaStream,
          videoElement,
          (result, error) => {
            if (result) {
              onDecoded({
                value: result.getText(),
                format: BarcodeFormat[result.getBarcodeFormat()] ?? 'UNKNOWN',
              })
              return
            }

            if (error && !(error instanceof NotFoundException)) {
              const decodeError = error as Exception
              setErrorMessage(decodeError.message || 'Error al decodificar el código.')
            }
          },
        )

        controlsRef.current = controls
        setStatus('running')
        await refreshDevices()
      } catch (error) {
        setStatus('error')
        const message = error instanceof Error ? error.message : 'No se pudo iniciar la cámara.'
        setErrorMessage(message)
      }
    },
    [onDecoded, preferredDeviceId, refreshDevices, requestUserMedia, stop],
  )

  useEffect(() => {
    void refreshDevices()

    return () => {
      stop()
    }
  }, [refreshDevices, stop])

  return {
    status,
    errorMessage,
    devices,
    start,
    stop,
  }
}
