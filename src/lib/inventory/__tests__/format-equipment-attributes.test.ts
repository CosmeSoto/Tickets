import {
  formatEquipmentAttributesString,
  humanizeAttributeFieldName,
} from '@/lib/inventory/format-equipment-attributes'

describe('formatEquipmentAttributesString', () => {
  const catalog = [
    { attributeName: 'ram', attributeLabel: 'RAM (GB)', order: 1 },
    { attributeName: 'procesador', attributeLabel: 'Procesador', order: 0 },
    { attributeName: 'pantalla_pulgadas', attributeLabel: 'Pantalla (pulgadas)', order: 2 },
  ]

  it('uses catalog labels and order', () => {
    const result = formatEquipmentAttributesString(
      [
        { fieldName: 'ram', fieldValue: '16' },
        { fieldName: 'procesador', fieldValue: 'i5-1235U' },
        { fieldName: 'pantalla_pulgadas', fieldValue: '14' },
      ],
      catalog
    )

    expect(result).toBe('Procesador: i5-1235U, RAM (GB): 16, Pantalla (pulgadas): 14')
  })

  it('humanizes unknown field names as fallback', () => {
    expect(humanizeAttributeFieldName('sistema_operativo')).toBe('Sistema Operativo')
  })
})
