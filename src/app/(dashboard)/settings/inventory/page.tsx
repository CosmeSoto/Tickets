'use client'

/**
 * Redirect: /settings/inventory → /admin/settings/inventory
 * Esta página fue movida. Este componente redirige automáticamente.
 */

import { redirect } from 'next/navigation'

export default function InventorySettingsRedirect() {
  redirect('/admin/settings/inventory')
}

