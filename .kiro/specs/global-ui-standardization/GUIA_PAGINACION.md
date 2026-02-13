# Guía de Paginación Estandarizada

**Fecha**: 2026-01-23  
**Versión**: 1.0  
**Estado**: ✅ Completado

---

## 📋 Índice

1. [Introducción](#introducción)
2. [Ubicación Estándar](#ubicación-estándar)
3. [Opciones Estándar](#opciones-estándar)
4. [Comportamiento Estándar](#comportamiento-estándar)
5. [Ejemplos de Código](#ejemplos-de-código)
6. [Hook usePagination](#hook-usepagination)
7. [Componente Pagination](#componente-pagination)
8. [Mejores Prácticas](#mejores-prácticas)
9. [Troubleshooting](#troubleshooting)

---

## 🎯 Introducción

Este documento define el estándar de paginación para todos los módulos del sistema, asegurando consistencia visual, funcional y de UX.

### Principios de Diseño

1. **Ubicación Consistente**: Siempre dentro del Card con separador visual
2. **Opciones Estándar**: [10, 20, 50, 100] con default 20
3. **Comportamiento Predecible**: Reset al filtrar, persistencia al cambiar vista
4. **Visual Claro**: Separador `border-t pt-4` para delimitar

---

## 📍 Ubicación Estándar

### Regla de Oro

**La paginación SIEMPRE va DENTRO del Card, al final del contenido, con separador visual.**

### Estructura Correcta

```tsx
<Card>
  <CardHeader>
    {/* Header descriptivo */}
    <CardTitle>Vista de Lista - Categorías</CardTitle>
  </CardHeader>
  
  <CardContent className="space-y-4">
    {/* Contenido de la vista */}
    <ListView data={paginatedData} />
    
    {/* Paginación DENTRO del Card */}
    {pagination.totalPages > 1 && (
      <div className="border-t pt-4">
        <Pagination {...paginationConfig} />
      </div>
    )}
  </CardContent>
</Card>
```

### Separador Visual

**Siempre usar**: `border-t pt-4`

```tsx
<div className="border-t pt-4">
  <Pagination {...paginationConfig} />
</div>
```

**Razones**:
- ✅ Delimita visualmente el contenido de la paginación
- ✅ Consistencia en todos los módulos
- ✅ Mejora la legibilidad
- ✅ Espacio adecuado (pt-4 = 16px)

### Ejemplos por Módulo

#### ✅ Correcto (Categorías, Departamentos, Técnicos)

```tsx
<Card>
  <CardContent className="space-y-4">
    <ListView data={data} />
    <div className="border-t pt-4">
      <Pagination {...config} />
    </div>
  </CardContent>
</Card>
```

#### ❌ Incorrecto (Legacy)

```tsx
{/* Fuera del Card */}
<Card>
  <ListView data={data} />
</Card>
<Pagination {...config} />  {/* ❌ Fuera del Card */}

{/* Sin separador */}
<Card>
  <ListView data={data} />
  <Pagination {...config} />  {/* ❌ Sin border-t pt-4 */}
</Card>
```

---

## 🔢 Opciones Estándar

### Valores Permitidos

**Estándar**: `[10, 20, 50, 100]`

```typescript
const paginationConfig: PaginationConfig = {
  // ...
  options: [10, 20, 50, 100]  // ✅ Estándar
}
```

### Default Recomendado

**Default**: `20 items por página`

```typescript
const pagination = usePagination(data, {
  pageSize: 20  // ✅ Default estándar
})
```

### Razones del Estándar

| Opción | Uso | Razón |
|--------|-----|-------|
| **10** | Listas cortas | Carga rápida, scroll mínimo |
| **20** | **Default** | Balance óptimo entre carga y navegación |
| **50** | Listas medianas | Menos clics, más datos visibles |
| **100** | Power users | Máxima información, mínima navegación |

### Comparación con Valores Anteriores

| Módulo | Antes | Después | Cambio |
|--------|-------|---------|--------|
| Tickets | [10, 25, 50, 100] | [10, 20, 50, 100] | 25 → 20 |
| Técnicos | [10, 12, 20, 50] | [10, 20, 50, 100] | 12 → 20, +100 |
| Usuarios | 25 (fijo) | 20 (fijo) | 25 → 20 |
| Reportes | 50 (fijo) | 20 (fijo) | 50 → 20 |
| Categorías | [10, 20, 50, 100] | [10, 20, 50, 100] | Sin cambios ✅ |
| Departamentos | [10, 20, 50, 100] | [10, 20, 50, 100] | Sin cambios ✅ |

---

## ⚙️ Comportamiento Estándar

### 1. Visibilidad Condicional

**Regla**: La paginación solo aparece si `totalPages > 1`

```tsx
{pagination.totalPages > 1 && (
  <div className="border-t pt-4">
    <Pagination {...paginationConfig} />
  </div>
)}
```

**Razón**: No mostrar paginación innecesaria cuando todos los datos caben en una página.

### 2. Reset al Filtrar

**Regla**: Al aplicar filtros, resetear a página 1

```tsx
const handleFilterChange = (newFilters) => {
  setFilters(newFilters)
  pagination.goToPage(1)  // ✅ Reset a página 1
}
```

**Razón**: Los filtros cambian el conjunto de datos, la página actual puede no existir.

### 3. Persistencia al Cambiar Vista

**Regla**: Al cambiar de vista (lista/tabla/cards), mantener la página actual

```tsx
const handleViewChange = (newView) => {
  setViewMode(newView)
  // ✅ NO resetear paginación
}
```

**Razón**: El usuario espera ver los mismos datos en diferente formato.

### 4. Información de Rango

**Regla**: Siempre mostrar "Mostrando X-Y de Z"

```tsx
<Pagination
  currentPage={1}
  totalPages={5}
  itemsPerPage={20}
  totalItems={95}
  showInfo={true}  // ✅ Mostrar rango
/>
```

**Resultado**: "Mostrando 1-20 de 95"

### 5. Selector Visible

**Regla**: El selector de items por página debe ser visible y accesible

```tsx
<Pagination
  showItemsPerPage={true}  // ✅ Selector visible
  options={[10, 20, 50, 100]}
/>
```

---

## 💻 Ejemplos de Código

### Ejemplo Completo (Cliente-side)

```tsx
import { usePagination } from '@/hooks/common/use-pagination'
import { Pagination } from '@/components/common/pagination'
import type { PaginationConfig } from '@/types/views'

function CategoriesPage() {
  // 1. Datos filtrados
  const filteredData = useFilters(categories, filters)
  
  // 2. Hook de paginación
  const pagination = usePagination(filteredData, {
    pageSize: 20  // Default estándar
  })
  
  // 3. Configuración para componente
  const paginationConfig: PaginationConfig = {
    page: pagination.currentPage,
    limit: pagination.pageSize,
    total: filteredData.length,
    onPageChange: (page) => pagination.goToPage(page),
    onLimitChange: (limit) => pagination.setPageSize(limit),
    options: [10, 20, 50, 100]
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Vista de Lista - Categorías</CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Vista con datos paginados */}
        <ListView data={pagination.paginatedData} />
        
        {/* Paginación con separador */}
        {pagination.totalPages > 1 && (
          <div className="border-t pt-4">
            <Pagination {...paginationConfig} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```


### Ejemplo con Servidor-side

```tsx
function TicketsPage() {
  // 1. Estado de paginación
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,  // Default estándar
    total: 0
  })
  
  // 2. Cargar datos con paginación
  const loadTickets = async (page: number, limit: number) => {
    const result = await getTickets({
      page,
      limit,
      ...filters
    })
    
    setPagination({
      page,
      limit,
      total: result.meta.pagination.total
    })
  }
  
  // 3. Configuración para componente
  const paginationConfig: PaginationConfig = {
    page: pagination.page,
    limit: pagination.limit,
    total: pagination.total,
    onPageChange: (page) => loadTickets(page, pagination.limit),
    onLimitChange: (limit) => loadTickets(1, limit),  // Reset a página 1
    options: [10, 20, 50, 100]
  }
  
  return (
    <Card>
      <CardContent className="space-y-4">
        <DataTable data={tickets} />
        
        {Math.ceil(pagination.total / pagination.limit) > 1 && (
          <div className="border-t pt-4">
            <Pagination {...paginationConfig} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

### Ejemplo con Filtros

```tsx
function DepartmentsPage() {
  const { data, loading } = useDepartments()
  const { filteredData, filters, setFilter } = useFilters(data, filterConfig)
  
  const pagination = usePagination(filteredData, {
    pageSize: 20
  })
  
  // Reset paginación al cambiar filtros
  useEffect(() => {
    pagination.goToPage(1)
  }, [filters])
  
  const paginationConfig: PaginationConfig = {
    page: pagination.currentPage,
    limit: pagination.pageSize,
    total: filteredData.length,
    onPageChange: (page) => pagination.goToPage(page),
    onLimitChange: (limit) => pagination.setPageSize(limit),
    options: [10, 20, 50, 100]
  }
  
  return (
    <Card>
      <CardContent className="space-y-4">
        {/* Filtros */}
        <FilterBar filters={filters} onChange={setFilter} />
        
        {/* Vista */}
        <ListView data={pagination.paginatedData} />
        
        {/* Paginación */}
        {pagination.totalPages > 1 && (
          <div className="border-t pt-4">
            <Pagination {...paginationConfig} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

### Ejemplo con Cambio de Vista

```tsx
function TechniciansPage() {
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards')
  const pagination = usePagination(filteredData, { pageSize: 20 })
  
  const paginationConfig: PaginationConfig = {
    page: pagination.currentPage,
    limit: pagination.pageSize,
    total: filteredData.length,
    onPageChange: (page) => pagination.goToPage(page),
    onLimitChange: (limit) => pagination.setPageSize(limit),
    options: [10, 20, 50, 100]
  }
  
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between">
          <CardTitle>Técnicos</CardTitle>
          <ViewToggle mode={viewMode} onChange={setViewMode} />
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Vista cambia, paginación se mantiene */}
        {viewMode === 'cards' ? (
          <CardView data={pagination.paginatedData} />
        ) : (
          <ListView data={pagination.paginatedData} />
        )}
        
        {/* Paginación compartida */}
        {pagination.totalPages > 1 && (
          <div className="border-t pt-4">
            <Pagination {...paginationConfig} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

---

## 🔧 Hook usePagination

### Ubicación

```
src/hooks/common/use-pagination.ts
```

### Firma

```typescript
interface UsePaginationOptions {
  pageSize?: number
  initialPage?: number
}

interface UsePaginationReturn<T> {
  // Datos paginados
  paginatedData: T[]
  
  // Estado
  currentPage: number
  pageSize: number
  totalItems: number
  totalPages: number
  
  // Navegación
  goToPage: (page: number) => void
  nextPage: () => void
  previousPage: () => void
  setPageSize: (size: number) => void
  
  // Helpers
  hasNextPage: boolean
  hasPreviousPage: boolean
  startIndex: number
  endIndex: number
}

function usePagination<T>(
  data: T[],
  options?: UsePaginationOptions
): UsePaginationReturn<T>
```

### Uso Básico

```typescript
const pagination = usePagination(categories, {
  pageSize: 20,
  initialPage: 1
})

// Datos paginados
const items = pagination.paginatedData

// Navegación
pagination.nextPage()
pagination.previousPage()
pagination.goToPage(3)
pagination.setPageSize(50)

// Estado
console.log(pagination.currentPage)     // 1
console.log(pagination.totalPages)      // 5
console.log(pagination.hasNextPage)     // true
console.log(pagination.hasPreviousPage) // false
```

### Características

- ✅ **Cliente-side**: Pagina arrays en memoria
- ✅ **Reactivo**: Actualiza automáticamente al cambiar datos
- ✅ **Type-safe**: Genérico con TypeScript
- ✅ **Helpers**: Funciones de navegación incluidas
- ✅ **Validación**: Previene páginas inválidas

---

## 🎨 Componente Pagination

### Ubicación

```
src/components/common/pagination.tsx
```

### Props

```typescript
interface PaginationProps {
  // Estado
  page: number
  limit: number
  total: number
  
  // Callbacks
  onPageChange: (page: number) => void
  onLimitChange: (limit: number) => void
  
  // Configuración
  options?: number[]
  showInfo?: boolean
  showItemsPerPage?: boolean
}
```

### Uso Básico

```tsx
<Pagination
  page={1}
  limit={20}
  total={95}
  onPageChange={(page) => console.log('Ir a página', page)}
  onLimitChange={(limit) => console.log('Cambiar a', limit, 'items')}
  options={[10, 20, 50, 100]}
  showInfo={true}
  showItemsPerPage={true}
/>
```

### Características

- ✅ **Botones**: Anterior, Siguiente, Números de página
- ✅ **Selector**: Dropdown para items por página
- ✅ **Información**: "Mostrando X-Y de Z"
- ✅ **Responsive**: Se adapta a mobile
- ✅ **Accesible**: Keyboard navigation, ARIA labels
- ✅ **Ellipsis**: Muestra "..." para muchas páginas

---

## ✨ Mejores Prácticas

### 1. Siempre Usar Opciones Estándar

```tsx
// ✅ Correcto
options: [10, 20, 50, 100]

// ❌ Incorrecto
options: [5, 15, 25, 75]
options: [12, 24, 48]
```

### 2. Default de 20 Items

```tsx
// ✅ Correcto
const pagination = usePagination(data, {
  pageSize: 20
})

// ❌ Incorrecto
const pagination = usePagination(data, {
  pageSize: 25  // No estándar
})
```

### 3. Separador Visual Siempre

```tsx
// ✅ Correcto
<div className="border-t pt-4">
  <Pagination {...config} />
</div>

// ❌ Incorrecto
<Pagination {...config} />  // Sin separador
```

### 4. Visibilidad Condicional

```tsx
// ✅ Correcto
{pagination.totalPages > 1 && (
  <div className="border-t pt-4">
    <Pagination {...config} />
  </div>
)}

// ❌ Incorrecto
<div className="border-t pt-4">
  <Pagination {...config} />  // Siempre visible
</div>
```

### 5. Reset al Filtrar

```tsx
// ✅ Correcto
useEffect(() => {
  pagination.goToPage(1)
}, [filters])

// ❌ Incorrecto
// No resetear paginación al cambiar filtros
```

### 6. Persistencia al Cambiar Vista

```tsx
// ✅ Correcto
const handleViewChange = (view) => {
  setViewMode(view)
  // NO resetear paginación
}

// ❌ Incorrecto
const handleViewChange = (view) => {
  setViewMode(view)
  pagination.goToPage(1)  // ❌ No resetear
}
```

### 7. Información de Rango

```tsx
// ✅ Correcto
<Pagination
  {...config}
  showInfo={true}  // Mostrar "Mostrando X-Y de Z"
/>

// ❌ Incorrecto
<Pagination
  {...config}
  showInfo={false}  // Ocultar información
/>
```

### 8. Selector Visible

```tsx
// ✅ Correcto
<Pagination
  {...config}
  showItemsPerPage={true}  // Selector visible
/>

// ❌ Incorrecto
<Pagination
  {...config}
  showItemsPerPage={false}  // Selector oculto
/>
```

---

## 🐛 Troubleshooting

### Problema: Paginación no aparece

**Síntoma**: El componente Pagination no se renderiza

**Causas posibles**:
1. `totalPages <= 1` (solo una página)
2. Condición `{pagination.totalPages > 1 &&` no se cumple
3. Datos vacíos

**Solución**:
```tsx
// Verificar datos
console.log('Total items:', filteredData.length)
console.log('Total pages:', pagination.totalPages)

// Renderizar siempre para debug
<div className="border-t pt-4">
  <Pagination {...config} />
  <p>Debug: {pagination.totalPages} páginas</p>
</div>
```

### Problema: Paginación no resetea al filtrar

**Síntoma**: Al aplicar filtros, sigue en página 3 (que ya no existe)

**Causa**: No hay `useEffect` que resetee la paginación

**Solución**:
```tsx
useEffect(() => {
  pagination.goToPage(1)
}, [filters])
```

### Problema: Paginación resetea al cambiar vista

**Síntoma**: Al cambiar de lista a tarjetas, vuelve a página 1

**Causa**: Reset innecesario en el handler

**Solución**:
```tsx
// ❌ Incorrecto
const handleViewChange = (view) => {
  setViewMode(view)
  pagination.goToPage(1)  // ❌ Eliminar esto
}

// ✅ Correcto
const handleViewChange = (view) => {
  setViewMode(view)
  // NO resetear paginación
}
```

### Problema: Opciones no estándar

**Síntoma**: Selector muestra [10, 12, 20, 50]

**Causa**: Configuración incorrecta

**Solución**:
```tsx
// ❌ Incorrecto
options: [10, 12, 20, 50]

// ✅ Correcto
options: [10, 20, 50, 100]
```

### Problema: Paginación fuera del Card

**Síntoma**: Paginación aparece debajo del Card

**Causa**: Estructura incorrecta

**Solución**:
```tsx
// ❌ Incorrecto
<Card>
  <ListView data={data} />
</Card>
<Pagination {...config} />

// ✅ Correcto
<Card>
  <CardContent className="space-y-4">
    <ListView data={data} />
    <div className="border-t pt-4">
      <Pagination {...config} />
    </div>
  </CardContent>
</Card>
```

---

## 📚 Recursos Adicionales

### Documentación Relacionada

- [Guía de Vistas Estandarizadas](./GUIA_VISTAS_ESTANDARIZADAS.md)
- [Guía de Headers](./GUIA_HEADERS.md)
- [Fase 13.5 - Estandarización de Paginación](../FASE_13_5_PAGINACION_COMPLETADA.md)

### Ejemplos en el Código

- **Categorías**: `src/components/categories/categories-page.tsx`
- **Departamentos**: `src/components/departments/departments-page.tsx`
- **Técnicos**: `src/app/admin/technicians/page.tsx`

### Tipos TypeScript

- `src/types/views.ts` - PaginationConfig
- `src/hooks/common/use-pagination.ts` - Hook

---

## 🎉 Conclusión

Esta guía proporciona todo lo necesario para implementar paginación estandarizada en el sistema. Siguiendo estos patrones, garantizamos:

- ✅ **Consistencia** visual en todos los módulos
- ✅ **UX predecible** para los usuarios
- ✅ **Mantenibilidad** con código reutilizable
- ✅ **Escalabilidad** para nuevos módulos

**Recuerda**: 
- Ubicación: DENTRO del Card con `border-t pt-4`
- Opciones: `[10, 20, 50, 100]`
- Default: `20 items`
- Comportamiento: Reset al filtrar, persistencia al cambiar vista

---

**Documento generado**: 2026-01-23  
**Autor**: Sistema de Estandarización de UI  
**Versión**: 1.0
