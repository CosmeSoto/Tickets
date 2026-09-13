import {
  getStatusColor,
  getPriorityColor,
  getStatusLabel,
  getPriorityLabel,
  TECHNICIAN_TICKET_EXPORT_COLUMNS,
  ADMIN_TICKET_EXPORT_COLUMN_MAP,
} from '@/lib/utils/ticket-utils'

describe('ticket-utils', () => {
  describe('getStatusLabel / getPriorityLabel', () => {
    it('returns the Spanish label for every known status', () => {
      expect(getStatusLabel('OPEN')).toBe('Abierto')
      expect(getStatusLabel('IN_PROGRESS')).toBe('En Progreso')
      expect(getStatusLabel('RESOLVED')).toBe('Resuelto')
      expect(getStatusLabel('CLOSED')).toBe('Cerrado')
      expect(getStatusLabel('ON_HOLD')).toBe('En Espera')
    })

    it('falls back to the raw value for an unknown status', () => {
      expect(getStatusLabel('WEIRD_STATUS')).toBe('WEIRD_STATUS')
    })

    it('returns the Spanish label for every known priority', () => {
      expect(getPriorityLabel('LOW')).toBe('Baja')
      expect(getPriorityLabel('MEDIUM')).toBe('Media')
      expect(getPriorityLabel('HIGH')).toBe('Alta')
      expect(getPriorityLabel('URGENT')).toBe('Urgente')
    })
  })

  describe('getStatusColor / getPriorityColor', () => {
    it('gives IN_PROGRESS the amber classes and ON_HOLD the purple ones', () => {
      // Debe coincidir con TICKET_STATUSES en use-ticket-data.ts (fuente de verdad)
      expect(getStatusColor('IN_PROGRESS')).toContain('amber')
      expect(getStatusColor('ON_HOLD')).toContain('purple')
    })

    it('falls back to a neutral class for an unknown status/priority', () => {
      expect(getStatusColor('UNKNOWN')).toContain('bg-muted')
      expect(getPriorityColor('UNKNOWN')).toContain('bg-muted')
    })
  })

  describe('columnas de exportación', () => {
    it('formatea estado/prioridad con las mismas etiquetas que getStatusLabel/getPriorityLabel (TECHNICIAN)', () => {
      const statusCol = TECHNICIAN_TICKET_EXPORT_COLUMNS.find(c => c.key === 'status')
      const priorityCol = TECHNICIAN_TICKET_EXPORT_COLUMNS.find(c => c.key === 'priority')
      expect(statusCol?.format?.('ON_HOLD', {})).toBe(getStatusLabel('ON_HOLD'))
      expect(priorityCol?.format?.('URGENT', {})).toBe(getPriorityLabel('URGENT'))
    })

    it('formatea estado/prioridad igual en el mapa de columnas de ADMIN', () => {
      expect(ADMIN_TICKET_EXPORT_COLUMN_MAP.status.format?.('ON_HOLD', {})).toBe(
        getStatusLabel('ON_HOLD')
      )
      expect(ADMIN_TICKET_EXPORT_COLUMN_MAP.priority.format?.('URGENT', {})).toBe(
        getPriorityLabel('URGENT')
      )
    })
  })
})
