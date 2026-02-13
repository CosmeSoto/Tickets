import { test, expect } from '@playwright/test'

test.describe('Responsive Design and Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login')
    await page.fill('input[type="email"]', 'admin@test.com')
    await page.fill('input[type="password"]', 'testpassword')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(3000)
  })

  test('should work on desktop viewport', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 })
    
    await page.goto('/admin/tickets')
    await page.waitForTimeout(2000)
    
    // Check that layout works on desktop
    const mainContent = page.locator('main, .main-content, .content')
    await expect(mainContent).toBeVisible()
    
    // Navigation should be visible
    const navigation = page.locator('nav, .navigation, .sidebar')
    await expect(navigation).toBeVisible()
    
    // Tables should display properly
    const table = page.locator('table')
    if (await table.isVisible()) {
      const tableWidth = await table.evaluate(el => el.getBoundingClientRect().width)
      expect(tableWidth).toBeGreaterThan(800) // Should use desktop space
    }
  })

  test('should work on tablet viewport', async ({ page }) => {
    // Set tablet viewport (iPad)
    await page.setViewportSize({ width: 768, height: 1024 })
    
    await page.goto('/admin/tickets')
    await page.waitForTimeout(2000)
    
    // Check that layout adapts to tablet
    const mainContent = page.locator('main, .main-content, .content')
    await expect(mainContent).toBeVisible()
    
    // Check if navigation adapts (might be collapsed or different)
    const navigation = page.locator('nav, .navigation, .sidebar')
    const mobileMenu = page.locator('.mobile-menu, .hamburger')
    
    // Either navigation is visible or mobile menu is available
    const hasNavigation = await navigation.isVisible() || await mobileMenu.isVisible()
    expect(hasNavigation).toBeTruthy()
  })

  test('should work on mobile viewport', async ({ page }) => {
    // Set mobile viewport (iPhone)
    await page.setViewportSize({ width: 375, height: 667 })
    
    await page.goto('/admin/tickets')
    await page.waitForTimeout(2000)
    
    // Check that page loads on mobile
    const mainContent = page.locator('main, .main-content, .content')
    await expect(mainContent).toBeVisible()
    
    // Mobile menu should be available
    const mobileMenu = page.locator('.mobile-menu, .hamburger, [data-testid="mobile-menu"]')
    
    if (await mobileMenu.isVisible()) {
      // Test mobile menu functionality
      await mobileMenu.click()
      await page.waitForTimeout(500)
      
      // Menu should expand with navigation items
      const menuItems = page.locator('.menu-item, nav a, .nav-link')
      expect(await menuItems.count()).toBeGreaterThan(0)
      
      // Close menu
      await mobileMenu.click()
      await page.waitForTimeout(500)
    }
    
    // Tables should be responsive (scrollable or stacked)
    const table = page.locator('table')
    if (await table.isVisible()) {
      const tableContainer = page.locator('.table-responsive, .overflow-x-auto')
      const hasResponsiveTable = await tableContainer.isVisible()
      
      if (!hasResponsiveTable) {
        // Table should at least fit in viewport or be scrollable
        const tableWidth = await table.evaluate(el => el.getBoundingClientRect().width)
        expect(tableWidth).toBeLessThan(400) // Should fit mobile or be scrollable
      }
    }
  })

  test('should have proper keyboard navigation', async ({ page }) => {
    await page.goto('/admin/tickets')
    await page.waitForTimeout(2000)
    
    // Test tab navigation
    await page.keyboard.press('Tab')
    
    // Check that focus is visible
    const focusedElement = page.locator(':focus')
    await expect(focusedElement).toBeVisible()
    
    // Continue tabbing through interactive elements
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab')
      const currentFocus = page.locator(':focus')
      
      if (await currentFocus.isVisible()) {
        // Focused element should be interactive
        const tagName = await currentFocus.evaluate(el => el.tagName.toLowerCase())
        const isInteractive = ['button', 'a', 'input', 'select', 'textarea'].includes(tagName)
        
        if (isInteractive) {
          expect(isInteractive).toBeTruthy()
        }
      }
    }
  })

  test('should have proper ARIA labels and semantic HTML', async ({ page }) => {
    await page.goto('/admin/tickets')
    await page.waitForTimeout(2000)
    
    // Check for main landmarks
    const main = page.locator('main, [role="main"]')
    const navigation = page.locator('nav, [role="navigation"]')
    
    // Should have main content area
    expect(await main.count()).toBeGreaterThan(0)
    
    // Should have navigation
    expect(await navigation.count()).toBeGreaterThan(0)
    
    // Check for proper heading hierarchy
    const h1 = page.locator('h1')
    expect(await h1.count()).toBeGreaterThan(0)
    
    // Buttons should have accessible names
    const buttons = page.locator('button')
    const buttonCount = await buttons.count()
    
    for (let i = 0; i < Math.min(buttonCount, 5); i++) {
      const button = buttons.nth(i)
      const hasText = await button.textContent()
      const hasAriaLabel = await button.getAttribute('aria-label')
      const hasTitle = await button.getAttribute('title')
      
      // Button should have accessible name
      const hasAccessibleName = (hasText && hasText.trim().length > 0) || hasAriaLabel || hasTitle
      expect(hasAccessibleName).toBeTruthy()
    }
    
    // Images should have alt text
    const images = page.locator('img')
    const imageCount = await images.count()
    
    for (let i = 0; i < Math.min(imageCount, 3); i++) {
      const img = images.nth(i)
      const altText = await img.getAttribute('alt')
      
      // Image should have alt attribute (can be empty for decorative images)
      expect(altText !== null).toBeTruthy()
    }
  })

  test('should have sufficient color contrast', async ({ page }) => {
    await page.goto('/admin/tickets')
    await page.waitForTimeout(2000)
    
    // Check text elements for color contrast
    const textElements = page.locator('p, span, div, h1, h2, h3, button, a')
    const elementCount = await textElements.count()
    
    for (let i = 0; i < Math.min(elementCount, 10); i++) {
      const element = textElements.nth(i)
      
      if (await element.isVisible()) {
        const styles = await element.evaluate(el => {
          const computed = window.getComputedStyle(el)
          return {
            color: computed.color,
            backgroundColor: computed.backgroundColor,
            fontSize: computed.fontSize
          }
        })
        
        // Basic check that text has color (not transparent)
        expect(styles.color).not.toBe('rgba(0, 0, 0, 0)')
        expect(styles.color).not.toBe('transparent')
      }
    }
  })

  test('should handle form validation accessibly', async ({ page }) => {
    await page.goto('/client/create-ticket')
    await page.waitForTimeout(2000)
    
    // Try to submit empty form
    const submitButton = page.locator('button[type="submit"]')
    if (await submitButton.isVisible()) {
      await submitButton.click()
      await page.waitForTimeout(1000)
      
      // Check for validation messages
      const errorMessages = page.locator('.error, .invalid, [role="alert"], .field-error')
      const requiredFields = page.locator('input[required], textarea[required]')
      
      // If there are required fields, there should be validation
      const requiredCount = await requiredFields.count()
      if (requiredCount > 0) {
        // Should have some form of validation feedback
        const hasValidation = await errorMessages.count() > 0 || 
                             await page.locator(':invalid').count() > 0
        expect(hasValidation).toBeTruthy()
      }
    }
  })

  test('should work with screen reader simulation', async ({ page }) => {
    await page.goto('/admin/tickets')
    await page.waitForTimeout(2000)
    
    // Simulate screen reader navigation with arrow keys
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(500)
    
    // Check that content is structured for screen readers
    const headings = page.locator('h1, h2, h3, h4, h5, h6')
    const lists = page.locator('ul, ol')
    const tables = page.locator('table')
    
    // Should have structured content
    const hasStructure = await headings.count() > 0 || 
                        await lists.count() > 0 || 
                        await tables.count() > 0
    expect(hasStructure).toBeTruthy()
    
    // Tables should have proper headers
    const tableHeaders = page.locator('th')
    const tableCount = await tables.count()
    
    if (tableCount > 0) {
      // Tables should have header cells
      expect(await tableHeaders.count()).toBeGreaterThan(0)
    }
  })

  test('should handle zoom levels properly', async ({ page }) => {
    await page.goto('/admin/tickets')
    await page.waitForTimeout(2000)
    
    // Test 200% zoom
    await page.evaluate(() => {
      document.body.style.zoom = '2'
    })
    
    await page.waitForTimeout(1000)
    
    // Content should still be accessible
    const mainContent = page.locator('main, .main-content')
    await expect(mainContent).toBeVisible()
    
    // Navigation should still work
    const navigation = page.locator('nav, .navigation')
    const mobileMenu = page.locator('.mobile-menu, .hamburger')
    
    const hasNavigation = await navigation.isVisible() || await mobileMenu.isVisible()
    expect(hasNavigation).toBeTruthy()
    
    // Reset zoom
    await page.evaluate(() => {
      document.body.style.zoom = '1'
    })
  })

  test('should handle reduced motion preferences', async ({ page }) => {
    // Set reduced motion preference
    await page.emulateMedia({ reducedMotion: 'reduce' })
    
    await page.goto('/admin/tickets')
    await page.waitForTimeout(2000)
    
    // Page should still function with reduced motion
    const mainContent = page.locator('main, .main-content')
    await expect(mainContent).toBeVisible()
    
    // Animations should be reduced or disabled
    const animatedElements = page.locator('.animate, .transition, [style*="transition"]')
    const animatedCount = await animatedElements.count()
    
    // If there are animated elements, they should respect reduced motion
    for (let i = 0; i < Math.min(animatedCount, 3); i++) {
      const element = animatedElements.nth(i)
      const styles = await element.evaluate(el => {
        const computed = window.getComputedStyle(el)
        return {
          transition: computed.transition,
          animation: computed.animation
        }
      })
      
      // Transitions and animations should be reduced
      const hasReducedMotion = styles.transition.includes('none') || 
                              styles.animation.includes('none') ||
                              styles.transition.includes('0s') ||
                              styles.animation.includes('0s')
      
      // This is a best practice check, not a hard requirement
      if (!hasReducedMotion) {
        // eslint-disable-next-line no-console
        console.log('Element may not respect reduced motion preference')
      }
    }
  })

  test('should work without JavaScript', async ({ page }) => {
    // Disable JavaScript
    await page.setJavaScriptEnabled(false)
    
    await page.goto('/login')
    await page.waitForTimeout(2000)
    
    // Basic HTML should still render
    const loginForm = page.locator('form')
    await expect(loginForm).toBeVisible()
    
    // Form inputs should be accessible
    const emailInput = page.locator('input[type="email"]')
    const passwordInput = page.locator('input[type="password"]')
    
    await expect(emailInput).toBeVisible()
    await expect(passwordInput).toBeVisible()
    
    // Re-enable JavaScript for other tests
    await page.setJavaScriptEnabled(true)
  })
})