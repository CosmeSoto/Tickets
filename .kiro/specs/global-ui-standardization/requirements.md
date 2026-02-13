# Estandarización Global de UI y Componentes

## 1. Visión General

Crear un sistema de componentes y patrones globales que estandarice la interfaz de usuario en todos los módulos del sistema, eliminando código duplicado y asegurando consistencia visual y funcional.

## 2. Problema Actual

### 2.1 Inconsistencias Detectadas

- **Filtros duplicados**: Cada módulo implementa sus propios filtros (búsqueda, departamento, estado)
- **Vistas diferentes**: Algunos módulos usan tablas, otros tarjetas, sin patrón consistente
- **Código redundante**: Lógica de filtrado, paginación y ordenamiento repetida
- **UX inconsistente**: Diferentes estilos de botones, diálogos y acciones
- **Mantenimiento difícil**: Cambios requieren actualizar múltiples archivos

### 2.2 Módulos Afectados

1. **Usuarios** (`/admin/users`) - Usa tabla con filtros
2. **Técnicos** (`/admin/technicians`) - Usa tarjetas/lista con filtros
3. **Categorías** (`/admin/categories`) - Componente separado
4. **Departamentos** (`/admin/departments`) - Componente separado
5. **Tickets** (`/admin/tickets`) - Tabla con filtros complejos
6. **Reportes** (`/admin/reports`) - Tablas con filtros de fecha

## 3. Objetivos

### 3.1 Objetivos Principales

1. **Reducir código duplicado** en 60-70%
2. **Estandarizar UX** en todos los módulos
3. **Facilitar mantenimiento** con componentes reutilizables
4. **Mejorar rendimiento** con hooks optimizados
5. **Mantener funcionalidad** sin romper nada existente

### 3.2 Objetivos Secundarios

- Documentar patrones de diseño
- Crear guías de uso para desarrolladores
- Facilitar creación de nuevos módulos
- Mejorar accesibilidad (a11y)

## 4. Requisitos Funcionales

### 4.1 Sistema de Filtros Global

**RF-1.1: Hook de Filtros Genérico**
- Como desarrollador
- Quiero un hook `useFilters<T>` reutilizable
- Para aplicar filtros a cualquier lista de datos

**Criterios de Aceptación:**
- ✓ Soporta búsqueda por múltiples campos
- ✓ Soporta filtros personalizados (select, checkbox, date)
- ✓ Mantiene estado de filtros en URL (opcional)
- ✓ Debounce automático para búsqueda
- ✓ Retorna datos filtrados y funciones de control

**RF-1.2: Componente FilterBar**
- Como usuario
- Quiero una barra de filtros consistente
- Para filtrar datos en cualquier módulo

**Criterios de Aceptación:**
- ✓ Búsqueda con icono y placeholder
- ✓ Filtros dropdown configurables
- ✓ Botón de limpiar filtros
- ✓ Botón de actualizar/refrescar
- ✓ Estadísticas rápidas (badges con contadores)
- ✓ Responsive (mobile-first)

**RF-1.3: Tipos de Filtros Soportados**
- Búsqueda de texto (con debounce)
- Select simple (departamento, estado, rol)
- Select múltiple (categorías, tags)
- Rango de fechas (desde/hasta)
- Checkbox (activo/inactivo, público/privado)
- Rango numérico (prioridad, rating)

### 4.2 Sistema de Vistas (Cards/List/Table)

**RF-2.1: Hook de Vista**
- Como desarrollador
- Quiero un hook `useViewMode` 
- Para manejar cambio entre vistas

**Criterios de Aceptación:**
- ✓ Soporta 'cards', 'list', 'table'
- ✓ Persiste preferencia en localStorage
- ✓ Retorna modo actual y función de cambio
- ✓ Responsive (auto-switch en mobile)

**RF-2.2: Componente ViewToggle**
- Como usuario
- Quiero cambiar entre vistas fácilmente
- Para ver datos como prefiera

**Criterios de Aceptación:**
- ✓ Botones con iconos claros
- ✓ Indicador visual de vista activa
- ✓ Tooltips descriptivos
- ✓ Accesible por teclado

**RF-2.3: Layouts Estandarizados**
- **CardGrid**: Grid responsive de tarjetas
- **ListView**: Lista compacta con hover
- **DataTable**: Tabla con ordenamiento y paginación

### 4.3 Sistema de Acciones Globales

**RF-3.1: Componente ActionBar**
- Como usuario
- Quiero acciones consistentes en todos los módulos
- Para realizar operaciones comunes

