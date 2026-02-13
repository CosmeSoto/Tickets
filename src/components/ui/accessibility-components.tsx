/**
 * Accessibility Components
 * Specialized components for enhanced accessibility
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { accessibilityUtils, keyboardUtils, AriaProps } from '@/lib/accessibility/accessibility-utils'

// Screen Reader Only component
interface ScreenReaderOnlyProps {
  children: React.ReactNode
  as?: React.ElementType
  className?: string
  id?: string
}

export const ScreenReaderOnly: React.FC<ScreenReaderOnlyProps> = ({
  children,
  as: Component = 'span',
  className,
  id,
}) => {
  return (
    <Component 
      id={id}
      className={cn(
        'sr-only',
        'absolute -inset-px overflow-hidden whitespace-nowrap border-0',
        'clip-path-inset-50 h-px w-px',
        className
      )}
    >
      {children}
    </Component>
  )
}

// Skip Link component
interface SkipLinkProps {
  href: string
  children: React.ReactNode
  className?: string
}

export const SkipLink: React.FC<SkipLinkProps> = ({
  href,
  children,
  className,
}) => {
  return (
    <a
      href={href}
      className={cn(
        'sr-only focus:not-sr-only',
        'absolute top-0 left-0 z-50 p-4 bg-blue-600 text-white',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
        'transition-all duration-200',
        className
      )}
    >
      {children}
    </a>
  )
}

// Accessible Button component
interface AccessibleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  loadingText?: string
  children: React.ReactNode
}

export const AccessibleButton: React.FC<AccessibleButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingText = 'Loading...',
  disabled,
  children,
  className,
  onClick,
  ...props
}) => {
  const sizeClasses = {
    sm: 'h-8 px-3 text-sm',
    md: 'h-10 px-4 text-base',
    lg: 'h-12 px-6 text-lg',
  }

  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500',
    outline: 'border border-border text-foreground hover:bg-muted focus:ring-blue-500',
    ghost: 'text-foreground hover:bg-muted focus:ring-blue-500',
  }

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (loading || disabled) return
    onClick?.(event)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (loading || disabled) return
      const syntheticEvent = {
        preventDefault: () => {},
        stopPropagation: () => {},
        target: event.target,
        currentTarget: event.currentTarget,
      } as React.MouseEvent<HTMLButtonElement>
      handleClick(syntheticEvent)
    }
  }

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium',
        'transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',
        'disabled:opacity-50 disabled:pointer-events-none',
        'min-h-[44px]', // Touch-friendly minimum height
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      disabled={disabled || loading}
      aria-disabled={disabled || loading}
      aria-describedby={loading ? `${props.id}-loading` : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin -ml-1 mr-3 h-5 w-5"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      
      {loading ? loadingText : children}
      
      {loading && (
        <ScreenReaderOnly id={`${props.id}-loading`}>
          Loading, please wait
        </ScreenReaderOnly>
      )}
    </button>
  )
}

// Accessible Input component
interface AccessibleInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  helpText?: string
  required?: boolean
  showRequiredIndicator?: boolean
}

export const AccessibleInput: React.FC<AccessibleInputProps> = ({
  label,
  error,
  helpText,
  required,
  showRequiredIndicator = true,
  className,
  id,
  ...props
}) => {
  const inputId = id || accessibilityUtils.generateId('input')
  const errorId = error ? `${inputId}-error` : undefined
  const helpId = helpText ? `${inputId}-help` : undefined
  
  const describedBy = [errorId, helpId].filter(Boolean).join(' ')

  return (
    <div className="space-y-2">
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-foreground"
      >
        {label}
        {required && showRequiredIndicator && (
          <span className="text-red-500 ml-1" aria-label="required">
            *
          </span>
        )}
      </label>
      
      <input
        id={inputId}
        className={cn(
          'block w-full min-h-[44px] px-3 py-2 border border-border rounded-md',
          'text-base', // Prevents zoom on iOS
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
          'disabled:bg-muted disabled:text-muted-foreground',
          error && 'border-red-300 focus:ring-red-500 focus:border-red-500',
          className
        )}
        aria-required={required}
        aria-invalid={!!error}
        aria-describedby={describedBy || undefined}
        {...props}
      />
      
      {helpText && (
        <p id={helpId} className="text-sm text-muted-foreground">
          {helpText}
        </p>
      )}
      
      {error && (
        <p id={errorId} className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

// Accessible Dialog component
interface AccessibleDialogProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  className?: string
  closeOnOverlayClick?: boolean
  closeOnEscape?: boolean
}

export const AccessibleDialog: React.FC<AccessibleDialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
  closeOnOverlayClick = true,
  closeOnEscape = true,
}) => {
  const dialogRef = React.useRef<HTMLDivElement>(null)
  const titleId = accessibilityUtils.generateId('dialog-title')
  const descriptionId = description ? accessibilityUtils.generateId('dialog-description') : undefined
  
  // Focus trap and escape handling
  React.useEffect(() => {
    if (!isOpen) return
    
    const dialog = dialogRef.current
    if (!dialog) return
    
    // Trap focus
    const cleanup = accessibilityUtils.trapFocus(dialog)
    
    // Handle escape key
    const handleKeyDown = closeOnEscape ? keyboardUtils.handleEscape(onClose) : () => {}
    document.addEventListener('keydown', handleKeyDown)
    
    // Announce dialog opening
    accessibilityUtils.announceToScreenReader(`Dialog opened: ${title}`)
    
    return () => {
      cleanup()
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose, title, closeOnEscape])
  
  // Prevent body scroll when dialog is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleOverlayClick = (event: React.MouseEvent) => {
    if (closeOnOverlayClick && event.target === event.currentTarget) {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleOverlayClick}
        aria-hidden="true"
      />
      
      {/* Dialog */}
      <div
        ref={dialogRef}
        className={cn(
          'relative bg-card rounded-lg shadow-xl max-w-md w-full mx-4',
          'max-h-[90vh] overflow-y-auto',
          className
        )}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h2 id={titleId} className="text-lg font-semibold text-foreground">
              {title}
            </h2>
            <button
              type="button"
              className="text-muted-foreground hover:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1"
              onClick={onClose}
              aria-label="Close dialog"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {description && (
            <p id={descriptionId} className="mt-2 text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        
        {/* Content */}
        <div className="px-6 py-4">
          {children}
        </div>
      </div>
    </div>
  )
}

