'use client'

import * as React from 'react'
import { Input, InputProps } from './input'
import { Button } from './button'
import { Barcode, Camera, X, AlertCircle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './dialog'
import { Alert, AlertDescription } from './alert'

export interface SerialNumberInputProps extends InputProps {
  onScanComplete?: (value: string) => void
}

type CameraError = 'permission' | 'not-found' | 'unknown' | null

const SerialNumberInput = React.forwardRef<HTMLInputElement, SerialNumberInputProps>(
  ({ className, value, onChange, onKeyDown, onScanComplete, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement>(null)
    const videoRef = React.useRef<HTMLVideoElement>(null)
    const [isKeyboardScanning, setIsKeyboardScanning] = React.useState(false)
    const [isCameraScanning, setIsCameraScanning] = React.useState(false)
    const [scanBuffer, setScanBuffer] = React.useState('')
    const [codeReader, setCodeReader] = React.useState<any>(null)
    const [cameraError, setCameraError] = React.useState<CameraError>(null)
    const [isLoadingCamera, setIsLoadingCamera] = React.useState(false)

    React.useEffect(() => {
      if (typeof window !== 'undefined') {
        import('@zxing/library').then((module) => {
          setCodeReader(new module.BrowserMultiFormatReader())
        })
      }
    }, [])

    React.useEffect(() => {
      return () => {
        if (codeReader) {
          codeReader.reset()
        }
      }
    }, [codeReader])

    const startCameraScan = async () => {
      if (!codeReader) return
      
      try {
        setIsLoadingCamera(true)
        setCameraError(null)
        setIsCameraScanning(true)
        
        await new Promise(resolve => setTimeout(resolve, 100))
        
        const result = await codeReader.decodeFromVideoDevice(
          undefined, 
          videoRef.current!, 
          (result: any, err: any) => {
            if (result) {
              const scannedValue = result.getText()
              if (onChange) {
                const event = {
                  target: { value: scannedValue },
                } as React.ChangeEvent<HTMLInputElement>
                onChange(event)
              }
              onScanComplete?.(scannedValue)
              stopCameraScan()
            }
          }
        )
      } catch (error: any) {
        console.error('Error accessing camera:', error)
        
        if (error.name === 'NotAllowedError') {
          setCameraError('permission')
        } else if (error.name === 'NotFoundError') {
          setCameraError('not-found')
        } else {
          setCameraError('unknown')
        }
      } finally {
        setIsLoadingCamera(false)
      }
    }

    const stopCameraScan = () => {
      setIsCameraScanning(false)
      setIsLoadingCamera(false)
      setCameraError(null)
      if (codeReader) {
        codeReader.reset()
      }
    }

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

      if (onKeyDown) {
        onKeyDown(e)
      }
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setScanBuffer(e.target.value)
      if (onChange) {
        onChange(e)
      }
    }

    const handleKeyboardScanButtonClick = () => {
      setIsKeyboardScanning(!isKeyboardScanning)
      if (!isKeyboardScanning) {
        inputRef.current?.focus()
      }
    }

    const getErrorMessage = () => {
      switch (cameraError) {
        case 'permission':
          return (
            <div className='space-y-2'>
              <p className='font-medium'>Permiso de cámara denegado</p>
              <p className='text-sm text-gray-600'>
                Por favor, habilita el acceso a la cámara en la configuración de tu navegador y vuelve a intentarlo.
              </p>
              <ol className='text-sm text-gray-600 list-decimal list-inside space-y-1'>
                <li>Haz clic en el ícono de candado en la barra de direcciones</li>
                <li>Busca la opción "Cámara" o "Permisos"</li>
                <li>Cambia el acceso a "Permitir"</li>
                <li>Actualiza la página y vuelve a intentar</li>
              </ol>
            </div>
          )
        case 'not-found':
          return (
            <div className='space-y-2'>
              <p className='font-medium'>No se encontró la cámara</p>
              <p className='text-sm text-gray-600'>
                Asegúrate de que tu dispositivo tenga una cámara conectada y que no esté siendo utilizada por otra aplicación.
              </p>
            </div>
          )
        default:
          return (
            <div className='space-y-2'>
              <p className='font-medium'>Error al acceder a la cámara</p>
              <p className='text-sm text-gray-600'>
                Ocurrió un error inesperado al intentar acceder a la cámara. Por favor, vuelve a intentarlo.
              </p>
            </div>
          )
      }
    }

    return (
      <div className='relative'>
        <Input
          ref={(node) => {
            if (typeof ref === 'function') {
              ref(node)
            } else if (ref) {
              ref.current = node
            }
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
            title={isKeyboardScanning ? 'Desactivar modo lector físico' : 'Activar modo lector físico'}
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

        <Dialog open={isCameraScanning} onOpenChange={(open) => {
          if (!open) stopCameraScan()
        }}>
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
                  <Button
                    variant='outline'
                    onClick={stopCameraScan}
                  >
                    <X className='h-4 w-4 mr-2' />
                    Cerrar
                  </Button>
                  <Button
                    onClick={startCameraScan}
                  >
                    <RefreshCw className='h-4 w-4 mr-2' />
                    Reintentar
                  </Button>
                </div>
              </div>
            ) : (
              <div className='space-y-4'>
                <div className='relative aspect-video bg-black rounded-lg overflow-hidden'>
                  {isLoadingCamera ? (
                    <div className='absolute inset-0 flex items-center justify-center bg-gray-900 text-white'>
                      <div className='text-center space-y-2'>
                        <RefreshCw className='h-8 w-8 mx-auto animate-spin' />
                        <p>Cargando cámara...</p>
                      </div>
                    </div>
                  ) : (
                    <video
                      ref={videoRef}
                      className='w-full h-full object-cover'
                      playsInline
                    />
                  )}
                </div>
                <div className='flex justify-end'>
                  <Button
                    variant='outline'
                    onClick={stopCameraScan}
                  >
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
