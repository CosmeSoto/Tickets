/**
 * ModuleStatusCard
 *
 * Tarjeta compacta que muestra el estado de un módulo del sistema
 * - Indica si está activo o inactivo
 * - Muestra familias asignadas cuando está activo
 */

interface ModuleStatusCardProps {
  emoji: string
  name: string
  active: boolean
  families?: Array<{ id: string; name: string; color?: string | null }>
  badge?: string
}

export function ModuleStatusCard({ emoji, name, active, families, badge }: ModuleStatusCardProps) {
  return (
    <div
      className={`rounded-lg border p-2.5 ${
        active ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 border-border'
      }`}
    >
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-1.5'>
          <span className='text-sm'>{emoji}</span>
          <span className='text-xs font-semibold text-foreground'>{name}</span>
          {badge && (
            <span className='text-[9px] px-1.5 py-0.5 rounded-full bg-muted border text-muted-foreground font-medium'>
              {badge}
            </span>
          )}
        </div>
        <span
          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
            active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          }`}
        >
          {active ? '● Activo' : '○ Inactivo'}
        </span>
      </div>

      {/* Familias activas — chips compactos */}
      {active && families && families.length > 0 && (
        <div className='flex flex-wrap gap-1 mt-1.5'>
          {families.map(f => (
            <span
              key={f.id}
              className='inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-background border font-medium'
            >
              {f.color && (
                <span
                  className='w-1.5 h-1.5 rounded-full flex-shrink-0'
                  style={{ backgroundColor: f.color }}
                />
              )}
              {f.name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
