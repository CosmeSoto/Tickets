import { CheckCircle, PlayCircle, AlertTriangle, Circle, Clock, XCircle } from 'lucide-react'
import { Badge } from '../badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../tooltip'
import type { ResolutionTask } from '@/hooks/use-resolution-plan'

export function getStatusIcon(status: ResolutionTask['status']) {
  switch (status) {
    case 'completed':
      return <CheckCircle className='h-4 w-4 text-green-600' />
    case 'in_progress':
      return <PlayCircle className='h-4 w-4 text-blue-600' />
    case 'blocked':
      return <AlertTriangle className='h-4 w-4 text-red-600' />
    default:
      return <Circle className='h-4 w-4 text-muted-foreground' />
  }
}

export function getStatusBadge(status: ResolutionTask['status']) {
  const configs = {
    pending: {
      icon: <Clock className='h-3 w-3' />,
      label: 'Pendiente',
      color: 'bg-muted text-foreground',
      description: 'Tarea no iniciada',
    },
    in_progress: {
      icon: <PlayCircle className='h-3 w-3' />,
      label: 'En Progreso',
      color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      description: 'Trabajando activamente',
    },
    completed: {
      icon: <CheckCircle className='h-3 w-3' />,
      label: 'Completada',
      color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      description: 'Terminada exitosamente',
    },
    blocked: {
      icon: <XCircle className='h-3 w-3' />,
      label: 'Bloqueada',
      color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      description: 'No se puede continuar',
    },
  }

  const config = configs[status]

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className={config.color}>
            {config.icon}
            <span className='ml-1'>{config.label}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
