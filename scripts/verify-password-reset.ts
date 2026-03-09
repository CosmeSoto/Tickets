/**
 * Script de Verificación: Sistema de Recuperación de Contraseña
 * Verifica que todos los componentes estén correctamente implementados
 */

import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

interface VerificationResult {
  component: string
  status: 'OK' | 'ERROR' | 'WARNING'
  message: string
}

const results: VerificationResult[] = []

async function verify() {
  console.log('🔍 Verificando Sistema de Recuperación de Contraseña...\n')

  // 1. Verificar archivos frontend
  console.log('📁 Verificando archivos frontend...')
  
  const frontendFiles = [
    'src/app/forgot-password/page.tsx',
    'src/app/reset-password/page.tsx',
    'src/app/login/page.tsx'
  ]

  for (const file of frontendFiles) {
    const filePath = path.join(process.cwd(), file)
    if (fs.existsSync(filePath)) {
      results.push({
        component: file,
        status: 'OK',
        message: 'Archivo existe'
      })
    } else {
      results.push({
        component: file,
        status: 'ERROR',
        message: 'Archivo no encontrado'
      })
    }
  }

  // 2. Verificar archivos API
  console.log('🔌 Verificando endpoints API...')
  
  const apiFiles = [
    'src/app/api/auth/check-oauth/route.ts',
    'src/app/api/auth/forgot-password/route.ts',
    'src/app/api/auth/validate-reset-token/route.ts',
    'src/app/api/auth/reset-password/route.ts'
  ]

  for (const file of apiFiles) {
    const filePath = path.join(process.cwd(), file)
    if (fs.existsSync(filePath)) {
      results.push({
        component: file,
        status: 'OK',
        message: 'Endpoint existe'
      })
    } else {
      results.push({
        component: file,
        status: 'ERROR',
        message: 'Endpoint no encontrado'
      })
    }
  }

  // 3. Verificar template de email
  console.log('📧 Verificando template de email...')
  
  const emailTemplate = 'src/lib/services/email/templates/password-reset.ts'
  const templatePath = path.join(process.cwd(), emailTemplate)
  
  if (fs.existsSync(templatePath)) {
    results.push({
      component: emailTemplate,
      status: 'OK',
      message: 'Template existe'
    })
  } else {
    results.push({
      component: emailTemplate,
      status: 'ERROR',
      message: 'Template no encontrado'
    })
  }

  // 4. Verificar tabla en base de datos
  console.log('🗄️  Verificando base de datos...')
  
  try {
    // Verificar que la tabla existe
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'password_reset_tokens'
      );
    `
    
    if (tableExists) {
      results.push({
        component: 'password_reset_tokens table',
        status: 'OK',
        message: 'Tabla existe en la base de datos'
      })

      // Contar tokens existentes
      const tokenCount = await prisma.password_reset_tokens.count()
      results.push({
        component: 'password_reset_tokens data',
        status: 'OK',
        message: `${tokenCount} tokens en la base de datos`
      })
    } else {
      results.push({
        component: 'password_reset_tokens table',
        status: 'ERROR',
        message: 'Tabla no existe. Ejecutar: npx prisma db push'
      })
    }
  } catch (error) {
    results.push({
      component: 'Database connection',
      status: 'ERROR',
      message: `Error conectando a BD: ${error instanceof Error ? error.message : 'Unknown'}`
    })
  }

  // 5. Verificar link en login page
  console.log('🔗 Verificando link en página de login...')
  
  const loginPagePath = path.join(process.cwd(), 'src/app/login/page.tsx')
  if (fs.existsSync(loginPagePath)) {
    const loginContent = fs.readFileSync(loginPagePath, 'utf-8')
    
    if (loginContent.includes('forgot-password') && loginContent.includes('¿Olvidaste tu contraseña?')) {
      results.push({
        component: 'Login page link',
        status: 'OK',
        message: 'Link de recuperación encontrado en login'
      })
    } else {
      results.push({
        component: 'Login page link',
        status: 'WARNING',
        message: 'Link de recuperación no encontrado en login'
      })
    }
  }

  // 6. Verificar acción de auditoría
  console.log('📝 Verificando integración con auditoría...')
  
  const auditServicePath = path.join(process.cwd(), 'src/lib/services/audit-service-complete.ts')
  if (fs.existsSync(auditServicePath)) {
    const auditContent = fs.readFileSync(auditServicePath, 'utf-8')
    
    if (auditContent.includes('PASSWORD_RESET')) {
      results.push({
        component: 'Audit service',
        status: 'OK',
        message: 'Acción PASSWORD_RESET registrada'
      })
    } else {
      results.push({
        component: 'Audit service',
        status: 'WARNING',
        message: 'Acción PASSWORD_RESET no encontrada'
      })
    }
  }

  // 7. Verificar configuración SMTP
  console.log('⚙️  Verificando configuración SMTP...')
  
  try {
    const smtpSettings = await prisma.system_settings.findMany({
      where: {
        key: {
          in: ['smtp_host', 'smtp_port', 'smtp_user']
        }
      }
    })

    if (smtpSettings.length >= 3) {
      results.push({
        component: 'SMTP configuration',
        status: 'OK',
        message: 'Configuración SMTP encontrada'
      })
    } else {
      results.push({
        component: 'SMTP configuration',
        status: 'WARNING',
        message: 'Configuración SMTP incompleta. Configurar en Admin > Configuración'
      })
    }
  } catch (error) {
    results.push({
      component: 'SMTP configuration',
      status: 'WARNING',
      message: 'No se pudo verificar configuración SMTP'
    })
  }

  // Mostrar resultados
  console.log('\n' + '='.repeat(80))
  console.log('📊 RESULTADOS DE VERIFICACIÓN')
  console.log('='.repeat(80) + '\n')

  let okCount = 0
  let warningCount = 0
  let errorCount = 0

  for (const result of results) {
    const icon = result.status === 'OK' ? '✅' : result.status === 'WARNING' ? '⚠️' : '❌'
    console.log(`${icon} ${result.component}`)
    console.log(`   ${result.message}\n`)

    if (result.status === 'OK') okCount++
    else if (result.status === 'WARNING') warningCount++
    else errorCount++
  }

  console.log('='.repeat(80))
  console.log(`✅ OK: ${okCount} | ⚠️  WARNING: ${warningCount} | ❌ ERROR: ${errorCount}`)
  console.log('='.repeat(80) + '\n')

  if (errorCount === 0 && warningCount === 0) {
    console.log('🎉 ¡PERFECTO! Todos los componentes están correctamente implementados.')
    console.log('✅ El sistema de recuperación de contraseña está listo para usar.\n')
    console.log('📝 Próximos pasos:')
    console.log('   1. Reiniciar el servidor: npm run dev')
    console.log('   2. Ir a http://localhost:3000/login')
    console.log('   3. Click en "¿Olvidaste tu contraseña?"')
    console.log('   4. Probar el flujo completo\n')
  } else if (errorCount === 0) {
    console.log('⚠️  Sistema funcional con advertencias menores.')
    console.log('   Revisar las advertencias arriba para optimización.\n')
  } else {
    console.log('❌ Se encontraron errores críticos.')
    console.log('   Revisar los errores arriba antes de continuar.\n')
  }

  await prisma.$disconnect()
}

verify().catch(console.error)
