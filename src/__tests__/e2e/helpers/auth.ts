import type { Page } from '@playwright/test'

const DEFAULT_EMAIL = 'internet.freecom@gmail.com'
const DEFAULT_PASSWORD = 'admin123'

/** Login con credenciales de seed (override vía E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD) */
export async function loginAsAdmin(page: Page) {
  const email = process.env.E2E_ADMIN_EMAIL ?? DEFAULT_EMAIL
  const password = process.env.E2E_ADMIN_PASSWORD ?? DEFAULT_PASSWORD

  await page.goto('/login')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: /iniciar sesión/i }).click()
  await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 30_000 })
}
