# Solución: Error de Inicialización en use-departments

**Fecha:** 2026-02-19  
**Error:** `Cannot access 'handleCloseDialog' before initialization`  
**Estado:** ✅ Resuelto

---

## Problema

```
ReferenceError: Cannot access 'handleCloseDialog' before initialization
at useDepartments (src/hooks/use-departments.ts:418:77)
```

### Causa Raíz

Orden incorrecto de declaración de funciones en React hooks:

```typescript
// ❌ INCORRECTO
const handleSubmit = useCallback(async (e) => {
  // ... código ...
  handleCloseDialog() // Usado aquí
}, [formData, editingDepartment, toast, invalidateCache, loadDepartments, handleCloseDialog])
//                                                                         ^^^^^^^^^^^^^^^^
//                                                                         Referenciado en dependencias

// Declarado DESPUÉS (línea 509)
const handleCloseDialog = useCallback(() => {
  // ... código ...
}, [])
```

---

## Solución

Mover `handleCloseDialog` ANTES de `handleSubmit`:

```typescript
// ✅ CORRECTO
// 1. Primero declarar handleCloseDialog
const handleCloseDialog = useCallback(() => {
  setShowDialog(false)
  setEditingDepartment(null)
  setFormData({
    name: '',
    description: '',
    color: '#3B82F6',
    isActive: true,
    order: 0,
  })
}, [])

// 2. Luego declarar handleSubmit que lo usa
const handleSubmit = useCallback(async (e: React.FormEvent) => {
  // ... código ...
  handleCloseDialog() // Ahora está disponible
}, [formData, editingDepartment, toast, invalidateCache, loadDepartments, handleCloseDialog])
```

---

## Cambios Realizados

**Archivo:** `src/hooks/use-departments.ts`

1. Movida declaración de `handleCloseDialog` de línea 509 a línea 373
2. Eliminada declaración duplicada
3. Orden correcto: `handleCloseDialog` → `handleSubmit`

---

## Regla General

En React hooks con `useCallback`:

1. **Declarar primero** las funciones que NO dependen de otras
2. **Declarar después** las funciones que usan las anteriores
3. **Verificar** el array de dependencias

### Orden Correcto

```typescript
// 1. Funciones sin dependencias de otras funciones
const handleClose = useCallback(() => { ... }, [])

// 2. Funciones que usan handleClose
const handleSubmit = useCallback(() => {
  handleClose()
}, [..., handleClose])

// 3. Funciones que usan handleSubmit
const handleSave = useCallback(() => {
  handleSubmit()
}, [..., handleSubmit])
```

---

## Verificación

✅ Sin errores de compilación  
✅ Sin errores de TypeScript  
✅ Hook funciona correctamente  
✅ No hay otros hooks con el mismo problema  

---

## Prevención

Para evitar este error en el futuro:

1. Organizar funciones por dependencias
2. Usar ESLint con regla `react-hooks/exhaustive-deps`
3. Revisar warnings de dependencias
4. Probar en desarrollo antes de producción

---

**Documentado por:** Sistema de Tickets Next.js  
**Última actualización:** 2026-02-19  
**Estado:** ✅ Resuelto
