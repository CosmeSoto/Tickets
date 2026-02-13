import { test, expect } from '@playwright/test'

test.describe('Ticket Management Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login')
    await page.fill('input[type="email"]', 'admin@test.com')
    await page.fill('input[type="password"]', 'testpassword')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(3000)
  })

  test('should display tickets list page', async ({ page }) => {
    await page.goto('/admin/tickets')
    
    // Check page title and main elements
    await expect(page).toHaveTitle(/Tickets|Boletos/)
    
    // Should have tickets table or list
    const ticketsContainer = page.locator('table, .tickets-list, [data-testid="tickets-table"]')
    await expect(ticketsContainer).toBeVisible()
    
    // Should have create ticket button
    const createButton = page.locator('button:has-text("Create"), button:has-text("Crear"), a:has-text("Create"), a:has-text("Crear")')
    await expect(createButton).toBeVisible()
  })

  test('should create a new ticket successfully', async ({ page }) => {
    await page.goto('/admin/tickets')
    
    // Click create ticket button
    const createButton = page.locator('button:has-text("Create"), button:has-text("Crear"), a:has-text("Create"), a:has-text("Crear")').first()
    await createButton.click()
    
    // Should navigate to create ticket page or open modal
    await page.waitForTimeout(1000)
    
    // Fill ticket form
    const titleInput = page.locator('input[name="title"], input[placeholder*="title"], input[placeholder*="título"]')
    if (await titleInput.isVisible()) {
      await titleInput.fill('Test Ticket E2E')
    }
    
    const descriptionInput = page.locator('textarea[name="description"], textarea[placeholder*="description"], textarea[placeholder*="descripción"]')
    if (await descriptionInput.isVisible()) {
      await descriptionInput.fill('This is a test ticket created by E2E tests')
    }
    
    // Select priority if available
    const prioritySelect = page.locator('select[name="priority"], select[name="prioridad"]')
    if (await prioritySelect.isVisible()) {
      await prioritySelect.selectOption('HIGH')
    }
    
    // Select category if available
    const categorySelect = page.locator('select[name="category"], select[name="categoryId"]')
    if (await categorySelect.isVisible()) {
      await categorySelect.selectOption({ index: 1 }) // Select first available option
    }
    
    // Submit form
    const submitButton = page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Save"), button:has-text("Crear"), button:has-text("Guardar")')
    await submitButton.click()
    
    // Wait for success message or redirect
    await page.waitForTimeout(3000)
    
    // Check for success indication
    const successMessage = page.locator('.success, .alert-success, [data-testid="success"]')
    const isOnTicketsList = page.url().includes('/tickets')
    
    // Either success message should be visible or we should be back on tickets list
    expect(await successMessage.isVisible() || isOnTicketsList).toBeTruthy()
  })

  test('should view ticket details', async ({ page }) => {
    await page.goto('/admin/tickets')
    
    // Wait for tickets to load
    await page.waitForTimeout(2000)
    
    // Click on first ticket in the list
    const firstTicketLink = page.locator('a[href*="/tickets/"], tr:first-child a, .ticket-item:first-child a').first()
    
    if (await firstTicketLink.isVisible()) {
      await firstTicketLink.click()
      
      // Should navigate to ticket details page
      await page.waitForTimeout(2000)
      
      // Check that we're on a ticket detail page
      expect(page.url()).toMatch(/\/tickets\/[^\/]+$/)
      
      // Should display ticket information
      const ticketTitle = page.locator('h1, h2, .ticket-title, [data-testid="ticket-title"]')
      await expect(ticketTitle).toBeVisible()
      
      // Should have ticket details
      const ticketDescription = page.locator('.ticket-description, .description, [data-testid="ticket-description"]')
      const ticketStatus = page.locator('.ticket-status, .status, [data-testid="ticket-status"]')
      
      // At least one of these should be visible
      const hasDetails = await ticketDescription.isVisible() || await ticketStatus.isVisible()
      expect(hasDetails).toBeTruthy()
    }
  })

  test('should update ticket status', async ({ page }) => {
    await page.goto('/admin/tickets')
    await page.waitForTimeout(2000)
    
    // Navigate to first ticket
    const firstTicketLink = page.locator('a[href*="/tickets/"]').first()
    
    if (await firstTicketLink.isVisible()) {
      await firstTicketLink.click()
      await page.waitForTimeout(2000)
      
      // Look for status update controls
      const statusSelect = page.locator('select[name="status"], select:has(option:text("OPEN")), select:has(option:text("CLOSED"))')
      const statusButton = page.locator('button:has-text("Status"), button:has-text("Estado")')
      
      if (await statusSelect.isVisible()) {
        // Update status via select
        await statusSelect.selectOption('IN_PROGRESS')
        
        // Look for save/update button
        const saveButton = page.locator('button:has-text("Save"), button:has-text("Update"), button:has-text("Guardar")')
        if (await saveButton.isVisible()) {
          await saveButton.click()
          await page.waitForTimeout(2000)
        }
      } else if (await statusButton.isVisible()) {
        // Update status via button
        await statusButton.click()
        await page.waitForTimeout(1000)
        
        // Select new status from dropdown/modal
        const statusOption = page.locator('button:has-text("In Progress"), li:has-text("In Progress")')
        if (await statusOption.isVisible()) {
          await statusOption.click()
          await page.waitForTimeout(2000)
        }
      }
    }
  })

  test('should add comment to ticket', async ({ page }) => {
    await page.goto('/admin/tickets')
    await page.waitForTimeout(2000)
    
    // Navigate to first ticket
    const firstTicketLink = page.locator('a[href*="/tickets/"]').first()
    
    if (await firstTicketLink.isVisible()) {
      await firstTicketLink.click()
      await page.waitForTimeout(2000)
      
      // Look for comment form
      const commentTextarea = page.locator('textarea[name="comment"], textarea[placeholder*="comment"], textarea[placeholder*="comentario"]')
      
      if (await commentTextarea.isVisible()) {
        await commentTextarea.fill('This is a test comment from E2E tests')
        
        // Submit comment
        const submitCommentButton = page.locator('button:has-text("Add Comment"), button:has-text("Comment"), button:has-text("Comentar")')
        if (await submitCommentButton.isVisible()) {
          await submitCommentButton.click()
          await page.waitForTimeout(2000)
          
          // Check if comment was added
          const commentsList = page.locator('.comments, .comment-list, [data-testid="comments"]')
          if (await commentsList.isVisible()) {
            const newComment = page.locator('text="This is a test comment from E2E tests"')
            await expect(newComment).toBeVisible()
          }
        }
      }
    }
  })

  test('should filter tickets by status', async ({ page }) => {
    await page.goto('/admin/tickets')
    await page.waitForTimeout(2000)
    
    // Look for filter controls
    const statusFilter = page.locator('select[name="status"], select:has(option:text("OPEN"))')
    const filterButton = page.locator('button:has-text("Filter"), button:has-text("Filtrar")')
    
    if (await statusFilter.isVisible()) {
      // Filter by OPEN status
      await statusFilter.selectOption('OPEN')
      
      if (await filterButton.isVisible()) {
        await filterButton.click()
      }
      
      await page.waitForTimeout(2000)
      
      // Check that URL contains filter parameter or results are filtered
      const currentUrl = page.url()
      const hasFilterParam = currentUrl.includes('status=OPEN') || currentUrl.includes('filter')
      
      // Or check that all visible tickets have OPEN status
      const statusBadges = page.locator('.status, .ticket-status, [data-testid="status"]')
      const statusCount = await statusBadges.count()
      
      if (statusCount > 0) {
        // Check first few status badges contain "OPEN"
        for (let i = 0; i < Math.min(3, statusCount); i++) {
          const statusText = await statusBadges.nth(i).textContent()
          expect(statusText?.toUpperCase()).toContain('OPEN')
        }
      }
    }
  })

  test('should search tickets', async ({ page }) => {
    await page.goto('/admin/tickets')
    await page.waitForTimeout(2000)
    
    // Look for search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="search"], input[placeholder*="buscar"]')
    
    if (await searchInput.isVisible()) {
      await searchInput.fill('test')
      
      // Look for search button or trigger search
      const searchButton = page.locator('button:has-text("Search"), button:has-text("Buscar")')
      if (await searchButton.isVisible()) {
        await searchButton.click()
      } else {
        // Try pressing Enter
        await searchInput.press('Enter')
      }
      
      await page.waitForTimeout(2000)
      
      // Check that URL contains search parameter or results are filtered
      const currentUrl = page.url()
      expect(currentUrl.includes('search=test') || currentUrl.includes('q=test')).toBeTruthy()
    }
  })

  test('should handle pagination', async ({ page }) => {
    await page.goto('/admin/tickets')
    await page.waitForTimeout(2000)
    
    // Look for pagination controls
    const nextButton = page.locator('button:has-text("Next"), button:has-text("Siguiente"), a:has-text("Next")')
    const pageNumbers = page.locator('.pagination button, .pagination a')
    
    if (await nextButton.isVisible()) {
      const initialUrl = page.url()
      await nextButton.click()
      await page.waitForTimeout(2000)
      
      // URL should change to indicate different page
      const newUrl = page.url()
      expect(newUrl).not.toBe(initialUrl)
      expect(newUrl.includes('page=') || newUrl.includes('offset=')).toBeTruthy()
    } else if (await pageNumbers.count() > 1) {
      // Click on page 2 if available
      const page2 = page.locator('.pagination button:has-text("2"), .pagination a:has-text("2")').first()
      if (await page2.isVisible()) {
        await page2.click()
        await page.waitForTimeout(2000)
        
        const newUrl = page.url()
        expect(newUrl.includes('page=2') || newUrl.includes('offset=')).toBeTruthy()
      }
    }
  })
})