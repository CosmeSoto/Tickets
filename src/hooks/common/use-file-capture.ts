/**
 * Hook para detectar si el dispositivo tiene cámara disponible
 * y gestionar la apertura de inputs de archivo con o sin captura.
 *
 * En móvil con cámara: ofrece dos opciones — cámara directa o galería/archivos.
 * En desktop: comportamiento normal de selección de archivos.
 */

import { useEffect, useState } from 'react'

export function useFileCapture() {
  const [hasCamera, setHasCamera] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // Detectar móvil por user agent y tamaño de pantalla
    const mobile =
      /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      window.innerWidth < 768

    setIsMobile(mobile)

    // Detectar cámara disponible
    if (mobile && navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          const cam = devices.some((d) => d.kind === 'videoinput')
          setHasCamera(cam)
        })
        .catch(() => {
          // Si no se puede consultar, asumir que hay cámara en móvil
          setHasCamera(true)
        })
    } else if (mobile) {
      // Fallback: en móvil sin API, asumir cámara disponible
      setHasCamera(true)
    }
  }, [])

  /**
   * Devuelve true si se debe mostrar la opción de cámara
   * (dispositivo móvil con cámara detectada)
   */
  const showCameraOption = isMobile && hasCamera

  return { showCameraOption, isMobile, hasCamera }
}
