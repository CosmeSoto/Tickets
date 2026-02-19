# Instrucciones para Corregir Problemas de UX

## Problema Actual

Los cambios están aplicados en el código pero el navegador tiene una versión cacheada. Necesitas hacer un **hard reload**.

---

## Solución Inmediata

### Paso 1: Limpiar Caché y Reiniciar

```bash
# En la terminal donde corre el servidor
# 1. Detén el servidor (Ctrl+C)

# 2. Limpia el caché
rm -rf .next/cache .next/server

# 3. Reinicia el servidor
npm run dev
```

### Paso 2: Hard Reload en el Navegador

**En Chrome/Edge/Brave:**
- Mac: `Cmd + Shift + R`
- Windows/Linux: `Ctrl + Shift + R`

**O abre DevTools y:**
1. Click derecho en el botón de reload
2. Selecciona "Empty Cache and Hard Reload"

---

## Estado de las Correcciones

### ✅ Módulo de Reportes
**Estado**: CORREGIDO (necesita hard reload)
- Import de `AlertCircle` agregado en línea 11
- Usado en línea 177
- Sin errores de TypeScript

**Verificación**:
```bash
grep -n "AlertCircle" src/components/reports/reports-page.tsx
# Debe mostrar:
# 11:  AlertCircle
# 177:                  <AlertCircle className="h-16 w-16 text-muted-foreground mb-4" />
```

### ⚠️ Módulo de Categorías
**Problema**: Vista árbol se ve como tabla
**Causa**: Posible problema con estilos o datos

**Solución**: Voy a investigar y corregir

### ⚠️ Módulo de Departamentos  
**Problema**: No tiene cambio de vista
**Causa**: Falta implementar ViewToggle y vistas adicionales

**Solución**: Voy a implementar

---

## Próximos Pasos

1. **TÚ**: Hacer hard reload del navegador
2. **YO**: Corregir vista árbol de categorías
3. **YO**: Agregar cambio de vista a departamentos

---

## Verificación Rápida

Después del hard reload, verifica:

### Reportes
- [ ] No debe mostrar error de `AlertCircle`
- [ ] Debe cargar los gráficos
- [ ] Debe mostrar las tabs (Resumen, Tickets, Técnicos, Categorías)

### Categorías
- [ ] Debe tener 3 botones de vista (Lista, Tabla, Árbol)
- [ ] Vista árbol debe mostrar jerarquía con indentación
- [ ] Debe mostrar colores por nivel

### Departamentos
- [ ] Actualmente solo tiene vista de lista
- [ ] Después de mi corrección tendrá 3 vistas

---

## Si el Problema Persiste

Si después del hard reload aún ves el error de `AlertCircle`:

1. Verifica que el servidor se reinició correctamente
2. Verifica que no hay errores en la terminal del servidor
3. Cierra completamente el navegador y ábrelo de nuevo
4. Verifica que estás en la URL correcta

---

## Comandos Útiles

```bash
# Ver si hay errores de compilación
npm run build

# Limpiar todo y reinstalar
rm -rf .next node_modules
npm install
npm run dev

# Ver logs del servidor
# (ya deberían estar visibles en la terminal)
```

