/**
 * Bootstrap idempotente de módulos que deben existir incluso cuando la base
 * ya tiene usuarios y el seed completo se omite durante un rebuild.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.system_modules.upsert({
    where: { key: 'access' },
    create: {
      key: 'access',
      name: 'Accesos',
      description:
        'Pases QR verificables para personal externo, visitantes y contratistas por área',
      icon: 'ScanLine',
      isActive: true,
      order: 8,
      defaultForAdmin: true,
      defaultForTech: false,
      defaultForClient: false,
      requiresManager: true,
      familyScoped: true,
    },
    update: {
      name: 'Accesos',
      description:
        'Pases QR verificables para personal externo, visitantes y contratistas por área',
      icon: 'ScanLine',
      isActive: true,
      order: 8,
      defaultForAdmin: true,
      defaultForTech: false,
      defaultForClient: false,
      requiresManager: true,
      familyScoped: true,
    },
  })

  await prisma.system_modules.upsert({
    where: { key: 'processes' },
    create: {
      key: 'processes',
      name: 'Procesos y Procedimientos',
      description: 'Catálogo interno, versiones y diagramas de procesos por área',
      icon: 'Workflow',
      isActive: true,
      order: 7,
      defaultForAdmin: true,
      defaultForTech: false,
      defaultForClient: false,
      requiresManager: true,
      familyScoped: true,
    },
    update: {
      name: 'Procesos y Procedimientos',
      description: 'Catálogo interno, versiones y diagramas de procesos por área',
      icon: 'Workflow',
      isActive: true,
      order: 7,
      defaultForAdmin: true,
      defaultForTech: false,
      defaultForClient: false,
      requiresManager: true,
      familyScoped: true,
    },
  })

  await prisma.system_modules.upsert({
    where: { key: 'planner' },
    create: {
      key: 'planner',
      name: 'Tareas (Planner)',
      description: 'Tablero Kanban y calendario de tareas, sincronizado con Microsoft Planner',
      icon: 'ListTodo',
      isActive: true,
      order: 9,
      defaultForAdmin: true,
      defaultForTech: false,
      defaultForClient: false,
      requiresManager: true,
      familyScoped: true,
    },
    update: {
      name: 'Tareas (Planner)',
      description: 'Tablero Kanban y calendario de tareas, sincronizado con Microsoft Planner',
      icon: 'ListTodo',
      isActive: true,
      order: 9,
      defaultForAdmin: true,
      defaultForTech: false,
      defaultForClient: false,
      requiresManager: true,
      familyScoped: true,
    },
  })

  // El catálogo nace operativo para los administradores existentes; los demás
  // perfiles se habilitan explícitamente desde la gestión de usuarios.
  const [processesResult, accessResult, plannerResult] = await Promise.all([
    prisma.users.updateMany({
      where: { role: 'ADMIN' },
      data: { processesEnabled: true, canManageProcesses: true },
    }),
    prisma.users.updateMany({
      where: { role: 'ADMIN' },
      data: { accessEnabled: true, canManageAccess: true },
    }),
    prisma.users.updateMany({
      where: { role: 'ADMIN' },
      data: { plannerEnabled: true, canManagePlanner: true },
    }),
  ])
  console.log(
    `✅ Módulos asegurados; Procesos: ${processesResult.count}, Accesos: ${accessResult.count} y Tareas: ${plannerResult.count} administradores habilitados.`
  )
}

main()
  .catch(error => {
    console.error('❌ ensure-system-modules falló:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
