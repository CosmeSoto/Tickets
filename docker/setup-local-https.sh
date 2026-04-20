#!/bin/bash
# Genera certificados SSL locales para gestion.local usando mkcert
# Requiere: brew install mkcert

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERTS_DIR="$SCRIPT_DIR/certs"

echo "🔐 Configurando HTTPS local para gestion.local..."

# Verificar que mkcert está instalado
if ! command -v mkcert &> /dev/null; then
    echo "❌ mkcert no está instalado. Instálalo con:"
    echo "   brew install mkcert"
    exit 1
fi

# Instalar la CA raíz de mkcert en el sistema (solo la primera vez)
echo "📋 Instalando CA raíz de mkcert..."
mkcert -install

# Crear directorio de certificados
mkdir -p "$CERTS_DIR"

# Generar certificado para gestion.local
echo "📜 Generando certificado para gestion.local..."
cd "$CERTS_DIR"
mkcert -cert-file gestion.local.pem -key-file gestion.local-key.pem \
    gestion.local "*.gestion.local" localhost 127.0.0.1

echo ""
echo "✅ Certificados generados en docker/certs/"
echo ""
echo "Próximos pasos:"
echo "  1. Actualiza NEXTAUTH_URL en .env.local:"
echo "     NEXTAUTH_URL=https://gestion.local"
echo ""
echo "  2. Reinicia los contenedores:"
echo "     docker compose -f docker-compose.dev.yml down"
echo "     docker compose -f docker-compose.dev.yml up -d"
echo ""
echo "  3. Abre https://gestion.local en el navegador"
echo "     (el candado verde confirma que HTTPS funciona)"
