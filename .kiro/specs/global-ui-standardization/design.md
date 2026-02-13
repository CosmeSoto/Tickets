# Diseño Técnico: Estandarización Global de UI

## 1. Arquitectura de Hooks

### 1.1 useFilters<T>

**Propósito**: Hook genérico para filtrar cualquier lista de datos

**Firma TypeScript**:
```typescript
interface FilterConfig<T> {
  id: string
  type: 'search' | 'select' | 'multiselect' | 'daterange' | 'checkbox' | 'range'
  label: string
  searchFields?: (keyof T)[]  // Para type: 'search'
  options?: Array<{ value: string; label: string }>  // Para type: 'select'
  field?: keyof T  // Campo a filtrar
  defaultValue?: any
  placeholder?: string
}

interface UseFiltersReturn<T> {
  filteredData: T[]
  filters: Record<string, any>
  setFilter: (id: string, value: any) => void
  clearFilters: () => void
  clearFilter: (id: string) => void
  activeFiltersCount: number
}

function useFilters<T>(
  data: T[],
  config: FilterConfig<T>[],
  options?: {
    debounceMs?: number
    persistInUrl?: boolean
    onFilterChange?: (filters: Record<string, any>) => void
  }
): UseFiltersReturn<T>
```

**Ejemplo de Uso**:
```typescript
const filterConfig: FilterConfig<Technician>[] = [
  {
    id: 'search',
    type: 'search',
    label: 'Buscar',
    searchFields: ['name', 'email', 'phone'],
    placeholder: 'Buscar por nombre, email o teléfono...'
  },
  {
    id: 'department',
    type: 'select',
    label: 'Departamento',
    field: 'departmentId',
    options: departments.map(d => ({ value: d.id, label: d.name })),
    defaultValue: 'all'
  },
  {
    id: 'status',
    type: 'select',
    label: 'Estado',
    field: 'isActive',
    options: [
      { value: 'all', label: 'Todos' },
      { value: 'true', label: 'Activos' },
      { value: 'false', label: 'Inactivos' }
    ]
  }
]

const { filteredData, filters, setFilter, clearFilters } = useFilters(
  technicians,
  filterConfig,
  { debounceMs: 300 }
)
```

**Implementación Interna**:
- Usa `useMemo` para cálculos eficientes
- Usa `useDebounce` para búsqueda
- Usa `useSearchParams` si `persistInUrl: true`
- Aplica filtros en cadena (AND logic)

### 1.2 useViewMode

**Propósito**: Manejar cambio entre vistas y persistir preferencia

**Firma TypeScript**:
```typescript
type ViewMode = 'cards' | 'list' | 'table'

interface UseViewModeReturn {
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  availableModes: ViewMode[]
}

function useViewMode(
  defaultMode: ViewMode = 'list',
  options?: {
    storageKey?: string
    availableModes?: ViewMode[]
    responsive?: boolean  // Auto-switch en mobile
  }
): UseViewModeReturn
```

**Ejemplo de Uso**:
```typescript
const { viewMode, setViewMode } = useViewMode('cards', {
  storageKey: 'technicians-view',
  availableModes: ['cards', 'list'],
  responsive: true  // En mobile siempre 'list'
})
```

### 1.3 usePagination<T>

**Propósito**: Paginar datos con soporte cliente y servidor

**Firma TypeScript**:
```typescript
interface UsePaginationReturn<T> {
  paginatedData: T[]
  currentPage: number
  totalPages: number
  itemsPerPage: number
  totalItems: number
  goToPage: (page: number) => void
  nextPage: () => void
  prevPage: () => void
  setItemsPerPage: (count: number) => void
  hasNextPage: boolean
  hasPrevPage: boolean
}

function usePagination<T>(
  data: T[],
  options?: {
    initialPage?: number
    initialItemsPerPage?: number
    persistInUrl?: boolean
  }
): UsePaginationReturn<T>
```

### 1.4 useModuleData<T>

**Propósito**: Hook genérico para cargar y gestionar datos de módulo

