# Componentes Comunes - Sistema de Estandarización de UI

Componentes reutilizables para estandarizar la interfaz en todos los módulos del sistema.

## 📦 Componentes Disponibles

### 1. FilterBar

Barra de filtros completa que integra búsqueda, selects y estadísticas.

**Características:**
- ✅ Integración con hook useFilters
- ✅ Búsqueda con debounce visual
- ✅ Filtros select con indicador activo
- ✅ Botón de limpiar filtros con contador
- ✅ Botón de actualizar con loading
- ✅ Estadísticas opcionales integradas
- ✅ Responsive (mobile-first)
- ✅ Accesibilidad completa

**Ejemplo:**
```tsx
import { FilterBar } from '@/components/common'
import { useFilters, FilterConfig } from '@/hooks/common'
import { Users, UserCheck, UserX } from 'lucide-react'

function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  
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
      label: 'Rol',
      field: 'role',
      options: [
        { value: 'all', label: 'Todos' },
        { value: 'ADMIN', label: 'Admin' },
        { value: 'TECHNICIAN', label: 'Técnico' },
        { value: 'CLIENT', label: 'Cliente' }
      ]
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
  
  const { 
    filteredData, 
    filters, 
    setFilter, 
    clearFilters,
    activeFiltersCount 
  } = useFilters(users, filterConfig)
  
  const stats = [
    {
      label: 'Total Usuarios',
      value: users.length,
      color: 'blue' as const,
      icon: <Users className="h-4 w-4" />
    },
    {
      label: 'Activos',
      value: users.filter(u => u.isActive).length,
      color: 'green' as const,
      icon: <UserCheck className="h-4 w-4" />
    },
    {
      label: 'Inactivos',
      value: users.filter(u => !u.isActive).length,
      color: 'red' as const,
      icon: <UserX className="h-4 w-4" />
    }
  ]
  
  return (
    <div className="space-y-6">
      <FilterBar
        config={filterConfig}
        filters={filters}
        onFilterChange={setFilter}
        onClearFilters={clearFilters}
        onRefresh={loadUsers}
        activeFiltersCount={activeFiltersCount}
        stats={stats}
        statsColumns={3}
      />
      
      <UserList users={filteredData} />
    </div>
  )
}
```

---

### 2. SearchInput

Input de búsqueda con icono, debounce visual y botón de limpiar.

**Características:**
- ✅ Icono de búsqueda
- ✅ Botón de limpiar (X)
- ✅ Indicador visual de debounce
- ✅ Placeholder configurable
- ✅ Accesibilidad (ARIA labels)

**Ejemplo:**
```tsx
import { SearchInput } from '@/components/common'

function SearchExample() {
  const [search, setSearch] = useState('')
  
  return (
    <SearchInput
      value={search}
      onChange={setSearch}
      placeholder="Buscar usuarios..."
      debouncing={false}
    />
  )
}
```

---

### 3. SelectFilter

Select estilizado con indicador de filtro activo y label opcional.

**Características:**
- ✅ Label opcional
- ✅ Indicador de filtro activo (badge)
- ✅ Border destacado cuando está activo
- ✅ Opciones configurables
- ✅ Soporte para opciones deshabilitadas

**Ejemplo:**
```tsx
import { SelectFilter } from '@/components/common'

function FilterExample() {
  const [role, setRole] = useState('all')
  
  return (
    <SelectFilter
      id="role-filter"
      label="Rol"
      value={role}
      onChange={setRole}
      options={[
        { value: 'all', label: 'Todos' },
        { value: 'ADMIN', label: 'Admin' },
        { value: 'TECHNICIAN', label: 'Técnico' },
        { value: 'CLIENT', label: 'Cliente' }
      ]}
      showActiveIndicator={true}
    />
  )
}
```

---

### 4. StatsBar

Barra de estadísticas con grid responsive y colores semánticos.

**Características:**
- ✅ Grid responsive (2-5 columnas)
- ✅ 7 colores semánticos
- ✅ Iconos opcionales
- ✅ Tendencias (↑↓) opcionales
- ✅ Tooltips opcionales
- ✅ onClick opcional
- ✅ Loading skeleton

**Ejemplo:**
```tsx
import { StatsBar } from '@/components/common'
import { Users, UserCheck, UserX, Clock } from 'lucide-react'
import type { Stat } from '@/types/common'

function StatsExample() {
  const stats: Stat[] = [
    {
      label: 'Total Usuarios',
      value: 150,
      color: 'blue',
      icon: <Users className="h-4 w-4" />,
      trend: {
        value: 12,
        direction: 'up'
      },
      tooltip: 'Total de usuarios registrados',
      onClick: () => console.log('Ver todos')
    },
    {
      label: 'Activos',
      value: 142,
      color: 'green',
      icon: <UserCheck className="h-4 w-4" />
    },
    {
      label: 'Inactivos',
      value: 8,
      color: 'red',
      icon: <UserX className="h-4 w-4" />
    },
    {
      label: 'Pendientes',
      value: 5,
      color: 'yellow',
      icon: <Clock className="h-4 w-4" />
    }
  ]
  
  return (
    <StatsBar 
      stats={stats} 
      columns={4}
      loading={false}
    />
  )
}
```

