# 🚀 Prueba Rápida - Registro Manual

## ⚡ Prueba en 2 Minutos

### 1. Asegúrate que el sistema esté corriendo

```bash
cd sistema-tickets-nextjs
npm run dev
```

Espera a ver: `✓ Ready in X ms`

---

### 2. Abre el navegador

**URL:** http://localhost:3000/register

---

### 3. Llena el formulario

**Datos de prueba:**
- **Nombre:** `Test Usuario`
- **Email:** `test@test.com`
- **Contraseña:** `123456`
- **Confirmar:** `123456`
- **Teléfono:** *(dejar vacío o poner `+52 123 456 7890`)*

---

### 4. Click en "Crear Cuenta"

**Deberías ver:**
1. ✅ Botón cambia a "Creando cuenta..." con spinner
2. ✅ Mensaje verde: "¡Cuenta creada exitosamente! Redirigiendo al login..."
3. ✅ Después de 2 segundos, te lleva a `/login`

---

### 5. Inicia sesión

**En la página de login, usa:**
- **Email:** `test@test.com`
- **Contraseña:** `123456`

**Click en:** "Iniciar Sesión"

---

### 6. ¡Listo! ✅

Deberías estar en el dashboard de cliente (`/client`)

---

## 🎯 ¿Qué acabas de probar?

✅ Registro manual de usuario  
✅ Validación de datos  
✅ Creación de usuario en base de datos  
✅ Hash de contraseña (seguro)  
✅ Inicio de sesión con credenciales nuevas  
✅ Redirección al dashboard correcto  

---

## 🧪 Prueba Adicional: Validaciones

### Probar email duplicado

1. Ve a http://localhost:3000/register
2. Intenta registrarte con `test@test.com` de nuevo
3. **Deberías ver:** ❌ "Este email ya está registrado"

### Probar contraseñas no coinciden

1. Ve a http://localhost:3000/register
2. Llena:
   - Nombre: `Otro Usuario`
   - Email: `otro@test.com`
   - Contraseña: `123456`
   - Confirmar: `654321` *(diferente)*
3. **Deberías ver:** ❌ "Las contraseñas no coinciden"

### Probar contraseña corta

1. Ve a http://localhost:3000/register
2. Llena:
   - Nombre: `Otro Usuario`
   - Email: `otro@test.com`
   - Contraseña: `123` *(solo 3 caracteres)*
   - Confirmar: `123`
3. **Deberías ver:** ❌ "La contraseña debe tener al menos 6 caracteres"

---

## ✅ Si todo funciona...

**¡El sistema está listo para usar!** 🎉

Ahora puedes:
- Registrar usuarios reales
- Crear tickets
- Usar el sistema completo

**OAuth (Google/Microsoft)** es opcional y puedes configurarlo después.

---

## 🐛 Si algo falla...

### Error: "Error de conexión"
**Solución:** Verifica que la base de datos esté corriendo

### Error: "Error al registrar usuario"
**Solución:** 
```bash
# Regenerar Prisma
npx prisma generate

# Reiniciar servidor
# Ctrl+C para detener
npm run dev
```

### Página no carga
**Solución:** Verifica que el servidor esté corriendo en http://localhost:3000

---

## 📚 Más Información

- **Guía completa de pruebas:** `test-manual-registration.md`
- **Resumen de implementación:** `REGISTRO_MANUAL_COMPLETADO.md`
- **Estado del sistema:** `ESTADO_ACTUAL_REGISTRO.md`

---

**¡Disfruta tu sistema de tickets! 🎫✨**
