/**
 * Equipment QR Card Component
 */

import { useState } from 'react'
import { QrCode, Download, Printer } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { QRPrintDialog } from '@/components/common/qr/qr-print-dialog'

interface EquipmentQRCardProps {
  qrCode: string | null
  equipmentCode: string
  equipmentName?: string
  onDownload: () => void
}

export function EquipmentQRCard({
  qrCode,
  equipmentCode,
  equipmentName,
  onDownload,
}: EquipmentQRCardProps) {
  const [printOpen, setPrintOpen] = useState(false)

  return (
    <>
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
              {/* eslint-disable-next-line @next/next/no-img-element -- QR code is a data URL */}
              <img src={qrCode} alt='QR Code' className='w-48 h-48' />
              <div className='flex gap-2'>
                <Button onClick={onDownload} variant='outline' size='sm'>
                  <Download className='mr-2 h-4 w-4' />
                  Descargar QR
                </Button>
                <Button onClick={() => setPrintOpen(true)} variant='outline' size='sm'>
                  <Printer className='mr-2 h-4 w-4' />
                  Imprimir QR
                </Button>
              </div>
            </>
          ) : (
            <p className='text-sm text-muted-foreground'>QR no disponible</p>
          )}
        </CardContent>
      </Card>

      <QRPrintDialog
        open={printOpen}
        onOpenChange={setPrintOpen}
        item={qrCode ? { qrSrc: qrCode, label: equipmentCode, sublabel: equipmentName } : null}
      />
    </>
  )
}
