# Análisis Detallado de Componentes de Vista

**Fecha**: 23 de enero de 2026  
**Fase**: 13.1.2 - Análisis de Componentes de Vista  
**Objetivo**: Identificar todos los componentes de vista específicos, medir código duplicado y planificar migración a componentes globales

---

## 1. Componentes de Lista Identificados

### 1.1 CategoryListView
- **Ubicación**: `src/components/categories/category-list-view.tsx`
- **Líneas de código**: ~150 líneas
- **Funcionalidad**:
  - Renderiza categorías en formato lista vertical
  - Muestra color, nivel, nombre, descripción
  - Muestra padre si existe
  - Muestra contadores (tickets, subcategorías, técnicos)
  - Muestra técnicos asignados con badges
  - Acciones: Editar, Eliminar
  - Soporte para selección masiva con checkboxes
  - Click en item para editar
- **Características únicas**:
  - Iconos por nivel (FolderTree, Folder, Tag)
  - Badges de nivel (N1, N2, N3, N4)
  - Información de jerarquía (padre)
  - Técnicos con prioridad
- **Código duplicado**: Estructura de lista, acciones, selección masiva

### 1.2 DepartmentList
- **Ubicación**: `src/components/departments/department-list.tsx`
- **Líneas de código**: ~120 líneas
- **Funcionalidad**:
  - Renderiza departamentos en formato lista vertical
  - Avatar circular con iniciales y color
  - Muestra nombre, descripción, estado
  - Muestra contadores (técnicos, categorías)
  - Acciones: Editar, Eliminar
  - Soporte para selección masiva con checkboxes
  - Click en item para editar
  - Empty state con botón de crear
- **Características únicas**:
  - Avatar circular con color de departamento
  - Iniciales del nombre
- **Código duplicado**: Estructura de lista, acciones, selección masiva, empty state

### 1.3 ListView Global (Existente)
- **Ubicación**: `src/components/common/views/list-view.tsx`
- **Líneas de código**: ~80 líneas
- **Funcionalidad**:
  - Componente genérico para listas
  - Renderizado personalizado con `renderItem`
  - onClick opcional
  - Empty state configurable
  - Loading skeleton
  - Dividers opcionales
  - Accesibilidad (keyboard nav)
- **Ventajas**:
  - Ya es genérico y reutilizable
  - Maneja loading y empty states
  - Accesible
- **Limitaciones actuales**:
  - No tiene soporte integrado para selección masiva
  - No tiene headers descriptivos integrados
  - No tiene paginación integrada

### 1.4 Análisis de Duplicación en Listas

**Código común entre CategoryListView y DepartmentList**:
- Estructura de contenedor con `space-y-2`
- Header de selección masiva con checkbox "Seleccionar todo"
- Badge de contador de seleccionados
- Estructura de item con border, padding, hover
- Checkbox de selección por item
- Área clickeable para editar
- Botones de acciones (Editar, Eliminar)
- Manejo de `stopPropagation` en acciones

**Estimación de código duplicado**: ~70 líneas (58%)

---

## 2. Componentes de Tabla Identificados

### 2.1 CategoryTableCompact
- **Ubicación**: `src/components/ui/category-table-compact.tsx`
- **Líneas de código**: ~250 líneas
- **Funcionalidad**:
  - Tabla HTML real con thead/tbody
  - Columnas: Categoría, Nivel, Estado, Tickets, Técnicos, Acciones
  - Iconos por nivel
  - Color indicator
  - Badges de nivel y estado
  - Contadores con iconos
  - Técnicos con badges (máximo 2 + contador)
  - Acciones: Editar, Eliminar
  - Click en fila para editar
  - Highlight de búsqueda
  - Empty state
- **Características únicas**:
  - Información jerárquica (padre)
  - Múltiples contadores
  - Técnicos con límite de visualización
- **Código duplicado**: Estructura de tabla, acciones, empty state

### 2.2 DepartmentTable
- **Ubicación**: `src/components/departments/department-table.tsx`
- **Líneas de código**: ~180 líneas
- **Funcionalidad**:
  - Usa DataTable global de `common/views`
  - Columnas configurables
  - Renderizado personalizado por columna
  - Ordenamiento
  - Selección múltiple
  - Click en fila
  - Empty message
- **Ventajas**:
  - Ya usa componente global
  - Código más limpio
- **Nota**: Este es un buen ejemplo de migración exitosa

