import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the login page
    await page.goto('/login')
  })

  test('should display login page correctly', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/Login/)
    
    // Check login form elements
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
    
    // Check login button text
    await expect(page.locator('button[type="submit"]')).toContainText(/Sign In|Login|Iniciar/)
  })

  test('should show validation errors for empty form', async ({ page }) => {
    // Try to submit empty form
    await page.click('button[type="submit"]')
    
    // Check for validation messages (may vary based on implementation)
    const emailInput = page.locator('input[type="email"]')
    const passwordInput = page.locator('input[type="password"]')
    
    // Check HTML5 validation or custom validation
    await expect(emailInput).toHaveAttribute('required')
    await expect(passwordInput).toHaveAttribute('required')
  })

  test('should show error for invalid credentials', async ({ page }) => {
    // Fill form with invalid credentials
    await page.fill('input[type="email"]', 'invalid@example.com')
    await page.fill('input[type="password"]', 'wrongpassword')
    
    // Submit form
    await page.click('button[type="submit"]')
    
    // Wait for error message (adjust selector based on your implementation)
    await page.waitForTimeout(2000) // Give time for authentication attempt
    
    // Check for error message or that we're still on login page
    const currentUrl = page.url()
    expect(currentUrl).toContain('/login')
  })

  test('should handle successful login flow', async ({ page }) => {
    // Note: This test assumes you have test credentials set up
    // You may need to create a test user or mock the authentication
    
    // Fill form with valid test credentials
    await page.fill('input[type="email"]', 'admin@test.com')
    await page.fill('input[type="password"]', 'testpassword')
    
    // Submit form
    await page.click('button[type="submit"]')
    
    // Wait for navigation or success indicator
    await page.waitForTimeout(3000)
    
    // Check if redirected to dashboard or home page
    const currentUrl = page.url()
    expect(currentUrl).not.toContain('/login')
    
    // Should be redirected to dashboard, admin, or home page
    expect(currentUrl).toMatch(/(dashboard|admin|home|\/$)/)
  })

  test('should redirect unauthenticated users to login', async ({ page }) => {
    // Try to access protected route without authentication
    await page.goto('/admin')
    
    // Should be redirected to login
    await page.waitForURL('**/login**')
    expect(page.url()).toContain('/login')
  })

  test('should handle logout flow', async ({ page }) => {
    // First login (assuming we have a way to authenticate)
    await page.goto('/login')
    await page.fill('input[type="email"]', 'admin@test.com')
    await page.fill('input[type="password"]', 'testpassword')
    await page.click('button[type="submit"]')
    
    // Wait for successful login
    await page.waitForTimeout(3000)
    
    // Look for logout button or menu
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Cerrar"), a:has-text("Logout"), a:has-text("Cerrar")')
    
    if (await logoutButton.isVisible()) {
      await logoutButton.click()
      
      // Should be redirected to login page
      await page.waitForURL('**/login**')
      expect(page.url()).toContain('/login')
    }
  })

  test('should maintain session across page refreshes', async ({ page }) => {
    // Login first
    await page.goto('/login')
    await page.fill('input[type="email"]', 'admin@test.com')
    await page.fill('input[type="password"]', 'testpassword')
    await page.click('button[type="submit"]')
    
    // Wait for successful login
    await page.waitForTimeout(3000)
    
    // Navigate to a protected page
    await page.goto('/admin')
    
    // Refresh the page
    await page.reload()
    
    // Should still be authenticated and not redirected to login
    await page.waitForTimeout(2000)
    expect(page.url()).not.toContain('/login')
  })

  test('should handle different user roles correctly', async ({ page }) => {
    // Test admin access
    await page.goto('/login')
    await page.fill('input[type="email"]', 'admin@test.com')
    await page.fill('input[type="password"]', 'testpassword')
    await page.click('button[type="submit"]')
    
    await page.waitForTimeout(3000)
    
    // Admin should be able to access admin pages
    await page.goto('/admin')
    await page.waitForTimeout(2000)
    
    // Should not be redirected to unauthorized page
    expect(page.url()).not.toContain('/unauthorized')
    expect(page.url()).not.toContain('/login')
  })
})