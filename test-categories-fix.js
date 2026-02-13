#!/usr/bin/env node

/**
 * Script de prueba para verificar las correcciones del sistema de categorías
 * Ejecutar: node test-categories-fix.js
 */

const BASE_URL = 'http://localhost:3000'

// Datos de prueba
const testCases = [
  {
    name: 'Actualización Básica',
    data: {
      name: 'Categoría Test Corregida',
      description: 'Descripción actualizada',
      color: '#FF5733',
      isActive: true,
      assignedTechnicians: []
    }
  },
  {
    name: 'Actualización con Técnicos',
    data: {
      name: 'Categoría con Técnicos',
      description: 'Categoría con asignaciones de técnicos',
      color: '#33FF57',
      isActive: true,
      assignedTechnicians: [
        {
          id: 'tech-id-example',
          priority: 5,
          maxTickets: 10,
          autoAssign: true
        }
      ]
    }
  },
  {
    name: 'Color Inválido (debe fallar)',
    data: {
      name: 'Test Color Inválido',
      description: 'Prueba de validación',
      color: 'rojo', // Color inválido
      isActive: true,
      assignedTechnicians: []
    },
    shouldFail: true
  },
  {
    name: 'Nombre Vacío (debe fallar)',
    data: {
      name: '', // Nombre vacío
      description: 'Prueba de validación',
      color: '#FF0000',
      isActive: true,
      assignedTechnicians: []
    },
    shouldFail: true
  }
]

async function testCategoryUpdate(categoryId, testCase) {
  console.log(`\n🧪 Probando: ${testCase.name}`)
  console.log('📤 Datos enviados:', JSON.stringify(testCase.data, null, 2))
  
  try {
    const response = await fetch(`${BASE_URL}/api/categories/${categoryId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'next-auth.session-token=your-session-token' // Reemplazar con token real
      },
      body: JSON.stringify(testCase.data)
    })
    
    const result = await response.json()
    
    if (testCase.shouldFail) {
      if (!response.ok) {
        console.log('✅ Falló como se esperaba')
        console.log('📝 Error:', result.error)
        if (result.details) {
          console.log('📋 Detalles:', result.details)
        }
      } else {
        console.log('❌ Debería haber fallado pero fue exitoso')
      }
    } else {
      if (response.ok && result.success) {
        console.log('✅ Actualización exitosa')
        console.log('📝 Mensaje:', result.message)
      } else {
        console.log('❌ Falló inesperadamente')
        console.log('📝 Error:', result.error)
        if (result.details) {
          console.log('📋 Detalles:', result.details)
        }
      }
    }
    
    console.log('📊 Status:', response.status)
    
  } catch (error) {
    console.log('❌ Error de red:', error.message)
  }
}

async function runTests() {
  console.log('🚀 Iniciando pruebas del sistema de categorías corregido')
  console.log('=' .repeat(60))
  
  // ID de categoría de prueba (reemplazar con ID real)
  const testCategoryId = '5e15c1b3-37ee-4908-935b-ca6e11ec9266'
  
  console.log(`📋 Usando categoría ID: ${testCategoryId}`)
  console.log('⚠️  Asegúrate de tener una sesión válida y que la categoría exista')
  
  for (const testCase of testCases) {
    await testCategoryUpdate(testCategoryId, testCase)
    await new Promise(resolve => setTimeout(resolve, 1000)) // Pausa entre pruebas
  }
  
  console.log('\n' + '=' .repeat(60))
  console.log('🏁 Pruebas completadas')
  console.log('\n📝 Notas:')
  console.log('- Revisa los logs del servidor para ver el debugging detallado')
  console.log('- Verifica la tabla audit_logs para confirmar el registro de auditoría')
  console.log('- Los errores esperados son parte de la validación correcta')
}

// Función para probar validaciones del frontend
function testFrontendValidations() {
  console.log('\n🎯 Probando validaciones del frontend')
  console.log('=' .repeat(40))
  
  const validations = [
    {
      name: 'Color hexadecimal válido',
      color: '#FF5733',
      expected: true
    },
    {
      name: 'Color hexadecimal inválido',
      color: 'rojo',
      expected: false
    },
    {
      name: 'Color sin #',
      color: 'FF5733',
      expected: false
    },
    {
      name: 'Color muy corto',
      color: '#FF5',
      expected: false
    }
  ]
  
  const colorRegex = /^#[0-9A-F]{6}$/i
  
  validations.forEach(test => {
    const result = colorRegex.test(test.color)
    const status = result === test.expected ? '✅' : '❌'
    console.log(`${status} ${test.name}: "${test.color}" -> ${result}`)
  })
}

// Ejecutar si se llama directamente
if (require.main === module) {
  console.log('🔧 Script de Prueba - Sistema de Categorías Corregido')
  console.log('Versión: 1.0.0')
  console.log('Fecha:', new Date().toISOString())
  
  testFrontendValidations()
  
  console.log('\n⚠️  Para probar las APIs, asegúrate de:')
  console.log('1. Tener el servidor ejecutándose en localhost:3000')
  console.log('2. Estar autenticado como ADMIN')
  console.log('3. Tener una categoría válida para probar')
  console.log('\n¿Continuar con las pruebas de API? (Ctrl+C para cancelar)')
  
  setTimeout(() => {
    runTests().catch(console.error)
  }, 3000)
}

module.exports = {
  testCategoryUpdate,
  testFrontendValidations,
  testCases
}