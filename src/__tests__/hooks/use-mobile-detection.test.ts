/**
 * Mobile Detection Hook Tests
 */

import { renderHook, act } from '@testing-library/react'
import { useMobileDetection, useMobileBehavior, useViewport } from '@/hooks/use-mobile-detection'

// Mock window properties
const mockWindow = (width: number, height: number, userAgent: string = 'Mozilla/5.0') => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  })
  
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  })
  
  Object.defineProperty(navigator, 'userAgent', {
    writable: true,
    configurable: true,
    value: userAgent,
  })
  
  Object.defineProperty(navigator, 'maxTouchPoints', {
    writable: true,
    configurable: true,
    value: 0,
  })
  
  Object.defineProperty(navigator, 'onLine', {
    writable: true,
    configurable: true,
    value: true,
  })
}

// Mock touch support
const mockTouchSupport = (hasTouch: boolean) => {
  if (hasTouch) {
    Object.defineProperty(window, 'ontouchstart', {
      writable: true,
      configurable: true,
      value: () => {},
    })
  } else {
    delete (window as any).ontouchstart
  }
}

describe('useMobileDetection', () => {
  beforeEach(() => {
    // Reset to desktop defaults
    mockWindow(1024, 768)
    mockTouchSupport(false)
  })

  it('detects desktop correctly', () => {
    mockWindow(1024, 768)
    
    const { result } = renderHook(() => useMobileDetection())
    
    expect(result.current.isDesktop).toBe(true)
    expect(result.current.isMobile).toBe(false)
    expect(result.current.isTablet).toBe(false)
    expect(result.current.deviceType).toBe('desktop')
  })

  it('detects mobile correctly', () => {
    mockWindow(375, 667) // iPhone size
    
    const { result } = renderHook(() => useMobileDetection())
    
    expect(result.current.isMobile).toBe(true)
    expect(result.current.isTablet).toBe(false)
    expect(result.current.isDesktop).toBe(false)
    expect(result.current.deviceType).toBe('mobile')
  })

  it('detects tablet correctly', () => {
    mockWindow(768, 1024) // iPad size
    
    const { result } = renderHook(() => useMobileDetection())
    
    expect(result.current.isTablet).toBe(true)
    expect(result.current.isMobile).toBe(false)
    expect(result.current.isDesktop).toBe(false)
    expect(result.current.deviceType).toBe('tablet')
  })

  it('detects touch device correctly', () => {
    mockWindow(375, 667)
    mockTouchSupport(true)
    
    const { result } = renderHook(() => useMobileDetection())
    
    expect(result.current.isTouchDevice).toBe(true)
  })

  it('detects iOS correctly', () => {
    mockWindow(375, 667, 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)')
    
    const { result } = renderHook(() => useMobileDetection())
    
    expect(result.current.isIOS).toBe(true)
    expect(result.current.isAndroid).toBe(false)
  })

  it('detects Android correctly', () => {
    mockWindow(375, 667, 'Mozilla/5.0 (Linux; Android 10; SM-G975F)')
    
    const { result } = renderHook(() => useMobileDetection())
    
    expect(result.current.isAndroid).toBe(true)
    expect(result.current.isIOS).toBe(false)
  })

  it('detects orientation correctly', () => {
    // Portrait
    mockWindow(375, 667)
    const { result } = renderHook(() => useMobileDetection())
    
    expect(result.current.orientation).toBe('portrait')
    
    // Landscape - need to trigger update
    act(() => {
      mockWindow(667, 375)
      window.dispatchEvent(new Event('resize'))
    })
    
    expect(result.current.orientation).toBe('landscape')
  })

  it('updates screen size correctly', () => {
    mockWindow(1024, 768)
    
    const { result } = renderHook(() => useMobileDetection())
    
    expect(result.current.screenSize).toEqual({
      width: 1024,
      height: 768,
    })
  })

  it('responds to window resize', () => {
    mockWindow(1024, 768)
    
    const { result } = renderHook(() => useMobileDetection())
    
    expect(result.current.isDesktop).toBe(true)
    
    // Simulate resize to mobile
    act(() => {
      mockWindow(375, 667)
      window.dispatchEvent(new Event('resize'))
    })
    
    expect(result.current.isMobile).toBe(true)
    expect(result.current.isDesktop).toBe(false)
  })
})

