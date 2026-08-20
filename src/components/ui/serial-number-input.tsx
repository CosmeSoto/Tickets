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

/** Espera hasta que el elemento video esté en el DOM (máx. 1 s). */
async function waitForVideoElement(
  ref: React.RefObject<HTMLVideoElement | null>
): Promise<HTMLVideoElement | null> {
  for (let i = 0; i < 20; i++) {
    if (ref.current) return ref.current
    await new Promise(r => setTimeout(r, 50))
  }
  return null
}

const SerialNumberInput = React.forwardRef<HTMLInputElement, SerialNumberInputProps>(
  ({ className, value, onChange, onKeyDown, onScanComplete, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement>(null)
    const videoRef = React.useRef<HTMLVideoElement>(null)
    const readerRef = React.useRef<any>(null)

    const [isKeyboardScanning, setIsKeyboardScanning] = React.useState(false)
    const [isCameraScanning, setIsCameraScanning] = React.useState(false)
    const [scanBuffer, setScanBuffer] = React.useState('')
    const [cameraError, setCameraError] = React.useState<CameraError>(null)
    const [isLoadingCamera, setIsLoadingCamera] = React.useState(false)

    // ── Limpiar al desmontar ────────────────────────────────────────────────
    React.useEffect(() => {
      return () => {
        readerRef.current?.reset()
        readerRef.current = null
      }
    }, [])

    // ── Iniciar escáner cuando el Dialog ya está visible ───────────────────
    // isCameraScanning=true + cameraError=null + !isLoadingCamera → arrancar
    React.useEffect(() => {
      if (!isCameraScanning || cameraError !== null) return

      let cancelled = false

      const init = async () => {
        // Esperar a que el <video> esté montado en el DOM
        const video = await waitForVideoElement(videoRef)
        if (cancelled || !video) {
          if (!cancelled) setCameraError('unknown')
          return
        }

        try {
          const { BrowserMultiFormatReader } = await import('@zxing/library')

          // Recrear lector fresco en cada apertura
          readerRef.current?.reset()
          readerRef.current = null
          const reader = new BrowserMultiFormatReader()
          readerRef.current = reader

          if (cancelled) return

          // decodeFromVideoDevice(null, videoElement, callback)
          // Con deviceId=null zxing pide facingMode:'environment' internamente
          await reader.decodeFromVideoDevice(null, video, (result: any) => {
            if (!result || cancelled) return
            const scannedValue = result.getText()
            if (onChange) {
              onChange({
                target: { value: scannedValue },
              } as React.ChangeEvent<HTMLInputElement>)
            }
            onScanComplete?.(scannedValue)
            stopCameraScan()
          })
        } catch (error: any) {
          if (cancelled) return
          console.error('[SerialNumberInput] Error cámara:', error)
          const name = error?.name ?? ''
          if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
            setCameraError('permission')
          } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
            setCameraError('not-found')
          } else {
            setCameraError('unknown')
          }
        } finally {
          if (!cancelled) setIsLoadingCamera(false)
        }
      }

      init()

      return () => {
        cancelled = true
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isCameraScanning])

    // ── Abrir / cerrar ─────────────────────────────────────────────────────
    const startCameraScan = () => {
      // Limpiar estado previo antes de abrir
      readerRef.current?.reset()
      readerRef.current = null
      setCameraError(null)
      setIsLoadingCamera(true)
      setIsCameraScanning(true)
    }

    const stopCameraScan = React.useCallback(() => {
      readerRef.current?.reset()
      readerRef.current = null
      setIsCameraScanning(false)
      setIsLoadingCamera(false)
      setCameraError(null)
    }, [])

    // ── Lector físico (teclado / pistola) ───────────────────────────────────
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

    // ── Mensajes de error ───────────────────────────────────────────────────
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
                  {/*
                   * El <video> siempre está montado (aunque cubierto por el spinner)
                   * para que videoRef esté disponible cuando zxing lo necesite.
                   * muted y playsInline son obligatorios en iOS/Android para autoplay.
                   */}
                  <video ref={videoRef} className='w-full h-full object-cover' playsInline muted />
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
