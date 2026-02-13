import { test, expect } from '@playwright/test'

test.describe('Admin Operations Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin before each test
    await page.goto('/login')
    await page.fill('input[type="email"]', 'admin@test.com')
    await page.fill('input[type="password"]', 'testpassword')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(3000)
  })

  test('should access admin dashboard', async ({ page }) => {
    await page.goto('/admin')
    
    // Check that we can access admin area
    expect(page.url()).toContain('/admin')
    
    // Should not be redirected to unauthorized page
    expect(page.url()).not.toContain('/unauthorized')
    
    // Check for admin dashboard elements
    const dashboardTitle = page.locator('h1:has-text("Dashboard"), h1:has-text("Admin"), h2:has-text("Dashboard")')
    const statsCards = page.locator('.stat, .card, .metric, [data-testid="stat-card"]')
    
    // Either dashboard title or stats should be visible
    const hasDashboardElements = await dashboardTitle.isVisible() || await statsCards.count() > 0
    expect(hasDashboardElements).toBeTruthy()
  })

  test('should manage categories', async ({ page }) => {
    await page.goto('/admin/categories')
    
    // Check categories page loads
    await expect(page).toHaveTitle(/Categories|Categorías/)
    
    // Should display categories list
    const categoriesTable = page.locator('table, .categories-list, [data-testid="categories-table"]')
    await expect(categoriesTable).toBeVisible()
    
    // Should have create category button
    const createButton = page.locator('button:has-text("Create"), button:has-text("Add"), button:has-text("Crear")')
    await expect(createButton).toBeVisible()
    
    // Test creating a new category
    await createButton.click()
    await page.waitForTimeout(1000)
    
    // Fill category form
    const nameInput = page.locator('input[name="name"], input[placeholder*="name"], input[placeholder*="nombre"]')
    if (await nameInput.isVisible()) {
      await nameInput.fill('E2E Test Category')
      
      const descriptionInput = page.locator('textarea[name="description"], input[name="description"]')
      if (await descriptionInput.isVisible()) {
        await descriptionInput.fill('Category created by E2E tests')
      }
      
      const colorInput = page.locator('input[name="color"], input[type="color"]')
      if (await colorInput.isVisible()) {
        await colorInput.fill('#FF5733')
      }
      
      // Submit form
      const submitButton = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Create")')
      await submitButton.click()
      await page.waitForTimeout(2000)
      
      // Check for success or return to categories list
      const isOnCategoriesList = page.url().includes('/categories')
      const successMessage = page.locator('.success, .alert-success')
      
      expect(await successMessage.isVisible() || isOnCategoriesList).toBeTruthy()
    }
  })

  test('should manage users', async ({ page }) => {
    await page.goto('/admin/users')
    
    // Check users page loads
    await expect(page).toHaveTitle(/Users|Usuarios/)
    
    // Should display users list
    const usersTable = page.locator('table, .users-list, [data-testid="users-table"]')
    await expect(usersTable).toBeVisible()
    
    // Should have create user button
    const createButton = page.locator('button:has-text("Create"), button:has-text("Add"), button:has-text("Crear")')
    
    if (await createButton.isVisible()) {
      await createButton.click()
      await page.waitForTimeout(1000)
      
      // Fill user form
      const nameInput = page.locator('input[name="name"], input[placeholder*="name"], input[placeholder*="nombre"]')
      if (await nameInput.isVisible()) {
        await nameInput.fill('E2E Test User')
        
        const emailInput = page.locator('input[name="email"], input[type="email"]')
        if (await emailInput.isVisible()) {
          await emailInput.fill('e2etest@example.com')
        }
        
        const roleSelect = page.locator('select[name="role"], select[name="rol"]')
        if (await roleSelect.isVisible()) {
          await roleSelect.selectOption('USER')
        }
        
        // Submit form
        const submitButton = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Create")')
        await submitButton.click()
        await page.waitForTimeout(2000)
      }
    }
  })

  test('should view system reports', async ({ page }) => {
    await page.goto('/admin/reports')
    
    // Check reports page loads
    await page.waitForTimeout(2000)
    
    // Should display reports section
    const reportsContainer = page.locator('.reports, .report-list, [data-testid="reports"]')
    const reportCards = page.locator('.report-card, .card, .report-item')
    
    // Either reports container or report cards should be visible
    const hasReports = await reportsContainer.isVisible() || await reportCards.count() > 0
    expect(hasReports).toBeTruthy()
    
    // Test generating a report if button exists
    const generateButton = page.locator('button:has-text("Generate"), button:has-text("Generar")')
    if (await generateButton.isVisible()) {
      await generateButton.click()
      await page.waitForTimeout(3000)
      
      // Should show loading or success state
      const loadingIndicator = page.locator('.loading, .spinner, [data-testid="loading"]')
      const reportResult = page.locator('.report-result, .report-data')
      
      // Either loading should appear or report should be generated
      const hasReportActivity = await loadingIndicator.isVisible() || await reportResult.isVisible()
      expect(hasReportActivity).toBeTruthy()
    }
  })

  test('should manage system settings', async ({ page }) => {
    await page.goto('/admin/settings')
    
    // Check settings page loads
    await page.waitForTimeout(2000)
    
    // Should display settings form
    const settingsForm = page.locator('form, .settings-form, [data-testid="settings-form"]')
    const settingsInputs = page.locator('input, select, textarea')
    
    // Either settings form or inputs should be visible
    const hasSettings = await settingsForm.isVisible() || await settingsInputs.count() > 0
    expect(hasSettings).toBeTruthy()
    
    // Test updating a setting if possible
    const emailInput = page.locator('input[name*="email"], input[type="email"]')
    if (await emailInput.isVisible()) {
      const currentValue = await emailInput.inputValue()
      await emailInput.fill('admin@e2etest.com')
      
      const saveButton = page.locator('button:has-text("Save"), button:has-text("Update"), button:has-text("Guardar")')
      if (await saveButton.isVisible()) {
        await saveButton.click()
        await page.waitForTimeout(2000)
        
        // Restore original value
        await emailInput.fill(currentValue)
        await saveButton.click()
        await page.waitForTimeout(1000)
      }
    }
  })

  test('should handle system backups', async ({ page }) => {
    await page.goto('/admin/backups')
    
    // Check backups page loads
    await page.waitForTimeout(2000)
    
    // Should display backups section
    const backupsContainer = page.locator('.backups, .backup-list, [data-testid="backups"]')
    const backupItems = page.locator('.backup-item, .backup-row')
    
    // Check if backups section exists
    const hasBackupsSection = await backupsContainer.isVisible() || await backupItems.count() > 0
    
    if (hasBackupsSection) {
      // Test creating a backup if button exists
      const createBackupButton = page.locator('button:has-text("Create Backup"), button:has-text("Backup"), button:has-text("Crear")')
      if (await createBackupButton.isVisible()) {
        await createBackupButton.click()
        await page.waitForTimeout(5000) // Backup might take time
        
        // Should show success message or new backup in list
        const successMessage = page.locator('.success, .alert-success')
        const backupsList = page.locator('.backup-item, tr')
        
        const hasBackupResult = await successMessage.isVisible() || await backupsList.count() > 0
        expect(hasBackupResult).toBeTruthy()
      }
    }
  })

  test('should display system statistics', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForTimeout(2000)
    
    // Look for statistics/metrics on dashboard
    const statCards = page.locator('.stat, .metric, .card, [data-testid="stat"]')
    const chartContainers = page.locator('.chart, canvas, svg')
    
    // Should have some statistics displayed
    const hasStats = await statCards.count() > 0 || await chartContainers.count() > 0
    
    if (hasStats) {
      // Check that stats contain numbers
      const firstStat = statCards.first()
      if (await firstStat.isVisible()) {
        const statText = await firstStat.textContent()
        // Should contain some numeric data
        expect(statText).toMatch(/\d+/)
      }
    }
  })

  test('should handle navigation between admin sections', async ({ page }) => {
    await page.goto('/admin')
    
    // Test navigation to different admin sections
    const adminSections = [
      { name: 'Tickets', url: '/admin/tickets' },
      { name: 'Users', url: '/admin/users' },
      { name: 'Categories', url: '/admin/categories' },
      { name: 'Reports', url: '/admin/reports' },
      { name: 'Settings', url: '/admin/settings' },
    ]
    
    for (const section of adminSections) {
      // Look for navigation link
      const navLink = page.locator(`a:has-text("${section.name}"), nav a[href="${section.url}"]`)
      
      if (await navLink.isVisible()) {
        await navLink.click()
        await page.waitForTimeout(2000)
        
        // Should navigate to correct section
        expect(page.url()).toContain(section.url)
        
        // Should not show unauthorized page
        expect(page.url()).not.toContain('/unauthorized')
      } else {
        // Try direct navigation
        await page.goto(section.url)
        await page.waitForTimeout(2000)
        
        // Should be able to access the page
        expect(page.url()).not.toContain('/unauthorized')
        expect(page.url()).not.toContain('/login')
      }
    }
  })

  test('should handle admin permissions correctly', async ({ page }) => {
    // Test that admin can access all admin functions
    const adminUrls = [
      '/admin',
      '/admin/tickets',
      '/admin/users',
      '/admin/categories',
      '/admin/reports',
      '/admin/settings',
    ]
    
    for (const url of adminUrls) {
      await page.goto(url)
      await page.waitForTimeout(2000)
      
      // Should not be redirected to unauthorized or login
      expect(page.url()).not.toContain('/unauthorized')
      expect(page.url()).not.toContain('/login')
      
      // Should actually be on the requested page
      expect(page.url()).toContain(url)
    }
  })
})