**Firma TypeScript**:
```typescript
interface UseModuleDataReturn<T> {
  data: T[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  create: (item: Partial<T>) => Promise<{ success: boolean; data?: T; error?: string }>
  update: (id: string, item: Partial<T>) => Promise<{ success: boolean; data?: T; error?: string }>
  delete: (id: string) => Promise<{ success: boolean; error?: string }>
}

function useModuleData<T>(
  endpoint: string,
  options?: {
    autoLoad?: boolean
    onSuccess?: (data: T[]) => void
    onError?: (error: string) => void
  }
): UseModuleDataReturn<T>
```

## 2. Arquitectura de Componentes

### 2.1 FilterBar

**Propósito**: Barra de filtros reutilizable con búsqueda y filtros configurables

**Props**:
```typescript
interface FilterBarProps<T> {
  config: FilterConfig<T>[]
  filters: Record<string, any>
  onFilterChange: (id: string, value: any) => void
  onClearFilters: () => void
  loading?: boolean
  onRefresh?: () => void
  stats?: Array<{
    label: string
    value: number | string
    color?: string
    icon?: React.ReactNode
  }>
}
```

**Estructura**:
```tsx
<Card>
  <CardContent>
    <div className="space-y-4">
      {/* Fila de filtros */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Búsqueda */}
        <SearchInput {...searchConfig} />
        
        {/* Filtros select */}
        {selectFilters.map(filter => (
          <SelectFilter key={filter.id} {...filter} />
        ))}
        
        {/* Botones de acción */}
        <Button onClick={onClearFilters}>Limpiar</Button>
        <Button onClick={onRefresh}>Actualizar</Button>
      </div>
      
      {/* Estadísticas */}
      {stats && <StatsBar stats={stats} />}
    </div>
  </CardContent>
</Card>
```

### 2.2 ViewToggle

**Propósito**: Toggle para cambiar entre vistas

**Props**:
```typescript
interface ViewToggleProps {
  mode: ViewMode
  availableModes: ViewMode[]
  onChange: (mode: ViewMode) => void
  labels?: Record<ViewMode, string>
  icons?: Record<ViewMode, React.ReactNode>
}
```

**Estructura**:
```tsx
<div className="flex border rounded-md overflow-hidden">
  {availableModes.map(mode => (
    <Button
      key={mode}
      variant={mode === currentMode ? 'default' : 'ghost'}
      onClick={() => onChange(mode)}
    >
      {icons[mode]}
      {labels[mode]}
    </Button>
  ))}
</div>
```

### 2.3 CardGrid

**Propósito**: Grid responsive de tarjetas

**Props**:
```typescript
interface CardGridProps<T> {
  data: T[]
  renderCard: (item: T) => React.ReactNode
  columns?: {
    sm?: number
    md?: number
    lg?: number
    xl?: number
  }
  gap?: number
  emptyState?: React.ReactNode
}
```

**Estructura**:
```tsx
<div className={cn(
  "grid gap-6",
  `grid-cols-1 md:grid-cols-${columns.md} lg:grid-cols-${columns.lg}`
)}>
  {data.length === 0 ? (
    emptyState || <EmptyState />
  ) : (
    data.map(item => renderCard(item))
  )}
</div>
```

### 2.4 ListView

**Propósito**: Lista compacta con hover

**Props**:
```typescript
interface ListViewProps<T> {
  data: T[]
  renderItem: (item: T) => React.ReactNode
  onItemClick?: (item: T) => void
  emptyState?: React.ReactNode
}
```

**Estructura**:
```tsx
<div className="space-y-2">
  {data.map(item => (
    <div
      key={item.id}
      className="p-3 border rounded-lg hover:bg-muted cursor-pointer transition-colors"
      onClick={() => onItemClick?.(item)}
    >
      {renderItem(item)}
    </div>
  ))}
</div>
```

### 2.5 DataTable

**Propósito**: Tabla con ordenamiento y selección

**Props**:
```typescript
interface Column<T> {
  id: string
  header: string
  accessor: keyof T | ((item: T) => React.ReactNode)
  sortable?: boolean
  width?: string
  align?: 'left' | 'center' | 'right'
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  onRowClick?: (item: T) => void
  selectable?: boolean
  onSelectionChange?: (selected: T[]) => void
  sortable?: boolean
  emptyState?: React.ReactNode
}
```

