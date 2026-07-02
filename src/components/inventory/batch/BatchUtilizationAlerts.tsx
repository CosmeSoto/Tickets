import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, AlertTriangle, Info } from 'lucide-react'
import type { BatchMetrics } from '@/types/inventory/batch-inventory'
import { getBatchUtilizationAlerts } from '@/lib/inventory/batch-alerts'

interface BatchUtilizationAlertsProps {
  metrics: BatchMetrics
  className?: string
}

const ICONS = {
  critical: AlertCircle,
  warning: AlertTriangle,
  info: Info,
} as const

const VARIANTS = {
  critical: 'destructive',
  warning: 'default',
  info: 'default',
} as const

export function BatchUtilizationAlerts({ metrics, className }: BatchUtilizationAlertsProps) {
  const alerts = getBatchUtilizationAlerts(metrics)
  if (alerts.length === 0) return null

  return (
    <div className={className ? `${className} space-y-2` : 'space-y-2'}>
      {alerts.map((alert, i) => {
        const Icon = ICONS[alert.level]
        return (
          <Alert
            key={i}
            variant={VARIANTS[alert.level]}
            className={
              alert.level === 'warning'
                ? 'border-amber-500/50 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100'
                : undefined
            }
          >
            <Icon className='h-4 w-4' />
            <AlertTitle className='text-sm'>{alert.title}</AlertTitle>
            <AlertDescription className='text-sm'>{alert.message}</AlertDescription>
          </Alert>
        )
      })}
    </div>
  )
}
