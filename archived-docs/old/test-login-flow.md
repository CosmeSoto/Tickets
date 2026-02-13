# 🧪 Prueba del Flujo de Login - Guía Paso a Paso

## ✅ Pre-requisitos

- [x] Servidor corriendo en http://localhost:3000
- [x] Base de datos activa
- [x] Navegador web abierto

## 📋 Pruebas a Realizar

### Prueba 1: Login Exitoso con Admin

**Objetivo:** Verificar que el login funciona sin mensajes de error

**Pasos:**

1. **Abrir página de login**
   ```
   http://localhost:3000/login
   ```

2. **Verificar elementos visuales:**
   - [ ] Logo de Shield visible
   - [ ] Título "Sistema de Tickets"
   - [ ] Indicador "En línea" (verde)
   - [ ] Campos de Email y Password
   - [ ] Botón "Iniciar Sesión"
   - [ ] Botones de Google y Microsoft OAuth
   - [ ] Credenciales de prueba visibles

3. **Ingresar credenciales de Admin:**
   ```
   Email: admin@tickets.com
   Password: admin123
   ```

4. **Click en "Iniciar Sesión"**

5. **Observar estados (deberían aparecer en orden):**
   - [ ] Icono Shield + "Validando credenciales..." (~300ms)
   - [ ] Icono Lock + "Autenticando usuario..." (~500ms)
   - [ ] Check verde + "Acceso concedido, redirigiendo..." (~800ms)

6. **Verificar resultado:**
   - [ ] ✅ NO aparece mensaje de error
   - [ ] ✅ Redirige a `/admin`
   - [ ] ✅ Dashboard de admin carga correctamente
   - [ ] ✅ Nombre de usuario visible en header
   - [ ] ✅ Avatar visible en header

**Resultado esperado:** ✅ Login exitoso sin errores

---

### Prueba 2: Login con Técnico

**Objetivo:** Verificar redirección correcta según rol

**Pasos:**

1. **Cerrar sesión** (click en avatar → Cerrar sesión)

2. **Volver a login:**
   ```
   http://localhost:3000/login
   ```

3. **Ingresar credenciales de Técnico:**
   ```
   Email: tecnico1@tickets.com
   Password: tech123
   ```

4. **Click en "Iniciar Sesión"**

5. **Verificar resultado:**
   - [ ] ✅ Redirige a `/technician`
   - [ ] ✅ Dashboard de técnico carga correctamente
   - [ ] ✅ Sin mensajes de error

**Resultado esperado:** ✅ Redirección correcta a dashboard de técnico

---

### Prueba 3: Login con Cliente

**Objetivo:** Verificar redirección para rol CLIENT

**Pasos:**

1. **Cerrar sesión**

2. **Volver a login:**
   ```
   http://localhost:3000/login
   ```

3. **Ingresar credenciales de Cliente:**
   ```
   Email: cliente1@empresa.com
   Password: client123
   ```

4. **Click en "Iniciar Sesión"**

5. **Verificar resultado:**
   - [ ] ✅ Redirige a `/client`
   - [ ] ✅ Dashboard de cliente carga correctamente
   - [ ] ✅ Sin mensajes de error

**Resultado esperado:** ✅ Redirección correcta a dashboard de cliente

---

### Prueba 4: Credenciales Incorrectas

**Objetivo:** Verificar manejo de errores de credenciales

**Pasos:**

1. **Cerrar sesión**

2. **Volver a login:**
   ```
   http://localhost:3000/login
   ```

3. **Ingresar credenciales incorrectas:**
   ```
   Email: admin@tickets.com
   Password: contraseña_incorrecta
   ```

4. **Click en "Iniciar Sesión"**

5. **Verificar resultado:**
   - [ ] ✅ Aparece mensaje de error rojo
   - [ ] ✅ Mensaje: "Email o contraseña incorrectos"
   - [ ] ✅ Sugerencia: "Verifica tus credenciales e intenta de nuevo"
   - [ ] ✅ Icono de alerta visible
   - [ ] ✅ NO redirige
   - [ ] ✅ Campos permanecen con los valores ingresados

**Resultado esperado:** ✅ Error mostrado correctamente

---

### Prueba 5: Email Inválido

**Objetivo:** Verificar validación de email

**Pasos:**

1. **Ingresar email inválido:**
   ```
   Email: admin-sin-arroba
   Password: admin123
   ```

2. **Click en "Iniciar Sesión"**

3. **Verificar resultado:**
   - [ ] ✅ Aparece mensaje de error
   - [ ] ✅ Mensaje: "Email no válido"
   - [ ] ✅ Sugerencia: "Ingresa un email válido"
   - [ ] ✅ NO hace request al servidor

**Resultado esperado:** ✅ Validación de email funciona

---

### Prueba 6: Campos Vacíos

**Objetivo:** Verificar validación de campos requeridos

**Pasos:**

1. **Dejar campos vacíos**

2. **Click en "Iniciar Sesión"**

