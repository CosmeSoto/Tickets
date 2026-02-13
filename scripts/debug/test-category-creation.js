#!/usr/bin/env node

/**
 * Script para probar la creación de categorías y verificar la sincronización
 */

const testCategoryCreation = async () => {
  console.log('🧪 [TEST] Probando creación de categorías...\n')

  const baseUrl = 'http://localhost:3000/api'
  
  // Función helper para hacer peticiones
  const makeRequest = async (url, options = {}) => {
    try {
      const response = await fetch(`${baseUrl}${url}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      })
      
      const data = await response.json()
      return { status: response.status, data, ok: response.ok }
    } catch (error) {
      return { status: 0, data: { error: error.message }, ok: false }
    }
  }

  // 1. Verificar estado inicial
  console.log('📋 [TEST] 1. Estado inicial de categorías...')
  const initialResult = await makeRequest('/categories')
  
  if (!initialResult.ok) {
    console.log('❌ Error al cargar estado inicial:', initialResult.data.error)
    return
  }

  const initialCategories = initialResult.data.data
  console.log(`   Categorías iniciales: ${initialCategories.length}`)
  
  // Buscar "Infraestructura"
  const infraestructura = initialCategories.find(cat => 
    cat.name.toLowerCase().includes('infraestructura') || 
    cat.name.toLowerCase().includes('infra')
  )
  
  if (infraestructura) {
    console.log(`   ✅ "Infraestructura" encontrada: ID=${infraestructura.id}, Nivel=${infraestructura.level}`)
  } else {
    console.log('   ❌ "Infraestructura" NO encontrada')
    console.log('   📋 Categorías existentes:')
    initialCategories.forEach(cat => {
      console.log(`      - ${cat.name} (Nivel ${cat.level})`)
    })
    return
  }

  // 2. Verificar que aparezca en padres disponibles
  console.log('\n👨‍👩‍👧‍👦 [TEST] 2. Verificando padres disponibles...')
  const parentsResult = await makeRequest('/categories?level=1,2,3')
  
  if (parentsResult.ok) {
    const parents = parentsResult.data.data
    const infraestructuraParent = parents.find(cat => cat.id === infraestructura.id)
    
    if (infraestructuraParent) {
      console.log('   ✅ "Infraestructura" SÍ aparece en padres disponibles')
    } else {
      console.log('   ❌ "Infraestructura" NO aparece en padres disponibles')
      console.log('   🔍 Verificando por qué...')
      
      // Aplicar los mismos filtros que usa el frontend
      const filtered = parents.filter(cat => {
        const validLevel = cat.level < 4
        const hasValidId = cat.id && cat.id.trim() !== ''
        
        console.log(`      ${cat.name}: level=${validLevel} (${cat.level}), validId=${hasValidId} ("${cat.id}")`)
        
        return validLevel && hasValidId
      })
      
      console.log(`   📊 Después del filtro frontend: ${filtered.length} padres`)
      const infraestructuraFiltered = filtered.find(cat => cat.id === infraestructura.id)
      
      if (infraestructuraFiltered) {
        console.log('   ✅ "Infraestructura" pasa el filtro frontend')
      } else {
        console.log('   ❌ "Infraestructura" NO pasa el filtro frontend')
      }
    }
  }

  // 3. Intentar crear categoría hija
  console.log('\n🆕 [TEST] 3. Intentando crear categoría hija...')
  
  const newCategory = {
    name: 'Falla o Error TEST',
    description: 'Categoría de prueba para errores de infraestructura',
    color: '#ef4444',
    parentId: infraestructura.id,
    isActive: true,
    assignedTechnicians: []
  }
  
  console.log('   📤 Datos a enviar:', newCategory)
  
  const createResult = await makeRequest('/categories', {
    method: 'POST',
    body: JSON.stringify(newCategory)
  })
  
  if (createResult.ok && createResult.data.success) {
    console.log('   ✅ Categoría creada exitosamente')
    console.log('   📋 Datos de la nueva categoría:', createResult.data.data)
    
    // Verificar que se creó correctamente
    const verifyResult = await makeRequest('/categories')
    if (verifyResult.ok) {
      const updatedCategories = verifyResult.data.data
      const newCat = updatedCategories.find(cat => cat.name === newCategory.name)
      
      if (newCat) {
        console.log('   ✅ Categoría verificada en la lista:')
        console.log(`      - Nombre: ${newCat.name}`)
        console.log(`      - Nivel: ${newCat.level}`)
        console.log(`      - Padre: ${newCat.parent ? newCat.parent.name : 'Ninguno'}`)
      } else {
        console.log('   ❌ Categoría NO encontrada en la lista actualizada')
      }
    }
  } else {
    console.log('   ❌ Error al crear categoría:', createResult.data.error)
    if (createResult.data.details) {
      console.log('   📋 Detalles:', createResult.data.details)
    }
  }

  console.log('\n🏁 [TEST] Prueba completada')
}

// Ejecutar si se llama directamente
if (require.main === module) {
  testCategoryCreation().catch(console.error)
}

module.exports = { testCategoryCreation }