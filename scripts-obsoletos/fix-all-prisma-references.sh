#!/bin/bash

echo "🔧 Corrigiendo TODAS las referencias de Prisma según el schema..."
echo ""

cd "$(dirname "$0")"

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}1. Corrigiendo nombres de tablas (singular → plural)...${NC}"

# Nombres de tablas
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  -e 's/prisma\.ticket\./prisma.tickets./g' \
  -e 's/prisma\.category\./prisma.categories./g' \
  -e 's/prisma\.user\./prisma.users./g' \
  -e 's/prisma\.department\./prisma.departments./g' \
  -e 's/prisma\.attachment\./prisma.attachments./g' \
  -e 's/prisma\.comment\./prisma.comments./g' \
  -e 's/prisma\.notification\./prisma.notifications./g' \
  -e 's/prisma\.backup\./prisma.backups./g' \
  -e 's/prisma\.auditLog/prisma.audit_logs/g' \
  -e 's/prisma\.siteConfig/prisma.site_config/g' \
  -e 's/prisma\.systemSetting/prisma.system_settings/g' \
  -e 's/tx\.ticket\./tx.tickets./g' \
  -e 's/tx\.category\./tx.categories./g' \
  {} \;

echo -e "${GREEN}✓ Nombres de tablas corregidos${NC}"

echo -e "${BLUE}2. Corrigiendo relaciones en includes...${NC}"

# Relaciones de tickets
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  -e 's/include: { client:/include: { users_tickets_clientIdTousers:/g' \
  -e 's/include: { assignee:/include: { users_tickets_assigneeIdTousers:/g' \
  -e 's/include: { category:/include: { categories:/g' \
  -e 's/include: { author:/include: { users:/g' \
  -e 's/include: { ticket:/include: { tickets:/g' \
  -e 's/include: { department:/include: { departments:/g' \
  -e 's/include: { parent:/include: { categories:/g' \
  {} \;

echo -e "${GREEN}✓ Relaciones en includes corregidas${NC}"

echo -e "${BLUE}3. Corrigiendo acceso a propiedades de relaciones...${NC}"

# Acceso a propiedades
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  -e 's/\.client\.name/.users_tickets_clientIdTousers.name/g' \
  -e 's/\.client\.email/.users_tickets_clientIdTousers.email/g' \
  -e 's/\.client\.id/.users_tickets_clientIdTousers.id/g' \
  -e 's/\.assignee\.name/.users_tickets_assigneeIdTousers.name/g' \
  -e 's/\.assignee\.email/.users_tickets_assigneeIdTousers.email/g' \
  -e 's/\.assignee\.id/.users_tickets_assigneeIdTousers.id/g' \
  -e 's/\.category\.name/.categories.name/g' \
  -e 's/\.category\.color/.categories.color/g' \
  -e 's/\.category\.id/.categories.id/g' \
  -e 's/\.category\.level/.categories.level/g' \
  -e 's/\.category\.departmentId/.categories.departmentId/g' \
  -e 's/\.author\.name/.users.name/g' \
  -e 's/\.author\.id/.users.id/g' \
  -e 's/\.department\.name/.departments.name/g' \
  -e 's/\.department\.id/.departments.id/g' \
  -e 's/\.parent\.name/.categories.name/g' \
  {} \;

echo -e "${GREEN}✓ Acceso a propiedades corregido${NC}"

echo -e "${BLUE}4. Corrigiendo condicionales...${NC}"

# Condicionales
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  -e 's/if (ticket\.client &&/if (ticket.users_tickets_clientIdTousers \&\&/g' \
  -e 's/if (ticket\.assignee &&/if (ticket.users_tickets_assigneeIdTousers \&\&/g' \
  -e 's/if (ticket\.category &&/if (ticket.categories \&\&/g' \
  -e 's/if (category\.parent &&/if (category.categories \&\&/g' \
  {} \;

echo -e "${GREEN}✓ Condicionales corregidos${NC}"

echo -e "${BLUE}5. Corrigiendo _count fields...${NC}"

# _count fields
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  -e 's/_count\.children/_count.other_categories/g' \
  -e 's/children: true/other_categories: true/g' \
  {} \;

echo -e "${GREEN}✓ _count fields corregidos${NC}"

echo ""
echo -e "${GREEN}✅ Todas las correcciones aplicadas${NC}"
echo ""
echo "Próximo paso: npm run build"
