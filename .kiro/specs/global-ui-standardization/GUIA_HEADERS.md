# Guía de Headers Descriptivos

**Fecha**: 2026-01-23  
**Versión**: 1.0  
**Estado**: ✅ Completado

---

## 📋 Índice

1. [Introducción](#introducción)
2. [Formato Estándar](#formato-estándar)
3. [Textos por Vista](#textos-por-vista)
4. [Estilos Estándar](#estilos-estándar)
5. [Ejemplos de Código](#ejemplos-de-código)
6. [Implementación por Componente](#implementación-por-componente)
7. [Mejores Prácticas](#mejores-prácticas)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 Introducción

Los headers descriptivos proporcionan contexto claro sobre qué tipo de vista está viendo el usuario y qué información contiene. Son esenciales para una UX profesional y consistente.

### Principios de Diseño

1. **Formato Consistente**: "Vista de [Tipo] - [Descripción]"
2. **Estilos Uniformes**: `text-sm font-medium text-muted-foreground`
3. **Separador Visual**: `border-b pb-2` para delimitar
4. **Siempre Visible**: Todos los módulos deben tener headers

### Beneficios

- ✅ **Claridad**: Usuario sabe qué está viendo
- ✅ **Contexto**: Descripción del propósito de la vista
- ✅ **Consistencia**: Mismo formato en todos los módulos
- ✅ **Profesionalismo**: Interfaz más pulida

---

## 📝 Formato Estándar

### Estructura

```
Vista de [Tipo] - [Descripción]
```

### Componentes

| Parte | Descripción | Ejemplo |
|-------|-------------|---------|
| **"Vista de"** | Prefijo fijo | "Vista de" |
| **[Tipo]** | Tipo de vista | "Lista", "Tabla", "Tarjetas", "Árbol" |
| **" - "** | Separador | " - " |
| **[Descripción]** | Descripción breve | "Información compacta" |

### Ejemplos

```
Vista de Lista - Información compacta
Vista de Tabla - Información detallada
Vista de Tarjetas - Información visual
Vista de Árbol - Jerarquía completa
Vista de Gráficos - Análisis visual de datos
```

---

## 📚 Textos por Vista

### Tabla de Referencia

| Vista | Formato Completo | Cuándo Usar |
|-------|------------------|-------------|
| **Lista** | `Vista de Lista - Información compacta` | ListView, datos simples |
| **Tabla** | `Vista de Tabla - Información detallada` | DataTable, datos tabulares |
| **Tarjetas** | `Vista de Tarjetas - Información visual` | CardView, estadísticas |
| **Árbol** | `Vista de Árbol - Jerarquía completa` | TreeView, datos jerárquicos |
| **Gráficos** | `Vista de Gráficos - Análisis visual de datos` | Charts, reportes |

### Variaciones por Módulo

#### Técnicos

```tsx
// Vista de Tarjetas
"Vista de Tarjetas - Técnicos"
"Vista de Tarjetas - Información visual de técnicos"

// Vista de Lista
"Vista de Lista - Técnicos"
"Vista de Lista - Información compacta de técnicos"
```

#### Categorías

```tsx
// Vista de Lista
"Vista de Lista - Categorías"
"Vista de Lista - Información compacta de categorías"

// Vista de Tabla
"Vista de Tabla - Categorías"
"Vista de Tabla - Información detallada de categorías"

// Vista de Árbol
"Vista de Árbol - Jerarquía Completa"
"Vista de Árbol - Estructura jerárquica de categorías"
```

#### Departamentos

```tsx
// Vista de Lista
"Vista de Lista - Departamentos"
"Vista de Lista - Información compacta de departamentos"

// Vista de Tabla
"Vista de Tabla - Departamentos"
"Vista de Tabla - Información detallada de departamentos"
```

#### Tickets

```tsx
// Vista de Tabla
"Vista de Tabla - Tickets"
"Vista de Tabla - Información detallada de tickets"

// Vista de Tarjetas
"Vista de Tarjetas - Tickets"
"Vista de Tarjetas - Información visual de tickets"
```

#### Usuarios

```tsx
// Vista de Tabla
"Vista de Tabla - Usuarios"
"Vista de Tabla - Información detallada de usuarios"
```

#### Reportes

```tsx
// Vista de Gráficos
"Vista de Gráficos - Análisis visual de datos"
"Vista de Gráficos - Resumen ejecutivo"
"Vista de Gráficos - Rendimiento de técnicos"
"Vista de Gráficos - Análisis de categorías"

// Vista de Tabla
"Vista de Tabla - Detalles de tickets"
"Vista de Tabla - Datos completos del período"
```

---

## 🎨 Estilos Estándar

### Clases CSS

```tsx
className="text-sm font-medium text-muted-foreground border-b pb-2"
```

### Desglose

| Clase | Propósito | Valor |
|-------|-----------|-------|
| `text-sm` | Tamaño de fuente | 14px |
| `font-medium` | Peso de fuente | 500 |
| `text-muted-foreground` | Color | Gris suave |
| `border-b` | Borde inferior | 1px solid |
| `pb-2` | Padding inferior | 8px |

### Estructura HTML

```tsx
<div className="text-sm font-medium text-muted-foreground border-b pb-2">
  Vista de Lista - Información compacta
</div>
```

### Con Icono (Opcional)

```tsx
<div className="text-sm font-medium text-muted-foreground border-b pb-2 flex items-center space-x-2">
  <FolderTree className="h-4 w-4" />
  <span>Vista de Lista - Categorías</span>
</div>
```

### Variante con Descripción Adicional

```tsx
<div className="border-b pb-2 mb-4">
  <div className="flex items-center space-x-2 mb-1">
    <FolderTree className="h-4 w-4 text-muted-foreground" />
    <h3 className="text-sm font-medium text-foreground">
      Vista de Lista - Categorías
    </h3>
  </div>
  <p className="text-xs text-muted-foreground">
    Explora las categorías en formato compacto
  </p>
</div>
```

---

## 💻 Ejemplos de Código

### ListView

```tsx
<ListView
  data={categories}
  header={{
    title: "Vista de Lista - Categorías",
    description: "Información compacta de categorías",
    icon: <FolderTree className="h-4 w-4" />
  }}
  renderItem={(category) => (
    <CategoryListItem category={category} />
  )}
/>
```

### DataTable

```tsx
<DataTable
  data={departments}
  columns={columns}
  header={{
    title: "Vista de Tabla - Departamentos",
    description: "Información detallada en columnas",
    icon: <Building className="h-4 w-4" />
  }}
  sortable={true}
/>
```

### CardView

```tsx
<CardView
  data={technicians}
  header={{
    title: "Vista de Tarjetas - Técnicos",
    description: "Información visual con estadísticas",
    icon: <Users className="h-4 w-4" />
  }}
  columns={3}
  renderCard={(tech) => (
    <TechnicianStatsCard technician={tech} />
  )}
/>
```

### TreeView (CategoryTree)

```tsx
<Card>
  <CardHeader>
    <CardTitle className="text-sm font-medium text-muted-foreground border-b pb-2">
      Vista de Árbol - Jerarquía Completa
    </CardTitle>
    <CardDescription>
      Explora la estructura jerárquica de categorías
    </CardDescription>
  </CardHeader>
  <CardContent>
    <CategoryTree categories={categories} />
  </CardContent>
</Card>
```

### Header Manual (Legacy)

```tsx
{/* Para componentes que no soportan header prop */}
<Card>
  <CardContent className="space-y-4">
    <div className="text-sm font-medium text-muted-foreground border-b pb-2">
      Vista de Gráficos - Análisis visual de datos
    </div>
    
    <ReportCharts data={data} />
  </CardContent>
</Card>
```

---

## 🔧 Implementación por Componente

### Componentes Globales (Soportan header prop)

#### ListView

```tsx
interface ListViewProps<T> {
  header?: {
    title: string
    description?: string
    icon?: ReactNode
  }
  // ...
}

// Uso
<ListView
  header={{
    title: "Vista de Lista - Categorías",
    description: "Información compacta"
  }}
  // ...
/>
```

#### DataTable

```tsx
interface DataTableProps<T> {
  header?: {
    title: string
    description?: string
    icon?: ReactNode
  }
  // ...
}

// Uso
<DataTable
  header={{
    title: "Vista de Tabla - Departamentos",
    description: "Información detallada"
  }}
  // ...
/>
```

#### CardView

```tsx
interface CardViewProps<T> {
  header?: {
    title: string
    description?: string
    icon?: ReactNode
  }
  // ...
}

// Uso
<CardView
  header={{
    title: "Vista de Tarjetas - Técnicos",
    description: "Información visual"
  }}
  // ...
/>
```

### Componentes Legacy (Requieren header manual)

#### DataTable Viejo (Tickets)

```tsx
<DataTable
  title={viewMode === 'table' 
    ? "Vista de Tabla - Información detallada de tickets" 
    : "Vista de Tarjetas - Información visual de tickets"}
  // ...
/>
```

#### UserTable

```tsx
<UserTable
  title="Vista de Tabla - Información detallada de usuarios"
  // ...
/>
```

#### Reportes (Manual)

```tsx
<Card>
  <CardContent className="space-y-4">
    <div className="text-sm font-medium text-muted-foreground border-b pb-2">
      Vista de Gráficos - Análisis visual de datos
    </div>
    {/* Contenido */}
  </CardContent>
</Card>
```

---

## ✨ Mejores Prácticas

### 1. Siempre Incluir Header

```tsx
// ✅ Correcto
<ListView
  header={{
    title: "Vista de Lista - Categorías"
  }}
  data={data}
/>

// ❌ Incorrecto
<ListView
  data={data}  // Sin header
/>
```

### 2. Usar Formato Estándar

```tsx
// ✅ Correcto
title: "Vista de Lista - Información compacta"

// ❌ Incorrecto
title: "Lista de Categorías"  // No sigue formato
title: "Categorías"  // Muy corto
title: "Ver categorías en formato de lista"  // Muy largo
```

### 3. Descripción Opcional pero Recomendada

```tsx
// ✅ Mejor
header={{
  title: "Vista de Lista - Categorías",
  description: "Explora las categorías en formato compacto"
}}

// ✅ Aceptable
header={{
  title: "Vista de Lista - Categorías"
}}
```

### 4. Icono Relevante

```tsx
// ✅ Correcto
header={{
  title: "Vista de Lista - Categorías",
  icon: <FolderTree className="h-4 w-4" />  // Relevante
}}

// ❌ Incorrecto
header={{
  title: "Vista de Lista - Categorías",
  icon: <User className="h-4 w-4" />  // No relevante
}}
```

### 5. Consistencia en el Módulo

```tsx
// ✅ Correcto - Consistente
// Vista de Lista
header={{ title: "Vista de Lista - Categorías" }}

// Vista de Tabla
header={{ title: "Vista de Tabla - Categorías" }}

// ❌ Incorrecto - Inconsistente
// Vista de Lista
header={{ title: "Vista de Lista - Categorías" }}

// Vista de Tabla
header={{ title: "Tabla de Categorías" }}  // Formato diferente
```

### 6. Actualizar al Cambiar Vista

```tsx
// ✅ Correcto
const getHeaderTitle = () => {
  switch (viewMode) {
    case 'list':
      return "Vista de Lista - Categorías"
    case 'table':
      return "Vista de Tabla - Categorías"
    case 'cards':
      return "Vista de Tarjetas - Categorías"
    default:
      return "Categorías"
  }
}

<ListView
  header={{ title: getHeaderTitle() }}
  data={data}
/>
```

### 7. Separador Siempre Presente

```tsx
// ✅ Correcto
className="text-sm font-medium text-muted-foreground border-b pb-2"

// ❌ Incorrecto
className="text-sm font-medium text-muted-foreground"  // Sin border-b pb-2
```

---

## 🐛 Troubleshooting

### Problema: Header no aparece

**Síntoma**: El header no se renderiza

**Causas posibles**:
1. Componente no soporta `header` prop
2. Prop `header` no pasado
3. Componente legacy

**Solución**:
```tsx
// Verificar si componente soporta header
<ListView
  header={{  // ✅ Soportado
    title: "Vista de Lista"
  }}
/>

// Si no soporta, usar header manual
<Card>
  <CardContent>
    <div className="text-sm font-medium text-muted-foreground border-b pb-2">
      Vista de Lista
    </div>
    <OldComponent />
  </CardContent>
</Card>
```

### Problema: Formato inconsistente

**Síntoma**: Headers con diferentes formatos

**Causa**: No seguir el estándar

**Solución**:
```tsx
// ❌ Incorrecto
"Lista de Categorías"
"Categorías - Vista de Lista"
"Ver Categorías"

// ✅ Correcto
"Vista de Lista - Categorías"
```

### Problema: Estilos incorrectos

**Síntoma**: Header con estilos diferentes

**Causa**: Clases CSS incorrectas

**Solución**:
```tsx
// ❌ Incorrecto
className="text-lg font-bold"

// ✅ Correcto
className="text-sm font-medium text-muted-foreground border-b pb-2"
```

### Problema: Header no se actualiza al cambiar vista

**Síntoma**: Header sigue diciendo "Lista" cuando estás en "Tabla"

**Causa**: Header estático, no reactivo

**Solución**:
```tsx
// ❌ Incorrecto
header={{ title: "Vista de Lista - Categorías" }}  // Estático

// ✅ Correcto
header={{ 
  title: viewMode === 'list' 
    ? "Vista de Lista - Categorías"
    : "Vista de Tabla - Categorías"
}}
```

---

## 📚 Recursos Adicionales

### Documentación Relacionada

- [Guía de Vistas Estandarizadas](./GUIA_VISTAS_ESTANDARIZADAS.md)
- [Guía de Paginación](./GUIA_PAGINACION.md)
- [Fase 13.6 - Headers Descriptivos](../FASE_13_6_HEADERS_COMPLETADA.md)

### Ejemplos en el Código

- **Técnicos**: `src/app/admin/technicians/page.tsx`
- **Categorías**: `src/components/categories/categories-page.tsx`
- **Departamentos**: `src/components/departments/departments-page.tsx`
- **Tickets**: `src/app/admin/tickets/page.tsx`
- **Usuarios**: `src/app/admin/users/page.tsx`
- **Reportes**: `src/components/reports/reports-page.tsx`

### Tipos TypeScript

```typescript
// src/types/views.ts
export interface ViewHeader {
  title: string
  description?: string
  icon?: ReactNode
}
```

---

## 🎉 Conclusión

Esta guía proporciona todo lo necesario para implementar headers descriptivos estandarizados en el sistema. Siguiendo estos patrones, garantizamos:

- ✅ **Consistencia** visual en todos los módulos
- ✅ **Claridad** para los usuarios
- ✅ **Profesionalismo** en la interfaz
- ✅ **Mantenibilidad** con formato estándar

**Recuerda**: 
- Formato: `"Vista de [Tipo] - [Descripción]"`
- Estilos: `text-sm font-medium text-muted-foreground border-b pb-2`
- Siempre incluir en todas las vistas
- Actualizar al cambiar de vista

---

**Documento generado**: 2026-01-23  
**Autor**: Sistema de Estandarización de UI  
**Versión**: 1.0
