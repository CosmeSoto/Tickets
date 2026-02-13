# 🎨 Estándares de UX/UI del Sistema

**Objetivo:** Mantener consistencia visual y de experiencia en todo el sistema

---

## 🎯 PRINCIPIOS DE DISEÑO

### 1. Consistencia
- Mismos componentes para mismas funciones
- Mismos colores para mismos estados
- Mismas animaciones y transiciones
- Mismo lenguaje y tono

### 2. Claridad
- Mensajes claros y concisos
- Feedback inmediato de acciones
- Estados visibles (loading, error, success)
- Navegación intuitiva

### 3. Accesibilidad
- Contraste adecuado (WCAG 2.1 AA)
- Navegación por teclado
- Lectores de pantalla
- Tamaños de fuente legibles

---

## 🎨 SISTEMA DE DISEÑO

### Colores

#### Estados de Tickets
```typescript
const ticketStatusColors = {
  OPEN: 'bg-blue-100 text-blue-800 border-blue-200',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  RESOLVED: 'bg-green-100 text-green-800 border-green-200',
  CLOSED: 'bg-gray-100 text-gray-800 border-gray-200'
}
```

#### Prioridades
```typescript
const priorityColors = {
  LOW: 'bg-gray-100 text-gray-800',
  MEDIUM: 'bg-blue-100 text-blue-800',
  HIGH: 'bg-orange-100 text-orange-800',
  URGENT: 'bg-red-100 text-red-800'
}
```

#### Roles
```typescript
const roleColors = {
  ADMIN: 'bg-purple-100 text-purple-800',
  TECHNICIAN: 'bg-blue-100 text-blue-800',
  CLIENT: 'bg-green-100 text-green-800'
}
```

#### Acciones
```typescript
const actionColors = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white',
  secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800',
  success: 'bg-green-600 hover:bg-green-700 text-white',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
  warning: 'bg-yellow-600 hover:bg-yellow-700 text-white'
}
```

### Tipografía

```typescript
const typography = {
  h1: 'text-3xl font-bold',
  h2: 'text-2xl font-semibold',
  h3: 'text-xl font-semibold',
  h4: 'text-lg font-medium',
  body: 'text-base',
  small: 'text-sm',
  xs: 'text-xs'
}
```

### Espaciado

```typescript
const spacing = {
  section: 'mb-8',
  card: 'p-6',
  form: 'space-y-4',
  button: 'px-4 py-2',
  input: 'px-3 py-2'
}
```

---

## 🧩 COMPONENTES ESTÁNDAR

### Botones

#### Primario
```tsx
<Button variant="default" size="default">
  Acción Principal
</Button>
```

#### Secundario
```tsx
<Button variant="outline" size="default">
  Acción Secundaria
</Button>
```

#### Destructivo
```tsx
<Button variant="destructive" size="default">
  Eliminar
</Button>
```

### Formularios

#### Input Estándar
```tsx
<div className="space-y-2">
  <Label htmlFor="field">Campo</Label>
  <Input
    id="field"
    type="text"
    placeholder="Ingrese valor"
  />
</div>
```

#### Select Estándar
```tsx
<div className="space-y-2">
  <Label htmlFor="select">Seleccione</Label>
  <Select>
    <SelectTrigger>
      <SelectValue placeholder="Seleccione una opción" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="1">Opción 1</SelectItem>
    </SelectContent>
  </Select>
</div>
```

### Tablas

#### Tabla Estándar
```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Columna 1</TableHead>
      <TableHead>Columna 2</TableHead>
      <TableHead className="text-right">Acciones</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>Dato 1</TableCell>
      <TableCell>Dato 2</TableCell>
      <TableCell className="text-right">
        <Button variant="ghost" size="sm">Editar</Button>
      </TableCell>
    </TableRow>
  </TableBody>
</Table>
```

### Diálogos

#### Dialog Estándar
```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button>Abrir</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Título</DialogTitle>
      <DialogDescription>
        Descripción del diálogo
      </DialogDescription>
    </DialogHeader>
    {/* Contenido */}
    <DialogFooter>
      <Button variant="outline">Cancelar</Button>
      <Button>Confirmar</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Notificaciones (Toasts)

#### Toast de Éxito
```tsx
toast({
  title: "Éxito",
  description: "Operación completada correctamente",
  variant: "default"
})
```

#### Toast de Error
```tsx
toast({
  title: "Error",
  description: "Ocurrió un error al procesar la solicitud",
  variant: "destructive"
})
```

### Estados de Carga

#### Loading Spinner
```tsx
<div className="flex items-center justify-center p-8">
  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
</div>
```

#### Skeleton
```tsx
<div className="space-y-2">
  <Skeleton className="h-4 w-full" />
  <Skeleton className="h-4 w-3/4" />
