import { PackagePlus, UserCheck, Wrench, Archive, Clock } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { es } from 'date-fns/locale'

interface BatchEvent {
  type: string
  date: Date
  user?: { name?: string | null } | null
  description: string
}

interface BatchHistoryProps {
  history: BatchEvent[]
}

const EVENT_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  created: { icon: PackagePlus, color: 'text-green-600 bg-green-100' },
  assigned: { icon: UserCheck, color: 'text-blue-600 bg-blue-100' },
  maintenance: { icon: Wrench, color: 'text-yellow-600 bg-yellow-100' },
  retired: { icon: Archive, color: 'text-red-600 bg-red-100' },
  default: { icon: Clock, color: 'text-gray-600 bg-gray-100' },
}

export function BatchHistory({ history }: BatchHistoryProps) {
  if (history.length === 0) {
    return <div className='text-center py-8 text-muted-foreground'>No hay eventos registrados</div>
  }

  const sorted = [...history].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  return (
    <div className='relative'>
      {/* Línea vertical */}
      <div className='absolute left-5 top-0 bottom-0 w-0.5 bg-border' />

      <div className='space-y-6'>
        {sorted.map((event, idx) => {
          const { icon: Icon, color } = EVENT_ICONS[event.type] || EVENT_ICONS.default
          const eventDate = new Date(event.date)

          return (
            <div key={idx} className='relative flex gap-4 pl-12'>
              {/* Icono */}
              <div
                className={`absolute left-0 w-10 h-10 rounded-full flex items-center justify-center ${color}`}
              >
                <Icon className='w-5 h-5' />
              </div>

              {/* Contenido */}
              <div className='flex-1 bg-muted/30 rounded-lg p-4'>
                <p className='font-medium text-sm'>{event.description}</p>
                <div className='flex items-center gap-3 mt-1 text-xs text-muted-foreground'>
                  {event.user?.name && <span>por {event.user.name}</span>}
                  <span title={format(eventDate, 'PPpp', { locale: es })}>
                    {formatDistanceToNow(eventDate, { addSuffix: true, locale: es })}
                  </span>
                  <span>{format(eventDate, 'dd/MM/yyyy HH:mm', { locale: es })}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
