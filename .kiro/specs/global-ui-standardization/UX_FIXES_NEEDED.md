# Correcciones de UX Necesarias

## Fecha
23 de enero de 2026

## Problemas Identificados

### 1. Módulo de Departamentos
**Problema**: No tiene cambio de vista (tabla/lista/cards) como los otros módulos  
**Impacto**: UX inconsistente, usuarios no pueden elegir su vista preferida  
**Estado**: ❌ Pendiente

**Solución**:
1. Agregar estado `viewMode` al hook `use-departments.ts`
2. Crear componente `DepartmentTable` usando DataTable global
3. Crear componente `DepartmentCards` para vista de tarjetas
4. Agregar `ViewToggle` al componente `departments-page.tsx`
5. Implementar lógica de cambio de vista

**Archivos a modificar**:
- `src/hooks/use-departments.ts` - Agregar viewMode state
- `src/components/departments/department-table.tsx` - Crear (nuevo)
- `src/components/departments/department-cards.tsx` - Crear (nuevo)
- `src/components/departments/departments-page.tsx` - Agregar ViewToggle y vistas

**Tiempo estimado**: 1-2 horas

---

### 2. Módulo de Categorías - Vista Árbol
**Problema**: La vista árbol no está cargando correctamente los datos  
**Impacto**: Usuarios no pueden ver la jerarquía de categorías  
**Estado**: ❌ Pendiente

**Posibles causas**:
1. Datos de `technician_assignments` no se están cargando correctamente
2. Estructura de datos no coincide con lo que espera CategoryTree
3. Relaciones de Prisma no están incluidas en la consulta

**Solución**:
1. Verificar la consulta API en `/api/categories`
2. Asegurar que incluye todas las relaciones necesarias:
   - `technician_assignments` con `users`
   - `other_categories` (children)
   - `_count` para tickets y subcategorías
3. Agregar logs de debug para identificar el problema exacto
4. Corregir el mapeo de datos en `categories-page.tsx`

**Archivos a verificar**:
- `src/app/api/categories/route.ts` - Verificar includes de Prisma
- `src/components/categories/categories-page.tsx` - Verificar mapeo de datos
- `src/components/ui/category-tree.tsx` - Verificar estructura esperada
- `src/hooks/categories.ts` - Verificar carga de datos

**Tiempo estimado**: 1-2 horas

---

### 3. Módulo de Reportes
**Problema**: No está cargando bien, tiene errores  
**Impacto**: Usuarios no pueden ver reportes y estadísticas  
**Estado**: ✅ Parcialmente corregido (faltaba import de AlertCircle)

**Errores identificados**:
1. ✅ Faltaba import de `AlertCircle` - CORREGIDO
2. ❓ Posibles errores en la carga de datos
3. ❓ Posibles errores en los componentes de gráficos

**Solución**:
1. ✅ Agregar import de AlertCircle - COMPLETADO
2. Verificar la API `/api/reports`
3. Verificar que los componentes de gráficos reciben datos correctos
4. Agregar manejo de errores más robusto
5. Agregar logs de debug

**Archivos a verificar**:
- `src/app/api/reports/route.ts` - Verificar respuesta de API
- `src/hooks/use-reports.ts` - Verificar carga de datos
- `src/components/reports/charts/*.tsx` - Verificar componentes de gráficos
- `src/components/reports/reports-page.tsx` - Verificar manejo de datos

**Tiempo estimado**: 1-2 horas

---

## Plan de Acción

### Prioridad Alta (Crítico)

#### 1. Corregir Módulo de Reportes (1-2 horas)
- [x] Agregar import de AlertCircle
- [ ] Verificar API de reportes
- [ ] Verificar carga de datos en hook
- [ ] Probar en navegador
- [ ] Corregir errores encontrados

#### 2. Corregir Vista Árbol de Categorías (1-2 horas)
- [ ] Verificar API de categorías
- [ ] Verificar includes de Prisma
- [ ] Verificar mapeo de datos
- [ ] Agregar logs de debug
- [ ] Probar en navegador
- [ ] Corregir errores encontrados

### Prioridad Media (Mejora de UX)

#### 3. Agregar Cambio de Vista a Departamentos (1-2 horas)
- [ ] Agregar viewMode al hook
- [ ] Crear DepartmentTable
- [ ] Crear DepartmentCards
- [ ] Agregar ViewToggle
- [ ] Implementar lógica de cambio
- [ ] Probar en navegador

---

## Tiempo Total Estimado
- **Prioridad Alta**: 2-4 horas
- **Prioridad Media**: 1-2 horas
- **Total**: 3-6 horas

---

## Notas

### Patrón de Cambio de Vista (Referencia: Módulo de Técnicos)

```tsx
// 1. En el hook
const [viewMode, setViewMode] = useState<'list' | 'table' | 'cards'>('list')

// 2. En el componente
import { ViewToggle } from '@/components/common/views/view-toggle'
import { DataTable } from '@/components/common/views/data-table'
import { CardGrid } from '@/components/common/views/card-grid'
import { ListView } from '@/components/common/views/list-view'

// 3. Agregar ViewToggle
<ViewToggle
  viewMode={viewMode}
  onViewModeChange={setViewMode}
  availableViews={['list', 'table', 'cards']}
/>

// 4. Renderizado condicional
{viewMode === 'table' && <DataTable ... />}
{viewMode === 'cards' && <CardGrid ... />}
{viewMode === 'list' && <ListView ... />}
```

### Estructura de Datos para CategoryTree

```typescript
interface CategoryTreeNode {
  id: string
  name: string
  level: number
  levelName: string
  children: CategoryTreeNode[]
  _count: {
    tickets: number
    children: number
  }
  assignedTechnicians: Array<{
    id: string
    name: string
    email: string
    priority: number
    maxTickets: number
    autoAssign: boolean
  }>
}
```

### Verificación de API de Categorías

```typescript
// En /api/categories/route.ts
const categories = await prisma.categories.findMany({
  include: {
    technician_assignments: {
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    },
    other_categories: true, // children
    _count: {
      select: {
        tickets: true,
        other_categories: true
      }
    }
  }
})
```

---

## Próximos Pasos

1. **Inmediato**: Verificar errores en navegador
   - Abrir consola del navegador
   - Navegar a cada módulo
   - Documentar errores específicos

2. **Corregir Reportes**: Prioridad más alta
   - Verificar API
   - Verificar hook
   - Corregir errores

3. **Corregir Categorías**: Segunda prioridad
   - Verificar API
   - Verificar datos
   - Corregir vista árbol

4. **Mejorar Departamentos**: Tercera prioridad
   - Agregar cambio de vista
   - Mejorar UX

---

## Conclusión

Se han identificado 3 problemas de UX que necesitan corrección:

1. ✅ **Reportes**: Import faltante corregido, necesita verificación adicional
2. ❌ **Categorías**: Vista árbol no funciona correctamente
3. ❌ **Departamentos**: Falta cambio de vista

**Recomendación**: Comenzar con la verificación de errores en navegador para identificar problemas específicos antes de hacer correcciones.