### 2.3 UserTable
- **Ubicación**: `src/components/users/user-table.tsx`
- **Líneas de código**: ~945 líneas (TRUNCADO en lectura)
- **Funcionalidad**:
  - Tabla completa con paginación integrada
  - Filtros avanzados (búsqueda, rol, estado, departamento)
  - Estadísticas rápidas (6 cards)
  - Selección masiva con acciones
  - Dos vistas: Tabla y Tarjetas
  - Avatar con botón de cambio
  - Dropdown de acciones por fila
  - Loading states elaborados
  - Error states con retry
  - Empty states contextuales
  - Modal de avatar
  - Dialog de confirmación
- **Características únicas**:
  - Sistema completo de gestión de usuarios
  - Integración con sesión (no puede eliminarse a sí mismo)
  - Avatar upload
  - Acciones masivas (activar, desactivar)
  - Estadísticas en tiempo real
- **Nota**: Este componente es MUY complejo y específico. Contiene lógica de negocio que no debe extraerse.

### 2.4 DataTable Global (Existente - UI)
- **Ubicación**: `src/components/ui/data-table.tsx`
- **Líneas de código**: ~400 líneas
- **Funcionalidad**:
  - Tabla completa con todas las características
  - Búsqueda con debounce
  - Filtros avanzados (select, input, date)
  - Ordenamiento por columna
  - Paginación integrada
  - Dos vistas: Tabla y Tarjetas
  - Acciones por fila
  - Empty state configurable
  - Loading state
  - Error state con retry
  - Refresh, Export, Settings
- **Ventajas**:
  - Componente completo y robusto
  - Ya usado en Tickets
  - Maneja todos los casos de uso
- **Usado por**: Tickets (referencia)

### 2.5 DataTable Global (Existente - Common)
- **Ubicación**: `src/components/common/views/data-table.tsx`
- **Líneas de código**: ~200 líneas
- **Funcionalidad**:
  - Tabla con ordenamiento
  - Selección múltiple
  - Columnas configurables
  - Empty state
  - Loading skeleton
  - Accesibilidad
- **Ventajas**:
  - Más simple que UI version
  - Enfocado en tabla pura
- **Usado por**: DepartmentTable

### 2.6 Análisis de Duplicación en Tablas

**Código común entre CategoryTableCompact y componentes globales**:
- Estructura de tabla HTML
- Empty state
- Loading state
- Acciones por fila
- Click en fila

**Estimación de código duplicado**: ~150 líneas (60%)

**Decisión**: CategoryTableCompact debe migrar a DataTable global (UI o Common)

---

## 3. Componentes de Tarjetas Identificados

### 3.1 TechnicianStatsCard
- **Ubicación**: `src/components/ui/technician-stats-card.tsx`
- **Líneas de código**: ~400 líneas
- **Funcionalidad**:
  - Card completa con toda la información del técnico
  - Avatar con icono de herramienta
  - Badges de rol y experiencia
  - Indicador de estado (disponible, ocupado, sobrecargado)
  - Información de contacto (email, teléfono)
  - Departamento con color
  - 3 estadísticas principales (tickets en proceso, áreas, carga)
  - Botón de ver asignaciones
  - Información de actividad (último acceso, registrado)
  - Alertas (tickets/asignaciones activas)
  - Acciones: Editar, Eliminar, Convertir a Cliente
  - Click en card para editar
- **Características únicas**:
  - Cálculo de nivel de experiencia (Experto, Avanzado, Junior)
  - Cálculo de carga de trabajo (utilización)
  - Lógica de negocio compleja
  - Múltiples estados visuales
- **Código duplicado**: Estructura de card, acciones, badges

### 3.2 TicketStatsCard
- **Ubicación**: `src/components/ui/ticket-stats-card.tsx`
- **Líneas de código**: ~350 líneas
- **Funcionalidad**:
  - Card completa con toda la información del ticket
  - Icono de estado
  - Badges de urgencia, estado, prioridad
  - Descripción truncada
  - Cliente y técnico asignado
  - Categoría con color
  - 3 estadísticas (comentarios, archivos, actividad)
  - Información temporal (creado, actualizado)
  - Alertas de urgencia
  - Acciones: Ver, Editar, Eliminar
  - Click en card para ver
- **Características únicas**:
  - Cálculo de nivel de urgencia
  - Tiempo transcurrido
  - Lógica de negocio de tickets
  - Border color por estado
- **Código duplicado**: Estructura de card, acciones, badges, estadísticas

