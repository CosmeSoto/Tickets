const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function testLogin() {
  try {
    console.log('🔍 Probando credenciales de login...\n')
    
    // Verificar usuario admin
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@tickets.com' }
    })
    
    if (!adminUser) {
      console.log('❌ Usuario admin no encontrado')
      return
    }
    
    console.log('✅ Usuario admin encontrado:')
    console.log(`   ID: ${adminUser.id}`)
    console.log(`   Email: ${adminUser.email}`)
    console.log(`   Nombre: ${adminUser.name}`)
    console.log(`   Rol: ${adminUser.role}`)
    console.log(`   Activo: ${adminUser.isActive}`)
    console.log(`   Tiene password: ${!!adminUser.passwordHash}`)
    
    // Probar password
    if (adminUser.passwordHash) {
      const isValidPassword = await bcrypt.compare('admin123', adminUser.passwordHash)
      console.log(`   Password válido: ${isValidPassword}`)
      
      if (!isValidPassword) {
        console.log('❌ Password incorrecto')
        
        // Regenerar password correcto
        console.log('🔧 Regenerando password...')
        const newHash = await bcrypt.hash('admin123', 12)
        await prisma.user.update({
          where: { id: adminUser.id },
          data: { passwordHash: newHash }
        })
        console.log('✅ Password regenerado')
      }
    } else {
      console.log('❌ Usuario sin password hash')
      
      // Crear password
      console.log('🔧 Creando password...')
      const newHash = await bcrypt.hash('admin123', 12)
      await prisma.user.update({
        where: { id: adminUser.id },
        data: { passwordHash: newHash }
      })
      console.log('✅ Password creado')
    }
    
    // Verificar otros usuarios
    console.log('\n📋 Otros usuarios:')
    const allUsers = await prisma.user.findMany({
      select: {
        email: true,
        name: true,
        role: true,
        isActive: true,
        passwordHash: true
      }
    })
    
    allUsers.forEach(user => {
      console.log(`   ${user.email} (${user.role}) - Activo: ${user.isActive} - Password: ${!!user.passwordHash}`)
    })
    
    console.log('\n✅ Verificación de login completada')
    console.log('🔑 Credenciales para probar:')
    console.log('   Email: admin@tickets.com')
    console.log('   Password: admin123')
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testLogin()