### 2.6 TreeView (Para Categorías y Datos Jerárquicos)

**Propósito**: Componente de árbol jerárquico con expand/collapse

**Props**:
```typescript
interface TreeNode<T> {
  id: string
  data: T
  children?: TreeNode<T>[]
  level: number
  isExpanded?: boolean
  isLeaf?: boolean
}

interface TreeViewProps<T> {
  data: TreeNode<T>[]
  renderNode: (node: TreeNode<T>, options: {
    isExpanded: boolean
    hasChildren: boolean
    level: number
    onToggle: () => void
  }) => React.ReactNode
  onNodeClick?: (node: TreeNode<T>) => void
  onNodeExpand?: (node: TreeNode<T>) => void
  onNodeCollapse?: (node: TreeNode<T>) => void
  defaultExpanded?: boolean
  maxDepth?: number
  searchTerm?: string
  highlightMatches?: boolean
  persistState?: boolean
  storageKey?: string
  virtualized?: boolean
  indentSize?: number
  showLines?: boolean
  icons?: {
    expanded: React.ReactNode
    collapsed: React.ReactNode
    leaf: React.ReactNode
  }
}
```

**Estructura**:
```tsx
<div className="tree-view">
  {nodes.map(node => (
    <TreeNode
      key={node.id}
      node={node}
      level={0}
      isExpanded={expandedNodes.has(node.id)}
      onToggle={() => toggleNode(node.id)}
      renderNode={renderNode}
      indentSize={indentSize}
      showLines={showLines}
    />
  ))}
</div>
```

**TreeNode Component**:
```tsx
function TreeNode<T>({ node, level, isExpanded, onToggle, renderNode, indentSize, showLines }: TreeNodeProps<T>) {
  const hasChildren = node.children && node.children.length > 0
  const indent = level * indentSize
  
  return (
    <div className="tree-node">
      {/* Líneas de conexión (opcional) */}
      {showLines && level > 0 && (
        <div className="tree-lines" style={{ left: indent - indentSize }} />
      )}
      
      {/* Contenido del nodo */}
      <div 
        className="tree-node-content"
        style={{ paddingLeft: indent }}
      >
        {/* Botón de expand/collapse */}
        {hasChildren && (
          <button
            onClick={onToggle}
            className="tree-toggle"
            aria-label={isExpanded ? 'Colapsar' : 'Expandir'}
          >
            {isExpanded ? <ChevronDown /> : <ChevronRight />}
          </button>
        )}
        
        {/* Contenido personalizado */}
        {renderNode(node, { isExpanded, hasChildren, level, onToggle })}
      </div>
      
      {/* Hijos (si está expandido) */}
      {hasChildren && isExpanded && (
        <div className="tree-children">
          {node.children!.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              isExpanded={expandedNodes.has(child.id)}
              onToggle={() => toggleNode(child.id)}
              renderNode={renderNode}
              indentSize={indentSize}
              showLines={showLines}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

**Hook useTreeState**:
```typescript
interface UseTreeStateReturn {
  expandedNodes: Set<string>
  toggleNode: (nodeId: string) => void
  expandNode: (nodeId: string) => void
  collapseNode: (nodeId: string) => void
  expandAll: () => void
  collapseAll: () => void
  expandToNode: (nodeId: string) => void
  isExpanded: (nodeId: string) => boolean
}

