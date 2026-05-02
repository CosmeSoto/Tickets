'use client'

import Link from 'next/link'
import { Info, ExternalLink } from 'lucide-react'

interface InformationalNoticeProps {
  technicianCount: number
  managerCount: number
  clientCount: number
}

/**
 * InformationalNotice — Aviso compacto en la página de detalle de familia.
 * Reemplaza la pestaña "Personal" eliminada, indicando que las asignaciones
 * de usuarios se gestionan desde el módulo de Usuarios.
 *
 * Responsive:
 *  - < md: el enlace aparece en línea separada debajo del texto
 *  - md+: el enlace aparece inline a la derecha del texto
 */
export function InformationalNotice({
  technicianCount,
  managerCount,
  clientCount,
}: InformationalNoticeProps) {
  return (
    <div className='rounded-lg border border-border bg-muted/50 p-4'>
      <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
        {/* Left: icon + text + stats */}
        <div className='flex items-start gap-3 min-w-0'>
          <Info className='h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0' />
          <div className='space-y-1 min-w-0'>
            <p className='text-sm text-muted-foreground leading-snug'>
              La asignación de usuarios a esta familia se gestiona desde el módulo de Usuarios,
              según el rol de cada usuario.
            </p>
            <p className='text-xs text-muted-foreground'>
              {technicianCount} técnico{technicianCount !== 1 ? 's' : ''} · {managerCount} gestor
              {managerCount !== 1 ? 'es' : ''} · {clientCount} cliente{clientCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Right: link to Users module */}
        <Link
          href='/admin/users'
          className='flex items-center gap-1.5 text-sm text-primary hover:underline flex-shrink-0 self-start md:self-auto'
        >
          Ir a Usuarios
          <ExternalLink className='h-3.5 w-3.5' />
        </Link>
      </div>
    </div>
  )
}
