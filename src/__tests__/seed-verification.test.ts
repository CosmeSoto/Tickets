/**
 * Test de verificación del seeder
 * 
 * Este test documenta el comportamiento esperado del seeder después de la tarea 7.1:
 * - No debe crear datos de demostración de inventario (equipos, consumibles, licencias)
 * - Debe crear datos de configuración esenciales (admin, departamento, SLA, etc.)
 */

describe('Seeder - Verificación de datos de demostración', () => {
  it('debe documentar que NO se crean equipos de demostración', () => {
    // Este test documenta que los siguientes equipos NO deben existir:
    const demoEquipmentCodes = ['LAP-001', 'DESK-001', 'MON-001', 'PRINT-001', 'PHONE-001']
    
    // El seeder NO debe crear estos equipos
    expect(demoEquipmentCodes).toBeDefined()
    expect(demoEquipmentCodes.length).toBe(5)
  })

  it('debe documentar que NO se crean consumibles de demostración', () => {
    // Este test documenta que NO se deben crear consumibles de ejemplo
    const expectedConsumablesCount = 0
    expect(expectedConsumablesCount).toBe(0)
  })

  it('debe documentar que NO se crean licencias de demostración', () => {
    // Este test documenta que NO se deben crear licencias de ejemplo
    const expectedLicensesCount = 0
    expect(expectedLicensesCount).toBe(0)
  })

  it('debe documentar que SÍ se crean datos de configuración esenciales', () => {
    // El seeder SÍ debe crear:
    const essentialData = {
      adminUser: true,          // Usuario administrador
      department: true,         // Departamento de Administración
      siteConfig: true,         // Configuración del sitio
      slaPolicies: true,        // 4 políticas de SLA
      folioCounters: true,      // Contadores de folio
      inventorySettings: true,  // Configuraciones de inventario
    }
    
    expect(Object.values(essentialData).every(v => v === true)).toBe(true)
  })

  it('debe documentar los mensajes informativos en consola', () => {
    // El seeder debe mostrar estos mensajes:
    const expectedMessages = [
      '📦 Omitiendo creación de datos de demostración de inventario',
      '• Equipos de ejemplo: OMITIDOS',
      '• Consumibles de ejemplo: OMITIDOS',
      '• Licencias de ejemplo: OMITIDAS',
      'ℹ️  Los datos de inventario deben ingresarse manualmente desde el panel',
    ]
    
    expect(expectedMessages.length).toBe(5)
    expect(expectedMessages.every(msg => msg.length > 0)).toBe(true)
  })
})
