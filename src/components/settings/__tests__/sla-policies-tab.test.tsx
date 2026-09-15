/**
 * Regresión: la tabla "Tiempos por prioridad" del tab de SLA se presenta
 * como "Políticas SLA globales del sistema" (fallback final, nivel 3 de la
 * jerarquía de precedencia), pero antes del fix solo excluía políticas con
 * categoryId — una política de familia (p. ej. "TI - Prioridad Media", que
 * tiene categoryId=null y familyId=<TI>) se colaba en la lista y, según el
 * orden en que la API devolviera las filas, `policies.find()` podía quedarse
 * con sus valores en vez de los de la política global real. Esto es
 * exactamente lo que reportó el usuario: la tabla mostraba Media=4h/24h
 * (el valor de TI) en vez de Media=24h/72h (el valor global real), mientras
 * que un ticket de una categoría de TI sí calculaba su SLA correctamente
 * contra la política de TI — el descuadre estaba en lo que mostraba esta
 * tabla, no en el cálculo del ticket.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { render, screen, waitFor, within } from '@testing-library/react'
import { SLAPoliciesTab } from '../sla-policies-tab'
import { ToastProvider } from '@/components/providers/toast-provider'

const mockFetch = jest.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<any>>()
global.fetch = mockFetch as unknown as typeof fetch

// Réplica fiel del estado real: la API devuelve la política de TI para
// MEDIUM/LOW *antes* que la global (mismo orden observado en producción,
// donde el desempate entre filas con igual priority+isActive no está
// garantizado). Si el filtro no excluyera familyId, el bug reaparece.
const REAL_POLICIES = [
  {
    id: 'global-high',
    name: 'Global - Alta Prioridad',
    priority: 'HIGH',
    responseTimeHours: 8,
    resolutionTimeHours: 48,
    businessHoursOnly: true,
    isActive: true,
    categoryId: null,
    familyId: null,
  },
  {
    id: 'ti-high',
    name: 'TI - Alta Prioridad',
    priority: 'HIGH',
    responseTimeHours: 2,
    resolutionTimeHours: 8,
    businessHoursOnly: true,
    isActive: true,
    categoryId: null,
    familyId: 'fam-ti',
  },
  {
    id: 'ti-low',
    name: 'TI - Baja Prioridad',
    priority: 'LOW',
    responseTimeHours: 8,
    resolutionTimeHours: 48,
    businessHoursOnly: true,
    isActive: true,
    categoryId: null,
    familyId: 'fam-ti',
  },
  {
    id: 'global-low',
    name: 'Global - Baja Prioridad',
    priority: 'LOW',
    responseTimeHours: 48,
    resolutionTimeHours: 120,
    businessHoursOnly: true,
    isActive: true,
    categoryId: null,
    familyId: null,
  },
  {
    id: 'ti-medium',
    name: 'TI - Prioridad Media',
    priority: 'MEDIUM',
    responseTimeHours: 4,
    resolutionTimeHours: 24,
    businessHoursOnly: true,
    isActive: true,
    categoryId: null,
    familyId: 'fam-ti',
  },
  {
    id: 'global-medium',
    name: 'Global - Prioridad Media',
    priority: 'MEDIUM',
    responseTimeHours: 24,
    resolutionTimeHours: 72,
    businessHoursOnly: true,
    isActive: true,
    categoryId: null,
    familyId: null,
  },
  {
    id: 'ti-urgent',
    name: 'TI - Urgente 24/7',
    priority: 'URGENT',
    responseTimeHours: 1,
    resolutionTimeHours: 4,
    businessHoursOnly: false,
    isActive: true,
    categoryId: null,
    familyId: 'fam-ti',
  },
  {
    id: 'global-urgent',
    name: 'Global - Urgente 24/7',
    priority: 'URGENT',
    responseTimeHours: 2,
    resolutionTimeHours: 8,
    businessHoursOnly: false,
    isActive: true,
    categoryId: null,
    familyId: null,
  },
]

describe('SLAPoliciesTab', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockFetch.mockResolvedValue({
      json: async () => ({ success: true, data: REAL_POLICIES }),
    } as Response)
  })

  it('muestra los valores de la política global real, no los de una política de familia con el mismo categoryId=null', async () => {
    render(
      <ToastProvider>
        <SLAPoliciesTab isSuperAdmin={false} />
      </ToastProvider>
    )

    await waitFor(() => {
      expect(screen.getAllByText('Media').length).toBeGreaterThan(0)
    })

    const rows = screen.getAllByRole('row')
    const cellsOf = (label: string) => {
      const row = rows.find(r => r.textContent?.includes(label))
      if (!row) throw new Error(`No se encontró la fila de "${label}"`)
      return within(row)
        .getAllByRole('cell')
        .map(c => c.textContent?.trim())
    }

    // [Respuesta, Resolución] — columnas 2 y 3 de la tabla.
    // Global - Prioridad Media: 24h/72h, NO 4h/24h de "TI - Prioridad Media".
    expect(cellsOf('Media').slice(1, 3)).toEqual(['24', '72'])
    // Global - Baja Prioridad: 48h/120h, NO 8h/48h de "TI - Baja Prioridad".
    expect(cellsOf('Baja').slice(1, 3)).toEqual(['48', '120'])
    // Global - Alta Prioridad: 8h/48h.
    expect(cellsOf('Alta').slice(1, 3)).toEqual(['8', '48'])
    // Global - Urgente 24/7: 2h/8h, NO 1h/4h de "TI - Urgente 24/7".
    expect(cellsOf('Urgente').slice(1, 3)).toEqual(['2', '8'])
  })
})
