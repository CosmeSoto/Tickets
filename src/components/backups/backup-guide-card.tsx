'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Database, Download, Shield, Activity } from 'lucide-react'

export function BackupGuideCard() {
  return (
    <Card className='border-primary/20 bg-primary/5'>
      <CardHeader className='pb-3'>
        <CardTitle className='text-base flex items-center gap-2'>
          <Shield className='h-5 w-5 text-primary' />
          ¿Cómo funciona el sistema de respaldos?
        </CardTitle>
        <CardDescription>Dos capas complementarias — infraestructura y exportación</CardDescription>
      </CardHeader>
      <CardContent className='grid gap-4 md:grid-cols-2 text-sm'>
        <div className='space-y-2 rounded-lg border bg-background p-4'>
          <div className='flex items-center gap-2 font-medium'>
            <Database className='h-4 w-4 text-primary' />
            pgBackRest — Infraestructura
            <Badge variant='secondary'>automático</Badge>
          </div>
          <p className='text-muted-foreground text-xs leading-relaxed'>
            Respaldos completos (FULL) y diferenciales (DIFF) en el repositorio interno. La
            programación — día del FULL, hora y retención — se configura en la pestaña{' '}
            <strong>Config</strong>. Sirve para recuperación ante desastre y PITR. No genera un
            archivo descargable.
          </p>
        </div>
        <div className='space-y-2 rounded-lg border bg-background p-4'>
          <div className='flex items-center gap-2 font-medium'>
            <Download className='h-4 w-4 text-primary' />
            Exportación .dump — Portable
            <Badge variant='outline'>manual</Badge>
          </div>
          <p className='text-muted-foreground text-xs leading-relaxed'>
            Archivo único para descargar, migrar o subir a la nube. Restauración selectiva por
            módulo (tickets, usuarios…) desde la pestaña <strong>Restaurar</strong>.
          </p>
        </div>
        <div className='md:col-span-2 flex flex-wrap gap-2 text-xs text-muted-foreground'>
          <Badge variant='outline' className='gap-1'>
            <Activity className='h-3 w-3' />
            Monitoreo → estado pgBackRest en tiempo real
          </Badge>
          <Badge variant='outline'>Config → horario, día FULL y retención</Badge>
          <Badge variant='outline'>Backups → historial con etiquetas pgBackRest</Badge>
          <Badge variant='outline'>Dashboard → guía de auditoría e informe JSON</Badge>
        </div>
      </CardContent>
    </Card>
  )
}