// Accessible Tabs component
interface AccessibleTabsProps {
  tabs: Array<{
    id: string
    label: string
    content: React.ReactNode
    disabled?: boolean
  }>
  defaultTab?: string
  onTabChange?: (tabId: string) => void
  className?: string
}

export const AccessibleTabs: React.FC<AccessibleTabsProps> = ({
  tabs,
  defaultTab,
  onTabChange,
  className,
}) => {
  const [activeTab, setActiveTab] = React.useState(defaultTab || tabs[0]?.id)
  const tabListRef = React.useRef<HTMLDivElement>(null)
  
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId)
    onTabChange?.(tabId)
  }
  
  // Keyboard navigation for tabs
  React.useEffect(() => {
    const tabList = tabListRef.current
    if (!tabList) return
    
    return keyboardUtils.createRovingTabindex(tabList)
  }, [])
  
  const handleTabKeyDown = (event: KeyboardEvent, tabId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleTabChange(tabId)
    }
  }

  return (
    <div className={cn('w-full', className)}>
      {/* Tab List */}
      <div
        ref={tabListRef}
        role="tablist"
        className="flex border-b border-border"
        aria-label="Tabs"
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            role="tab"
            id={`tab-${tab.id}`}
            aria-controls={`panel-${tab.id}`}
            aria-selected={activeTab === tab.id}
            tabIndex={activeTab === tab.id ? 0 : -1}
            disabled={tab.disabled}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            )}
            onClick={() => handleTabChange(tab.id)}
            onKeyDown={(e) => handleTabKeyDown(e.nativeEvent, tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      
      {/* Tab Panels */}
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${tab.id}`}
          hidden={activeTab !== tab.id}
          className="py-4"
          tabIndex={0}
        >
          {tab.content}
        </div>
      ))}
    </div>
  )
}

// Accessible Alert component
interface AccessibleAlertProps {
  type?: 'info' | 'success' | 'warning' | 'error'
  title?: string
  children: React.ReactNode
  dismissible?: boolean
  onDismiss?: () => void
  className?: string
}

export const AccessibleAlert: React.FC<AccessibleAlertProps> = ({
  type = 'info',
  title,
  children,
  dismissible = false,
  onDismiss,
  className,
}) => {
  const alertId = accessibilityUtils.generateId('alert')
  
  const typeConfig = {
    info: {
      icon: (
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
      ),
      classes: 'bg-blue-50 text-blue-800 border-blue-200',
      iconClasses: 'text-blue-400',
    },
    success: {
      icon: (
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      ),
      classes: 'bg-green-50 text-green-800 border-green-200',
      iconClasses: 'text-green-400',
    },
    warning: {
      icon: (
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      ),
      classes: 'bg-yellow-50 text-yellow-800 border-yellow-200',
      iconClasses: 'text-yellow-400',
    },
    error: {
      icon: (
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      ),
      classes: 'bg-red-50 text-red-800 border-red-200',
      iconClasses: 'text-red-400',
    },
  }
  
  const config = typeConfig[type]

  return (
    <div
      id={alertId}
      role="alert"
      aria-live="polite"
      className={cn(
        'rounded-md border p-4',
        config.classes,
        className
      )}
    >
      <div className="flex">
        <div className={cn('flex-shrink-0', config.iconClasses)}>
          {config.icon}
        </div>
        <div className="ml-3 flex-1">
          {title && (
            <h3 className="text-sm font-medium mb-1">
              {title}
            </h3>
          )}
          <div className="text-sm">
            {children}
          </div>
        </div>
        {dismissible && (
          <div className="ml-auto pl-3">
            <button
              type="button"
              className={cn(
                'inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2',
                config.iconClasses,
                'hover:bg-opacity-20 focus:ring-offset-2'
              )}
              onClick={onDismiss}
              aria-label="Dismiss alert"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// Accessible Dropdown Menu component
interface AccessibleDropdownProps {
  trigger: React.ReactNode
  items: Array<{
    id: string
    label: string
    onClick: () => void
    disabled?: boolean
    separator?: boolean
  }>
  className?: string
}

export const AccessibleDropdown: React.FC<AccessibleDropdownProps> = ({
  trigger,
  items,
  className,
}) => {
  const [isOpen, setIsOpen] = React.useState(false)
  const [focusedIndex, setFocusedIndex] = React.useState(-1)
  const dropdownRef = React.useRef<HTMLDivElement>(null)
  const menuRef = React.useRef<HTMLDivElement>(null)
  
  const menuId = accessibilityUtils.generateId('dropdown-menu')
  
  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setFocusedIndex(-1)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  // Keyboard navigation
  const handleKeyDown = (event: KeyboardEvent) => {
    if (!isOpen) return
    
    const enabledItems = items.filter(item => !item.disabled && !item.separator)
    
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setFocusedIndex(prev => (prev + 1) % enabledItems.length)
        break
      case 'ArrowUp':
        event.preventDefault()
        setFocusedIndex(prev => prev <= 0 ? enabledItems.length - 1 : prev - 1)
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        if (focusedIndex >= 0) {
          enabledItems[focusedIndex]?.onClick()
          setIsOpen(false)
          setFocusedIndex(-1)
        }
        break
      case 'Escape':
        event.preventDefault()
        setIsOpen(false)
        setFocusedIndex(-1)
        break
    }
  }
  
  React.useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
    return undefined
  }, [isOpen, focusedIndex, items])

  return (
    <div ref={dropdownRef} className={cn('relative inline-block text-left', className)}>
      {/* Trigger */}
      <div
        role="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        tabIndex={0}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setIsOpen(!isOpen)
          }
        }}
        className="focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md"
      >
        {trigger}
      </div>
      
      {/* Menu */}
      {isOpen && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-card ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
        >
          <div className="py-1">
            {items.map((item, index) => {
              if (item.separator) {
                return <div key={item.id} className="border-t border-gray-100 my-1" />
              }
              
              const enabledItems = items.filter(i => !i.disabled && !i.separator)
              const enabledIndex = enabledItems.findIndex(i => i.id === item.id)
              const isFocused = enabledIndex === focusedIndex
              
              return (
                <button
                  key={item.id}
                  role="menuitem"
                  disabled={item.disabled}
                  className={cn(
                    'block w-full text-left px-4 py-2 text-sm transition-colors',
                    'focus:outline-none',
                    item.disabled
                      ? 'text-muted-foreground cursor-not-allowed'
                      : 'text-foreground hover:bg-muted focus:bg-muted',
                    isFocused && 'bg-muted'
                  )}
                  onClick={() => {
                    if (!item.disabled) {
                      item.onClick()
                      setIsOpen(false)
                      setFocusedIndex(-1)
                    }
                  }}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}