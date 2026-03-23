#!/bin/bash

# ============================================
# Script de Inicialización de Base de Datos
# ============================================
# Este script inicializa la base de datos con:
# - Migraciones de Prisma
# - Datos iniciales (seed)
# - Verificación de instalación
# ============================================

set -e  # Salir si hay error

echo ""
echo "🚀 Inicializando Base de Datos del Sistema de Tickets"
echo "═══════════════════════════════════════════════════════"
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para imprimir con color
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# 1. Verificar que PostgreSQL esté listo
print_info "Verificando conexión a PostgreSQL..."
sleep 2

MAX_RETRIES=30
RETRY_COUNT=0

while ! docker-compose exec -T postgres pg_isready -U tickets_user > /dev/null 2>&1; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        print_error "PostgreSQL no está disponible después de $MAX_RETRIES intentos"
        exit 1
    fi
    echo "Esperando a PostgreSQL... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

print_success "PostgreSQL está listo"
echo ""

# 2. Aplicar migraciones
print_info "Aplicando migraciones de Prisma..."
if docker-compose exec -T app npx prisma migrate deploy; then
    print_success "Migraciones aplicadas correctamente"
else
    print_error "Error al aplicar migraciones"
    exit 1
fi
echo ""

# 3. Ejecutar seed
print_info "Ejecutando seed (datos iniciales)..."
if docker-compose exec -T app npx prisma db seed; then
    print_success "Seed ejecutado correctamente"
else
    print_warning "El seed falló o ya se ejecutó anteriormente"
fi
echo ""

# 4. Verificar instalación
print_info "Verificando instalación..."
if docker-compose exec -T app node scripts/verify-seed.js; then
    print_success "Verificación completada"
else
    print_warning "La verificación encontró algunos problemas"
fi
echo ""

# 5. Resumen
echo "═══════════════════════════════════════════════════════"
echo ""
print_success "¡Base de datos inicializada correctamente!"
echo ""
echo "📋 Información de Acceso:"
echo ""
echo "   🌐 URL: http://localhost:3000"
echo "   👤 Email: internet.freecom@gmail.com"
echo "   🔑 Contraseña: admin123"
echo ""
echo "📚 Próximos pasos:"
echo ""
echo "   1. Accede al sistema en http://localhost:3000"
echo "   2. Inicia sesión con las credenciales de administrador"
echo "   3. Cambia la contraseña del administrador"
echo "   4. Configura departamentos y categorías"
echo "   5. Crea usuarios técnicos y clientes"
echo ""
echo "═══════════════════════════════════════════════════════"
echo ""
