/**
 * Equipment QR Card Component
 */

import { QrCode, Download } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface EquipmentQRCardProps {
  qrCode: string | null
  equipmentCode: string
  onDownload: () => void
}

export function EquipmentQRCard({ qrCode, equipmentCode, onDownload }: EquipmentQRCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <QrCode className='h-5 w-5' />
          Código QR
        </CardTitle>
        <CardDescription>Escanea para acceder rápidamente</CardDescription>
      </CardHeader>
      <CardContent className='flex flex-col items-center gap-4'>
        {qrCode ? (
          <>
            <img src={qrCode} alt='QR Code' className='w-48 h-48' />
            <Button onClick={onDownload} variant='outline' size='sm'>
              <Download className='mr-2 h-4 w-4' />
              Descargar QR
            </Button>
          </>
        ) : (
          <p className='text-sm text-muted-foreground'>QR no disponible</p>
        )}
      </CardContent>
    </Card>
  )
}
