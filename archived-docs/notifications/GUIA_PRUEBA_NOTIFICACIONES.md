# 🧪 Guía de Prueba - Sistema de Notificaciones en Tiempo Real

## 📋 Preparación

### Requisitos Previos
1. ✅ Servidor de desarrollo corriendo (`npm run dev`)
2. ✅ Base de datos PostgreSQL activa (Docker)
3. ✅ Al menos 1 usuario CLIENT y 1 usuario ADMIN/TECHNICIAN
4. ✅ Al menos 1 ticket creado

---

## 🎯 Escenarios de Prueba

### Prueba 1: Activar Notificaciones

**Pasos**:
1. Iniciar sesión como CLIENT
2. Ir a "Mis Tickets"
3. Abrir cualquier ticket
4. Buscar el botón "Notificaciones OFF" en la esquina superior derecha
5. Hacer click en el botón

**Resultado Esperado**:
- ✅ El navegador solicita permiso para mostrar notificaciones
- ✅ Al aceptar, el botón cambia a "Notificaciones ON" (verde)
- ✅ Aparece un toast: "Notificaciones activadas"
- ✅ El icono cambia de 🔕 a 🔔

**Verificación**:
```
Botón antes:  🔕 Notificaciones OFF (gris)
Botón después: 🔔 Notificaciones ON (verde)
```

---

### Prueba 2: Nuevo Comentario

**Pasos**:
1. Cliente tiene ticket abierto con notificaciones ON
2. En otra ventana/navegador, iniciar sesión como ADMIN o TECHNICIAN
3. Abrir el mismo ticket
4. Agregar un comentario: "Estoy revisando tu solicitud"
5. Guardar el comentario
6. Esperar máximo 30 segundos

**Resultado Esperado**:
- ✅ Cliente recibe notificación del navegador
- ✅ Título: "Nuevo Comentario"
- ✅ Mensaje: "[Nombre del técnico] ha comentado en tu ticket"
- ✅ Al hacer click, la ventana se enfoca
- ✅ Notificación se cierra automáticamente después de 5 segundos

**Captura de Pantalla Esperada**:
```
┌─────────────────────────────────────┐
│ 🎫 Sistema de Tickets               │
│                                     │
│ Nuevo Comentario                    │
│ Juan Pérez ha comentado en tu      │
│ ticket                              │
└─────────────────────────────────────┘
```

---

### Prueba 3: Cambio de Estado

**Pasos**:
1. Cliente tiene ticket abierto con notificaciones ON
2. En otra ventana, admin/técnico cambia el estado del ticket
   - De "Abierto" a "En Progreso"
3. Esperar máximo 30 segundos

**Resultado Esperado**:
- ✅ Cliente recibe notificación
- ✅ Título: "Estado Actualizado"
- ✅ Mensaje: "Tu ticket ahora está: En Progreso"
- ✅ El badge de estado se actualiza automáticamente en la página

**Estados Posibles**:
```
OPEN         → "Tu ticket ahora está: Abierto"
IN_PROGRESS  → "Tu ticket ahora está: En Progreso"
RESOLVED     → "Tu ticket ahora está: Resuelto"
CLOSED       → "Tu ticket ahora está: Cerrado"
ON_HOLD      → "Tu ticket ahora está: En Espera"
```

---

### Prueba 4: Asignación de Técnico

**Pasos**:
1. Cliente tiene ticket SIN técnico asignado
2. Cliente abre el ticket con notificaciones ON
3. En otra ventana, admin asigna un técnico al ticket
4. Esperar máximo 30 segundos

**Resultado Esperado**:
- ✅ Cliente recibe notificación
- ✅ Título: "Ticket Asignado"
- ✅ Mensaje: "[Nombre del técnico] ha sido asignado a tu ticket"
- ✅ La tarjeta de "Técnico Asignado" aparece en el sidebar

---

### Prueba 5: Ticket Resuelto

**Pasos**:
1. Cliente tiene ticket en estado "En Progreso"
2. Cliente abre el ticket con notificaciones ON
3. En otra ventana, técnico marca el ticket como "Resuelto"
4. Esperar máximo 30 segundos

**Resultado Esperado**:
- ✅ Cliente recibe notificación especial
- ✅ Título: "¡Ticket Resuelto!"
- ✅ Mensaje: "Tu ticket ha sido resuelto. Por favor califica el servicio."
- ✅ El badge cambia a "Resuelto" (verde)
- ✅ La pestaña "Calificación" se habilita

---

### Prueba 6: Desactivar Notificaciones

**Pasos**:
1. Cliente tiene notificaciones ON
2. Hacer click en el botón "Notificaciones ON"
3. Realizar cambios en el ticket desde otra ventana
4. Esperar 30 segundos

**Resultado Esperado**:
- ✅ Botón cambia a "Notificaciones OFF" (gris)
- ✅ Aparece toast: "Notificaciones desactivadas"
- ✅ NO se reciben notificaciones del navegador
- ✅ Los cambios SÍ se reflejan en la página (polling se detiene)

---

### Prueba 7: Múltiples Cambios Simultáneos

**Pasos**:
1. Cliente tiene ticket abierto con notificaciones ON
2. En otra ventana, realizar múltiples cambios:
   - Cambiar estado a "En Progreso"
   - Agregar comentario
   - Asignar técnico
3. Esperar 30 segundos

