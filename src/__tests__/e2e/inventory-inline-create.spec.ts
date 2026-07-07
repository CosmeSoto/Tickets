import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers/auth'

/**
 * Requiere BD con seed (admin + familias + tipos/marcas).
 * Ejecutar: npm run test:e2e -- inventory-inline-create
 */
test.describe('Inventario — creación inline sin validación fantasma', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('crear modelo inline no dispara error de número de serie', async ({ page }) => {
    await page.goto('/inventory/new')
    await expect(page.getByText('¿A qué familia pertenece el activo?')).toBeVisible({
      timeout: 15_000,
    })

    // Seleccionar la primera familia del grid
    await page.locator('.grid.grid-cols-2 button[type="button"]').first().click()

    await expect(page.getByText('Nuevo Activo Individual')).toBeVisible({ timeout: 15_000 })

    // Tipo de equipo — primer combobox del formulario
    const typeCombo = page.getByRole('combobox').first()
    await typeCombo.click()
    await page.getByRole('option').nth(1).click()

    // Marca
    const brandCombo = page.getByRole('combobox').nth(1)
    await brandCombo.click()
    await page.getByRole('option').nth(1).click()

    // Modelo — crear nuevo
    const modelCombo = page.getByRole('combobox').nth(2)
    await modelCombo.click()
    await page.getByRole('option', { name: /crear modelo/i }).click()

    const modelName = `E2E Test ${Date.now()}`
    await page.getByLabel(/^modelo/i).fill(modelName)
    await page.getByRole('button', { name: /crear modelo/i }).click()

    // Éxito esperado
    await expect(
      page.locator('[data-sonner-toast]').filter({ hasText: /modelo creado/i })
    ).toBeVisible({
      timeout: 10_000,
    })

    // Regresión: no debe aparecer validación del formulario padre
    await expect(
      page.locator('[data-sonner-toast]').filter({ hasText: /número de serie/i })
    ).not.toBeVisible()
  })
})
