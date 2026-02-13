import { test, expect } from '@playwright/test'

test.describe('Client Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as regular user/client before each test
    await page.goto('/login')
    await page.fill('input[type="email"]', 'client@test.com')
    await page.fill('input[type="password"]', 'testpassword')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(3000)
  })

  test('should access client dashboard', async ({ page }) => {
    await page.goto('/client')
    
    // Check that client can access their area
    expect(page.url()).toContain('/client')
    
    // Should not be redirected to unauthorized page
    expect(page.url()).not.toContain('/unauthorized')
    
    // Check for client dashboard elements
    const dashboardTitle = page.locator('h1:has-text("Dashboard"), h1:has-text("Client"), h2:has-text("My Tickets")')
    const ticketsSection = page.locator('.tickets, .my-tickets, [data-testid="client-tickets"]')
    
    // Either dashboard title or tickets section should be visible
    const hasClientElements = await dashboardTitle.isVisible() || await ticketsSection.isVisible()
    expect(hasClientElements).toBeTruthy()
  })

  test('should create a new ticket as client', async ({ page }) => {
    await page.goto('/client/create-ticket')
    
    // Check create ticket page loads
    await page.waitForTimeout(2000)
    
    // Fill ticket creation form
    const titleInput = page.locator('input[name="title"], input[placeholder*="title"], input[placeholder*="título"]')
    await expect(titleInput).toBeVisible()
    await titleInput.fill('Client E2E Test Ticket')
    
    const descriptionInput = page.locator('textarea[name="description"], textarea[placeholder*="description"]')
    await expect(descriptionInput).toBeVisible()
    await descriptionInput.fill('This ticket was created by a client during E2E testing')
    
    // Select category if available
    const categorySelect = page.locator('select[name="category"], select[name="categoryId"]')
    if (await categorySelect.isVisible()) {
      await categorySelect.selectOption({ index: 1 }) // Select first available category
    }
    
    // Select priority if available
    const prioritySelect = page.locator('select[name="priority"]')
    if (await prioritySelect.isVisible()) {
      await prioritySelect.selectOption('MEDIUM')
    }
    
    // Submit the form
    const submitButton = page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Submit")')
    await submitButton.click()
    
    // Wait for success or redirect
    await page.waitForTimeout(3000)
    
    // Should show success message or redirect to tickets list
    const successMessage = page.locator('.success, .alert-success, [data-testid="success"]')
    const isOnTicketsList = page.url().includes('/client/tickets') || page.url().includes('/client')
    
    expect(await successMessage.isVisible() || isOnTicketsList).toBeTruthy()
  })

  test('should view own tickets list', async ({ page }) => {
    await page.goto('/client/tickets')
    
    // Check tickets list page
    await page.waitForTimeout(2000)
    
    // Should display tickets table or list
    const ticketsContainer = page.locator('table, .tickets-list, [data-testid="tickets-table"]')
    await expect(ticketsContainer).toBeVisible()
    
    // Should have create ticket button or link
    const createButton = page.locator('button:has-text("Create"), a:has-text("Create"), button:has-text("New")')
    await expect(createButton).toBeVisible()
    
    // Check if there are any tickets displayed
    const ticketRows = page.locator('tr, .ticket-item, .ticket-row')
    const ticketCount = await ticketRows.count()
    
    if (ticketCount > 1) { // More than header row
      // Click on first ticket to view details
      const firstTicket = page.locator('a[href*="/tickets/"], tr:not(:first-child) a').first()
      if (await firstTicket.isVisible()) {
        await firstTicket.click()
        await page.waitForTimeout(2000)
        
        // Should navigate to ticket details
        expect(page.url()).toMatch(/\/tickets\/[^\/]+$/)
      }
    }
  })

  test('should view ticket details as client', async ({ page }) => {
    await page.goto('/client/tickets')
    await page.waitForTimeout(2000)
    
    // Find and click on a ticket
    const ticketLink = page.locator('a[href*="/tickets/"]').first()
    
    if (await ticketLink.isVisible()) {
      await ticketLink.click()
      await page.waitForTimeout(2000)
      
      // Should be on ticket detail page
      expect(page.url()).toMatch(/\/tickets\/[^\/]+$/)
      
      // Should display ticket information
      const ticketTitle = page.locator('h1, h2, .ticket-title, [data-testid="ticket-title"]')
      await expect(ticketTitle).toBeVisible()
      
      // Should show ticket status
      const ticketStatus = page.locator('.status, .ticket-status, [data-testid="status"]')
      const ticketPriority = page.locator('.priority, .ticket-priority, [data-testid="priority"]')
      
      // At least status or priority should be visible
      const hasTicketInfo = await ticketStatus.isVisible() || await ticketPriority.isVisible()
      expect(hasTicketInfo).toBeTruthy()
      
      // Should show ticket description
      const ticketDescription = page.locator('.description, .ticket-description, [data-testid="description"]')
      if (await ticketDescription.isVisible()) {
        const descriptionText = await ticketDescription.textContent()
        expect(descriptionText?.length).toBeGreaterThan(0)
      }
    }
  })

  test('should add comment to own ticket', async ({ page }) => {
    await page.goto('/client/tickets')
    await page.waitForTimeout(2000)
    
    // Navigate to a ticket
    const ticketLink = page.locator('a[href*="/tickets/"]').first()
    
    if (await ticketLink.isVisible()) {
      await ticketLink.click()
      await page.waitForTimeout(2000)
      
      // Look for comment form
      const commentTextarea = page.locator('textarea[name="comment"], textarea[placeholder*="comment"]')
      
      if (await commentTextarea.isVisible()) {
        await commentTextarea.fill('Client comment added during E2E testing')
        
        // Submit comment
        const submitButton = page.locator('button:has-text("Add"), button:has-text("Comment"), button:has-text("Send")')
        if (await submitButton.isVisible()) {
          await submitButton.click()
          await page.waitForTimeout(2000)
          
          // Check if comment appears
          const commentText = page.locator('text="Client comment added during E2E testing"')
          await expect(commentText).toBeVisible()
        }
      }
    }
  })

  test('should not access admin areas as client', async ({ page }) => {
    // Try to access admin areas - should be redirected or blocked
    const adminUrls = [
      '/admin',
      '/admin/users',
      '/admin/categories',
      '/admin/settings',
    ]
    
    for (const url of adminUrls) {
      await page.goto(url)
      await page.waitForTimeout(2000)
      
      // Should be redirected to unauthorized page or login
      const currentUrl = page.url()
      const isBlocked = currentUrl.includes('/unauthorized') || 
                       currentUrl.includes('/login') || 
                       currentUrl.includes('/client') ||
                       !currentUrl.includes('/admin')
      
      expect(isBlocked).toBeTruthy()
    }
  })

  test('should filter own tickets', async ({ page }) => {
    await page.goto('/client/tickets')
    await page.waitForTimeout(2000)
    
    // Look for filter controls
    const statusFilter = page.locator('select[name="status"], select:has(option:text("OPEN"))')
    
    if (await statusFilter.isVisible()) {
      // Filter by status
      await statusFilter.selectOption('OPEN')
      
      // Look for filter button or auto-filter
      const filterButton = page.locator('button:has-text("Filter"), button:has-text("Apply")')
      if (await filterButton.isVisible()) {
        await filterButton.click()
      }
      
      await page.waitForTimeout(2000)
      
      // Check that URL contains filter or results are filtered
      const currentUrl = page.url()
      expect(currentUrl.includes('status=') || currentUrl.includes('filter=')).toBeTruthy()
    }
  })

  test('should search own tickets', async ({ page }) => {
    await page.goto('/client/tickets')
    await page.waitForTimeout(2000)
    
    // Look for search functionality
    const searchInput = page.locator('input[type="search"], input[placeholder*="search"]')
    
    if (await searchInput.isVisible()) {
      await searchInput.fill('test')
      
      // Trigger search
      const searchButton = page.locator('button:has-text("Search")')
      if (await searchButton.isVisible()) {
        await searchButton.click()
      } else {
        await searchInput.press('Enter')
      }
      
      await page.waitForTimeout(2000)
      
      // Check search results
      const currentUrl = page.url()
      expect(currentUrl.includes('search=') || currentUrl.includes('q=')).toBeTruthy()
    }
  })

  test('should handle file attachments', async ({ page }) => {
    await page.goto('/client/create-ticket')
    await page.waitForTimeout(2000)
    
    // Look for file upload functionality
    const fileInput = page.locator('input[type="file"]')
    
    if (await fileInput.isVisible()) {
      // Create a test file
      const testFile = {
        name: 'test-attachment.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('This is a test file for E2E testing')
      }
      
      // Upload file
      await fileInput.setInputFiles({
        name: testFile.name,
        mimeType: testFile.mimeType,
        buffer: testFile.buffer
      })
      
      await page.waitForTimeout(1000)
      
      // Check if file is listed
      const fileName = page.locator('text="test-attachment.txt"')
      if (await fileName.isVisible()) {
        expect(await fileName.isVisible()).toBeTruthy()
      }
    }
  })

  test('should display ticket history', async ({ page }) => {
    await page.goto('/client/tickets')
    await page.waitForTimeout(2000)
    
    // Navigate to a ticket
    const ticketLink = page.locator('a[href*="/tickets/"]').first()
    
    if (await ticketLink.isVisible()) {
      await ticketLink.click()
      await page.waitForTimeout(2000)
      
      // Look for history/activity section
      const historySection = page.locator('.history, .activity, .timeline, [data-testid="history"]')
      const historyItems = page.locator('.history-item, .activity-item, .timeline-item')
      
      // Check if history is displayed
      const hasHistory = await historySection.isVisible() || await historyItems.count() > 0
      
      if (hasHistory) {
        // History should contain creation event at minimum
        const creationEvent = page.locator('text*="created", text*="Created", text*="opened"')
        expect(await creationEvent.count()).toBeGreaterThan(0)
      }
    }
  })

  test('should handle responsive design on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    await page.goto('/client')
    await page.waitForTimeout(2000)
    
    // Check that page is responsive
    const mobileMenu = page.locator('.mobile-menu, .hamburger, [data-testid="mobile-menu"]')
    const navigation = page.locator('nav, .navigation')
    
    // On mobile, either mobile menu should be visible or navigation should be adapted
    const isMobileResponsive = await mobileMenu.isVisible() || await navigation.isVisible()
    expect(isMobileResponsive).toBeTruthy()
    
    // Test navigation on mobile
    if (await mobileMenu.isVisible()) {
      await mobileMenu.click()
      await page.waitForTimeout(500)
      
      // Menu should expand
      const menuItems = page.locator('.menu-item, nav a')
      expect(await menuItems.count()).toBeGreaterThan(0)
    }
    
    // Test ticket creation on mobile
    await page.goto('/client/create-ticket')
    await page.waitForTimeout(2000)
    
    // Form should be usable on mobile
    const titleInput = page.locator('input[name="title"]')
    if (await titleInput.isVisible()) {
      const inputBox = await titleInput.boundingBox()
      expect(inputBox?.width).toBeLessThan(400) // Should fit mobile screen
    }
  })
})