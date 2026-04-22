'use client'

import { AlertTriangle, XCircle } from 'lucide-react'
import { getRenewalAlertClass } from '@/lib/utils/inventory-utils'

interface RenewalAlertProps {
  renewalAlertStatus: 'none' | 'warning' | 'expired'
  renewalDate?: string | Date | null
  className?: string
}

export function RenewalAlert({
  renewalAlertStatus,
  renewalDate,
  className = '',
}: RenewalAlertProps) {
  if (renewalAlertStatus === 'none') return null

  const isExpired = renewalAlertStatus === 'expired'
  const dateStr = renewalDate
    ? new Date(renewalDate).toLocaleDateString('es-EC', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : null

  return (
    <div
      className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${getRenewalAlertClass(isExpired)} ${className}`}
    >
      {isExpired ? (
        <XCircle className='h-3.5 w-3.5 shrink-0' />
      ) : (
        <AlertTriangle className='h-3.5 w-3.5 shrink-0' />
      )}
      <span>
        {isExpired
          ? `Vencida${dateStr ? ` el ${dateStr}` : ''}`
          : `Renueva${dateStr ? ` el ${dateStr}` : ' pronto'}`}
      </span>
    </div>
  )
}
