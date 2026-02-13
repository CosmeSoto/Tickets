# Hooks Comunes - Sistema de Estandarización de UI

Hooks reutilizables para estandarizar la funcionalidad en todos los módulos del sistema.

## 📦 Hooks Disponibles

### 1. useFilters

Hook genérico para filtrar cualquier lista de datos con soporte para búsqueda, selects, checkboxes y más.

**Características:**
- ✅ Búsqueda con debounce automático
- ✅ Filtros por select (simple y múltiple)
- ✅ Filtros por checkbox
- ✅ Filtros por rango de fechas
- ✅ Filtros por rango numérico
- ✅ Contador de filtros activos

**Ejemplo:**
```tsx
import { useFilters, FilterConfig } from '@/hooks/common'

const filterConfig: FilterConfig<User>[] = [
  {
    id: 'search',
    type: 'search',
    searchFields: ['name', 'email', 'phone'],
    placeholder: 'Buscar usuarios...'
  },
  {
    id: 'role',
    type: 'select',
    field: 'role',
    options: [
      { value: 'all', label: 'Todos' },
      { value: 'ADMIN', label: 'Admin' },
      { value: 'TECHNICIAN', label: 'Técnico' }
    ]
  }
]

function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  
  const { 
    filteredData, 
    filters, 
    setFilter, 
    clearFilters,
    activeFiltersCount 
  } = useFilters(users, filterConfig, { debounceMs: 300 })
  
  return (
    <div>
      <input 
        value={filters.search}
        onChange={(e) => setFilter('search', e.target.value)}
        placeholder="Buscar..."
      />
      <select 
        value={filters.role}
        onChange={(e) => setFilter('role', e.target.value)}
      >
        {/* opciones */}
      </select>
      {activeFiltersCount > 0 && (
        <button onClick={clearFilters}>
          Limpiar filtros ({activeFiltersCount})
        </button>
      )}
      <UserList users={filteredData} />
    </div>
  )
}
```

---

### 2. useViewMode

Hook para manejar cambio entre vistas (cards/list/table) con persistencia en localStorage.

**Características:**
- ✅ Soporte para múltiples vistas
- ✅ Persistencia en localStorage
- ✅ Auto-switch responsive (mobile)
- ✅ Configuración de vistas disponibles

**Ejemplo:**
```tsx
import { useViewMode } from '@/hooks/common'

function UsersPage() {
  const { viewMode, setViewMode, availableModes, isMobile } = useViewMode('list', {
    storageKey: 'users-view-mode',
    availableModes: ['cards', 'list', 'table'],
    responsive: true,
    mobileMode: 'list'
  })
  
  return (
    <div>
      <ViewToggle mode={viewMode} onChange={setViewMode} />
      
      {viewMode === 'cards' && <CardGrid data={users} />}
      {viewMode === 'list' && <ListView data={users} />}
      {viewMode === 'table' && <DataTable data={users} />}
    </div>
  )
}
```

---

### 3. usePagination

Hook genérico para paginación de datos con navegación completa.

**Características:**
- ✅ Paginación cliente (datos en memoria)
- ✅ Navegación completa (next/prev/first/last)
- ✅ Cambio de tamaño de página
- ✅ Información de rango (mostrando X de Y)
- ✅ Estados de navegación (hasNext, hasPrev, etc)

**Ejemplo:**
```tsx
import { usePagination } from '@/hooks/common'

function UsersPage() {
  const { 
    paginatedData,
    currentPage,
    totalPages,
    totalItems,
    goToPage,
    nextPage,
    prevPage,
    setPageSize,
    hasNextPage,
    hasPrevPage
  } = usePagination(filteredUsers, { 
    pageSize: 20,
    initialPage: 1 
  })
  
  return (
    <div>
      <UserList users={paginatedData} />
      
      <div className="pagination">
        <button onClick={prevPage} disabled={!hasPrevPage}>
          Anterior
        </button>
        <span>Página {currentPage} de {totalPages}</span>
        <button onClick={nextPage} disabled={!hasNextPage}>
          Siguiente
        </button>
        
        <select 
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
        >
          <option value={10}>10 por página</option>
          <option value={20}>20 por página</option>
          <option value={50}>50 por página</option>
        </select>
      </div>
    </div>
  )
}
```

---

### 4. useModuleData

Hook genérico para operaciones CRUD con manejo de loading y errores.

**Características:**
- ✅ Operaciones CRUD completas (GET, POST, PUT, DELETE)
- ✅ Manejo automático de loading states
- ✅ Manejo automático de errores
- ✅ Toasts de éxito/error
- ✅ Cache opcional con TTL
- ✅ Transformación de datos