function useTreeState(
  initialExpanded?: string[],
  options?: {
    persistState?: boolean
    storageKey?: string
  }
): UseTreeStateReturn
```

**Características Especiales**:
- **Búsqueda con auto-expand**: Cuando hay un término de búsqueda, expande automáticamente los nodos que contienen coincidencias
- **Virtualización**: Para árboles grandes (100+ nodos), usa virtualización para renderizar solo nodos visibles
- **Persistencia**: Guarda el estado de expansión en localStorage
- **Animaciones**: Transiciones suaves para expand/collapse
- **Accesibilidad**: Navegación completa con teclado (Arrow keys, Enter, Space)
- **Indicadores visuales**: Colores, iconos y líneas para mostrar jerarquía

**Ejemplo de Uso (Categorías)**:
```tsx
<TreeView
  data={categoryTree}
  renderNode={(node, { isExpanded, hasChildren, level, onToggle }) => (
    <div className="flex items-center space-x-2">
      {/* Icono según nivel */}
      {level === 0 && <FolderTree className="h-5 w-5 text-blue-600" />}
      {level === 1 && <Folder className="h-5 w-5 text-green-600" />}
      {level === 2 && <FileText className="h-5 w-5 text-purple-600" />}
      {level === 3 && <File className="h-5 w-5 text-orange-600" />}
      
      {/* Nombre */}
      <span className="font-medium">{node.data.name}</span>
      
      {/* Badge de nivel */}
      <Badge variant="outline">L{level + 1}</Badge>
      
      {/* Contador de hijos */}
      {hasChildren && (
        <Badge variant="secondary">
          {node.children!.length} {node.children!.length === 1 ? 'hijo' : 'hijos'}
        </Badge>
      )}
      
      {/* Estadísticas */}
      <span className="text-sm text-muted-foreground">
        {node.data._count.tickets} tickets
      </span>
      
      {/* Acciones */}
      <div className="ml-auto flex space-x-2">
        <Button size="sm" variant="ghost" onClick={() => onEdit(node.data)}>
          <Edit className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onDelete(node.data)}>
          <Trash className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )}
  onNodeClick={(node) => console.log('Clicked:', node.data.name)}
  searchTerm={searchTerm}
  highlightMatches={true}
  persistState={true}
  storageKey="categories-tree-state"
  indentSize={24}
  showLines={true}
  icons={{
    expanded: <ChevronDown className="h-4 w-4" />,
    collapsed: <ChevronRight className="h-4 w-4" />,
    leaf: <Circle className="h-2 w-2" />
  }}
/>
```

### 2.7 ActionBar

**Propósito**: Barra de acciones consistente

**Props**:
```typescript
interface ActionBarProps {
  primaryAction?: {
    label: string
    icon?: React.ReactNode
    onClick: () => void
  }
  secondaryActions?: Array<{
    label: string
    icon?: React.ReactNode
    onClick: () => void
    variant?: 'default' | 'outline' | 'ghost'
  }>
  bulkActions?: Array<{
    label: string
    icon?: React.ReactNode
    onClick: (selected: any[]) => void
    disabled?: boolean
  }>
  selectedCount?: number
}
```

### 2.8 StatsBar

**Propósito**: Barra de estadísticas con badges

**Props**:
```typescript
interface Stat {
  label: string
  value: number | string
  color?: 'blue' | 'green' | 'yellow' | 'purple' | 'orange' | 'red'
  icon?: React.ReactNode
  trend?: {
    value: number
    direction: 'up' | 'down'
  }
  onClick?: () => void
}

interface StatsBarProps {
  stats: Stat[]
  columns?: number
}
```

### 2.9 Pagination

**Propósito**: Paginación consistente

**Props**:
```typescript
interface PaginationProps {
  currentPage: number
  totalPages: number
  itemsPerPage: number
  totalItems: number
  onPageChange: (page: number) => void
  onItemsPerPageChange: (count: number) => void
  showItemsPerPage?: boolean
  showInfo?: boolean
}
```

## 3. Sistema de Tipos

### 3.1 Tipos Comunes

```typescript
// types/common.ts
export interface BaseEntity {
  id: string
  createdAt: string
  updatedAt: string
}

export interface WithDepartment {
  departmentId?: string
  department?: {
    id: string
    name: string
    color: string
  }
}

export interface WithStatus {
  isActive: boolean
}

export interface WithCounts {
  _count?: Record<string, number>
}

// types/filters.ts
export type FilterType = 
  | 'search' 
  | 'select' 
  | 'multiselect' 
  | 'daterange' 
  | 'checkbox' 
  | 'range'

export interface BaseFilter {
  id: string
  type: FilterType
  label: string
  defaultValue?: any
}

export interface SearchFilter extends BaseFilter {
  type: 'search'
  searchFields: string[]
  placeholder?: string
  debounceMs?: number
}