**Colores disponibles:**
- `blue` - Azul (información general)
- `green` - Verde (éxito, activo)
- `yellow` - Amarillo (advertencia, pendiente)
- `purple` - Morado (especial)
- `orange` - Naranja (atención)
- `red` - Rojo (error, inactivo)
- `gray` - Gris (neutral)

---

## 🔄 Uso Combinado

Ejemplo completo usando FilterBar con todos los componentes integrados:

```tsx
import { FilterBar } from '@/components/common'
import { useFilters, useModuleData, FilterConfig } from '@/hooks/common'
import { Users, UserCheck, UserX, UserPlus } from 'lucide-react'
import type { Stat } from '@/types/common'

function UsersPage() {
  // 1. Cargar datos
  const { data: users, loading, reload } = useModuleData<User>({
    endpoint: '/api/users',
    initialLoad: true
  })
  
  // 2. Configurar filtros
  const filterConfig: FilterConfig<User>[] = [
    {
      id: 'search',
      type: 'search',
      searchFields: ['name', 'email', 'phone'],
      placeholder: 'Buscar por nombre, email o teléfono...'
    },
    {
      id: 'role',
      type: 'select',
      label: 'Rol',
      field: 'role',
      options: [
        { value: 'all', label: 'Todos los roles' },
        { value: 'ADMIN', label: 'Administradores' },
        { value: 'TECHNICIAN', label: 'Técnicos' },
        { value: 'CLIENT', label: 'Clientes' }
      ]
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
  
  // 3. Aplicar filtros
  const { 
    filteredData, 
    filters, 
    setFilter, 
    clearFilters,
    activeFiltersCount 
  } = useFilters(users, filterConfig)
  
  // 4. Calcular estadísticas
  const stats: Stat[] = [
    {
      label: 'Total Usuarios',
      value: users.length,
      color: 'blue',
      icon: <Users className="h-4 w-4" />,
      tooltip: 'Total de usuarios en el sistema'
    },
    {
      label: 'Activos',
      value: users.filter(u => u.isActive).length,
      color: 'green',
      icon: <UserCheck className="h-4 w-4" />,
      trend: {
        value: 5,
        direction: 'up'
      }
    },
    {
      label: 'Inactivos',
      value: users.filter(u => !u.isActive).length,
      color: 'red',
      icon: <UserX className="h-4 w-4" />
    },
    {
      label: 'Nuevos (7 días)',
      value: users.filter(u => {
        const created = new Date(u.createdAt)
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        return created >= weekAgo
      }).length,
      color: 'purple',
      icon: <UserPlus className="h-4 w-4" />
    }
  ]
  
  return (
    <div className="space-y-6">
      {/* Barra de filtros con estadísticas */}
      <FilterBar
        config={filterConfig}
        filters={filters}
        onFilterChange={setFilter}
        onClearFilters={clearFilters}
        onRefresh={reload}
        loading={loading}
        activeFiltersCount={activeFiltersCount}
        stats={stats}
        statsColumns={4}
      />
      
      {/* Lista de usuarios filtrados */}
      <UserList users={filteredData} />
    </div>
  )
}
```

---

## 🎨 Personalización

### Estilos

Todos los componentes aceptan la prop `className` para personalización:

```tsx
<FilterBar
  className="bg-muted/50"
  // ...
/>

<SearchInput
  className="max-w-md"
  // ...
/>

<StatsBar
  className="gap-6"
  // ...
/>
```

### Modo Pequeño

FilterBar soporta modo pequeño para espacios reducidos:

```tsx
<FilterBar
  small={true}
  // ...
/>
```

---

## 📱 Responsive

Todos los componentes son responsive por defecto:

- **SearchInput**: Se adapta al ancho del contenedor
- **SelectFilter**: Ancho mínimo de 150px
- **FilterBar**: Layout en columna en mobile, fila en desktop
- **StatsBar**: Grid adaptativo según número de columnas

---

## ♿ Accesibilidad

Todos los componentes incluyen:

- ✅ ARIA labels apropiados
- ✅ Navegación por teclado
- ✅ Estados de disabled
- ✅ Tooltips descriptivos
- ✅ Contraste de colores adecuado

---

## 🚀 Próximos Pasos

- [ ] Agregar tests unitarios
- [ ] Crear historias en Storybook
- [ ] Agregar más tipos de filtros (daterange, checkbox, range)
- [ ] Agregar animaciones de transición
- [ ] Agregar soporte para filtros personalizados
