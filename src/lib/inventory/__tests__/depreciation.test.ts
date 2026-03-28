import { calculateBookValue } from '../depreciation'

describe('calculateBookValue', () => {
  it('retorna null cuando purchasePrice es null', () => {
    const result = calculateBookValue({
      purchasePrice: null,
      purchaseDate: new Date(),
      usefulLifeYears: 5,
      residualValue: 0,
      depreciationMethod: 'LINEAR',
      totalUnits: null,
      usedUnits: null,
    })
    expect(result).toBeNull()
  })

  it('retorna null cuando purchaseDate es null', () => {
    const result = calculateBookValue({
      purchasePrice: 10000,
      purchaseDate: null,
      usefulLifeYears: 5,
      residualValue: 0,
      depreciationMethod: 'LINEAR',
      totalUnits: null,
      usedUnits: null,
    })
    expect(result).toBeNull()
  })

  it('retorna null cuando usefulLifeYears es null', () => {
    const result = calculateBookValue({
      purchasePrice: 10000,
      purchaseDate: new Date(),
      usefulLifeYears: null,
      residualValue: 0,
      depreciationMethod: 'LINEAR',
      totalUnits: null,
      usedUnits: null,
    })
    expect(result).toBeNull()
  })

  it('retorna número positivo con todos los campos válidos (activo de 2 años, vida útil 5)', () => {
    const purchaseDate = new Date()
    purchaseDate.setFullYear(purchaseDate.getFullYear() - 2)

    const result = calculateBookValue({
      purchasePrice: 10000,
      purchaseDate,
      usefulLifeYears: 5,
      residualValue: 0,
      depreciationMethod: 'LINEAR',
      totalUnits: null,
      usedUnits: null,
    })

    expect(result).not.toBeNull()
    expect(result).toBeGreaterThan(0)
  })
})