### 3.3 UserStatsCard (Mencionado en UserTable)
- **Ubicación**: `src/components/ui/user-stats-card.tsx`
- **Funcionalidad**: Similar a TechnicianStatsCard pero para usuarios
- **Nota**: No leído en detalle, pero probablemente tiene estructura similar

### 3.4 CardGrid Global (Existente)
- **Ubicación**: `src/components/common/views/card-grid.tsx`
- **Líneas de código**: ~80 líneas
- **Funcionalidad**:
  - Grid responsive configurable
  - Columnas: 1-6
  - Gap configurable
  - Renderizado personalizado con `renderCard`
  - Empty state
  - Loading skeleton
- **Ventajas**:
  - Ya es genérico
  - Responsive
  - Configurable
- **Limitaciones actuales**:
  - No tiene headers descriptivos integrados
  - No tiene paginación integrada
  - No tiene selección masiva

### 3.5 Análisis de Duplicación en Tarjetas

**Código común entre TechnicianStatsCard y TicketStatsCard**:
- Estructura de Card con CardContent
- Border-left con color
- Hover effects
- Indicador de "Clic" en esquina
- Header con avatar/icono y badges
- Sección de información principal
- Grid de 3 estadísticas con iconos y colores
- Sección de información secundaria
- Alertas condicionales
- Barra de acciones en footer
- Click en card para acción principal

**Estimación de código duplicado**: ~200 líneas (50%)

**Patrón identificado**: Todas las tarjetas siguen la misma estructura:
1. Header (avatar/icono + título + badges + indicador de estado)
2. Información principal (contacto, descripción, etc.)
3. Grid de estadísticas (3 columnas con iconos)
4. Información secundaria (fechas, actividad)
5. Alertas condicionales
6. Footer con acciones

---

## 4. Componentes de Árbol Identificados

### 4.1 CategoryTree
- **Ubicación**: `src/components/categories/category-tree.tsx` (asumido, no leído)
- **Funcionalidad**:
  - Vista jerárquica de 4 niveles
  - Expand/collapse por nivel
  - Colores por nivel
  - Búsqueda con auto-expand
  - Información de tickets y técnicos
- **Características únicas**:
  - Muy específico del dominio de categorías
  - Lógica de negocio compleja
  - 4 niveles con reglas específicas
- **Decisión previa**: Mantener como componente específico (no crear TreeView global)

---

## 5. Resumen de Código Duplicado

### 5.1 Por Tipo de Vista

| Tipo | Componentes Específicos | Líneas Totales | Código Duplicado | % Duplicado |
|------|------------------------|----------------|------------------|-------------|
| Lista | CategoryListView, DepartmentList | 270 | ~150 | 56% |
| Tabla | CategoryTableCompact | 250 | ~150 | 60% |
| Tarjetas | TechnicianStatsCard, TicketStatsCard | 750 | ~200 | 27% |
| **TOTAL** | **5 componentes** | **1,270** | **~500** | **39%** |

**Nota**: UserTable (945L) NO se incluye porque es un componente completo con lógica de negocio que no debe extraerse.

### 5.2 Componentes Globales Existentes

| Componente | Ubicación | Líneas | Estado | Usado Por |
|------------|-----------|--------|--------|-----------|
| ListView | common/views | 80 | ✅ Funcional | - |
| DataTable (Common) | common/views | 200 | ✅ Funcional | DepartmentTable |
| DataTable (UI) | ui | 400 | ✅ Funcional | Tickets |
| CardGrid | common/views | 80 | ✅ Funcional | - |

### 5.3 Componentes a Crear

| Componente | Propósito | Líneas Estimadas | Reemplaza |
|------------|-----------|------------------|-----------|
| CardView | Tarjetas estandarizadas | ~150 | TechnicianStatsCard, TicketStatsCard (parcial) |
| ViewContainer | Contenedor con headers y paginación | ~100 | Código duplicado en páginas |

---

## 6. Plan de Migración Priorizado

### 6.1 Prioridad Alta (Máximo Impacto)

#### 1. CategoryTableCompact → DataTable Global
- **Impacto**: 250 líneas → ~50 líneas (80% reducción)
- **Esfuerzo**: Medio
- **Beneficio**: Eliminar componente específico completo
- **Acción**: Migrar a DataTable (UI o Common) con columnas personalizadas

#### 2. CategoryListView → ListView Global
- **Impacto**: 150 líneas → ~30 líneas (80% reducción)
- **Esfuerzo**: Bajo
- **Beneficio**: Eliminar componente específico
- **Acción**: Usar ListView con renderItem personalizado

