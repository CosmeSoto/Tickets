const { PrismaClient } = require('@prisma/client')

console.log('PrismaClient:', PrismaClient)
console.log('typeof PrismaClient:', typeof PrismaClient)

const prisma = new PrismaClient()

console.log('prisma:', prisma)
console.log('prisma.users:', prisma.users)

async function checkUsers() {
  try {
    console.log('Intentando consultar usuarios...')
    const users = await prisma.users.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        passwordHash: true
      }
    })
    
    console.log('\n📊 Usuarios en la base de datos:\n')
    console.log('Total:', users.length)
    console.log('\nDetalles:')
    users.forEach(user => {
      console.log(`\n- Email: ${user.email}`)
      console.log(`  Nombre: ${user.name}`)
      console.log(`  Rol: ${user.role}`)
      console.log(`  Activo: ${user.isActive ? 'Sí' : 'No'}`)
      console.log(`  Tiene password: ${user.passwordHash ? 'Sí' : 'No'}`)
    })
    
    if (users.length === 0) {
      console.log('\n⚠️  No hay usuarios en la base de datos')
      console.log('Ejecuta: npm run seed')
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error('Stack:', error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

checkUsers()