describe('useMobileBehavior', () => {
  beforeEach(() => {
    mockWindow(1024, 768)
    mockTouchSupport(false)
  })

  it('provides mobile-specific utilities', () => {
    mockWindow(375, 667)
    mockTouchSupport(true)
    
    const { result } = renderHook(() => useMobileBehavior())
    
    expect(result.current.shouldShowMobileMenu).toBe(true)
    expect(result.current.shouldUseTouchOptimization).toBe(true)
  })

  it('provides responsive column helper', () => {
    const { result } = renderHook(() => useMobileBehavior())
    
    // Mobile
    act(() => {
      mockWindow(375, 667)
      window.dispatchEvent(new Event('resize'))
    })
    
    expect(result.current.getResponsiveColumns(1, 2, 3)).toBe(1)
    
    // Tablet
    act(() => {
      mockWindow(768, 1024)
      window.dispatchEvent(new Event('resize'))
    })
    
    expect(result.current.getResponsiveColumns(1, 2, 3)).toBe(2)
    
    // Desktop
    act(() => {
      mockWindow(1024, 768)
      window.dispatchEvent(new Event('resize'))
    })
    
    expect(result.current.getResponsiveColumns(1, 2, 3)).toBe(3)
  })

  it('provides responsive spacing helper', () => {
    const { result } = renderHook(() => useMobileBehavior())
    
    // Mobile
    act(() => {
      mockWindow(375, 667)
      window.dispatchEvent(new Event('resize'))
    })
    
    expect(result.current.getResponsiveSpacing('p-4', 'p-8')).toBe('p-4')
    
    // Desktop
    act(() => {
      mockWindow(1024, 768)
      window.dispatchEvent(new Event('resize'))
    })
    
    expect(result.current.getResponsiveSpacing('p-4', 'p-8')).toBe('p-8')
  })

  it('provides touch target size helper', () => {
    const { result } = renderHook(() => useMobileBehavior())
    
    // Non-touch device
    mockTouchSupport(false)
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })
    
    expect(result.current.getTouchTargetSize()).toBe('40px')
    
    // Touch device
    mockTouchSupport(true)
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })
    
    expect(result.current.getTouchTargetSize()).toBe('44px')
  })

  it('provides platform classes', () => {
    mockWindow(375, 667, 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)')
    mockTouchSupport(true)
    
    const { result } = renderHook(() => useMobileBehavior())
    
    const classes = result.current.getPlatformClasses()
    expect(classes).toContain('mobile')
    expect(classes).toContain('touch')
    expect(classes).toContain('ios')
  })

  it('detects iOS zoom prevention need', () => {
    mockWindow(375, 667, 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)')
    
    const { result } = renderHook(() => useMobileBehavior())
    
    expect(result.current.shouldPreventZoom).toBe(true)
  })
})

describe('useViewport', () => {
  beforeEach(() => {
    mockWindow(1024, 768)
  })

  it('provides viewport dimensions', () => {
    const { result } = renderHook(() => useViewport())
    
    expect(result.current.width).toBe(1024)
    expect(result.current.height).toBe(768)
    expect(result.current.aspectRatio).toBeCloseTo(1024 / 768)
  })

  it('detects landscape orientation', () => {
    mockWindow(1024, 768) // Landscape
    
    const { result } = renderHook(() => useViewport())
    
    expect(result.current.isLandscape).toBe(true)
    expect(result.current.isPortrait).toBe(false)
  })

  it('detects portrait orientation', () => {
    mockWindow(375, 667) // Portrait
    
    const { result } = renderHook(() => useViewport())
    
    expect(result.current.isPortrait).toBe(true)
    expect(result.current.isLandscape).toBe(false)
  })

  it('detects wide screen', () => {
    mockWindow(1920, 1080) // 16:9 ratio
    
    const { result } = renderHook(() => useViewport())
    
    expect(result.current.isWideScreen).toBe(true)
  })

  it('detects square-ish screen', () => {
    mockWindow(1000, 1000) // Perfect square
    
    const { result } = renderHook(() => useViewport())
    
    expect(result.current.isSquareish).toBe(true)
  })

  it('provides breakpoint helpers', () => {
    const { result } = renderHook(() => useViewport())
    
    // Test mobile
    act(() => {
      mockWindow(375, 667)
      window.dispatchEvent(new Event('resize'))
    })
    
    expect(result.current.isSmallScreen).toBe(true)
    expect(result.current.isMediumScreen).toBe(false)
    expect(result.current.isLargeScreen).toBe(false)
    
    // Test tablet
    act(() => {
      mockWindow(768, 1024)
      window.dispatchEvent(new Event('resize'))
    })
    
    expect(result.current.isSmallScreen).toBe(false)
    expect(result.current.isMediumScreen).toBe(true)
    expect(result.current.isLargeScreen).toBe(false)
    
    // Test desktop
    act(() => {
      mockWindow(1280, 800)
      window.dispatchEvent(new Event('resize'))
    })
    
    expect(result.current.isSmallScreen).toBe(false)
    expect(result.current.isMediumScreen).toBe(false)
    expect(result.current.isLargeScreen).toBe(true)
  })

  it('provides specific breakpoint detection', () => {
    // Test sm breakpoint
    mockWindow(640, 480)
    const { result } = renderHook(() => useViewport())
    
    expect(result.current.isSm).toBe(true)
    expect(result.current.isMd).toBe(false)
    
    // Test md breakpoint
    act(() => {
      mockWindow(768, 600)
      window.dispatchEvent(new Event('resize'))
    })
    
    expect(result.current.isSm).toBe(false)
    expect(result.current.isMd).toBe(true)
    expect(result.current.isLg).toBe(false)
    
    // Test lg breakpoint
    act(() => {
      mockWindow(1024, 768)
      window.dispatchEvent(new Event('resize'))
    })
    
    expect(result.current.isMd).toBe(false)
    expect(result.current.isLg).toBe(true)
    expect(result.current.isXl).toBe(false)
    
    // Test xl breakpoint
    act(() => {
      mockWindow(1280, 800)
      window.dispatchEvent(new Event('resize'))
    })
    
    expect(result.current.isLg).toBe(false)
    expect(result.current.isXl).toBe(true)
    expect(result.current.is2Xl).toBe(false)
    
    // Test 2xl breakpoint
    act(() => {
      mockWindow(1536, 900)
      window.dispatchEvent(new Event('resize'))
    })
    
    expect(result.current.isXl).toBe(false)
    expect(result.current.is2Xl).toBe(true)
  })

  it('responds to window resize', () => {
    mockWindow(1024, 768)
    
    const { result } = renderHook(() => useViewport())
    
    expect(result.current.isLargeScreen).toBe(true)
    
    act(() => {
      mockWindow(375, 667)
      window.dispatchEvent(new Event('resize'))
    })
    
    expect(result.current.isSmallScreen).toBe(true)
    expect(result.current.isLargeScreen).toBe(false)
  })
})