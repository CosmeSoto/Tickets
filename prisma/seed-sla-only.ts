import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Creando políticas de SLA...')

  const now = new Date()

  // Verificar si ya existen políticas
  const existingPolicies = await prisma.sla_policies.count()
  
  if (existingPolicies > 0) {
    console.log(`⚠️  Ya existen ${existingPolicies} políticas de SLA`)
    console.log('¿Deseas continuar? Esto creará políticas adicionales.')
    
    // Mostrar políticas existentes
    const policies = await prisma.sla_policies.findMany({
      where: { isActive: true },
      select: {
        name: true,
        priority: true,
        responseTimeHours: true,
        resolutionTimeHours: true,
      }
    })
    
    console.log('\nPolíticas existentes:')
    policies.forEach(p => {
      console.log(`  • ${p.priority}: ${p.name} (Respuesta: ${p.responseTimeHours}h, Resolución: ${p.resolutionTimeHours}h)`)
    })
    
    return
  }

  // Crear políticas de SLA profesionales
  const slaPolicies = [
    {
      id: randomUUID(),
      name: 'SLA Urgente - 24/7',
      description: 'Política de SLA para tickets de prioridad urgente. Respuesta inmediata y resolución en 4 horas. Aplica 24/7 incluyendo fines de semana.',
      categoryId: null,
      priority: 'URGENT',
      responseTimeHours: 1,
      resolutionTimeHours: 4,
      businessHoursOnly: false,
      businessHoursStart: '00:00:00',
      businessHoursEnd: '23:59:59',
      businessDays: 'MON,TUE,WED,THU,FRI,SAT,SUN',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: randomUUID(),
      name: 'SLA Alta Prioridad',
      description: 'Política de SLA para tickets de alta prioridad. Respuesta en 4 horas y resolución en 24 horas durante horario laboral.',
      categoryId: null,
      priority: 'HIGH',
      responseTimeHours: 4,
      resolutionTimeHours: 24,
      businessHoursOnly: true,
      businessHoursStart: '09:00:00',
      businessHoursEnd: '18:00:00',
      businessDays: 'MON,TUE,WED,THU,FRI',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: randomUUID(),
      name: 'SLA Prioridad Media',
      description: 'Política de SLA para tickets de prioridad media. Respuesta en 8 horas y resolución en 48 horas durante horario laboral.',
      categoryId: null,
      priority: 'MEDIUM',
      responseTimeHours: 8,
      resolutionTimeHours: 48,
      businessHoursOnly: true,
      businessHoursStart: '09:00:00',
      businessHoursEnd: '18:00:00',
      businessDays: 'MON,TUE,WED,THU,FRI',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: randomUUID(),
      name: 'SLA Baja Prioridad',
      description: 'Política de SLA para tickets de baja prioridad. Respuesta en 24 horas y resolución en 72 horas durante horario laboral.',
      categoryId: null,
      priority: 'LOW',
      responseTimeHours: 24,
      resolutionTimeHours: 72,
      businessHoursOnly: true,
      businessHoursStart: '09:00:00',
      businessHoursEnd: '18:00:00',
      businessDays: 'MON,TUE,WED,THU,FRI',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ]

  console.log('\nCreando 4 políticas de SLA...')
  
  for (const policy of slaPolicies) {
    await prisma.sla_policies.create({
      data: policy,
    })
    console.log(`  ✅ ${policy.priority}: ${policy.name}`)
  }

  console.log('\n✅ Políticas de SLA creadas exitosamente!')
  console.log('\n📊 Resumen de políticas:')
  console.log('   • URGENT: Respuesta 1h, Resolución 4h (24/7)')
  console.log('   • HIGH: Respuesta 4h, Resolución 24h (Laboral 9-18h)')
  console.log('   • MEDIUM: Respuesta 8h, Resolución 48h (Laboral 9-18h)')
  console.log('   • LOW: Respuesta 24h, Resolución 72h (Laboral 9-18h)')
  console.log('\n💡 Los tickets nuevos recibirán SLA automáticamente según su prioridad.')
  
  // Verificar tickets existentes sin SLA
  const ticketsWithoutSLA = await prisma.tickets.count({
    where: {
      ticket_sla_metrics: null
    }
  })
  
  if (ticketsWithoutSLA > 0) {
    console.log(`\n⚠️  Hay ${ticketsWithoutSLA} tickets existentes sin SLA asignado.`)
    console.log('💡 Puedes asignarles SLA ejecutando el script de migración.')
  }
}

main()
  .catch(e => {
    console.error('❌ Error:', e.message)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
