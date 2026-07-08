import { enrichImportError, resolveImportErrorHint } from '../error-hints'

describe('error-hints', () => {
  it('suggests warehouse names when bodega not found', () => {
    const hint = resolveImportErrorHint('warehouse', 'Bodega no encontrada: XYZ', {
      warehouseNames: ['Bodega Central (BC)', 'Recepción'],
    })
    expect(hint).toContain('Bodega Central')
  })

  it('suggests devolver a bodega when equipment is assigned', () => {
    const hint = resolveImportErrorHint(
      'serialNumber',
      'No se puede actualizar: equipo EQ-001 en estado ASSIGNED'
    )
    expect(hint).toMatch(/bodega/i)
  })

  it('enriches error with field label and hint', () => {
    const enriched = enrichImportError({
      row: 3,
      field: 'condition',
      message: 'Condición inválida. Use: NEW, USED, DAMAGED',
    })
    expect(enriched.fieldLabel).toBe('Condición')
    expect(enriched.hint).toContain('Nuevo')
  })
})
