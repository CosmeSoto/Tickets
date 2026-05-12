'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Camera, CameraOff, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface ScanResult {
  checkpointId: string
  token: string
}

interface PatrolCheckpointScannerProps {
  onScan: (result: ScanResult) => void
  onError: (error: string) => void
  /** Si true, el scanner está activo y procesando frames */
  active?: boolean
}

/**
 * Escáner de QR para checkpoints de patrulla.
 * Usa BarcodeDetector API (nativa) con fallback a jsQR.
 * Accede a la cámara trasera (facingMode: 'environment').
 * Detiene el stream al desmontar.
 */
export function PatrolCheckpointScanner({
  onScan,
  onError,
  active = true,
}: PatrolCheckpointScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const scanningRef = useRef(false)

  const [cameraState, setCameraState] = useState<'idle' | 'starting' | 'active' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // ── Parsear payload QR ──────────────────────────────────────────────────────
  const parseQRPayload = useCallback(
    (raw: string): ScanResult | null => {
      try {
        const parsed = JSON.parse(raw)
        if (parsed?.cid && parsed?.t) {
          return { checkpointId: parsed.cid, token: parsed.t }
        }
      } catch {
        // no es JSON — ignorar
      }
      onError(`QR no reconocido: ${raw.slice(0, 40)}`)
      return null
    },
    [onError]
  )

  // ── Procesar frame con BarcodeDetector ─────────────────────────────────────
  const scanWithBarcodeDetector = useCallback(
    async (detector: any, video: HTMLVideoElement) => {
      try {
        const barcodes = await detector.detect(video)
        for (const barcode of barcodes) {
          if (barcode.format === 'qr_code') {
            const result = parseQRPayload(barcode.rawValue)
            if (result) {
              scanningRef.current = false
              onScan(result)
              return
            }
          }
        }
      } catch {
        // frame no procesable — continuar
      }
      if (scanningRef.current) {
        animFrameRef.current = requestAnimationFrame(() => scanWithBarcodeDetector(detector, video))
      }
    },
    [onScan, parseQRPayload]
  )

  // ── Procesar frame con jsQR ─────────────────────────────────────────────────
  const scanWithJsQR = useCallback(
    async (video: HTMLVideoElement, canvas: HTMLCanvasElement) => {
      const jsQR = (await import('jsqr')).default
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const tick = () => {
        if (!scanningRef.current) return
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          })
          if (code) {
            const result = parseQRPayload(code.data)
            if (result) {
              scanningRef.current = false
              onScan(result)
              return
            }
          }
        }
        animFrameRef.current = requestAnimationFrame(tick)
      }
      animFrameRef.current = requestAnimationFrame(tick)
    },
    [onScan, parseQRPayload]
  )

  // ── Iniciar cámara ──────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setCameraState('starting')
    setErrorMsg(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream

      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      await video.play()

      setCameraState('active')
      scanningRef.current = true

      // Intentar BarcodeDetector nativo primero
      if ('BarcodeDetector' in window) {
        try {
          const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })
          scanWithBarcodeDetector(detector, video)
          return
        } catch {
          // BarcodeDetector no soporta qr_code en este dispositivo
        }
      }

      // Fallback: jsQR
      const canvas = canvasRef.current
      if (canvas) scanWithJsQR(video, canvas)
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Permiso de cámara denegado. Habilita el acceso en la configuración del navegador.'
          : 'No se pudo acceder a la cámara.'
      setCameraState('error')
      setErrorMsg(msg)
      onError(msg)
    }
  }, [scanWithBarcodeDetector, scanWithJsQR, onError])

  // ── Detener cámara ──────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    scanningRef.current = false
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraState('idle')
  }, [])

  // Iniciar/detener según prop `active`
  useEffect(() => {
    if (active) {
      startCamera()
    } else {
      stopCamera()
    }
    return () => stopCamera()
  }, [active, startCamera, stopCamera])

  return (
    <div className='relative w-full aspect-square max-w-sm mx-auto rounded-xl overflow-hidden bg-black'>
      {/* Video */}
      <video
        ref={videoRef}
        className='w-full h-full object-cover'
        playsInline
        muted
        aria-label='Visor de cámara para escanear QR'
      />

      {/* Canvas oculto para jsQR */}
      <canvas ref={canvasRef} className='hidden' />

      {/* Overlay de estado */}
      {cameraState === 'starting' && (
        <div className='absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white gap-3'>
          <Loader2 className='h-8 w-8 animate-spin' />
          <p className='text-sm'>Iniciando cámara...</p>
        </div>
      )}

      {cameraState === 'idle' && (
        <div className='absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white gap-3'>
          <CameraOff className='h-8 w-8 opacity-60' />
          <p className='text-sm opacity-60'>Cámara inactiva</p>
        </div>
      )}

      {cameraState === 'error' && (
        <div className='absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white gap-3 p-4'>
          <AlertCircle className='h-8 w-8 text-destructive' />
          <p className='text-sm text-center'>{errorMsg}</p>
          <Button
            size='sm'
            variant='outline'
            onClick={startCamera}
            className='text-white border-white/40'
          >
            <Camera className='h-4 w-4 mr-2' />
            Reintentar
          </Button>
        </div>
      )}

      {/* Marco de escaneo */}
      {cameraState === 'active' && (
        <div className='absolute inset-0 flex items-center justify-center pointer-events-none'>
          <div className='w-48 h-48 border-2 border-white/80 rounded-lg relative'>
            {/* Esquinas */}
            <span className='absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-sm' />
            <span className='absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-sm' />
            <span className='absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-sm' />
            <span className='absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-sm' />
          </div>
        </div>
      )}
    </div>
  )
}