export interface SelectFilter extends BaseFilter {
  type: 'select'
  field: string
  options: Array<{ value: string; label: string }>
}

// types/views.ts
export type ViewMode = 'cards' | 'list' | 'table'

export interface ViewConfig {
  mode: ViewMode
  label: string
  icon: React.ReactNode
  available: boolean
}
```

## 4. Patrones de Implementación

### 4.1 Patrón: Módulo Estandarizado

```typescript
// src/app/admin/[module]/page.tsx
'use client'

import { ModuleLayout } from '@/components/common/layouts/ModuleLayout'
import { useModuleData } from '@/hooks/useModuleData'
import { useFilters } from '@/hooks/useFilters'
import { useViewMode } from '@/hooks/useViewMode'
import { usePagination } from '@/hooks/usePagination'
import { ModuleCard } from '@/components/[module]/ModuleCard'
import { ModuleListItem } from '@/components/[module]/ModuleListItem'
import { ModuleTable } from '@/components/[module]/ModuleTable'

export default function ModulePage() {
  // 1. Cargar datos
  const { data, loading, error, reload } = useModuleData<Module>('/api/modules')
  
  // 2. Configurar filtros
  const filterConfig = useMemo(() => [
    {
      id: 'search',
      type: 'search' as const,
      label: 'Buscar',
      searchFields: ['name', 'email'] as (keyof Module)[],
      placeholder: 'Buscar...'
    },
    {
      id: 'status',
      type: 'select' as const,
      label: 'Estado',
      field: 'isActive' as keyof Module,
      options: [
        { value: 'all', label: 'Todos' },
        { value: 'true', label: 'Activos' },
        { value: 'false', label: 'Inactivos' }
      ]
    }
  ], [])
  
  // 3. Aplicar filtros
  const { filteredData, filters, setFilter, clearFilters } = useFilters(
    data,
    filterConfig
  )
  
  // 4. Aplicar paginación
  const pagination = usePagination(filteredData, { initialItemsPerPage: 12 })
  
  // 5. Manejar vista
  const { viewMode, setViewMode } = useViewMode('cards')
  
  // 6. Calcular estadísticas
  const stats = useMemo(() => [
    { label: 'Total', value: data.length, color: 'blue' as const },
    { label: 'Activos', value: data.filter(d => d.isActive).length, color: 'green' as const }
  ], [data])
  
  return (
    <ModuleLayout
      title="Módulo"
      subtitle="Gestión de módulo"
      loading={loading}
      error={error}
      onRetry={reload}
      primaryAction={{
        label: 'Crear',
        onClick: () => setShowCreate(true)
      }}
    >
      <FilterBar
        config={filterConfig}
        filters={filters}
        onFilterChange={setFilter}
        onClearFilters={clearFilters}
        onRefresh={reload}
        stats={stats}
      />
      
      <ViewToggle
        mode={viewMode}
        availableModes={['cards', 'list', 'table']}
        onChange={setViewMode}
      />
      
      {viewMode === 'cards' && (
        <CardGrid
          data={pagination.paginatedData}
          renderCard={(item) => <ModuleCard item={item} />}
        />
      )}
      
      {viewMode === 'list' && (
        <ListView
          data={pagination.paginatedData}
          renderItem={(item) => <ModuleListItem item={item} />}
        />
      )}
      
      {viewMode === 'table' && (
        <ModuleTable data={pagination.paginatedData} />
      )}
      
      <Pagination {...pagination} />
    </ModuleLayout>
  )
}
```

### 4.2 Patrón: Componente de Tarjeta

```typescript
// src/components/[module]/ModuleCard.tsx
interface ModuleCardProps {
  item: Module
  onEdit?: (item: Module) => void
  onDelete?: (item: Module) => void
  onView?: (item: Module) => void
}

