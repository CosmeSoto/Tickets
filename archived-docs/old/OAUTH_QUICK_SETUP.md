# ⚡ Configuración Rápida OAuth - Resumen

## 🔵 Google OAuth (5 minutos)

### 1. Google Cloud Console
```
https://console.cloud.google.com/
```

### 2. Crear Proyecto
- Nuevo Proyecto → "Sistema de Tickets"

### 3. Habilitar API
- APIs y servicios → Biblioteca → "Google+ API" → Habilitar

### 4. Pantalla de Consentimiento
- Pantalla de consentimiento → Externo → Crear
- Nombre: "Sistema de Tickets"
- Email de soporte: tu-email@gmail.com
- Permisos: email, profile, openid
- Guardar

### 5. Crear Credenciales
- Credenciales → Crear → ID de cliente OAuth 2.0
- Tipo: Aplicación web
- Orígenes autorizados: `http://localhost:3000`
- URI de redirección: `http://localhost:3000/api/auth/callback/google`
- Crear

### 6. Copiar Credenciales
```
Client ID: 123456789-abc123.apps.googleusercontent.com
Client Secret: GOCSPX-AbCdEfGhIjKl...
```

---

## 🔷 Microsoft OAuth (5 minutos)

### 1. Azure Portal
```
https://portal.azure.com/
```

### 2. Azure Active Directory
- Buscar: "Azure Active Directory"

### 3. Registrar Aplicación
- Registros de aplicaciones → Nuevo registro
- Nombre: "Sistema de Tickets"
- Tipos de cuenta: **Multiinquilino y cuentas personales**
- URI de redirección (Web): `http://localhost:3000/api/auth/callback/azure-ad`
- Registrar

### 4. Copiar Application ID
```
Application (Client) ID: 12345678-1234-1234-1234-123456789012
```

### 5. Crear Secret
- Certificados y secretos → Nuevo secreto
- Descripción: "Sistema de Tickets"
- Expira: 24 meses
- Agregar

### 6. Copiar Secret (¡Solo se muestra una vez!)
```
Valor: abc123def456ghi789...
```

---

## 🎯 Configurar en tu Sistema

### 1. Ir a Configuración
```
http://localhost:3000/admin/settings
→ Pestaña "OAuth"
```

### 2. Google OAuth
- Client ID: `[pegar]`
- Client Secret: `[pegar]`
- ✅ Habilitar Google OAuth
- Guardar

### 3. Microsoft OAuth
- Application (Client) ID: `[pegar]`
- Client Secret: `[pegar]`
- Tenant ID: `common`
- ✅ Habilitar Microsoft OAuth
- Guardar

---

## 🧪 Probar

### 1. Cerrar sesión

### 2. Ir a Registro
```
http://localhost:3000/register
```

### 3. Deberías ver:
- ✅ Botón "Continuar con Google"
- ✅ Botón "Continuar con Microsoft"

### 4. Probar ambos botones
- Click → Seleccionar cuenta → Aceptar permisos
- ✅ Redirige al dashboard como CLIENT

---

## 📋 Checklist

- [ ] Proyecto creado en Google Cloud Console
- [ ] Google+ API habilitada
- [ ] Credenciales OAuth 2.0 creadas (Google)
- [ ] Client ID y Secret copiados (Google)
- [ ] Aplicación registrada en Azure Portal
- [ ] Application ID copiado (Microsoft)
- [ ] Client Secret creado y copiado (Microsoft)
- [ ] Configuración guardada en el sistema (Google)
- [ ] Configuración guardada en el sistema (Microsoft)
- [ ] Proveedores habilitados
- [ ] Botones OAuth visibles en /register
- [ ] Prueba exitosa con Google
- [ ] Prueba exitosa con Microsoft

---

## 🚨 Errores Comunes

### "redirect_uri_mismatch"
→ Verifica que el URI sea exactamente: `http://localhost:3000/api/auth/callback/google`

### "invalid_client"
→ Verifica Client ID y Secret, cópialos nuevamente

### "client_id is required"
→ Guarda la configuración y habilita el proveedor

### Botones no aparecen
→ Marca el checkbox "Habilitar" y guarda

---

## 📚 Documentación Completa

Para más detalles, consulta:
- `GUIA_CONFIGURACION_OAUTH_PASO_A_PASO.md` - Guía detallada con capturas
- `OAUTH_SETUP_GUIDE.md` - Documentación técnica completa

---

## ⏱️ Tiempo Total: ~15 minutos

- Google: 5 minutos
- Microsoft: 5 minutos
- Configuración en sistema: 3 minutos
- Pruebas: 2 minutos

**¡Listo para producción!** 🎉
