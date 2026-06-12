'use client'

/**
 * PatrolPhotoCard
 * Tarjeta de captura de foto requerida para iniciar o finalizar una ronda.
 * Soporta cámara y galería a través de FileInputWithCamera.
 */

import { Camera, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileInputWithCamera } from '@/components/common/file-input-with-camera'

interface PatrolPhotoCardProps {
  action: 'start' | 'end'
  photoPreview: string | null
  onPhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onClearPhoto: () => void
}

export function PatrolPhotoCard({
  action,
  photoPreview,
  onPhotoChange,
  onClearPhoto,
}: PatrolPhotoCardProps) {
  const label = action === 'start' ? 'iniciar' : 'finalizar'

  return (
    <Card className='border-orange-300 dark:border-orange-700'>
      <CardHeader className='pb-2'>
        <CardTitle className='text-sm flex items-center gap-2'>
          <Camera className='h-4 w-4 text-orange-500' />
          Foto requerida para {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {photoPreview ? (
          <div className='relative rounded-lg overflow-hidden'>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoPreview}
              alt='Vista previa'
              className='w-full h-40 object-cover rounded-lg'
            />
            <Button size='sm' variant='outline' className='mt-2 w-full' onClick={onClearPhoto}>
              Cambiar foto
            </Button>
          </div>
        ) : (
          <FileInputWithCamera
            accept='image/*'
            onChange={onPhotoChange}
            onCameraChange={onPhotoChange}
          >
            {({ openFile, openCamera, showCamera }) => (
              <div className='flex gap-2'>
                {showCamera && (
                  <Button
                    variant='outline'
                    size='sm'
                    className='flex-1'
                    onClick={() => openCamera('environment')}
                  >
                    <Camera className='h-4 w-4 mr-2' /> Cámara
                  </Button>
                )}
                <Button
                  variant='outline'
                  size='sm'
                  className={showCamera ? 'flex-1' : 'w-full'}
                  onClick={openFile}
                >
                  <Upload className='h-4 w-4 mr-2' /> Galería
                </Button>
              </div>
            )}
          </FileInputWithCamera>
        )}
      </CardContent>
    </Card>
  )
}
