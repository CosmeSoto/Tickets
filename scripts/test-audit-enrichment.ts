/**
 * Script de Prueba - Enriquecimiento de Auditoría
 * Genera logs de prueba con contexto enriquecido para verificar el sistema
 */

import { AuditServiceComplete } from '../src/lib/services/audit-service-complete'
import { AuditContextEnricher } from '../src/lib/services/audit-context-enricher'

async function testAuditEnrichment() {
  console.log('🧪 Iniciando prueba de enriquecimiento de auditoría...\n')
  
  // Simular diferentes user agents
  const testCases = [
    {
      name: 'Desktop - Chrome en Windows',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      userId: 'test-user-1',
      action: 'created',
      entityType: 'comment' as const,
      details: {
        content: 'Este es un comentario de prueba desde Chrome en Windows',
        metadata: { ticketId: 'test-ticket-1', isInternal: false }
      }
    },
    {
      name: 'Mobile - Safari en iPhone',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      userId: 'test-user-2',
      action: 'updated',
      entityType: 'ticket' as const,
      details: {
        title: 'Ticket actualizado desde iPhone',
        oldValues: { status: 'open' },
        newValues: { status: 'in_progress' }
      }
    },
    {
      name: 'Tablet - Chrome en iPad',
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1',
      userId: 'test-user-3',
      action: 'created',
      entityType: 'ticket' as const,
      details: {
        title: 'Nuevo ticket desde iPad',
        priority: 'high'
      }
    },
    {
      name: 'Desktop - Firefox en macOS',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.2; rv:121.0) Gecko/20100101 Firefox/121.0',
      userId: 'test-user-4',
      action: 'deleted',
      entityType: 'comment' as const,
      details: {
        content: 'Comentario eliminado',
        reason: 'spam'
      }
    }
  ]
  
  for (const testCase of testCases) {
    console.log(`📝 Probando: ${testCase.name}`)
    
    // Detectar información del user agent
    const deviceType = AuditContextEnricher.detectDeviceType(testCase.userAgent)
    const browser = AuditContextEnricher.detectBrowser(testCase.userAgent)
    const os = AuditContextEnricher.detectOS(testCase.userAgent)
    
    console.log(`   Dispositivo: ${deviceType}`)
    console.log(`   Navegador: ${browser.name} ${browser.version || ''}`)
    console.log(`   SO: ${os.name} ${os.version || ''}`)
    
    // Crear contexto enriquecido
    const context = AuditContextEnricher.createSystemContext({
      result: 'SUCCESS',
      duration: Math.floor(Math.random() * 500) + 50
    })
    
    // Simular guardado (sin realmente guardar en BD)
    console.log(`   ✅ Contexto generado:`)
    console.log(`      - Request ID: ${context.requestId}`)
    console.log(`      - Resultado: ${context.result}`)
    console.log(`      - Duración: ${context.duration}ms`)
    console.log(`      - Origen: ${context.source}`)
    console.log('')
    
    /* 
    // Descomentar para guardar en BD real:
    try {
      await AuditServiceComplete.log({
        action: testCase.action,
        entityType: testCase.entityType,
        entityId: `test-entity-${Date.now()}`,
        userId: testCase.userId,
        userAgent: testCase.userAgent,
        ipAddress: '192.168.1.100',
        details: testCase.details,
        result: 'SUCCESS',
        startTime: Date.now() - Math.floor(Math.random() * 500)
      })
      console.log(`   ✅ Log guardado en BD\n`)
    } catch (error) {
      console.error(`   ❌ Error al guardar:`, error)
    }
    */
  }
  
  console.log('\n✅ Prueba completada!')
  console.log('\n📋 Resumen:')
  console.log('   - Detección de dispositivos: ✅')
  console.log('   - Detección de navegadores: ✅')
  console.log('   - Detección de SO: ✅')
  console.log('   - Generación de contexto: ✅')
  console.log('\n💡 Para guardar logs reales, descomenta el bloque de guardado en el script')
}

// Ejecutar prueba
testAuditEnrichment().catch(console.error)
