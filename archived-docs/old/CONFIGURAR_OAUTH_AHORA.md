# 🚀 Configurar OAuth - Empieza Aquí

## 📋 Lo que necesitas

- ✅ Cuenta de Google (Gmail)
- ✅ Cuenta de Microsoft (Outlook, Hotmail, o Azure)
- ✅ 15 minutos de tiempo
- ✅ Navegador web

## 🎯 Objetivo

Permitir que los usuarios se registren e inicien sesión con sus cuentas de Google o Microsoft.

---

## 📚 Guías Disponibles

### 1. Guía Completa (Recomendada para primera vez)
**Archivo:** `GUIA_CONFIGURACION_OAUTH_PASO_A_PASO.md`

✅ Paso a paso detallado con explicaciones
✅ Capturas de pantalla descritas
✅ Solución de problemas
✅ Notas de seguridad

**Tiempo:** 20 minutos

### 2. Guía Rápida (Para usuarios experimentados)
**Archivo:** `OAUTH_QUICK_SETUP.md`

✅ Solo los pasos esenciales
✅ Sin explicaciones extras
✅ Checklist incluido

**Tiempo:** 10 minutos

---

## ⚡ Inicio Rápido (3 pasos)

### Paso 1: Obtener Credenciales

#### 🔵 Google
1. Ve a: https://console.cloud.google.com/
2. Crea proyecto → Habilita Google+ API
3. Crea credenciales OAuth 2.0
4. Copia Client ID y Secret

#### 🔷 Microsoft
1. Ve a: https://portal.azure.com/
2. Azure AD → Registrar aplicación
3. Crea Client Secret
4. Copia Application ID y Secret

### Paso 2: Configurar en el Sistema

1. Ve a: http://localhost:3000/admin/settings
2. Pestaña "OAuth"
3. Pega las credenciales
4. Habilita los proveedores
5. Guarda

### Paso 3: Probar

1. Ve a: http://localhost:3000/register
2. Deberías ver botones de Google y Microsoft
3. Prueba registrarte con ambos

---

## 🔗 URIs Importantes

**Estos URIs necesitas configurarlos en Google y Microsoft:**

### Google
```
Origen autorizado:
http://localhost:3000

Redirect URI:
http://localhost:3000/api/auth/callback/google
```

### Microsoft
```
Redirect URI:
http://localhost:3000/api/auth/callback/azure-ad
```

---

## 🧪 Verificar Configuración

Después de configurar, ejecuta:

```bash
cd sistema-tickets-nextjs
node verificar-oauth-config.js
```

Este script te dirá:
- ✅ Si las configuraciones están correctas
- ⚠️ Qué falta configurar
- 📝 Próximos pasos

---

## 📖 Orden Recomendado

### Primera Vez Configurando OAuth
1. Lee: `GUIA_CONFIGURACION_OAUTH_PASO_A_PASO.md`
2. Sigue los pasos para Google
3. Sigue los pasos para Microsoft
4. Ejecuta: `node verificar-oauth-config.js`
5. Prueba en: http://localhost:3000/register

### Ya Configuraste OAuth Antes
1. Lee: `OAUTH_QUICK_SETUP.md`
2. Configura ambos proveedores
3. Ejecuta: `node verificar-oauth-config.js`
4. Prueba en: http://localhost:3000/register

---

## 🎯 Resultado Final

Después de configurar correctamente:

### En la Página de Registro
- ✅ Botón "Continuar con Google"
- ✅ Botón "Continuar con Microsoft"
- ✅ Formulario de registro manual

### En la Página de Login
- ✅ Botón "Continuar con Google"
- ✅ Botón "Continuar con Microsoft"
- ✅ Formulario de login manual

### Usuarios OAuth
- ✅ Se crean automáticamente como CLIENT
- ✅ Usan su email de Google/Microsoft
- ✅ Usan su nombre de Google/Microsoft
- ✅ Usan su avatar de Google/Microsoft
- ✅ No necesitan contraseña

---

## 🚨 Problemas Comunes

### "Los botones no aparecen"
→ Verifica que habilitaste los proveedores en la UI

### "redirect_uri_mismatch"
→ Verifica que el URI sea exactamente el correcto

### "invalid_client"
→ Verifica Client ID y Secret, cópialos nuevamente

### "client_id is required"
→ Guarda la configuración en la UI

---

## 📞 Ayuda

Si tienes problemas:

1. **Ejecuta el script de verificación:**
   ```bash
   node verificar-oauth-config.js
   ```

2. **Revisa los logs del servidor:**
   - Mira la terminal donde corre `npm run dev`
   - Busca errores relacionados con OAuth

3. **Consulta la documentación:**
   - `GUIA_CONFIGURACION_OAUTH_PASO_A_PASO.md` - Sección "Solución de Problemas"
   - `OAUTH_SETUP_GUIDE.md` - Documentación técnica

---

## ✅ Checklist Rápido

Antes de empezar:
- [ ] Servidor corriendo (`npm run dev`)
- [ ] Puedes acceder a http://localhost:3000
- [ ] Tienes cuenta de Google
- [ ] Tienes cuenta de Microsoft
- [ ] Estás logueado como ADMIN

Durante la configuración:
- [ ] Proyecto creado en Google Cloud Console
- [ ] Credenciales OAuth creadas (Google)
- [ ] Aplicación registrada en Azure Portal
- [ ] Client Secret creado (Microsoft)
- [ ] Credenciales guardadas en la UI
- [ ] Proveedores habilitados

Después de configurar:
- [ ] Script de verificación ejecutado
- [ ] Botones visibles en /register
- [ ] Prueba con Google exitosa
- [ ] Prueba con Microsoft exitosa

---

## 🎉 ¡Listo!

Una vez completada la configuración, tu sistema tendrá autenticación OAuth completamente funcional.

**Siguiente paso:** Abre `GUIA_CONFIGURACION_OAUTH_PASO_A_PASO.md` y sigue las instrucciones.

---

**Tiempo total estimado:** 15-20 minutos
**Dificultad:** Media
**Resultado:** Sistema con OAuth funcional 🚀
