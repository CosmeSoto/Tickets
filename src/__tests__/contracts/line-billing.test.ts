import {
  amountDueOnDate,
  lineIsBillableOn,
  linePeriodAmount,
  suggestedRecurringFromLines,
} from '@/lib/contracts/line-billing'

const contract = {
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  monthlyCost: 1000,
  billingCycle: 'MONTHLY',
}

describe('line-billing', () => {
  it('hereda vigencia del contrato si la línea no tiene fechas', () => {
    expect(
      lineIsBillableOn({ unitPrice: 100, quantity: 1 }, contract, new Date('2026-06-15'))
    ).toBe(true)
    expect(
      lineIsBillableOn({ unitPrice: 100, quantity: 1 }, contract, new Date('2027-01-02'))
    ).toBe(false)
  })

  it('un equipo que entra a mitad de año no cobra el primer semestre', () => {
    const line = {
      quantity: 1,
      unitPrice: 200,
      serviceStartDate: '2026-07-01',
      serviceEndDate: '2026-12-31',
    }
    expect(lineIsBillableOn(line, contract, new Date('2026-01-01'))).toBe(false)
    expect(lineIsBillableOn(line, contract, new Date('2026-07-01'))).toBe(true)
    expect(linePeriodAmount(line)).toBe(200)
  })

  it('el cargo del periodo suma solo líneas vigentes, sin duplicar el encabezado', () => {
    const lines = [
      { quantity: 1, unitPrice: 100, serviceStartDate: '2026-01-01', serviceEndDate: '2026-12-31' },
      { quantity: 1, unitPrice: 50, serviceStartDate: '2026-04-01' },
    ]
    expect(amountDueOnDate(lines, contract, new Date('2026-01-15'))).toBe(100)
    expect(amountDueOnDate(lines, contract, new Date('2026-04-15'))).toBe(150)
    expect(suggestedRecurringFromLines(lines)).toBe(150)
  })

  it('sin precios en líneas usa el costo del contrato', () => {
    expect(amountDueOnDate([], contract, new Date('2026-03-01'))).toBe(1000)
  })
})