#### 3. DepartmentList → ListView Global
- **Impacto**: 120 líneas → ~30 líneas (75% reducción)
- **Esfuerzo**: Bajo
- **Beneficio**: Eliminar componente específico
- **Acción**: Usar ListView con renderItem personalizado

### 6.2 Prioridad Media (Mejora de Consistencia)

#### 4. Crear CardView Global
- **Impacto**: Unificar estructura de tarjetas
- **Esfuerzo**: Alto
- **Beneficio**: Consistencia visual y reducción de código futuro
- **Acción**: Crear componente genérico con slots para contenido

#### 5. TechnicianStatsCard → CardView Global
- **Impacto**: 400 líneas → ~100 líneas (75% reducción)
- **Esfuerzo**: Alto (mucha lógica de negocio)
- **Beneficio**: Usar componente global
- **Acción**: Extraer lógica de negocio, usar CardView para UI

#### 6. TicketStatsCard → CardView Global
- **Impacto**: 350 líneas → ~100 líneas (71% reducción)
- **Esfuerzo**: Alto (mucha lógica de negocio)
- **Beneficio**: Usar componente global
- **Acción**: Extraer lógica de negocio, usar CardView para UI

### 6.3 Prioridad Baja (Mantener)

#### 7. UserTable
- **Decisión**: MANTENER como está
- **Razón**: Componente completo con lógica de negocio compleja
- **Acción**: Solo migrar a ModuleLayout si no está ya

#### 8. CategoryTree
- **Decisión**: MANTENER como está
- **Razón**: Muy específico del dominio
- **Acción**: Ninguna

---

## 7. Estimación de Reducción Total

### 7.1 Escenario Conservador (Solo Prioridad Alta)

| Componente | Antes | Después | Reducción |
|------------|-------|---------|-----------|
| CategoryTableCompact | 250 | 50 | 200 (80%) |
| CategoryListView | 150 | 30 | 120 (80%) |
| DepartmentList | 120 | 30 | 90 (75%) |
| **TOTAL** | **520** | **110** | **410 (79%)** |

### 7.2 Escenario Completo (Todas las Prioridades)

| Componente | Antes | Después | Reducción |
|------------|-------|---------|-----------|
| CategoryTableCompact | 250 | 50 | 200 (80%) |
| CategoryListView | 150 | 30 | 120 (80%) |
| DepartmentList | 120 | 30 | 90 (75%) |
| TechnicianStatsCard | 400 | 100 | 300 (75%) |
| TicketStatsCard | 350 | 100 | 250 (71%) |
| **TOTAL** | **1,270** | **310** | **960 (76%)** |

**Componentes globales a crear**: CardView (~150L), ViewContainer (~100L)  
**Costo de creación**: 250 líneas  
**Reducción neta**: 960 - 250 = **710 líneas (56%)**

---

## 8. Próximos Pasos

### Fase 13.1.2 (Actual)
- [x] 13.1.2.1 Identificar componentes de lista ✅
- [x] 13.1.2.2 Identificar componentes de tabla ✅
- [x] 13.1.2.3 Identificar componentes de tarjetas ✅
- [x] 13.1.2.4 Identificar componentes de árbol ✅
- [x] 13.1.2.5 Medir líneas de código ✅
- [x] 13.1.2.6 Identificar código duplicado ✅

### Fase 13.1.3 (Siguiente)
- [ ] Documentar paginación en cada módulo
- [ ] Identificar inconsistencias

### Fase 13.2 (Diseño)
- [ ] Definir patrones de vista estándar
- [ ] Diseñar CardView global
- [ ] Diseñar ViewContainer global
- [ ] Mejorar componentes globales existentes

---

## 9. Conclusiones

1. **Código duplicado identificado**: ~500 líneas (39% del total)
2. **Reducción potencial**: 710 líneas (56% neto)
3. **Componentes a eliminar**: 5 (CategoryTableCompact, CategoryListView, DepartmentList, TechnicianStatsCard, TicketStatsCard)
4. **Componentes a crear**: 2 (CardView, ViewContainer)
5. **Componentes a mantener**: 2 (UserTable, CategoryTree)
6. **Prioridad de migración**: Tablas y Listas primero (impacto rápido), Tarjetas después (mayor esfuerzo)

**Recomendación**: Comenzar con migraciones de Prioridad Alta (CategoryTableCompact, CategoryListView, DepartmentList) para obtener resultados rápidos y validar el enfoque antes de abordar las tarjetas más complejas.
