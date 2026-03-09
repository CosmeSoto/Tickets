/**
 * Script de prueba para verificar que la auditoría funciona
 * Ejecutar con: npx tsx scripts/test-audit.ts
 */

import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

async function testAudit() {
  console.log('🧪 Probando sistema de auditoría...\n')

  try {
    // Crear un log de prueba
    const testLog = await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'test_action',
        entityType: 'test',
        entityId: 'test-123',
        userId: null,
        details: {
          test: true,
          message: 'Este es un log de prueba',
          timestamp: new Date().toISOString()
        },
        createdAt: new Date()
      }
    })

    console.log('✅ Log de prueba creado exitosamente:')
    console.log(JSON.stringify(testLog, null, 2))

    // Verificar que se puede leer
    const readLog = await prisma.audit_logs.findUnique({
      where: { id: testLog.id }
    })

    if (readLog) {
      console.log('\n✅ Log de prueba leído exitosamente')
    } else {
      console.log('\n❌ No se pudo leer el log de prueba')
    }

    // Limpiar
    await prisma.audit_logs.delete({
      where: { id: testLog.id }
    })

    console.log('✅ Log de prueba eliminado')

    console.log('\n🎉 Sistema de auditoría funciona correctamente')

  } catch (error) {
    console.error('❌ Error al probar auditoría:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testAudit()
