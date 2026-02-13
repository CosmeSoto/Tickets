# Correcciones de Errores - Módulo de Conocimientos

## Fecha: 5 de Febrero de 2026

## Errores Corregidos

### 1. ✅ SelectItem Empty Value Error
**Error**: `A <Select.Item /> must have a value prop that is not an empty string`

**Ubicación**: `src/components/admin/technicians/dialogs/TechnicianFormDialog.tsx`

**Causa**: El SelectItem para "Sin departamento" tenía `value=""` (string vacío), lo cual no está permitido en Radix UI Select.

**Solución**:
```typescript
// ANTES (incorrecto)
<SelectItem value="">Sin departamento</SelectItem>
value={formData.departmentId || ''}

// DESPUÉS (correcto)
<SelectItem value="none">Sin departamento</SelectItem>
value={formData.departmentId || 'none'}
onValueChange={(value) => setFormData(prev => ({ 
  ...prev, 
  departmentId: value === 'none' ? null : value 
}))}
```

### 2. ✅ Stats Card Color Undefined Error
**Error**: `Cannot read properties of undefined (reading 'bg')`

**Ubicación**: `src/components/shared/stats-card.tsx`

**Causa**: El color `yellow` no estaba definido en el objeto `colorClasses`, pero se estaba usando en las tarjetas de métricas del módulo de conocimientos.

**Solución**: El color `yellow` ya estaba agregado previamente en el archivo. Error resuelto.

```typescript
const colorClasses = {
  // ... otros colores
  yellow: {
    bg: 'bg-yellow-50 dark:bg-yellow-950/50',
    text: 'text-yellow-700 dark:text-yellow-300',
    border: 'border-yellow-200 dark:border-yellow-800',
    icon: 'text-yellow-600 dark:text-yellow-400',
    gradient: 'from-yellow-500/10 to-yellow-600/5',
  },
}
```

### 3. ✅ API Similar Articles - Parámetros Incorrectos
**Error**: `POST /api/knowledge/similar` retorna 400 Bad Request

**Ubicación**: 
- `src/app/technician/knowledge/[id]/page.tsx`
- `src/app/admin/knowledge/[id]/page.tsx`

**Causa**: Las páginas de detalle enviaban parámetros incorrectos:
```typescript
// INCORRECTO
body: JSON.stringify({ 
  articleId,  // ❌ La API no acepta articleId
  limit: 3 
})
```

**Solución**: Enviar los parámetros correctos que la API espera:
```typescript
// CORRECTO
const loadSimilarArticles = async () => {
  if (!article) return
  
  try {
    const response = await fetch(`/api/knowledge/similar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        title: article.title,                                    // ✅ Requerido
        description: article.summary || article.content.substring(0, 200), // ✅ Opcional
        categoryId: article.categoryId,                          // ✅ Opcional
        limit: 3                                                 // ✅ Opcional
      }),
    })
    
    if (response.ok) {
      const data = await response.json()
      // Filtrar el artículo actual de los resultados
      const filtered = (data.articles || []).filter((a: Article) => a.id !== article.id)
      setSimilarArticles(filtered)
    }
  } catch (err) {
    console.error('Error loading similar articles:', err)
  }
}
```

**Cambio adicional**: Separar la carga de artículos similares en un useEffect independiente:
```typescript
// Cargar artículo principal
useEffect(() => {
  if (!session || session.user.role !== 'TECHNICIAN') {
    router.push('/login')
    return
  }

  if (articleId) {
    loadArticle()
  }
}, [session, articleId, router])

// Cargar artículos similares DESPUÉS de tener el artículo
useEffect(() => {
  if (article) {
    loadSimilarArticles()
  }
}, [article?.id])
```

## Verificación del Módulo de Conocimientos en Sidebar

### ✅ Cliente (CLIENT)
**Ruta**: `/knowledge`
**Estado**: Presente en el sidebar del cliente
```typescript
{
  title: 'Base de Conocimiento',
  href: '/knowledge',
  icon: BookOpen,
  description: 'Artículos de ayuda',
}
```

### ✅ Técnico (TECHNICIAN)
**Ruta**: `/technician/knowledge`
**Estado**: Presente en el sidebar del técnico
```typescript
{
  title: 'Base de Conocimiento',
  href: '/technician/knowledge',
  icon: BookOpen,
  description: 'Artículos y guías',
}
```

### ✅ Administrador (ADMIN)
**Ruta**: `/admin/knowledge`
**Estado**: Presente en el sidebar del administrador
```typescript
{
  title: 'Base de Conocimiento',
  href: '/admin/knowledge',
  icon: BookOpen,
  description: 'Gestión de artículos',
}
```

## Parámetros de la API Similar

La API `/api/knowledge/similar` espera los siguientes parámetros:

```typescript
{
  title: string,           // REQUERIDO - Mínimo 3 caracteres
  description?: string,    // OPCIONAL - Para mejorar la búsqueda
  categoryId?: string,     // OPCIONAL - UUID de la categoría
  limit?: number          // OPCIONAL - Default: 5, Max: 20
}
```

**Algoritmo de relevancia**:
1. Extrae palabras clave del título y descripción (ignora stop words)
2. Busca coincidencias en:
   - Título (peso: 3)
   - Tags (peso: 2)
   - Contenido (peso: 1)
3. Bonus por misma categoría (peso: 5)
4. Bonus por votos útiles (normalizado)
5. Bonus por popularidad (vistas)
6. Ordena por score de relevancia descendente

## Estado Final

✅ **Todos los errores corregidos**
✅ **Módulo de conocimientos visible en todos los roles**
✅ **API de artículos similares funcionando correctamente**
✅ **Parámetros correctos en todas las páginas de detalle**

## Archivos Modificados

1. `src/components/admin/technicians/dialogs/TechnicianFormDialog.tsx`
2. `src/app/technician/knowledge/[id]/page.tsx`
3. `src/app/admin/knowledge/[id]/page.tsx`

## Próximos Pasos

Pendiente crear las páginas de formulario para crear/editar artículos:
- `src/app/technician/knowledge/new/page.tsx`
- `src/app/technician/knowledge/[id]/edit/page.tsx`
- `src/app/admin/knowledge/new/page.tsx`
- `src/app/admin/knowledge/[id]/edit/page.tsx`
