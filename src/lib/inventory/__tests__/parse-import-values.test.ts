import {
  parseEquipmentAttributesFromExportString,
  parsePurchasePrice,
} from '@/lib/inventory/parse-import-values'

describe('parsePurchasePrice', () => {
  it('parses plain numbers', () => {
    expect(parsePurchasePrice('1200.00')).toBe(1200)
    expect(parsePurchasePrice('450')).toBe(450)
  })

  it('strips currency symbols from export values', () => {
    expect(parsePurchasePrice('$1,200.00')).toBe(1200)
    expect(parsePurchasePrice('€ 450,50')).toBe(450.5)
  })

  it('returns undefined for invalid values', () => {
    expect(parsePurchasePrice('abc')).toBeUndefined()
    expect(parsePurchasePrice('-10')).toBeUndefined()
  })
})

describe('parseEquipmentAttributesFromExportString', () => {
  const catalog = [
    { attributeName: 'ram', attributeLabel: 'RAM (GB)', order: 1 },
    { attributeName: 'procesador', attributeLabel: 'Procesador', order: 0 },
  ]

  it('parses export format back to field names', () => {
    const result = parseEquipmentAttributesFromExportString(
      'Procesador: i5-1235U, RAM (GB): 16',
      catalog
    )
    expect(result).toEqual([
      { fieldName: 'procesador', fieldValue: 'i5-1235U' },
      { fieldName: 'ram', fieldValue: '16' },
    ])
  })
})
