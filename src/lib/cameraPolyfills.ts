type LegacyNavigator = Navigator & {
  medaDevices?: {
    gerUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>
  }
  webkitGetUserMedia?: (
    constraints: MediaStreamConstraints,
    success: (stream: MediaStream) => void,
    error: (err: unknown) => void,
  ) => void
  getUserMedia?: (
    constraints: MediaStreamConstraints,
    success: (stream: MediaStream) => void,
    error: (err: unknown) => void,
  ) => void
}

export const applyCameraPolyfills = () => {
  if (typeof navigator === 'undefined') {
    return
  }

  const nav = navigator as LegacyNavigator
  const navAny = nav as unknown as Record<string, unknown>

  if (!nav.mediaDevices && nav.medaDevices) {
    navAny.mediaDevices = nav.medaDevices
  }

  const mediaDevicesAny = navAny.mediaDevices as
    | {
        getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>
        gerUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>
      }
    | undefined

  if (mediaDevicesAny && !mediaDevicesAny.getUserMedia && typeof mediaDevicesAny.gerUserMedia === 'function') {
    mediaDevicesAny.getUserMedia = mediaDevicesAny.gerUserMedia.bind(mediaDevicesAny)
  }

  if (!nav.mediaDevices?.getUserMedia) {
    const legacyGetUserMedia = nav.webkitGetUserMedia ?? nav.getUserMedia
    if (legacyGetUserMedia) {
      const wrapped = (constraints: MediaStreamConstraints) =>
        new Promise<MediaStream>((resolve, reject) => {
          legacyGetUserMedia.call(nav, constraints, resolve, reject)
        })

      navAny.mediaDevices = {
        ...(mediaDevicesAny ?? {}),
        getUserMedia: wrapped,
      }
    }
  }
}