**Criterios de Aceptación:**
- ✓ Botón primario (Crear/Agregar)
- ✓ Botones secundarios (Exportar, Importar)
- ✓ Acciones masivas (cuando aplique)
- ✓ Posición consistente (top-right)

**RF-3.2: Diálogos Estandarizados**
- **CreateDialog**: Crear nuevo registro
- **EditDialog**: Editar registro existente
- **DeleteDialog**: Confirmar eliminación
- **DetailsDialog**: Ver detalles completos

**Criterios de Aceptación:**
- ✓ Mismo estilo visual
- ✓ Validación consistente
- ✓ Mensajes de error claros
- ✓ Loading states
- ✓ Accesibilidad (ESC para cerrar, focus trap)

### 4.4 Sistema de Estadísticas

**RF-4.1: Componente StatsBar**
- Como usuario
- Quiero ver estadísticas rápidas
- Para entender el estado del módulo

**Criterios de Aceptación:**
- ✓ Badges con colores semánticos
- ✓ Iconos descriptivos
- ✓ Números actualizados en tiempo real
- ✓ Tooltips con detalles
- ✓ Grid responsive (2-5 columnas)

**RF-4.2: Estadísticas Comunes**
- Total de registros
- Registros activos/inactivos
- Registros por categoría/tipo
- Tendencias (↑↓)
- Alertas/Warnings

### 4.5 Sistema de Paginación

**RF-5.1: Hook de Paginación**
- Como desarrollador
- Quiero un hook `usePagination<T>`
- Para paginar cualquier lista

**Criterios de Aceptación:**
- ✓ Soporta paginación cliente y servidor
- ✓ Configurable items por página
- ✓ Retorna página actual, total, funciones de navegación
- ✓ Mantiene estado en URL (opcional)

**RF-5.2: Componente Pagination**
- Como usuario
- Quiero navegar entre páginas fácilmente
- Para ver todos los registros

**Criterios de Aceptación:**
- ✓ Botones Anterior/Siguiente
- ✓ Números de página (con ellipsis)
- ✓ Selector de items por página
- ✓ Información "Mostrando X de Y"
- ✓ Accesible por teclado

## 5. Requisitos No Funcionales

### 5.1 Rendimiento

**RNF-1**: Los filtros deben aplicarse en < 100ms para listas de hasta 1000 items
**RNF-2**: El cambio de vista debe ser instantáneo (< 50ms)
**RNF-3**: La paginación debe cargar nueva página en < 200ms

### 5.2 Compatibilidad

**RNF-4**: Debe funcionar en todos los módulos existentes sin romper funcionalidad
**RNF-5**: Debe ser compatible con React 18+ y Next.js 14+
**RNF-6**: Debe soportar TypeScript con tipos estrictos

### 5.3 Accesibilidad

**RNF-7**: Todos los componentes deben cumplir WCAG 2.1 AA
**RNF-8**: Navegación completa por teclado
**RNF-9**: Screen readers compatibles
**RNF-10**: Contraste de colores adecuado

### 5.4 Mantenibilidad

**RNF-11**: Código documentado con JSDoc
**RNF-12**: Tests unitarios para hooks
**RNF-13**: Storybook para componentes visuales
**RNF-14**: Guía de uso con ejemplos

## 6. Arquitectura de Componentes

### 6.1 Estructura de Carpetas

```
src/
├── components/
│   ├── common/              # Componentes globales
│   │   ├── filters/
│   │   │   ├── FilterBar.tsx
│   │   │   ├── SearchInput.tsx
│   │   │   ├── SelectFilter.tsx
│   │   │   └── DateRangeFilter.tsx
│   │   ├── views/
│   │   │   ├── ViewToggle.tsx
│   │   │   ├── CardGrid.tsx
│   │   │   ├── ListView.tsx
│   │   │   └── DataTable.tsx
│   │   ├── actions/
│   │   │   ├── ActionBar.tsx
│   │   │   ├── CreateButton.tsx
│   │   │   └── BulkActions.tsx
│   │   ├── stats/
│   │   │   ├── StatsBar.tsx
│   │   │   └── StatCard.tsx
│   │   └── pagination/
│   │       └── Pagination.tsx
│   └── [module]/            # Componentes específicos
│       ├── [Module]Card.tsx
│       ├── [Module]ListItem.tsx
│       └── [Module]Dialogs.tsx
├── hooks/
│   ├── useFilters.ts        # Hook de filtros
│   ├── useViewMode.ts       # Hook de vistas
│   ├── usePagination.ts     # Hook de paginación
│   └── useModuleData.ts     # Hook genérico de datos
└── types/
    ├── filters.ts           # Tipos de filtros
    ├── views.ts             # Tipos de vistas
    └── common.ts            # Tipos comunes
```