3. **Verificar resultado:**
   - [ ] ✅ Aparece mensaje de error
   - [ ] ✅ Mensaje: "Email y contraseña son requeridos"
   - [ ] ✅ Sugerencia: "Completa todos los campos"

**Resultado esperado:** ✅ Validación de campos requeridos funciona

---

### Prueba 7: Contraseña Muy Corta

**Objetivo:** Verificar validación de longitud de contraseña

**Pasos:**

1. **Ingresar contraseña corta:**
   ```
   Email: admin@tickets.com
   Password: 123
   ```

2. **Click en "Iniciar Sesión"**

3. **Verificar resultado:**
   - [ ] ✅ Aparece mensaje de error
   - [ ] ✅ Mensaje: "Contraseña muy corta"
   - [ ] ✅ Sugerencia: "La contraseña debe tener al menos 6 caracteres"

**Resultado esperado:** ✅ Validación de longitud funciona

---

### Prueba 8: Mostrar/Ocultar Contraseña

**Objetivo:** Verificar funcionalidad de toggle de contraseña

**Pasos:**

1. **Ingresar contraseña:**
   ```
   Password: admin123
   ```

2. **Click en icono de ojo**

3. **Verificar resultado:**
   - [ ] ✅ Contraseña se muestra en texto plano
   - [ ] ✅ Icono cambia a "ojo tachado"

4. **Click nuevamente en icono**

5. **Verificar resultado:**
   - [ ] ✅ Contraseña se oculta (••••••••)
   - [ ] ✅ Icono cambia a "ojo"

**Resultado esperado:** ✅ Toggle de contraseña funciona

---

### Prueba 9: Indicador de Conexión

**Objetivo:** Verificar indicador de estado de red

**Pasos:**

1. **Verificar indicador inicial:**
   - [ ] ✅ Muestra "En línea" con icono verde

2. **Abrir DevTools (F12)**

3. **Ir a Network → Throttling → Offline**

4. **Verificar resultado:**
   - [ ] ✅ Indicador cambia a "Sin conexión" (rojo)
   - [ ] ✅ Botón de login se deshabilita
   - [ ] ✅ Aparece mensaje de error si intentas login

5. **Volver a Online**

6. **Verificar resultado:**
   - [ ] ✅ Indicador vuelve a "En línea" (verde)
   - [ ] ✅ Botón de login se habilita

**Resultado esperado:** ✅ Indicador de conexión funciona

---

### Prueba 10: Botones OAuth (Visual)

**Objetivo:** Verificar que los botones OAuth están visibles

**Pasos:**

1. **Verificar botones OAuth:**
   - [ ] ✅ Botón "Google" visible con logo
   - [ ] ✅ Botón "Microsoft" visible con logo
   - [ ] ✅ Divider "O continúa con" visible
   - [ ] ✅ Botones tienen hover effect

**Nota:** No probaremos OAuth funcional aún (requiere configuración)

**Resultado esperado:** ✅ Botones OAuth visibles

---

## 📊 Resumen de Resultados

### Pruebas Funcionales
- [ ] Prueba 1: Login Admin ✅
- [ ] Prueba 2: Login Técnico ✅
- [ ] Prueba 3: Login Cliente ✅
- [ ] Prueba 4: Credenciales Incorrectas ✅
- [ ] Prueba 5: Email Inválido ✅
- [ ] Prueba 6: Campos Vacíos ✅
- [ ] Prueba 7: Contraseña Corta ✅

### Pruebas de UI/UX
- [ ] Prueba 8: Toggle Contraseña ✅
- [ ] Prueba 9: Indicador Conexión ✅
- [ ] Prueba 10: Botones OAuth ✅

### Resultado General
- **Total de pruebas:** 10
- **Pruebas pasadas:** ___/10
- **Pruebas falladas:** ___/10

---

## 🐛 Reporte de Problemas

Si alguna prueba falla, anota aquí:

### Problema 1
- **Prueba:** ___
- **Descripción:** ___
- **Comportamiento esperado:** ___
- **Comportamiento actual:** ___

### Problema 2
- **Prueba:** ___
- **Descripción:** ___
- **Comportamiento esperado:** ___
- **Comportamiento actual:** ___

---

## ✅ Checklist Final

Después de completar todas las pruebas:

- [ ] Todas las pruebas pasaron
- [ ] No hay mensajes de error falsos
- [ ] Redirecciones funcionan correctamente
- [ ] Validaciones funcionan
- [ ] UI/UX es clara y profesional
- [ ] Estados de loading son visibles
- [ ] Indicadores de conexión funcionan

---

## 🎉 Conclusión

Si todas las pruebas pasaron:
✅ **El sistema de login está funcionando correctamente**

Si alguna prueba falló:
❌ **Revisar el problema específico y corregir**

---

**Fecha de prueba:** ___________  
**Probado por:** ___________  
**Navegador:** ___________  
**Resultado:** ✅ APROBADO / ❌ REQUIERE CORRECCIONES
