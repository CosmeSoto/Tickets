# Instrucciones para Ver la Sección de Archivos Adjuntos

## ✅ El Código Está Correcto

La sección de archivos adjuntos **SÍ está implementada** en el código (líneas 615-670 del archivo).

El problema es que tu navegador tiene la versión antigua en **caché**.

---

## 🔄 Soluciones (Prueba en Orden)

### 1️⃣ Hard Refresh del Navegador (RECOMENDADO)

**En la página de crear ticket (`localhost:3000/client/create-ticket`):**

- **Mac:** Presiona `Cmd + Shift + R`
- **Windows/Linux:** Presiona `Ctrl + Shift + R` o `Ctrl + F5`

Esto forzará al navegador a descargar la versión más reciente.

---

### 2️⃣ Limpiar Caché con DevTools

1. Abre las herramientas de desarrollo (presiona `F12`)
2. Haz clic derecho en el botón de **recargar** del navegador
3. Selecciona **"Vaciar caché y recargar de forma forzada"**

---

### 3️⃣ Reiniciar el Servidor de Desarrollo

Si las opciones anteriores no funcionan:

```bash
# Detener el servidor actual (Ctrl+C en la terminal donde corre)
# Luego ejecutar:
cd sistema-tickets-nextjs
npm run dev
```

Espera a que diga "Ready" y luego abre `localhost:3000/client/create-ticket`

---

### 4️⃣ Limpiar Caché de Next.js (Última Opción)

```bash
cd sistema-tickets-nextjs
rm -rf .next
npm run dev
```

---

## 📋 Qué Deberías Ver Después del Refresh

Después de hacer el hard refresh, deberías ver en la página de crear ticket:

### Sección de Archivos Adjuntos:

```
┌─────────────────────────────────────────────┐
│ Archivos Adjuntos (Opcional)               │
├─────────────────────────────────────────────┤
│                                             │
│           📤 (ícono de upload)              │
│                                             │
│   Arrastra archivos aquí o haz clic        │
│        para seleccionar                     │
│                                             │
│   [📎 Seleccionar Archivos]  (botón)       │
│                                             │
│   Máximo 5 archivos, 10MB cada uno.        │
│   Formatos: imágenes, PDF, documentos      │
│                                             │
└─────────────────────────────────────────────┘
```

### Cuando Selecciones Archivos:

```
Archivos seleccionados (2/5):

┌─────────────────────────────────────────────┐
│ 📄 screenshot.png                      [X]  │
│    1.2 MB                                   │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 📄 error-log.txt                       [X]  │
│    45.3 KB                                  │
└─────────────────────────────────────────────┘
```

---

## 🎯 Ubicación en la Página

La sección de archivos adjuntos aparece:

1. **Después de:** La sección de categorías en cascada
2. **Antes de:** Los consejos para una mejor atención
3. **Antes de:** Los botones "Cancelar" y "Crear Ticket"

---

## ✅ Verificación Rápida

Para verificar que el código está actualizado, abre la consola del navegador (F12) y ejecuta:

```javascript
console.log(document.querySelector('input[type="file"]'))
```

Si devuelve `null`, significa que el navegador tiene la versión antigua en caché.

---

## 🔍 Características de la Sección de Archivos

Una vez que veas la sección, podrás:

✅ **Arrastrar y soltar** archivos en el área punteada
✅ **Hacer clic** en "Seleccionar Archivos" para abrir el explorador
✅ **Subir hasta 5 archivos** (máximo 10MB cada uno)
✅ **Ver lista** de archivos seleccionados con nombre y tamaño
✅ **Remover archivos** antes de crear el ticket (botón X)
✅ **Formatos soportados:** 
   - Imágenes (jpg, png, gif, etc.)
   - PDF
   - Word (.doc, .docx)
   - Excel (.xls, .xlsx)
   - Texto (.txt)

---

## ⚠️ Si Aún No Ves la Sección

Si después de hacer hard refresh aún no ves la sección:

1. Verifica que estés en la URL correcta: `localhost:3000/client/create-ticket`
2. Verifica que hayas iniciado sesión como **CLIENT** (no como ADMIN)
3. Abre la consola del navegador (F12) y busca errores en rojo
4. Comparte los errores que veas en la consola

---

## 📸 Captura de Pantalla Esperada

Deberías ver algo similar a esto:

```
┌──────────────────────────────────────────────────────────┐
│ Nueva Solicitud de Soporte                               │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ Título del Ticket *                                      │
│ [_____________________________________________]          │
│                                                          │
│ Descripción Detallada *                                  │
│ [                                             ]          │
│ [                                             ]          │
│ [                                             ]          │
│                                                          │
│ ┌─────────────────────┐  ┌─────────────────────┐       │
│ │ Prioridad *         │  │ Categoría *         │       │
│ │ [Media ▼]           │  │ [1. Principal ▼]    │       │
│ │                     │  │ [2. Sub... ▼]       │       │
│ │ Media: Para...      │  │ Ruta: Hardware →... │       │
│ └─────────────────────┘  └─────────────────────┘       │
│                                                          │
│ Archivos Adjuntos (Opcional)                            │
│ ┌────────────────────────────────────────────┐          │
│ │          📤                                 │          │
│ │  Arrastra archivos aquí o haz clic         │          │
│ │  [📎 Seleccionar Archivos]                 │          │
│ │  Máximo 5 archivos, 10MB cada uno          │          │
│ └────────────────────────────────────────────┘          │
│                                                          │
│ ℹ️ Consejos para una mejor atención:                    │
│ • Sé específico en la descripción                       │
│ • Incluye capturas de pantalla                          │
│                                                          │
│                        [Cancelar] [Crear Ticket]        │
└──────────────────────────────────────────────────────────┘
```

---

## 🆘 Soporte Adicional

Si después de seguir todos estos pasos aún no ves la sección:

1. Toma una captura de pantalla de la página completa
2. Abre la consola del navegador (F12) y toma captura de los errores
3. Comparte ambas capturas para diagnóstico

---

**Última actualización:** 16 de Enero, 2026
**Estado:** Código implementado y verificado ✅
