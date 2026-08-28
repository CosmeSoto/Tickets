import {
  formatAttributesString,
  withAttributeLabels,
  humanizeAttributeFieldName,
} from '@/lib/inventory/attribute-labels'

describe('attribute-labels', () => {
  const catalog = [
    { attributeName: 'ram', attributeLabel: 'RAM (GB)', order: 1 },
    { attributeName: 'procesador', attributeLabel: 'Procesador', order: 0 },
    { attributeName: 'pantalla_pulgadas', attributeLabel: 'Pantalla (pulgadas)', order: 2 },
  ]

  const values = [
    { fieldName: 'ram', fieldValue: '16' },
    { fieldName: 'procesador', fieldValue: 'i5-1235U' },
    { fieldName: 'pantalla_pulgadas', fieldValue: '14' },
  ]

  it('formatAttributesString usa las etiquetas y el orden del catálogo', () => {
    expect(formatAttributesString(values, catalog)).toBe(
      'Procesador: i5-1235U, RAM (GB): 16, Pantalla (pulgadas): 14'
    )
  })

  it('withAttributeLabels adjunta fieldLabel y ordena', () => {
    expect(withAttributeLabels(values, catalog)).toEqual([
      { fieldName: 'procesador', fieldValue: 'i5-1235U', fieldLabel: 'Procesador' },
      { fieldName: 'ram', fieldValue: '16', fieldLabel: 'RAM (GB)' },
      { fieldName: 'pantalla_pulgadas', fieldValue: '14', fieldLabel: 'Pantalla (pulgadas)' },
    ])
  })

  it('humaniza cuando el valor no tiene atributo en catálogo', () => {
    expect(humanizeAttributeFieldName('sistema_operativo')).toBe('Sistema Operativo')
    expect(
      withAttributeLabels([{ fieldName: 'sistema_operativo', fieldValue: 'Win11' }], [])
    ).toEqual([
      { fieldName: 'sistema_operativo', fieldValue: 'Win11', fieldLabel: 'Sistema Operativo' },
    ])
  })
})
