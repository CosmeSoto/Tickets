/**
 * Template de email "Ticket asignado" — antes no incluía el SLA en absoluto
 * (ni `sendTicketAssignedToTechnicianEmail` lo pasaba, ni el template lo
 * mostraba), a pesar de que el ticket ya tiene un `slaDeadline` real.
 */

import ticketAssignedTemplate from '@/lib/services/email/templates/ticket-assigned'

describe('ticketAssignedTemplate — incluye el SLA cuando hay deadline', () => {
  const baseData = {
    ticketId: 't1',
    ticketNumber: '000001',
    ticketTitle: 'Fuga de agua',
    technicianName: 'Técnico',
    clientName: 'Cliente',
    category: 'Mantenimiento',
    priority: 'HIGH',
    description: 'desc',
  }

  it('regresión: con slaDeadline futuro, el html y el texto incluyen "Vence SLA"', () => {
    const slaDeadline = new Date(Date.now() + 3 * 60 * 60 * 1000)
    const { html, text } = ticketAssignedTemplate({ ...baseData, slaDeadline })

    expect(html).toContain('Vence SLA')
    expect(text).toContain('Vence SLA')
  })

  it('sin slaDeadline (categoría sin política de SLA), no se muestra la fila', () => {
    const { html, text } = ticketAssignedTemplate({ ...baseData, slaDeadline: null })

    expect(html).not.toContain('Vence SLA')
    expect(text).not.toContain('Vence SLA')
  })
})
