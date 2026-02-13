# 🚀 Quick Start: Configuración OAuth desde la UI

## ⚡ En 3 Pasos Simples

### 1. Configurar Clave de Encriptación (30 segundos)

Agrega a tu `.env.local`:

```env
# Genera una clave segura
ENCRYPTION_KEY="$(openssl rand -base64 32)"
```

O manualmente:
```bash
openssl rand -base64 32
```

Copia el resultado y agrégalo a `.env.local`:
```env
ENCRYPTION_KEY="tu-clave-generada-aqui"
```

### 2. Aplicar Migración (30 segundos)

```bash
npx prisma migrate dev
```

### 3. Configurar desde la UI (5 minutos)

1. **Inicia sesión como ADMIN**
2. **Ve a**: `http://localhost:3000/admin/oauth-settings`
3. **Configura Google:**
   - Obtén credenciales de [Google Console](https://console.cloud.google.com/)
   - Copia el Redirect URI del panel
   - Pega Client ID y Client Secret
   - Marca "Habilitar"
   - Guarda

4. **Configura Microsoft:**
   - Obtén credenciales de [Azure Portal](https://portal.azure.com/)
   - Copia el Redirect URI del panel
   - Pega Application ID y Client Secret
   - Marca "Habilitar"
   - Guarda

## ✅ ¡Listo!

Ahora los usuarios pueden registrarse con:
- ✅ Google (Gmail)
- ✅ Microsoft (Outlook/Hotmail)

Los usuarios OAuth se crean automáticamente como **CLIENT**.

## 🎯 Ventajas de la UI

- ✅ **Sin editar archivos** `.env`
- ✅ **Activar/desactivar** con un click
- ✅ **Copiar URIs** con un botón
- ✅ **Credenciales encriptadas** en BD
- ✅ **Cambios inmediatos** sin reiniciar

## 📚 Documentación Completa

Ver `OAUTH_UI_CONFIG_GUIDE.md` para detalles completos.