export function ModuleCard({ item, onEdit, onDelete, onView }: ModuleCardProps) {
  return (
    <Card className="hover:shadow-md transition-all cursor-pointer" onClick={() => onView?.(item)}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Avatar />
            <div>
              <h3 className="font-semibold">{item.name}</h3>
              <Badge>{item.status}</Badge>
            </div>
          </div>
          <StatusIndicator active={item.isActive} />
        </div>
        
        {/* Content */}
        <div className="space-y-2 mb-3">
          <InfoRow icon={<Mail />} text={item.email} />
          {item.department && (
            <InfoRow icon={<Building />} text={item.department.name} />
          )}
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <StatBox label="Stat 1" value={item.stat1} color="blue" />
          <StatBox label="Stat 2" value={item.stat2} color="green" />
          <StatBox label="Stat 3" value={item.stat3} color="purple" />
        </div>
        
        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t">
          <Badge variant={item.isActive ? 'default' : 'secondary'}>
            {item.isActive ? 'Activo' : 'Inactivo'}
          </Badge>
          <div className="flex space-x-2">
            <Button size="sm" onClick={(e) => { e.stopPropagation(); onEdit?.(item) }}>
              Editar
            </Button>
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onDelete?.(item) }}>
              Eliminar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

## 5. Correctness Properties

### 5.1 Propiedades de Filtros

**Property 1.1: Filtros Idempotentes**
```typescript
// Aplicar el mismo filtro dos veces debe dar el mismo resultado
∀ data, filter: applyFilter(applyFilter(data, filter), filter) === applyFilter(data, filter)
```

**Property 1.2: Filtros Conmutativos**
```typescript
// El orden de aplicación de filtros no debe afectar el resultado
∀ data, f1, f2: applyFilters(data, [f1, f2]) === applyFilters(data, [f2, f1])
```

**Property 1.3: Búsqueda Case-Insensitive**
```typescript
// La búsqueda debe ser insensible a mayúsculas/minúsculas
∀ data, query: search(data, query.toLowerCase()) === search(data, query.toUpperCase())
```

### 5.2 Propiedades de Paginación

**Property 2.1: Conservación de Datos**
```typescript
// La suma de todas las páginas debe ser igual a los datos originales
∀ data, itemsPerPage: 
  flatten(getAllPages(data, itemsPerPage)) === data
```

**Property 2.2: Límites de Página**
```typescript
// Cada página debe tener exactamente itemsPerPage items (excepto la última)
∀ data, itemsPerPage, page:
  page < totalPages - 1 → getPage(data, page, itemsPerPage).length === itemsPerPage
```

### 5.3 Propiedades de Vistas

**Property 3.1: Persistencia de Vista**
```typescript
// La vista seleccionada debe persistir entre recargas
∀ mode: setViewMode(mode) → reload() → getViewMode() === mode
```

**Property 3.2: Responsive Auto-Switch**
```typescript
// En mobile, siempre debe usar vista 'list'
isMobile() → getViewMode() === 'list'
```

## 6. Testing Strategy

### 6.1 Unit Tests (Hooks)

```typescript
describe('useFilters', () => {
  it('should filter by search term', () => {
    const { result } = renderHook(() => useFilters(mockData, searchConfig))
    act(() => result.current.setFilter('search', 'test'))
    expect(result.current.filteredData).toHaveLength(expectedLength)
  })
  
  it('should apply multiple filters', () => {
    const { result } = renderHook(() => useFilters(mockData, multiConfig))
    act(() => {
      result.current.setFilter('search', 'test')
      result.current.setFilter('status', 'active')
    })
    expect(result.current.filteredData).toMatchSnapshot()
  })
  
  it('should clear all filters', () => {
    const { result } = renderHook(() => useFilters(mockData, config))
    act(() => result.current.clearFilters())
    expect(result.current.filteredData).toEqual(mockData)
  })
})
```

### 6.2 Integration Tests (Components)

```typescript
describe('FilterBar', () => {
  it('should render all filter controls', () => {
    render(<FilterBar config={mockConfig} {...props} />)
    expect(screen.getByPlaceholderText('Buscar...')).toBeInTheDocument()
    expect(screen.getByLabelText('Estado')).toBeInTheDocument()
  })
  
  it('should call onFilterChange when filter changes', () => {
    const onFilterChange = jest.fn()
    render(<FilterBar onFilterChange={onFilterChange} {...props} />)
    fireEvent.change(screen.getByPlaceholderText('Buscar...'), { target: { value: 'test' } })
    expect(onFilterChange).toHaveBeenCalledWith('search', 'test')
  })
})
```

