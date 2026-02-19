# 📋 INSTRUCCIONES DE VERIFICACIÓN

## 🧹 PASO 1: Limpiar Caché

```bash
cd sistema-tickets-nextjs
rm -rf .next/cache .next/server
```

O ejecutar el script:
```bash
./verificar-ux-consistencia.sh
```

---

## 🔄 PASO 2: Hard Reload en Navegador

### Mac
```
Cmd + Shift + R
```

### Windows/Linux
```
Ctrl + Shift + R
```

---

## ✅ PASO 3: Verificar Módulo CATEGORÍAS

### Navegar a:
```
/admin/categories
```

### Verificar 3 vistas:

#### Vista Lista
- ✅ Header: "Vista de Lista - Información compacta"
- ✅ Contenido: Lista vertical, angosta
- ✅ Paginación: Dentro del Card, con separador superior

#### Vista Tabla
- ✅ Header: "Vista de Tabla - Información detallada"
- ✅ Contenido: Tabla HTML con columnas
- ✅ Paginación: Dentro del Card, con separador superior

#### Vista Árbol
- ✅ Header: "Vista de Árbol - Jerarquía completa"
- ✅ Contenido: Estructura jerárquica con colores
- ✅ Paginación: NO visible (muestra jerarquía completa)

---

## ✅ PASO 4: Verificar Módulo DEPARTAMENTOS

### Navegar a:
```
/admin/departments
```

### Verificar 2 vistas:

#### Vista Lista
- ✅ Header: "Vista de Lista - Información compacta"
- ✅ Contenido: Lista vertical, angosta
- ✅ Paginación: Dentro del Card, con separador superior

#### Vista Tabla
- ✅ Header: "Vista de Tabla - Información detallada"
- ✅ Contenido: Tabla HTML con columnas
- ✅ Paginación: Dentro del Card, con separador superior

---

## ✅ PASO 5: Verificar Módulo TÉCNICOS

### Navegar a:
```
/admin/technicians
```

### Verificar 2 vistas:

#### Vista Tarjetas
- ✅ Header: "Vista de Tarjetas - Información visual"
- ✅ Contenido: Grid de tarjetas (3 columnas)
- ✅ Paginación: Dentro del Card, con separador superior

#### Vista Lista
- ✅ Header: "Vista de Lista - Información compacta"
- ✅ Contenido: Lista vertical, angosta
- ✅ Paginación: Dentro del Card, con separador superior

---

## 🎯 CHECKLIST GENERAL

Para CADA vista en CADA módulo, verificar:

### Headers
- [ ] Header descriptivo visible
- [ ] Texto: "Vista de [Tipo] - [Descripción]"
- [ ] Estilo: `text-sm font-medium text-muted-foreground`
- [ ] Separador inferior: `border-b pb-2`

### Contenido
- [ ] Contenido apropiado para el tipo de vista
- [ ] Lista: Vertical, angosta
- [ ] Tabla: Horizontal, columnas visibles
- [ ] Árbol: Jerárquico con colores
- [ ] Tarjetas: Grid visual

### Paginación
- [ ] Paginación DENTRO del Card
- [ ] Separador superior: `border-t pt-4`
- [ ] Selector de items por página visible
- [ ] Botones de navegación funcionales
- [ ] Info de rango visible (ej: "Mostrando 1 a 20 de 50")

### Estructura
- [ ] Todo dentro de `<div className="space-y-4">`
- [ ] Espaciado consistente entre elementos
- [ ] Sin elementos fuera del Card

---

## 🐛 PROBLEMAS COMUNES

### Si no ves los cambios:

1. **Caché no limpiado**
   ```bash
   rm -rf .next/cache .next/server
   ```

2. **No hiciste hard reload**
   - Mac: `Cmd + Shift + R`
   - Windows: `Ctrl + Shift + R`

3. **Servidor no reiniciado**
   ```bash
   # Detener servidor
   # Iniciar de nuevo
   npm run dev
   ```

### Si ves errores:

1. **Error de TypeScript**
   - Verificar imports
   - Verificar tipos

2. **Error de runtime**
   - Abrir consola del navegador (F12)
   - Revisar errores en rojo

3. **Paginación no funciona**
   - Verificar que `pagination` no sea null
   - Verificar que `totalPages > 1`

---

## ✨ RESULTADO ESPERADO

### En TODOS los módulos deberías ver:

1. **Header descriptivo** en la parte superior
2. **Contenido** apropiado para la vista
3. **Paginación** en la parte inferior (si hay múltiples páginas)
4. **Separadores visuales** claros
5. **Transiciones suaves** al cambiar de vista

### Diferencias claras entre vistas:

- **Lista**: Compacta, vertical, escaneo rápido
- **Tabla**: Detallada, horizontal, análisis
- **Árbol**: Jerárquica, colores, estructura
- **Tarjetas**: Visual, grid, overview

---

## 📸 CAPTURAS RECOMENDADAS

Si quieres documentar, toma capturas de:

1. Categorías - Vista Lista
2. Categorías - Vista Tabla
3. Categorías - Vista Árbol
4. Departamentos - Vista Lista
5. Departamentos - Vista Tabla
6. Técnicos - Vista Tarjetas
7. Técnicos - Vista Lista

---

## ✅ CONFIRMACIÓN FINAL

Una vez verificado todo, confirma:

- [ ] Headers visibles en TODAS las vistas
- [ ] Paginación integrada en TODOS los módulos
- [ ] Estructura consistente en TODOS los módulos
- [ ] Sin errores en consola
- [ ] Transiciones suaves
- [ ] UX profesional y clara

**Si todos los checkboxes están marcados, las correcciones fueron exitosas.**
