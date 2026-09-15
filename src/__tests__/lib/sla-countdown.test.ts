import { getSlaCountdown } from '@/lib/tickets/sla-countdown'

describe('getSlaCountdown', () => {
  const now = new Date('2026-01-01T12:00:00Z')

  it('sin slaDeadline → "Sin SLA configurado", urgencia none', () => {
    expect(getSlaCountdown(null, null, now)).toEqual({
      label: 'Sin SLA configurado',
      urgency: 'none',
      deadlineLabel: null,
    })
  })

  it('deadline lejos en el futuro (>4h) → urgencia ok, con la fecha/hora exacta del deadline', () => {
    const deadline = new Date(now.getTime() + 10 * 60 * 60 * 1000)
    const result = getSlaCountdown(deadline, null, now)

    expect(result.urgency).toBe('ok')
    expect(result.label).toBe('Vence en 10h')
    expect(result.deadlineLabel).not.toBeNull()
  })

  it('deadline dentro de 4h → urgencia warning, con la fecha/hora exacta del deadline', () => {
    const deadline = new Date(now.getTime() + 2 * 60 * 60 * 1000 + 30 * 60 * 1000)
    const result = getSlaCountdown(deadline, null, now)

    expect(result.urgency).toBe('warning')
    expect(result.label).toBe('Vence en 2h 30min')
    expect(result.deadlineLabel).not.toBeNull()
  })

  it('deadline ya pasado y sin resolver → vencido, con la fecha/hora exacta en que venció', () => {
    const deadline = new Date(now.getTime() - 90 * 60 * 1000)
    const result = getSlaCountdown(deadline, null, now)

    expect(result.urgency).toBe('overdue')
    expect(result.label).toBe('Vencido hace 1h 30min')
    expect(result.deadlineLabel).not.toBeNull()
  })

  it('resuelto antes del deadline → dentro de SLA, sin deadlineLabel (ya lo cubre la fecha de "Resuelto")', () => {
    const deadline = new Date(now.getTime() + 60 * 60 * 1000)
    const resolvedAt = new Date(now.getTime() - 10 * 60 * 1000)
    const result = getSlaCountdown(deadline, resolvedAt, now)

    expect(result).toEqual({
      label: 'Resuelto dentro de SLA',
      urgency: 'ok',
      deadlineLabel: null,
    })
  })

  it('resuelto después del deadline → fuera de SLA', () => {
    const deadline = new Date(now.getTime() - 60 * 60 * 1000)
    const resolvedAt = new Date(now.getTime() - 15 * 60 * 1000)
    const result = getSlaCountdown(deadline, resolvedAt, now)

    expect(result.urgency).toBe('overdue')
    expect(result.label).toContain('fuera de SLA')
  })
})
