'use client'

/**
 * Redirect: /settings/inventory → /inventory/settings
 * Accesible para ADMIN y gestores (fuera del gate /admin).
 */

import { redirect } from 'next/navigation'

export default function InventorySettingsRedirect() {
  redirect('/inventory/settings')
}
