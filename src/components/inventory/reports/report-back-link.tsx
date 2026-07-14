'use client'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export function ReportBackLink({ href = '/inventory/reports' }: { href?: string }) {
  return (
    <Link
      href={href}
      className='inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors'
    >
      <ChevronLeft className='h-4 w-4' />
      Volver a reportes
    </Link>
  )
}