</div>
```

### Estados Vacíos

#### Empty State
```tsx
<div className="text-center py-12">
  <FileQuestion className="mx-auto h-12 w-12 text-gray-400" />
  <h3 className="mt-4 text-lg font-semibold">No hay datos</h3>
  <p className="mt-2 text-sm text-gray-500">
    No se encontraron resultados
  </p>
  <Button className="mt-4">Crear Nuevo</Button>
</div>
```

---

## 📱 RESPONSIVE DESIGN

### Breakpoints
```typescript
const breakpoints = {
  sm: '640px',   // Móvil grande
  md: '768px',   // Tablet
  lg: '1024px',  // Desktop
  xl: '1280px',  // Desktop grande
  '2xl': '1536px' // Desktop extra grande
}
```

### Patrones Responsive

#### Navegación
- **Móvil:** Menú hamburguesa
- **Tablet:** Menú colapsable
- **Desktop:** Sidebar completo

#### Tablas
- **Móvil:** Cards apiladas
- **Tablet:** Tabla con scroll horizontal
- **Desktop:** Tabla completa

#### Formularios
- **Móvil:** 1 columna
- **Tablet:** 2 columnas
- **Desktop:** 2-3 columnas

---

## ♿ ACCESIBILIDAD

### Navegación por Teclado
- Tab: Navegar entre elementos
- Enter/Space: Activar botones
- Escape: Cerrar diálogos
- Arrow keys: Navegar en listas

### ARIA Labels
```tsx
<button aria-label="Cerrar diálogo">
  <X className="h-4 w-4" />
</button>
```

### Contraste
- Texto normal: Mínimo 4.5:1
- Texto grande: Mínimo 3:1
- Elementos interactivos: Mínimo 3:1

---

## 🎭 ANIMACIONES

### Transiciones Estándar
```typescript
const transitions = {
  fast: 'transition-all duration-150',
  normal: 'transition-all duration-300',
  slow: 'transition-all duration-500'
}
```

### Animaciones Comunes
```typescript
const animations = {
  fadeIn: 'animate-in fade-in',
  fadeOut: 'animate-out fade-out',
  slideIn: 'animate-in slide-in-from-bottom',
  slideOut: 'animate-out slide-out-to-bottom'
}
```

---

## 📝 MENSAJES Y TEXTOS

### Tono
- **Profesional pero amigable**
- **Claro y conciso**
- **Positivo y constructivo**

### Ejemplos

#### Éxito
- ✅ "Ticket creado correctamente"
- ✅ "Usuario actualizado con éxito"
- ✅ "Cambios guardados"

#### Error
- ❌ "No se pudo crear el ticket. Intente nuevamente"
- ❌ "Error al actualizar usuario. Verifique los datos"
- ❌ "Ocurrió un error. Contacte al administrador"

#### Confirmación
- ⚠️ "¿Está seguro de eliminar este ticket?"
- ⚠️ "Esta acción no se puede deshacer"
- ⚠️ "¿Desea continuar?"

---

## 🔍 CHECKLIST DE CONSISTENCIA

### Por Cada Módulo/Página

#### Visual
- [ ] Usa componentes estándar de shadcn/ui
- [ ] Colores consistentes con el sistema
- [ ] Espaciado uniforme
- [ ] Tipografía correcta
- [ ] Iconos de Lucide React

#### Funcional
- [ ] Estados de carga implementados
- [ ] Estados de error manejados
- [ ] Estados vacíos con mensaje
- [ ] Feedback de acciones (toasts)
- [ ] Validación de formularios

#### Responsive
- [ ] Funciona en móvil
- [ ] Funciona en tablet
- [ ] Funciona en desktop
- [ ] Navegación adaptativa
- [ ] Tablas/listas adaptativas

#### Accesibilidad
- [ ] Navegación por teclado
- [ ] ARIA labels donde corresponde
- [ ] Contraste adecuado
- [ ] Focus visible
- [ ] Mensajes de error accesibles

#### Consistencia
- [ ] Mismo patrón que otros módulos
- [ ] Mismos mensajes de éxito/error
- [ ] Mismas animaciones
- [ ] Mismo flujo de usuario
- [ ] Misma terminología

---

## 🛠️ HERRAMIENTAS

### Verificación de Accesibilidad
- Lighthouse (Chrome DevTools)
- axe DevTools
- WAVE Extension

### Verificación de Responsive
- Chrome DevTools (Device Mode)
- Firefox Responsive Design Mode
- Real devices testing

### Verificación de Consistencia
- Storybook (futuro)
- Visual regression testing (futuro)
- Manual review checklist

---

**Última actualización:** 16/01/2026
