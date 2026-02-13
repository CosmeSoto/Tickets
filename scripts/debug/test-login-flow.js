// Test para verificar el flujo de login
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function testLoginFlow() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔐 TESTING LOGIN FLOW...\n');
    
    // 1. Verificar usuario admin
    console.log('1️⃣ VERIFICANDO USUARIO ADMIN:');
    const admin = await prisma.user.findUnique({
      where: { email: 'admin@tickets.com' }
    });
    
    if (!admin) {
      console.log('❌ Usuario admin no encontrado');
      return;
    }
    
    console.log(`   ✅ Usuario encontrado: ${admin.name}`);
    console.log(`   📧 Email: ${admin.email}`);
    console.log(`   👤 Rol: ${admin.role}`);
    console.log(`   🟢 Activo: ${admin.isActive}`);
    console.log(`   🔑 Tiene password: ${admin.passwordHash ? 'SÍ' : 'NO'}`);
    
    // 2. Verificar password
    console.log('\n2️⃣ VERIFICANDO PASSWORD:');
    const testPassword = 'admin123';
    
    if (admin.passwordHash) {
      const isValid = await bcrypt.compare(testPassword, admin.passwordHash);
      console.log(`   Password "${testPassword}" es válido: ${isValid ? '✅ SÍ' : '❌ NO'}`);
      
      if (!isValid) {
        console.log('   ⚠️  Probando con otros passwords comunes...');
        const commonPasswords = ['admin', 'password', '123456', 'admin@123'];
        
        for (const pwd of commonPasswords) {
          const valid = await bcrypt.compare(pwd, admin.passwordHash);
          if (valid) {
            console.log(`   ✅ Password correcto encontrado: "${pwd}"`);
            break;
          }
        }
      }
    }
    
    // 3. Verificar otros usuarios
    console.log('\n3️⃣ VERIFICANDO OTROS USUARIOS:');
    const allUsers = await prisma.user.findMany({
      select: {
        email: true,
        name: true,
        role: true,
        isActive: true
      }
    });
    
    console.log('   Usuarios en el sistema:');
    allUsers.forEach(user => {
      console.log(`   - ${user.name} (${user.email}) - ${user.role} - ${user.isActive ? 'Activo' : 'Inactivo'}`);
    });
    
    console.log('\n✅ TEST COMPLETADO');
    console.log('\n📋 INSTRUCCIONES PARA EL USUARIO:');
    console.log('   1. Asegúrate de estar logueado como admin@tickets.com');
    console.log('   2. Usa la contraseña: admin123');
    console.log('   3. Verifica que el rol sea ADMIN');
    console.log('   4. Revisa la consola del navegador para ver los logs de la página de reportes');
    
  } catch (error) {
    console.error('❌ Error en test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testLoginFlow();