### 6.2 Patrón de Uso

```typescript
// Ejemplo de módulo estandarizado
function ModulePage() {
  // 1. Cargar datos
  const { data, loading, error, reload } = useModuleData()
  
  // 2. Aplicar filtros
  const { 
    filteredData, 
    filters, 
    setFilter, 
    clearFilters 
  } = useFilters(data, filterConfig)
  
  // 3. Aplicar paginación
  const { 
    paginatedData, 
    currentPage, 
    totalPages, 
    goToPage 
  } = usePagination(filteredData)
  
  // 4. Manejar vista
  const { viewMode, setViewMode } = useViewMode('cards')
  
  return (
    <Layout>
      <ActionBar onAdd={handleAdd} />
      <FilterBar {...filters} />
      <StatsBar stats={calculateStats(data)} />
      <ViewToggle mode={viewMode} onChange={setViewMode} />
      
      {viewMode === 'cards' && <CardGrid data={paginatedData} />}
      {viewMode === 'list' && <ListView data={paginatedData} />}
      {viewMode === 'table' && <DataTable data={paginatedData} />}
      
      <Pagination {...pagination} />
    </Layout>
  )
}
```

## 7. Requisitos Específicos por Módulo

### 7.1 Módulo de Categorías (Jerarquía de 4 Niveles)

**RF-CAT-1: Vista de Árbol Jerárquico**
- Como usuario
- Quiero ver categorías en estructura de árbol
- Para entender la jerarquía completa

**Criterios de Aceptación:**
- ✓ Visualización de 4 niveles: Nivel 1 → Nivel 2 → Nivel 3 → Nivel 4
- ✓ Expand/collapse de nodos con animación suave
- ✓ Indicadores visuales de profundidad (indentación, líneas, colores)
- ✓ Iconos diferenciados por nivel (FolderTree, Folder, FileText)
- ✓ Contador de hijos en cada nodo
- ✓ Búsqueda que expande automáticamente nodos coincidentes
- ✓ Persistencia del estado de expansión en localStorage
- ✓ Performance óptima con 100+ categorías

**RF-CAT-2: Vista de Lista Plana con Jerarquía**
- Como usuario
- Quiero ver todas las categorías en lista
- Para tener una vista compacta con indicadores de nivel

**Criterios de Aceptación:**
- ✓ Indentación visual proporcional al nivel
- ✓ Badges de nivel (L1, L2, L3, L4)
- ✓ Breadcrumb de jerarquía en cada item
- ✓ Filtrado por nivel específico
- ✓ Ordenamiento respetando jerarquía

**RF-CAT-3: Vista de Tabla con Columnas Jerárquicas**
- Como usuario
- Quiero ver categorías en tabla
- Para comparar datos tabulares manteniendo jerarquía

**Criterios de Aceptación:**
- ✓ Columna de nombre con indentación
- ✓ Columna de nivel
- ✓ Columna de categoría padre
- ✓ Columnas de estadísticas (tickets, técnicos)
- ✓ Ordenamiento por cualquier columna
- ✓ Expand/collapse inline en tabla

**RF-CAT-4: Componentes Específicos de Categorías**
- `TreeView`: Componente de árbol reutilizable
- `TreeNode`: Nodo individual con expand/collapse
- `HierarchyBreadcrumb`: Breadcrumb de jerarquía
- `LevelBadge`: Badge visual de nivel
- `CategoryCard`: Tarjeta con jerarquía visual

**RF-CAT-5: Filtros Específicos de Categorías**
- Filtro por nivel (L1, L2, L3, L4, Todos)
- Filtro por categoría padre
- Búsqueda en toda la jerarquía
- Filtro por técnicos asignados
- Filtro por departamento

**RNF-CAT: Requisitos No Funcionales**
- Renderizado eficiente con virtualización para árboles grandes
- Animaciones suaves (< 300ms) para expand/collapse
- Accesibilidad completa (keyboard navigation con arrow keys)
- Indicadores visuales claros de profundidad
- Responsive: árbol en desktop, lista en mobile

### 7.2 Módulo de Técnicos (Piloto)

**RF-TECH-1: Vistas Estandarizadas**
- Vista de tarjetas con estadísticas
- Vista de lista compacta
- Vista de tabla con métricas

