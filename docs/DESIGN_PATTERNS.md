# Patrones de Diseño - Sistema de Estandarización de UI

## Tabla de Contenidos

1. [Introducción](#introducción)
2. [Patrones de Arquitectura](#patrones-de-arquitectura)
3. [Patrones de Componentes](#patrones-de-componentes)
4. [Patrones de Hooks](#patrones-de-hooks)
5. [Patrones de Estado](#patrones-de-estado)
6. [Patrones de Renderizado](#patrones-de-renderizado)
7. [Patrones de Optimización](#patrones-de-optimización)
8. [Anti-Patrones](#anti-patrones)

## Introducción

Este documento describe los patrones de diseño utilizados en el sistema de estandarización de UI. Estos patrones aseguran consistencia, mantenibilidad y escalabilidad.

### Principios SOLID

- **S**ingle Responsibility: Cada componente tiene una responsabilidad única
- **O**pen/Closed: Abierto a extensión, cerrado a modificación
- **L**iskov Substitution: Los componentes son intercambiables
- **I**nterface Segregation: Interfaces específicas, no genéricas
- **D**ependency Inversion: Depende de abstracciones, no de implementaciones

## Patrones de Arquitectura

### 1. Patrón de Composición

**Problema:** Componentes monolíticos difíciles de mantener

**Solución:** Componer componentes pequeños y reutilizables

**Ejemplo:**
```typescript
// ❌ Malo - Componente monolítico
function TechniciansPage() {
  return (
    <div>
      {/* 500 líneas de código */}
      {/* Filtros, vistas, paginación, todo mezclado */}
    </div>
  )
}

// ✅ Bueno - Composición de componentes
function TechniciansPage() {
  return (
    <ModuleLayout {...layoutProps}>
      <FilterBar {...filterProps} />
      <ViewToggle {...viewProps} />
      <CardView {...cardProps} />
      <Pagination {...paginationProps} />
    </ModuleLayout>
  )
}
```

**Beneficios:**
- Componentes más pequeños y manejables
- Reutilización de código
- Fácil testing
- Mejor separación de responsabilidades

### 2. Patrón de Contenedor/Presentación

**Problema:** Lógica de negocio mezclada con UI

**Solución:** Separar componentes de lógica (contenedores) de componentes de UI (presentación)

**Ejemplo:**
```typescript
// ✅ Contenedor - Maneja lógica
function TechniciansContainer() {
  const { data, loading, error } = useModuleData<Technician>('/api/technicians')
  const { filteredData, filters, setFilter } = useFilters(data, filterConfig)
  const pagination = usePagination(filteredData)
  
  return (
    <TechniciansPresentation
      data={pagination.paginatedData}
      filters={filters}
      onFilterChange={setFilter}
      pagination={pagination}
    />
  )
}

// ✅ Presentación - Solo UI
function TechniciansPresentation({ data, filters, onFilterChange, pagination }) {
  return (
    <div>
      <FilterBar filters={filters} onFilterChange={onFilterChange} />
      <CardView data={data} pagination={pagination} />
    </div>
  )
}
```

**Beneficios:**
- Lógica separada de UI
- Componentes de presentación reutilizables
- Fácil testing de lógica
- Mejor organización del código

### 3. Patrón de Render Props

**Problema:** Necesidad de personalizar renderizado sin perder funcionalidad

**Solución:** Pasar funciones de renderizado como props

**Ejemplo:**
```typescript
// ✅ Componente con render props
interface ListViewProps<T> {
  data: T[]
  renderItem: (item: T) => React.ReactNode
  renderEmpty?: () => React.ReactNode
}

function ListView<T>({ data, renderItem, renderEmpty }: ListViewProps<T>) {
  if (data.length === 0) {
    return renderEmpty ? renderEmpty() : <DefaultEmptyState />
  }
  
  return (
    <div className="space-y-2">
      {data.map((item, index) => (
        <div key={index}>{renderItem(item)}</div>
      ))}
    </div>
  )
}

// Uso
<ListView
  data={technicians}
  renderItem={(tech) => (
    <div>
      <h3>{tech.name}</h3>
      <p>{tech.email}</p>
    </div>
  )}
  renderEmpty={() => <CustomEmptyState />}
/>
```

**Beneficios:**
- Máxima flexibilidad
- Reutilización de lógica
- Personalización sin modificar componente
- Type-safe con TypeScript

## Patrones de Componentes

### 1. Patrón de Componente Controlado

**Problema:** Estado inconsistente entre padre e hijo

**Solución:** El padre controla completamente el estado del hijo

**Ejemplo:**
```typescript
// ✅ Componente controlado
interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

function SearchInput({ value, onChange, placeholder }: SearchInputProps) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  )
}

// Uso
const [search, setSearch] = useState('')
<SearchInput value={search} onChange={setSearch} />
```

**Beneficios:**
- Estado predecible
- Fácil sincronización
- Mejor control del flujo de datos
- Fácil debugging

### 2. Patrón de Compound Components

**Problema:** Componentes con muchas props difíciles de configurar

**Solución:** Componentes que trabajan juntos compartiendo estado implícito

**Ejemplo:**
```typescript
// ✅ Compound components
function ViewContainer({ children, header, pagination }) {
  return (
    <Card>
      <CardContent className="space-y-4">
        {header && <ViewHeader {...header} />}
        <div className="border-b" />
        {children}
        {pagination && (
          <>
            <div className="border-t pt-4" />
            <Pagination {...pagination} />
          </>
        )}
      </CardContent>
    </Card>
  )
}

// Uso
<ViewContainer
  header={{ title: 'Vista de Lista', description: 'Información compacta' }}
  pagination={pagination}
>
  <ListView data={data} renderItem={renderItem} />
</ViewContainer>
```

**Beneficios:**
- API más limpia
- Mejor composición
- Menos props
- Más flexible

### 3. Patrón de Higher-Order Component (HOC)

**Problema:** Lógica repetida en múltiples componentes

**Solución:** Función que toma un componente y retorna un componente mejorado

**Ejemplo:**
```typescript
// ✅ HOC para agregar loading state
function withLoading<P extends object>(
  Component: React.ComponentType<P>
) {
  return function WithLoadingComponent(
    props: P & { loading?: boolean; error?: string | null }
  ) {
    const { loading, error, ...rest } = props
    
    if (loading) return <LoadingSpinner />
    if (error) return <ErrorMessage error={error} />
    
    return <Component {...(rest as P)} />
  }
}

// Uso
const TechniciansListWithLoading = withLoading(TechniciansList)

<TechniciansListWithLoading
  data={data}
  loading={loading}
  error={error}
/>
```

**Beneficios:**
- Reutilización de lógica
- Separación de responsabilidades
- Composición de comportamientos
- Código DRY

## Patrones de Hooks

### 1. Patrón de Custom Hook

**Problema:** Lógica repetida en múltiples componentes

**Solución:** Extraer lógica a un hook personalizado

**Ejemplo:**
```typescript
// ✅ Custom hook
function useFilters<T>(
  data: T[],
  config: FilterConfig<T>[]
) {
  const [filters, setFilters] = useState<Record<string, any>>({})
  
  const filteredData = useMemo(() => {
    return data.filter(item => {
      return config.every(filter => {
        const value = filters[filter.id]
        if (!value || value === 'all') return true
        
        if (filter.type === 'search') {
          return filter.searchFields.some(field =>
            String(item[field]).toLowerCase().includes(value.toLowerCase())
          )
        }
        
        if (filter.type === 'select') {
          return String(item[filter.field]) === value
        }
        
        return true
      })
    })
  }, [data, filters, config])
  
  const setFilter = (id: string, value: any) => {
    setFilters(prev => ({ ...prev, [id]: value }))
  }
  
  const clearFilters = () => setFilters({})
  
  return { filteredData, filters, setFilter, clearFilters }
}

// Uso
const { filteredData, filters, setFilter, clearFilters } = useFilters(
  data,
  filterConfig
)
```

**Beneficios:**
- Lógica reutilizable
- Código más limpio
- Fácil testing
- Mejor organización

### 2. Patrón de Hook Composition

**Problema:** Hooks complejos difíciles de mantener

**Solución:** Componer hooks pequeños en hooks más grandes

**Ejemplo:**
```typescript
// ✅ Hooks pequeños
function useDataLoading<T>(endpoint: string) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const reload = async () => {
    // lógica de carga
  }
  
  return { data, loading, error, reload }
}

function useDataFiltering<T>(data: T[], config: FilterConfig<T>[]) {
  // lógica de filtrado
  return { filteredData, filters, setFilter, clearFilters }
}

function useDataPagination<T>(data: T[]) {
  // lógica de paginación
  return { paginatedData, currentPage, totalPages, goToPage }
}

// ✅ Hook compuesto
function useModuleData<T>(endpoint: string, filterConfig: FilterConfig<T>[]) {
  const { data, loading, error, reload } = useDataLoading<T>(endpoint)
  const { filteredData, filters, setFilter, clearFilters } = useDataFiltering(data, filterConfig)
  const pagination = useDataPagination(filteredData)
  
  return {
    data,
    loading,
    error,
    reload,
    filteredData,
    filters,
    setFilter,
    clearFilters,
    pagination
  }
}
```

**Beneficios:**
- Hooks más pequeños y manejables
- Reutilización de lógica
- Fácil testing
- Mejor composición

### 3. Patrón de Hook con Cleanup

**Problema:** Memory leaks por efectos no limpiados

**Solución:** Siempre retornar función de cleanup en useEffect

**Ejemplo:**
```typescript
// ✅ Hook con cleanup
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)
    
    // Cleanup
    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])
  
  return debouncedValue
}

// Uso
const debouncedSearch = useDebounce(searchTerm, 300)
```

**Beneficios:**
- No memory leaks
- Mejor performance
- Código más robusto
- Previene bugs

## Patrones de Estado

### 1. Patrón de Estado Derivado

**Problema:** Estado duplicado y sincronización compleja

**Solución:** Derivar estado de otros estados con useMemo

**Ejemplo:**
```typescript
// ❌ Malo - Estado duplicado
const [data, setData] = useState([])
const [filteredData, setFilteredData] = useState([])
const [paginatedData, setPaginatedData] = useState([])

useEffect(() => {
  setFilteredData(applyFilters(data))
}, [data])

useEffect(() => {
  setPaginatedData(applyPagination(filteredData))
}, [filteredData])

// ✅ Bueno - Estado derivado
const [data, setData] = useState([])
const [filters, setFilters] = useState({})
const [currentPage, setCurrentPage] = useState(1)

const filteredData = useMemo(() => 
  applyFilters(data, filters),
  [data, filters]
)

const paginatedData = useMemo(() =>
  applyPagination(filteredData, currentPage),
  [filteredData, currentPage]
)
```

**Beneficios:**
- Menos estado
- No sincronización manual
- Más predecible
- Mejor performance

### 2. Patrón de Estado Inmutable

**Problema:** Mutaciones directas causan bugs

**Solución:** Siempre crear nuevos objetos/arrays

**Ejemplo:**
```typescript
// ❌ Malo - Mutación directa
const addItem = (item) => {
  data.push(item) // Mutación
  setData(data) // No re-renderiza
}

// ✅ Bueno - Inmutabilidad
const addItem = (item) => {
  setData([...data, item]) // Nuevo array
}

const updateItem = (id, updates) => {
  setData(data.map(item =>
    item.id === id ? { ...item, ...updates } : item
  ))
}

const deleteItem = (id) => {
  setData(data.filter(item => item.id !== id))
}
```

**Beneficios:**
- Re-renders correctos
- Menos bugs
- Mejor debugging
- Más predecible

## Patrones de Renderizado

### 1. Patrón de Renderizado Condicional

**Problema:** Renderizado condicional complejo y difícil de leer

**Solución:** Usar early returns y componentes separados

**Ejemplo:**
```typescript
// ❌ Malo - Anidación compleja
function TechniciansPage() {
  return (
    <div>
      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorMessage />
      ) : data.length === 0 ? (
        <EmptyState />
      ) : (
        <div>
          {viewMode === 'cards' ? (
            <CardView />
          ) : viewMode === 'list' ? (
            <ListView />
          ) : (
            <TableView />
          )}
        </div>
      )}
    </div>
  )
}

// ✅ Bueno - Early returns
function TechniciansPage() {
  if (loading) return <LoadingState />
  if (error) return <ErrorState error={error} onRetry={reload} />
  if (data.length === 0) return <EmptyState />
  
  return (
    <div>
      {viewMode === 'cards' && <CardView data={data} />}
      {viewMode === 'list' && <ListView data={data} />}
      {viewMode === 'table' && <TableView data={data} />}
    </div>
  )
}
```

**Beneficios:**
- Código más legible
- Menos anidación
- Fácil de mantener
- Mejor flujo de lectura

### 2. Patrón de Lista con Key

**Problema:** Re-renders innecesarios en listas

**Solución:** Usar keys estables y únicas

**Ejemplo:**
```typescript
// ❌ Malo - Index como key
{data.map((item, index) => (
  <Card key={index}>{item.name}</Card>
))}

// ❌ Malo - Key no estable
{data.map(item => (
  <Card key={Math.random()}>{item.name}</Card>
))}

// ✅ Bueno - ID como key
{data.map(item => (
  <Card key={item.id}>{item.name}</Card>
))}

// ✅ Bueno - Combinación de campos
{data.map(item => (
  <Card key={`${item.type}-${item.id}`}>{item.name}</Card>
))}
```

**Beneficios:**
- Mejor performance
- Re-renders correctos
- Animaciones suaves
- Estado preservado

## Patrones de Optimización

### 1. Patrón de Memoización

**Problema:** Cálculos costosos en cada render

**Solución:** Usar useMemo para cachear resultados

**Ejemplo:**
```typescript
// ❌ Malo - Cálculo en cada render
function TechniciansPage() {
  const stats = calculateStats(data) // Se ejecuta en cada render
  
  return <StatsBar stats={stats} />
}

// ✅ Bueno - Memoización
function TechniciansPage() {
  const stats = useMemo(() => 
    calculateStats(data),
    [data] // Solo recalcula si data cambia
  )
  
  return <StatsBar stats={stats} />
}
```

**Beneficios:**
- Mejor performance
- Menos cálculos
- Renders más rápidos
- Mejor UX

### 2. Patrón de Callback Memoizado

**Problema:** Funciones recreadas en cada render

**Solución:** Usar useCallback para cachear funciones

**Ejemplo:**
```typescript
// ❌ Malo - Función recreada
function TechniciansPage() {
  const handleEdit = (id) => {
    // lógica
  }
  
  return <TechnicianCard onEdit={handleEdit} /> // Nueva función cada vez
}

// ✅ Bueno - Callback memoizado
function TechniciansPage() {
  const handleEdit = useCallback((id) => {
    // lógica
  }, []) // Función estable
  
  return <TechnicianCard onEdit={handleEdit} />
}
```

**Beneficios:**
- Menos re-renders
- Mejor performance
- Props estables
- Componentes hijos optimizados

### 3. Patrón de Componente Memoizado

**Problema:** Componentes re-renderizan innecesariamente

**Solución:** Usar React.memo para prevenir re-renders

**Ejemplo:**
```typescript
// ❌ Malo - Re-render en cada cambio del padre
function TechnicianCard({ technician }) {
  return (
    <Card>
      <h3>{technician.name}</h3>
      <p>{technician.email}</p>
    </Card>
  )
}

// ✅ Bueno - Memoizado
const TechnicianCard = React.memo(function TechnicianCard({ technician }) {
  return (
    <Card>
      <h3>{technician.name}</h3>
      <p>{technician.email}</p>
    </Card>
  )
}, (prevProps, nextProps) => {
  // Solo re-renderiza si el técnico cambió
  return prevProps.technician.id === nextProps.technician.id &&
         prevProps.technician.updatedAt === nextProps.technician.updatedAt
})
```

**Beneficios:**
- Menos re-renders
- Mejor performance
- Renders más rápidos
- Mejor UX en listas grandes

### 4. Patrón de Lazy Loading

**Problema:** Bundle inicial muy grande

**Solución:** Cargar componentes bajo demanda

**Ejemplo:**
```typescript
// ✅ Lazy loading de componentes pesados
const ReportsCharts = lazy(() => import('@/components/reports/charts'))

function ReportsPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <ReportsCharts data={data} />
    </Suspense>
  )
}
```

**Beneficios:**
- Bundle más pequeño
- Carga más rápida
- Mejor performance inicial
- Mejor UX

## Anti-Patrones

### 1. Anti-Patrón: Prop Drilling

**Problema:** Pasar props a través de muchos niveles

**Solución:** Usar Context o composición

**Ejemplo:**
```typescript
// ❌ Malo - Prop drilling
function App() {
  const [user, setUser] = useState(null)
  return <Layout user={user} setUser={setUser} />
}

function Layout({ user, setUser }) {
  return <Sidebar user={user} setUser={setUser} />
}

function Sidebar({ user, setUser }) {
  return <UserMenu user={user} setUser={setUser} />
}

// ✅ Bueno - Context
const UserContext = createContext()

function App() {
  const [user, setUser] = useState(null)
  return (
    <UserContext.Provider value={{ user, setUser }}>
      <Layout />
    </UserContext.Provider>
  )
}

function UserMenu() {
  const { user, setUser } = useContext(UserContext)
  return <div>{user.name}</div>
}
```

### 2. Anti-Patrón: Mutación Directa

**Problema:** Mutar estado directamente

**Solución:** Siempre crear nuevos objetos

**Ejemplo:**
```typescript
// ❌ Malo - Mutación directa
const updateTechnician = (id, updates) => {
  const tech = data.find(t => t.id === id)
  tech.name = updates.name // Mutación
  setData(data) // No re-renderiza
}

// ✅ Bueno - Inmutabilidad
const updateTechnician = (id, updates) => {
  setData(data.map(tech =>
    tech.id === id ? { ...tech, ...updates } : tech
  ))
}
```

### 3. Anti-Patrón: useEffect Innecesario

**Problema:** Usar useEffect para estado derivado

**Solución:** Usar useMemo o cálculo directo

**Ejemplo:**
```typescript
// ❌ Malo - useEffect innecesario
const [data, setData] = useState([])
const [filteredData, setFilteredData] = useState([])

useEffect(() => {
  setFilteredData(data.filter(item => item.isActive))
}, [data])

// ✅ Bueno - useMemo
const [data, setData] = useState([])
const filteredData = useMemo(() =>
  data.filter(item => item.isActive),
  [data]
)
```

### 4. Anti-Patrón: Componentes Gigantes

**Problema:** Componentes con cientos de líneas

**Solución:** Dividir en componentes más pequeños

**Ejemplo:**
```typescript
// ❌ Malo - Componente gigante (500+ líneas)
function TechniciansPage() {
  // 500 líneas de código
  // Lógica, UI, todo mezclado
}

// ✅ Bueno - Componentes pequeños
function TechniciansPage() {
  return (
    <ModuleLayout>
      <TechniciansFilters />
      <TechniciansStats />
      <TechniciansView />
      <TechniciansPagination />
    </ModuleLayout>
  )
}
```

## Mejores Prácticas

### 1. Siempre Tipea con TypeScript

```typescript
// ✅ Bueno
interface TechnicianCardProps {
  technician: Technician
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

function TechnicianCard({ technician, onEdit, onDelete }: TechnicianCardProps) {
  // ...
}
```

### 2. Usa Nombres Descriptivos

```typescript
// ❌ Malo
const d = data.filter(x => x.a)

// ✅ Bueno
const activeTechnicians = technicians.filter(tech => tech.isActive)
```

### 3. Mantén Componentes Pequeños

```typescript
// Regla: < 200 líneas por componente
// Si es más grande, divide en componentes más pequeños
```

### 4. Documenta Código Complejo

```typescript
/**
 * Filtra técnicos por múltiples criterios
 * @param technicians - Lista de técnicos
 * @param filters - Filtros a aplicar
 * @returns Lista filtrada de técnicos
 */
function filterTechnicians(technicians: Technician[], filters: Filters) {
  // ...
}
```

## Recursos Adicionales

- [Guía de Componentes](./COMPONENT_GUIDE.md)
- [Guía de Migración](./MIGRATION_GUIDE.md)
- [Ejemplos de Código](./EXAMPLES.md)
- [README Principal](../README.md)
