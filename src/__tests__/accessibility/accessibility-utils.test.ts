/**
 * Accessibility Utils Tests
 */

import { 
  accessibilityUtils, 
  accessibilityChecker, 
  keyboardUtils,
  AccessibilityChecker,
  accessibilityRules 
} from '@/lib/accessibility/accessibility-utils'

// Mock DOM methods
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock getComputedStyle
Object.defineProperty(window, 'getComputedStyle', {
  writable: true,
  value: jest.fn().mockImplementation((element, pseudoElement) => ({
    outline: 'none',
    boxShadow: '',
    color: 'rgb(0, 0, 0)',
    backgroundColor: 'rgb(255, 255, 255)',
    getPropertyValue: jest.fn().mockReturnValue('0'),
  })),
})

describe('accessibilityUtils', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  describe('generateId', () => {
    it('generates unique IDs with prefix', () => {
      const id1 = accessibilityUtils.generateId('test')
      const id2 = accessibilityUtils.generateId('test')
      
      expect(id1).toMatch(/^test-/)
      expect(id2).toMatch(/^test-/)
      expect(id1).not.toBe(id2)
    })

    it('uses default prefix when none provided', () => {
      const id = accessibilityUtils.generateId()
      expect(id).toMatch(/^a11y-/)
    })
  })

  describe('createAriaProps', () => {
    it('filters out undefined values', () => {
      const props = accessibilityUtils.createAriaProps({
        'aria-label': 'Test label',
        'aria-hidden': undefined,
        'aria-expanded': false,
      })

      expect(props).toEqual({
        'aria-label': 'Test label',
        'aria-expanded': false,
      })
    })

    it('returns empty object for all undefined values', () => {
      const props = accessibilityUtils.createAriaProps({
        'aria-label': undefined,
        'aria-hidden': undefined,
      })

      expect(props).toEqual({})
    })
  })

  describe('announceToScreenReader', () => {
    it('creates and removes announcement element', (done) => {
      accessibilityUtils.announceToScreenReader('Test message')
      
      const announcement = document.querySelector('[aria-live="polite"]')
      expect(announcement).toBeTruthy()
      expect(announcement?.textContent).toBe('Test message')
      expect(announcement?.className).toBe('sr-only')
      
      setTimeout(() => {
        const removedAnnouncement = document.querySelector('[aria-live="polite"]')
        expect(removedAnnouncement).toBeFalsy()
        done()
      }, 1100)
    })

    it('uses assertive priority when specified', () => {
      accessibilityUtils.announceToScreenReader('Urgent message', 'assertive')
      
      const announcement = document.querySelector('[aria-live="assertive"]')
      expect(announcement).toBeTruthy()
      expect(announcement?.getAttribute('aria-atomic')).toBe('true')
    })
  })

  describe('isFocusable', () => {
    it('identifies focusable elements', () => {
      const button = document.createElement('button')
      const link = document.createElement('a')
      link.href = '#'
      const input = document.createElement('input')
      const div = document.createElement('div')
      
      expect(accessibilityUtils.isFocusable(button)).toBe(true)
      expect(accessibilityUtils.isFocusable(link)).toBe(true)
      expect(accessibilityUtils.isFocusable(input)).toBe(true)
      expect(accessibilityUtils.isFocusable(div)).toBe(false)
    })

    it('excludes disabled elements', () => {
      const button = document.createElement('button')
      button.disabled = true
      
      expect(accessibilityUtils.isFocusable(button)).toBe(false)
    })

    it('includes elements with tabindex', () => {
      const div = document.createElement('div')
      div.tabIndex = 0
      
      expect(accessibilityUtils.isFocusable(div)).toBe(true)
    })

    it('excludes elements with negative tabindex', () => {
      const div = document.createElement('div')
      div.tabIndex = -1
      
      expect(accessibilityUtils.isFocusable(div)).toBe(false)
    })
  })

  describe('getFocusableElements', () => {
    it('returns all focusable elements in container', () => {
      const container = document.createElement('div')
      container.innerHTML = `
        <button>Button 1</button>
        <a href="#">Link</a>
        <input type="text" />
        <div>Not focusable</div>
        <button disabled>Disabled</button>
        <button>Button 2</button>
      `
      
      const focusable = accessibilityUtils.getFocusableElements(container)
      expect(focusable).toHaveLength(4) // 2 buttons + 1 link + 1 input
    })

    it('returns empty array for container with no focusable elements', () => {
      const container = document.createElement('div')
      container.innerHTML = '<div>Not focusable</div><span>Also not focusable</span>'
      
      const focusable = accessibilityUtils.getFocusableElements(container)
      expect(focusable).toHaveLength(0)
    })
  })

  describe('trapFocus', () => {
    it('focuses first element and sets up event listener', () => {
      const container = document.createElement('div')
      container.innerHTML = `
        <button id="first">First</button>
        <button id="second">Second</button>
        <button id="last">Last</button>
      `
      document.body.appendChild(container)
      
      const cleanup = accessibilityUtils.trapFocus(container)
      
      expect(document.activeElement?.id).toBe('first')
      
      cleanup()
      document.body.removeChild(container)
    })

    it('returns cleanup function', () => {
      const container = document.createElement('div')
      container.innerHTML = '<button>Test</button>'
      
      const cleanup = accessibilityUtils.trapFocus(container)
      expect(typeof cleanup).toBe('function')
      
      cleanup()
    })
  })

  describe('createScreenReaderText', () => {
    it('creates span with sr-only class', () => {
      const element = accessibilityUtils.createScreenReaderText('Screen reader text')
      
      expect(element.tagName).toBe('SPAN')
      expect(element.className).toBe('sr-only')
      expect(element.textContent).toBe('Screen reader text')
    })
  })

  describe('user preferences', () => {
    it('detects reduced motion preference', () => {
      (window.matchMedia as jest.Mock).mockImplementation(query => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }))
      
      expect(accessibilityUtils.prefersReducedMotion()).toBe(true)
    })

    it('detects high contrast preference', () => {
      (window.matchMedia as jest.Mock).mockImplementation(query => ({
        matches: query === '(prefers-contrast: high)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }))
      
      expect(accessibilityUtils.prefersHighContrast()).toBe(true)
    })

    it('detects color scheme preference', () => {
      (window.matchMedia as jest.Mock).mockImplementation(query => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }))
      
      expect(accessibilityUtils.getColorSchemePreference()).toBe('dark')
    })
  })
})