**RF-TECH-2: Filtros Específicos**
- Búsqueda por nombre/email
- Filtro por departamento
- Filtro por estado (activo/inactivo)
- Filtro por carga de trabajo

### 7.3 Módulo de Usuarios

**RF-USER-1: Vistas Estandarizadas**
- Vista de tabla (por defecto)
- Vista de tarjetas con avatar
- Vista de lista compacta

**RF-USER-2: Filtros Específicos**
- Búsqueda por nombre/email
- Filtro por rol (Admin, Técnico, Cliente)
- Filtro por estado
- Filtro por departamento

### 7.4 Módulo de Tickets

**RF-TICKET-1: Vistas Estandarizadas**
- Vista de tabla con columnas configurables
- Vista de tarjetas tipo kanban
- Vista de lista con preview

**RF-TICKET-2: Filtros Avanzados**
- Búsqueda por título/ID
- Filtro por estado (múltiple)
- Filtro por prioridad (múltiple)
- Filtro por categoría (jerárquico)
- Filtro por asignado
- Filtro por cliente
- Filtro por rango de fechas

### 7.5 Módulo de Reportes

**RF-REPORT-1: Filtros de Fecha**
- Selector de rango de fechas
- Presets (Hoy, Esta semana, Este mes, Últimos 30 días)
- Comparación con período anterior

**RF-REPORT-2: Exportación**
- Exportar a CSV
- Exportar a Excel
- Exportar a PDF
- Programar reportes automáticos

## 8. Plan de Migración

### 8.1 Fase 1: Componentes Base (Semana 1)
- Crear hooks globales (useFilters, useViewMode, usePagination)
- Crear componentes de filtros (FilterBar, SearchInput, SelectFilter)
- Crear componentes de vistas (ViewToggle, CardGrid, ListView)
- Tests unitarios

### 7.2 Fase 2: Componentes Avanzados (Semana 2)
- Crear ActionBar y diálogos estandarizados
- Crear StatsBar y StatCard
- Crear Pagination
- Documentación y Storybook

### 7.3 Fase 3: Migración de Módulos (Semana 3-4)
- Migrar módulo Técnicos (piloto)
- Migrar módulo Usuarios
- Migrar módulo Categorías
- Migrar módulo Departamentos

### 7.4 Fase 4: Módulos Restantes (Semana 5-6)
- Migrar módulo Tickets
- Migrar módulo Reportes
- Migrar otros módulos
- Limpieza de código legacy

## 8. Criterios de Éxito

### 8.1 Métricas Cuantitativas
- ✓ Reducción de 60%+ en líneas de código duplicado
- ✓ Reducción de 50%+ en tiempo de desarrollo de nuevos módulos
- ✓ 100% de módulos usando componentes globales
- ✓ 0 regresiones en funcionalidad existente

### 8.2 Métricas Cualitativas
- ✓ UX consistente en todos los módulos
- ✓ Código más mantenible y legible
- ✓ Documentación completa
- ✓ Feedback positivo del equipo

## 9. Riesgos y Mitigaciones

### 9.1 Riesgo: Romper Funcionalidad Existente
**Mitigación**: 
- Migración gradual módulo por módulo
- Tests de regresión antes de cada migración
- Rollback plan para cada módulo

### 9.2 Riesgo: Componentes Demasiado Genéricos
**Mitigación**:
- Diseño flexible con props configurables
- Slots para personalización
- Escape hatches para casos especiales

### 9.3 Riesgo: Resistencia al Cambio
**Mitigación**:
- Documentación clara con ejemplos
- Sesiones de capacitación
- Soporte durante migración

## 10. Dependencias

### 10.1 Técnicas
- React 18+
- Next.js 14+
- TypeScript 5+
- Tailwind CSS
- shadcn/ui

### 10.2 Humanas
- 1 desarrollador senior (arquitectura)
- 1-2 desarrolladores (implementación)
- 1 QA (testing)

## 11. Entregables

1. **Código**
   - Hooks globales
   - Componentes reutilizables
   - Tipos TypeScript
   - Tests unitarios

2. **Documentación**
   - Guía de uso de componentes
   - Ejemplos de implementación
   - Guía de migración
   - API reference

3. **Herramientas**
   - Storybook con todos los componentes
   - Scripts de migración
   - Linters y formatters configurados

## 12. Cronograma

- **Semana 1-2**: Diseño y componentes base
- **Semana 3-4**: Migración de módulos principales
- **Semana 5-6**: Migración de módulos restantes y limpieza
- **Semana 7**: Testing, documentación y capacitación

**Total**: 7 semanas para estandarización completa del sistema
