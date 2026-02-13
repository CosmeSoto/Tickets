import prisma from './src/lib/prisma'

async function verifyUsers() {
  try {
    console.log('🔍 Verificando usuarios en la base de datos...\n')

    // Contar usuarios
    const userCount = await prisma.users.count()
    console.log(`📊 Total de usuarios: ${userCount}`)

    if (userCount === 0) {
      console.log('\n❌ No hay usuarios en la base de datos')
      console.log('💡 Ejecuta: npm run seed para crear usuarios de prueba')
      return
    }

    // Obtener todos los usuarios
    const users = await prisma.users.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        passwordHash: true,
        departments: {
          select: {
            name: true
          }
        }
      }
    })

    console.log('\n👥 Usuarios encontrados:\n')
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name}`)
      console.log(`   Email: ${user.email}`)
      console.log(`   Rol: ${user.role}`)
      console.log(`   Activo: ${user.isActive ? '✅' : '❌'}`)
      console.log(`   Tiene contraseña: ${user.passwordHash ? '✅' : '❌'}`)
      console.log(`   Departamento: ${user.departments?.name || 'Sin departamento'}`)
      console.log('')
    })

    // Verificar usuarios activos por rol
    const adminCount = await prisma.users.count({ where: { role: 'ADMIN', isActive: true } })
    const techCount = await prisma.users.count({ where: { role: 'TECHNICIAN', isActive: true } })
    const clientCount = await prisma.users.count({ where: { role: 'CLIENT', isActive: true } })

    console.log('📈 Resumen por rol (activos):')
    console.log(`   Administradores: ${adminCount}`)
    console.log(`   Técnicos: ${techCount}`)
    console.log(`   Clientes: ${clientCount}`)

  } catch (error) {
    console.error('❌ Error al verificar usuarios:', error)
  } finally {
    await prisma.$disconnect()
  }
}

verifyUsers()