**Resultado Esperado**:
- ✅ Cliente recibe múltiples notificaciones (una por cada cambio)
- ✅ Las notificaciones aparecen en secuencia
- ✅ Cada notificación tiene su propio mensaje específico
- ✅ Todas se cierran automáticamente después de 5 segundos

---

## 🔍 Verificación de Consola

### Logs Esperados en Consola del Cliente

```javascript
// Al activar notificaciones
"Notification permission: granted"

// Durante polling (cada 30 segundos)
"Polling ticket updates..."

// Al detectar cambio
"Change detected: status changed from OPEN to IN_PROGRESS"
"Sending notification: Status Updated"
```

### Logs Esperados en Consola del Servidor

```javascript
// Request de polling cada 30 segundos
GET /api/tickets/[id] 200 OK

// Sin errores adicionales
```

---

## ⚠️ Casos de Error a Probar

### Error 1: Permisos Denegados

**Pasos**:
1. Bloquear notificaciones en configuración del navegador
2. Intentar activar notificaciones en el ticket

**Resultado Esperado**:
- ✅ Aparece toast: "Permiso denegado"
- ✅ Botón permanece en "Notificaciones OFF"
- ✅ No hay errores en consola

---

### Error 2: Navegador No Soportado

**Pasos**:
1. Abrir en navegador muy antiguo (sin soporte de Notification API)
2. Intentar activar notificaciones

**Resultado Esperado**:
- ✅ Botón no aparece o está deshabilitado
- ✅ Degradación elegante sin errores
- ✅ Resto de funcionalidad sigue funcionando

---

### Error 3: Pérdida de Conexión

**Pasos**:
1. Cliente tiene notificaciones ON
2. Desconectar internet
3. Esperar 30 segundos
4. Reconectar internet

**Resultado Esperado**:
- ✅ No hay errores visibles al usuario
- ✅ Polling se reanuda automáticamente
- ✅ Cambios se sincronizan al reconectar

---

## 📊 Checklist de Pruebas

### Funcionalidad Básica
- [ ] Activar notificaciones (primera vez)
- [ ] Desactivar notificaciones
- [ ] Reactivar notificaciones
- [ ] Notificación de nuevo comentario
- [ ] Notificación de cambio de estado
- [ ] Notificación de asignación
- [ ] Notificación de ticket resuelto

### Interfaz de Usuario
- [ ] Botón toggle funciona correctamente
- [ ] Indicador visual cambia de color
- [ ] Toast aparece al cambiar configuración
- [ ] Notificaciones tienen iconos correctos
- [ ] Notificaciones se cierran automáticamente

### Rendimiento
- [ ] Polling no afecta la experiencia del usuario
- [ ] No hay lag al navegar en la página
- [ ] Memoria no aumenta con el tiempo
- [ ] CPU no se dispara durante polling

### Compatibilidad
- [ ] Chrome/Edge - Funciona
- [ ] Firefox - Funciona
- [ ] Safari - Funciona
- [ ] Navegador antiguo - Degradación elegante

### Casos de Error
- [ ] Permisos denegados - Manejo correcto
- [ ] Sin conexión - No rompe la app
- [ ] Ticket eliminado - Manejo correcto
- [ ] Sesión expirada - Redirección correcta

---

## 🎯 Criterios de Éxito

### ✅ Prueba Exitosa Si:
1. Todas las notificaciones se reciben dentro de 30 segundos
2. No hay errores en consola del navegador
3. La UI responde correctamente a todos los cambios
4. El botón toggle funciona en ambas direcciones
5. Las notificaciones se cierran automáticamente
6. El polling no afecta el rendimiento

### ❌ Prueba Fallida Si:
1. Notificaciones no aparecen después de 30 segundos
2. Hay errores en consola
3. El botón toggle no cambia de estado
4. Las notificaciones no se cierran
5. La página se congela durante el polling
6. Hay memory leaks

---

## 🐛 Debugging

### Si las notificaciones no aparecen:

1. **Verificar permisos del navegador**:
   ```
   Chrome: chrome://settings/content/notifications
   Firefox: about:preferences#privacy
   Safari: Preferencias > Sitios web > Notificaciones
   ```

2. **Verificar consola del navegador**:
   ```javascript
   console.log(Notification.permission) // Debe ser "granted"
   ```

3. **Verificar polling**:
   ```javascript
   // Debe aparecer cada 30 segundos
   "Polling ticket updates..."
   ```

4. **Verificar cambios en el ticket**:
   ```javascript
   // Debe detectar diferencias
   "Change detected: ..."
   ```

---

## 📝 Reporte de Pruebas

### Formato de Reporte

```markdown
## Prueba: [Nombre de la prueba]
**Fecha**: [Fecha]
**Navegador**: [Chrome/Firefox/Safari]
**Resultado**: [✅ Exitosa / ❌ Fallida]

### Detalles:
- Tiempo de respuesta: [X segundos]
- Notificaciones recibidas: [Sí/No]
- Errores encontrados: [Ninguno/Descripción]
- Observaciones: [Comentarios adicionales]
```

---

## 🎉 Conclusión

Si todas las pruebas pasan exitosamente, el sistema de notificaciones está **listo para producción** y proporciona una excelente experiencia de usuario con feedback en tiempo real sobre el estado de sus tickets.

**Tiempo estimado de pruebas**: 15-20 minutos
**Nivel de dificultad**: Fácil
**Requisitos**: 2 navegadores o ventanas de incógnito
