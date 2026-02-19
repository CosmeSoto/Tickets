#!/bin/bash

echo "🔧 Corrigiendo nombres de tablas en seed.ts..."

sed -i '' 's/prisma\.department\./prisma.departments./g' prisma/seed.ts
sed -i '' 's/prisma\.user\./prisma.users./g' prisma/seed.ts
sed -i '' 's/prisma\.category\./prisma.categories./g' prisma/seed.ts
sed -i '' 's/prisma\.technicianAssignment\./prisma.technician_assignments./g' prisma/seed.ts
sed -i '' 's/prisma\.ticket\./prisma.tickets./g' prisma/seed.ts
sed -i '' 's/prisma\.comment\./prisma.comments./g' prisma/seed.ts
sed -i '' 's/prisma\.ticketHistory\./prisma.ticket_history./g' prisma/seed.ts
sed -i '' 's/prisma\.notificationPreference\./prisma.notification_preferences./g' prisma/seed.ts
sed -i '' 's/prisma\.notification\./prisma.notifications./g' prisma/seed.ts
sed -i '' 's/prisma\.siteConfig\./prisma.site_config./g' prisma/seed.ts

echo "✅ Correcciones completadas"
