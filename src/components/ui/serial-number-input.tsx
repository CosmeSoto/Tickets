'use client'

import * as React from 'react'
import { Input, InputProps } from './input'
import { Button } from './button'
import { Barcode, Camera, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './dialog'

export interface SerialNumberInputProps extends InputProps {
  onScanComplete?: (value: string) => void
}

const SerialNumberInput = React.forwardRef<HTMLInputElement, SerialNumberInputProps>(
  ({ className, value, onChange, onKeyDown, onScanComplete, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement>(null)
    const videoRef = React.useRef<HTMLVideoElement>(null)
    const [isKeyboardScanning, setIsKeyboardScanning] = React.useState(false)
    const [isCameraScanning, setIsCameraScanning] = React.useState(false)
    const [scanBuffer, setScanBuffer] = React.useState('')
    const [codeReader, setCodeReader] = React.useState<any>(null)
    const [hasCameraAccess, setHasCameraAccess] = React.useState(true)

    React.useEffect(() => {
      if (typeof window !== 'undefined') {
        import('@zxing/library').then(module => {
          setCodeReader(new module.BrowserMultiFormatReader())
        })
      }
    }, [])

    const startCameraScan = async () => {
      if (!codeReader) return

      try {
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
      } catch (error) {
        console.error('Error accessing camera:', error)
        setHasCameraAccess(false)
        stopCameraScan()
      }
    }

    const stopCameraScan = () => {
      setIsCameraScanning(false)
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

    return (
      <div className='relative'>
        <Input
          ref={node => {
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

        <Dialog open={isCameraScanning} onOpenChange={setIsCameraScanning}>
          <DialogContent className='sm:max-w-md'>
            <DialogHeader>
              <DialogTitle>Escanear código de barras</DialogTitle>
              <DialogDescription>
                Apunta la cámara al código de barras para escanearlo
              </DialogDescription>
            </DialogHeader>
            <div className='relative aspect-video bg-black rounded-lg overflow-hidden'>
              <video ref={videoRef} className='w-full h-full object-cover' playsInline />
              {!hasCameraAccess && (
                <div className='absolute inset-0 flex items-center justify-center bg-gray-800 text-white'>
                  <p>No se puede acceder a la cámara</p>
                </div>
              )}
            </div>
            <div className='flex justify-end'>
              <Button variant='outline' onClick={stopCameraScan}>
                <X className='h-4 w-4 mr-2' />
                Cancelar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }
)

SerialNumberInput.displayName = 'SerialNumberInput'

export { SerialNumberInput }
