'use client'

import * as React from 'react'
import { Input, InputProps } from './input'
import { Button } from './button'
import { Barcode, Camera, X, AlertCircle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './dialog'
import { Alert, AlertDescription } from './alert'

export interface SerialNumberInputProps extends InputProps {
  onScanComplete?: (value: string) => void
}

type CameraError = 'permission' | 'not-found' | 'unknown' | null

// ── Formatos de código de barras para BarcodeDetector nativa ──────────────────
// Incluye todos los formatos comunes en equipos/inventario
const BARCODE_FORMATS = [
  'code_128', // el más común en equipos electrónicos
  'code_39',
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'data_matrix',
  'qr_code',
  'pdf417',
  'aztec',
  'itf',
]

// ── Detecta si BarcodeDetector nativa está disponible ─────────────────────────
function hasBarcodeDetector(): boolean {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window
}

// ── Decodifica un frame de video usando BarcodeDetector nativa ────────────────
async function detectWithNativeAPI(video: HTMLVideoElement, detector: any): Promise<string | null> {
  try {
    const results = await detector.detect(video)
    if (results.length > 0) return results[0].rawValue
  } catch {
    // frame inválido o detector ocupado — ignorar
  }
  return null
}

// ── Decodifica un frame usando ZXing vía canvas (fallback) ────────────────────
async function detectWithZXing(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  reader: any
): Promise<string | null> {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null

  canvas.width = video.videoWidth || 640
  canvas.height = video.videoHeight || 480
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

  try {
    const zxing = await import('@zxing/library')
    // HTMLCanvasElementLuminanceSource convierte correctamente RGBA → escala de grises
    const luminanceSource = new (zxing as any).HTMLCanvasElementLuminanceSource(canvas)
    const bitmap = new zxing.BinaryBitmap(new zxing.HybridBinarizer(luminanceSource))
    const result = reader.decode(bitmap)
    return result?.getText() ?? null
  } catch {
    // NotFoundException es normal cuando no hay código en el frame — ignorar
    return null
  }
}

const SerialNumberInput = React.forwardRef<HTMLInputElement, SerialNumberInputProps>(
  ({ className, value, onChange, onKeyDown, onScanComplete, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement>(null)
    const videoRef = React.useRef<HTMLVideoElement>(null)
    const canvasRef = React.useRef<HTMLCanvasElement>(null)
    const streamRef = React.useRef<MediaStream | null>(null)
    const rafRef = React.useRef<number | null>(null)
    const detectorRef = React.useRef<any>(null)
    const zxingReaderRef = React.useRef<any>(null)
    const scanningRef = React.useRef(false)

    const [isKeyboardScanning, setIsKeyboardScanning] = React.useState(false)
    const [isCameraScanning, setIsCameraScanning] = React.useState(false)
    const [scanBuffer, setScanBuffer] = React.useState('')
    const [cameraError, setCameraError] = React.useState<CameraError>(null)
    const [isLoadingCamera, setIsLoadingCamera] = React.useState(false)
    const [scanStatus, setScanStatus] = React.useState<'idle' | 'scanning' | 'detected'>('idle')

    // ── Cleanup al desmontar ────────────────────────────────────────────────
    React.useEffect(() => {
      return () => {
        cleanupCamera()
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const cleanupCamera = React.useCallback(() => {
      scanningRef.current = false
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      zxingReaderRef.current?.reset?.()
      zxingReaderRef.current = null
      detectorRef.current = null
    }, [])

    // ── Loop de detección frame a frame ─────────────────────────────────────
    const startScanLoop = React.useCallback(
      (video: HTMLVideoElement, onDetected: (value: string) => void) => {
        scanningRef.current = true
        setScanStatus('scanning')

        const tick = async () => {
          if (!scanningRef.current) return
          if (video.readyState < 2 || video.videoWidth === 0) {
            // Video aún no tiene frames — esperar
            rafRef.current = requestAnimationFrame(tick)
            return
          }

          let detected: string | null = null

          // Intento 1: BarcodeDetector nativa (más rápida y precisa en Android)
          if (detectorRef.current) {
            detected = await detectWithNativeAPI(video, detectorRef.current)
          }

          // Intento 2: ZXing via canvas (fallback universal)
          if (!detected && zxingReaderRef.current && canvasRef.current) {
            detected = await detectWithZXing(video, canvasRef.current, zxingReaderRef.current)
          }

          if (detected) {
            scanningRef.current = false
            setScanStatus('detected')
            onDetected(detected)
            return
          }

          // Continuar en el siguiente frame
          if (scanningRef.current) {
            rafRef.current = requestAnimationFrame(tick)
          }
        }

        rafRef.current = requestAnimationFrame(tick)
      },
      []
    )

    // ── Iniciar cámara ─────────────────────────────────────────────────────
    const startCameraScan = React.useCallback(async () => {
      cleanupCamera()
      setCameraError(null)
      setIsLoadingCamera(true)
      setScanStatus('idle')
      setIsCameraScanning(true)

      // Pequeña pausa para que el Dialog monte el <video>
      await new Promise(r => setTimeout(r, 80))

      const video = videoRef.current
      if (!video) {
        setCameraError('unknown')
        setIsLoadingCamera(false)
        return
      }

      // Pedir stream con cámara trasera
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        })
      } catch (err: any) {
        setIsLoadingCamera(false)
        const name = err?.name ?? ''
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setCameraError('permission')
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          setCameraError('not-found')
        } else {
          setCameraError('unknown')
        }
        return
      }

      streamRef.current = stream
      video.srcObject = stream

      try {
        await video.play()
      } catch {
        // En algunos browsers play() ya fue llamado por autoplay — ignorar
      }

      // Preparar detector nativo si está disponible
      if (hasBarcodeDetector()) {
        try {
          detectorRef.current = new (window as any).BarcodeDetector({ formats: BARCODE_FORMATS })
        } catch {
          // BarcodeDetector no soporta algún formato — intentar sin formatos específicos
          try {
            detectorRef.current = new (window as any).BarcodeDetector()
          } catch {
            detectorRef.current = null
          }
        }
      }

      // Preparar lector ZXing (fallback)
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/library')
        zxingReaderRef.current = new BrowserMultiFormatReader()
      } catch {
        zxingReaderRef.current = null
      }

      setIsLoadingCamera(false)

      // Arrancar el loop de detección
      startScanLoop(video, (scannedValue: string) => {
        if (onChange) {
          onChange({
            target: { value: scannedValue },
          } as React.ChangeEvent<HTMLInputElement>)
        }
        onScanComplete?.(scannedValue)
        stopCameraScan()
      })
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cleanupCamera, startScanLoop, onChange, onScanComplete])

    const stopCameraScan = React.useCallback(() => {
      cleanupCamera()
      setIsCameraScanning(false)
      setIsLoadingCamera(false)
      setCameraError(null)
      setScanStatus('idle')
    }, [cleanupCamera])

    // ── Lector físico (pistola / teclado) ────────────────────────────────────
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (scanBuffer.length > 0) {
          onScanComplete?.(scanBuffer.trim())
          setScanBuffer('')
        }
      } else if (e.key.length === 1) {
        setScanBuffer(prev => prev + e.key)
      } else if (e.key === 'Backspace') {
        setScanBuffer(prev => prev.slice(0, -1))
      }
      onKeyDown?.(e)
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setScanBuffer(e.target.value)
      onChange?.(e)
    }

    const handleKeyboardScanButtonClick = () => {
      setIsKeyboardScanning(prev => !prev)
      if (!isKeyboardScanning) inputRef.current?.focus()
    }

    // ── Mensajes de error ────────────────────────────────────────────────────
    const getErrorMessage = () => {
      switch (cameraError) {
        case 'permission':
          return (
            <div className='space-y-2'>
              <p className='font-medium'>Permiso de cámara denegado</p>
              <p className='text-sm text-gray-600'>
                Habilita el acceso a la cámara en la configuración del navegador y vuelve a
                intentarlo.
              </p>
              <ol className='text-sm text-gray-600 list-decimal list-inside space-y-1'>
                <li>Toca el ícono de candado en la barra de direcciones</li>
                <li>Busca &quot;Cámara&quot; o &quot;Permisos&quot;</li>
                <li>Cambia el acceso a &quot;Permitir&quot;</li>
                <li>Recarga la página y vuelve a intentar</li>
              </ol>
            </div>
          )
        case 'not-found':
          return (
            <div className='space-y-2'>
              <p className='font-medium'>No se encontró la cámara</p>
              <p className='text-sm text-gray-600'>
                Asegúrate de que el dispositivo tenga cámara y que no esté siendo usada por otra
                aplicación.
              </p>
            </div>
          )
        default:
          return (
            <div className='space-y-2'>
              <p className='font-medium'>Error al acceder a la cámara</p>
              <p className='text-sm text-gray-600'>
                Verifica los permisos de cámara y vuelve a intentarlo.
              </p>
            </div>
          )
      }
    }

    // ── Render ──────────────────────────────────────────────────────────────
    return (
      <div className='relative'>
        <Input
          ref={node => {
            if (typeof ref === 'function') ref(node)
            else if (ref) ref.current = node
            inputRef.current = node
          }}
          className={cn(
            isKeyboardScanning && 'ring-2 ring-blue-500 ring-offset-2',
            'pr-24',
            className
          )}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          {...props}
        />
        <div className='absolute right-1 top-1/2 -translate-y-1/2 flex gap-1'>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className={cn(
              'h-8 w-8',
              isKeyboardScanning && 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            )}
            onClick={handleKeyboardScanButtonClick}
            title={
              isKeyboardScanning ? 'Desactivar modo lector físico' : 'Activar modo lector físico'
            }
          >
            <Barcode className={cn('h-4 w-4', isKeyboardScanning && 'animate-pulse')} />
          </Button>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='h-8 w-8'
            onClick={startCameraScan}
            title='Escanear con cámara'
          >
            <Camera className='h-4 w-4' />
          </Button>
        </div>

        {/* Canvas oculto — usado por ZXing para procesar frames */}
        <canvas ref={canvasRef} className='hidden' aria-hidden='true' />

        <Dialog
          open={isCameraScanning}
          onOpenChange={open => {
            if (!open) stopCameraScan()
          }}
        >
          <DialogContent className='sm:max-w-md'>
            <DialogHeader>
              <DialogTitle>Escanear código de barras</DialogTitle>
              <DialogDescription>
                Apunta la cámara al código de barras para escanearlo
              </DialogDescription>
            </DialogHeader>

            {cameraError ? (
              <div className='space-y-4'>
                <Alert variant='destructive'>
                  <AlertCircle className='h-4 w-4' />
                  <AlertDescription>{getErrorMessage()}</AlertDescription>
                </Alert>
                <div className='flex justify-end gap-2'>
                  <Button variant='outline' onClick={stopCameraScan}>
                    <X className='h-4 w-4 mr-2' />
                    Cerrar
                  </Button>
                  <Button onClick={startCameraScan}>
                    <RefreshCw className='h-4 w-4 mr-2' />
                    Reintentar
                  </Button>
                </div>
              </div>
            ) : (
              <div className='space-y-4'>
                <div className='relative aspect-video bg-black rounded-lg overflow-hidden'>
                  {isLoadingCamera && (
                    <div className='absolute inset-0 flex items-center justify-center bg-gray-900 text-white z-10'>
                      <div className='text-center space-y-2'>
                        <RefreshCw className='h-8 w-8 mx-auto animate-spin' />
                        <p className='text-sm'>Iniciando cámara...</p>
                      </div>
                    </div>
                  )}

                  {/* Indicador de escaneo activo */}
                  {scanStatus === 'scanning' && !isLoadingCamera && (
                    <div className='absolute top-2 left-2 z-10 flex items-center gap-1.5 bg-black/60 text-white text-xs px-2 py-1 rounded-full'>
                      <span className='h-2 w-2 rounded-full bg-green-400 animate-pulse' />
                      Buscando código...
                    </div>
                  )}

                  {/* Guía de encuadre */}
                  {!isLoadingCamera && (
                    <div className='absolute inset-0 flex items-center justify-center pointer-events-none z-10'>
                      <div className='w-3/4 h-1/3 border-2 border-white/60 rounded-md relative'>
                        {/* Esquinas resaltadas */}
                        <div className='absolute -top-0.5 -left-0.5 w-4 h-4 border-t-2 border-l-2 border-white rounded-tl' />
                        <div className='absolute -top-0.5 -right-0.5 w-4 h-4 border-t-2 border-r-2 border-white rounded-tr' />
                        <div className='absolute -bottom-0.5 -left-0.5 w-4 h-4 border-b-2 border-l-2 border-white rounded-bl' />
                        <div className='absolute -bottom-0.5 -right-0.5 w-4 h-4 border-b-2 border-r-2 border-white rounded-br' />
                      </div>
                    </div>
                  )}

                  <video
                    ref={videoRef}
                    className='w-full h-full object-cover'
                    playsInline
                    muted
                    autoPlay
                  />
                </div>
                <div className='flex justify-end'>
                  <Button variant='outline' onClick={stopCameraScan}>
                    <X className='h-4 w-4 mr-2' />
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    )
  }
)

SerialNumberInput.displayName = 'SerialNumberInput'

export { SerialNumberInput }