describe('keyboardUtils', () => {
  describe('handleEnterOrSpace', () => {
    it('calls callback on Enter key', () => {
      const callback = jest.fn()
      const handler = keyboardUtils.handleEnterOrSpace(callback)
      
      const event = new KeyboardEvent('keydown', { key: 'Enter' })
      handler(event)
      
      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('calls callback on Space key', () => {
      const callback = jest.fn()
      const handler = keyboardUtils.handleEnterOrSpace(callback)
      
      const event = new KeyboardEvent('keydown', { key: ' ' })
      handler(event)
      
      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('does not call callback on other keys', () => {
      const callback = jest.fn()
      const handler = keyboardUtils.handleEnterOrSpace(callback)
      
      const event = new KeyboardEvent('keydown', { key: 'a' })
      handler(event)
      
      expect(callback).not.toHaveBeenCalled()
    })
  })

  describe('handleEscape', () => {
    it('calls callback on Escape key', () => {
      const callback = jest.fn()
      const handler = keyboardUtils.handleEscape(callback)
      
      const event = new KeyboardEvent('keydown', { key: 'Escape' })
      handler(event)
      
      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('does not call callback on other keys', () => {
      const callback = jest.fn()
      const handler = keyboardUtils.handleEscape(callback)
      
      const event = new KeyboardEvent('keydown', { key: 'Enter' })
      handler(event)
      
      expect(callback).not.toHaveBeenCalled()
    })
  })

  describe('handleArrowKeys', () => {
    it('calls appropriate callbacks for arrow keys', () => {
      const callbacks = {
        up: jest.fn(),
        down: jest.fn(),
        left: jest.fn(),
        right: jest.fn(),
      }
      const handler = keyboardUtils.handleArrowKeys(callbacks)
      
      handler(new KeyboardEvent('keydown', { key: 'ArrowUp' }))
      handler(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
      handler(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
      handler(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
      
      expect(callbacks.up).toHaveBeenCalledTimes(1)
      expect(callbacks.down).toHaveBeenCalledTimes(1)
      expect(callbacks.left).toHaveBeenCalledTimes(1)
      expect(callbacks.right).toHaveBeenCalledTimes(1)
    })

    it('does not call callbacks for other keys', () => {
      const callbacks = {
        up: jest.fn(),
        down: jest.fn(),
        left: jest.fn(),
        right: jest.fn(),
      }
      const handler = keyboardUtils.handleArrowKeys(callbacks)
      
      handler(new KeyboardEvent('keydown', { key: 'Enter' }))
      
      expect(callbacks.up).not.toHaveBeenCalled()
      expect(callbacks.down).not.toHaveBeenCalled()
      expect(callbacks.left).not.toHaveBeenCalled()
      expect(callbacks.right).not.toHaveBeenCalled()
    })
  })
})

describe('AccessibilityChecker', () => {
  let checker: AccessibilityChecker

  beforeEach(() => {
    checker = new AccessibilityChecker()
    document.body.innerHTML = ''
  })

  describe('auditPage', () => {
    it('finds missing alt text issues', () => {
      document.body.innerHTML = '<img src="test.jpg" />'
      
      const issues = checker.auditPage()
      const altTextIssue = issues.find(issue => issue.rule.name === 'missing-alt-text')
      
      expect(altTextIssue).toBeTruthy()
    })

    it('finds missing form label issues', () => {
      document.body.innerHTML = '<input type="text" />'
      
      const issues = checker.auditPage()
      const labelIssue = issues.find(issue => issue.rule.name === 'missing-form-labels')
      
      expect(labelIssue).toBeTruthy()
    })

    it('does not flag properly labeled inputs', () => {
      document.body.innerHTML = `
        <label for="test-input">Test Label</label>
        <input type="text" id="test-input" />
      `
      
      const issues = checker.auditPage()
      const labelIssue = issues.find(issue => issue.rule.name === 'missing-form-labels')
      
      expect(labelIssue).toBeFalsy()
    })

    it('does not flag inputs with aria-label', () => {
      document.body.innerHTML = '<input type="text" aria-label="Test input" />'
      
      const issues = checker.auditPage()
      const labelIssue = issues.find(issue => issue.rule.name === 'missing-form-labels')
      
      expect(labelIssue).toBeFalsy()
    })
  })

  describe('generateReport', () => {
    it('generates comprehensive report', () => {
      document.body.innerHTML = `
        <img src="test.jpg" />
        <input type="text" />
        <button style="outline: none;">Button</button>
      `
      
      const report = checker.generateReport()
      
      expect(report.summary.total).toBeGreaterThan(0)
      expect(report.summary.errors).toBeGreaterThan(0)
      expect(report.issues).toBeInstanceOf(Array)
      expect(report.issues.length).toBe(report.summary.total)
    })

    it('categorizes issues by severity', () => {
      document.body.innerHTML = `
        <img src="test.jpg" />
        <input type="text" />
      `
      
      const report = checker.generateReport()
      
      expect(report.summary.errors).toBeGreaterThan(0)
      expect(report.summary.total).toBe(report.summary.errors + report.summary.warnings + report.summary.info)
    })

    it('categorizes issues by WCAG level', () => {
      document.body.innerHTML = `
        <img src="test.jpg" />
        <input type="text" />
      `
      
      const report = checker.generateReport()
      
      expect(report.summary.wcagA + report.summary.wcagAA + report.summary.wcagAAA).toBe(report.summary.total)
    })
  })
})

describe('accessibilityRules', () => {
  it('has all required properties', () => {
    accessibilityRules.forEach(rule => {
      expect(rule).toHaveProperty('name')
      expect(rule).toHaveProperty('description')
      expect(rule).toHaveProperty('check')
      expect(rule).toHaveProperty('severity')
      expect(rule).toHaveProperty('wcagLevel')
      expect(typeof rule.check).toBe('function')
      expect(['error', 'warning', 'info']).toContain(rule.severity)
      expect(['A', 'AA', 'AAA']).toContain(rule.wcagLevel)
    })
  })

  it('has unique rule names', () => {
    const names = accessibilityRules.map(rule => rule.name)
    const uniqueNames = [...new Set(names)]
    
    expect(names.length).toBe(uniqueNames.length)
  })
})