**Ejemplo:**
```tsx
import { useModuleData } from '@/hooks/common'

function UsersPage() {
  const { 
    data: users,
    loading,
    error,
    create,
    update,
    remove,
    reload,
    findById
  } = useModuleData<User>({
    endpoint: '/api/users',
    initialLoad: true,
    enableCache: true,
    cacheTTL: 5 * 60 * 1000 // 5 minutos
  })
  
  const handleCreate = async (userData: Partial<User>) => {
    const newUser = await create(userData)
    if (newUser) {
      console.log('Usuario creado:', newUser)
    }
  }
  
  const handleUpdate = async (id: string, userData: Partial<User>) => {
    const updatedUser = await update(id, userData)
    if (updatedUser) {
      console.log('Usuario actualizado:', updatedUser)
    }
  }
  
  const handleDelete = async (id: string) => {
    const success = await remove(id)
    if (success) {
      console.log('Usuario eliminado')
    }
  }
  
  if (loading) return <div>Cargando...</div>
  if (error) return <div>Error: {error}</div>
  
  return (
    <div>
      <button onClick={reload}>Recargar</button>
      <UserList 
        users={users}
        onEdit={handleUpdate}
        onDelete={handleDelete}
      />
    </div>
  )
}
```

---

### 5. useDebounce

Hook simple para debounce de valores (útil para búsquedas).

**Ejemplo:**
```tsx
import { useDebounce } from '@/hooks/common'

function SearchInput() {
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounce(searchTerm, 300)
  
  useEffect(() => {
    // Esta búsqueda solo se ejecuta 300ms después del último cambio
    performSearch(debouncedSearch)
  }, [debouncedSearch])
  
  return (
    <input 
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
    />
  )
}
```

---

## 🔄 Uso Combinado

Ejemplo completo combinando todos los hooks:

```tsx
import { 
  useModuleData, 
  useFilters, 
  useViewMode, 
  usePagination,
  FilterConfig 
} from '@/hooks/common'

function UsersPage() {
  // 1. Cargar datos
  const { data, loading, error, reload } = useModuleData<User>({
    endpoint: '/api/users',
    initialLoad: true
  })
  
  // 2. Configurar filtros
  const filterConfig: FilterConfig<User>[] = [
    {
      id: 'search',
      type: 'search',
      searchFields: ['name', 'email'],
      placeholder: 'Buscar usuarios...'
    },
    {
      id: 'role',
      type: 'select',
      field: 'role',
      options: [
        { value: 'all', label: 'Todos' },
        { value: 'ADMIN', label: 'Admin' },
        { value: 'TECHNICIAN', label: 'Técnico' },
        { value: 'CLIENT', label: 'Cliente' }
      ]
    }
  ]
  
  // 3. Aplicar filtros
  const { 
    filteredData, 
    filters, 
    setFilter, 
    clearFilters,
    activeFiltersCount 
  } = useFilters(data, filterConfig)
  
  // 4. Aplicar paginación
  const { 
    paginatedData, 
    currentPage, 
    totalPages, 
    goToPage,
    nextPage,
    prevPage
  } = usePagination(filteredData, { pageSize: 20 })
  
  // 5. Manejar vista
  const { viewMode, setViewMode } = useViewMode('list', {
    storageKey: 'users-view-mode'
  })
  
  if (loading) return <div>Cargando...</div>
  if (error) return <div>Error: {error}</div>
  
  return (
    <div>
      {/* Filtros */}
      <FilterBar
        filters={filters}
        onFilterChange={setFilter}
        onClearFilters={clearFilters}
        activeCount={activeFiltersCount}
      />
      
      {/* Toggle de vista */}
      <ViewToggle mode={viewMode} onChange={setViewMode} />
      
      {/* Contenido según vista */}
      {viewMode === 'cards' && <CardGrid data={paginatedData} />}
      {viewMode === 'list' && <ListView data={paginatedData} />}
      {viewMode === 'table' && <DataTable data={paginatedData} />}
      
      {/* Paginación */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={goToPage}
        onNext={nextPage}
        onPrev={prevPage}
      />
    </div>
  )
}
```

---

## 📝 Notas

- Todos los hooks están completamente tipados con TypeScript
- Incluyen documentación JSDoc completa
- Manejan casos edge automáticamente
- Son completamente reutilizables en cualquier módulo
- Siguen las mejores prácticas de React Hooks

---

## 🚀 Próximos Pasos

- [ ] Agregar tests unitarios
- [ ] Agregar persistencia en URL para filtros y paginación
- [ ] Crear componentes visuales que usen estos hooks
- [ ] Migrar módulos existentes a usar estos hooks