### 6.3 E2E Tests (Playwright)

```typescript
test('should filter and paginate technicians', async ({ page }) => {
  await page.goto('/admin/technicians')
  
  // Aplicar filtro de búsqueda
  await page.fill('[placeholder="Buscar..."]', 'John')
  await page.waitForTimeout(500) // Debounce
  
  // Verificar resultados filtrados
  const cards = await page.locator('[data-testid="technician-card"]').count()
  expect(cards).toBeGreaterThan(0)
  
  // Cambiar vista
  await page.click('[data-testid="view-toggle-list"]')
  expect(await page.locator('[data-testid="list-view"]').isVisible()).toBe(true)
  
  // Navegar a página 2
  await page.click('[data-testid="pagination-next"]')
  expect(await page.url()).toContain('page=2')
})
```

## 7. Performance Optimizations

### 7.1 Memoization

```typescript
// Memoizar cálculos costosos
const filteredData = useMemo(() => {
  return applyFilters(data, filters)
}, [data, filters])

// Memoizar componentes pesados
const MemoizedCard = memo(ModuleCard, (prev, next) => {
  return prev.item.id === next.item.id && 
         prev.item.updatedAt === next.item.updatedAt
})
```

### 7.2 Virtualization

```typescript
// Para listas muy largas (>1000 items)
import { useVirtualizer } from '@tanstack/react-virtual'

function VirtualizedList({ data }) {
  const parentRef = useRef()
  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100
  })
  
  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map(virtualRow => (
          <div key={virtualRow.index} style={{ height: `${virtualRow.size}px` }}>
            <ModuleCard item={data[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  )
}
```

### 7.3 Debouncing

```typescript
// Debounce automático en búsqueda
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)
  
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])
  
  return debouncedValue
}
```

## 8. Accessibility Guidelines

### 8.1 Keyboard Navigation

- **Tab**: Navegar entre controles
- **Enter/Space**: Activar botones
- **Escape**: Cerrar diálogos
- **Arrow Keys**: Navegar en listas/tablas

### 8.2 ARIA Labels

```tsx
<button
  aria-label="Filtrar por departamento"
  aria-expanded={isOpen}
  aria-controls="department-menu"
>
  Departamento
</button>

<div
  role="region"
  aria-label="Resultados filtrados"
  aria-live="polite"
>
  {filteredData.length} resultados
</div>
```

### 8.3 Focus Management

```typescript
// Trap focus en diálogos
useFocusTrap(dialogRef, isOpen)

// Restaurar focus al cerrar
const previousFocus = useRef<HTMLElement>()
useEffect(() => {
  if (isOpen) {
    previousFocus.current = document.activeElement as HTMLElement
  } else {
    previousFocus.current?.focus()
  }
}, [isOpen])
```

## 9. Migration Checklist

Para cada módulo a migrar:

- [ ] Identificar datos y tipos
- [ ] Configurar filtros necesarios
- [ ] Crear componentes Card/ListItem/Table
- [ ] Implementar diálogos (Create/Edit/Delete)
- [ ] Migrar lógica de negocio a hooks
- [ ] Actualizar tests
- [ ] Verificar accesibilidad
- [ ] Probar en diferentes viewports
- [ ] Code review
- [ ] Deploy y monitoreo

## 10. Documentation

Cada componente debe incluir:

```typescript
/**
 * FilterBar - Barra de filtros reutilizable
 * 
 * @example
 * ```tsx
 * <FilterBar
 *   config={filterConfig}
 *   filters={filters}
 *   onFilterChange={setFilter}
 *   onClearFilters={clearFilters}
 * />
 * ```
 * 
 * @param config - Configuración de filtros
 * @param filters - Estado actual de filtros
 * @param onFilterChange - Callback cuando cambia un filtro
 * @param onClearFilters - Callback para limpiar todos los filtros
 */
export function FilterBar({ ... }: FilterBarProps) { ... }
```
