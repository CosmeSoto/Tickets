/**
 * Mobile Detection Hook
 * Detects mobile devices and provides mobile-specific utilities
 */

import { useState, useEffect } from 'react'

export interface MobileDetection {
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  isTouchDevice: boolean
  isIOS: boolean
  isAndroid: boolean
  orientation: 'portrait' | 'landscape' | null
  screenSize: {
    width: number
    height: number
  }
  deviceType: 'mobile' | 'tablet' | 'desktop'
}

/**
 * Hook for detecting mobile devices and capabilities
 */
export const useMobileDetection = (): MobileDetection => {
  const [detection, setDetection] = useState<MobileDetection>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isTouchDevice: false,
    isIOS: false,
    isAndroid: false,
    orientation: null,
    screenSize: { width: 0, height: 0 },
    deviceType: 'desktop',
  })

  useEffect(() => {
    const updateDetection = () => {
      if (typeof window === 'undefined') return

      const width = window.innerWidth
      const height = window.innerHeight
      const userAgent = navigator.userAgent.toLowerCase()

      // Device type detection based on screen size
      const isMobile = width < 768
      const isTablet = width >= 768 && width < 1024
      const isDesktop = width >= 1024

      // Touch device detection
      const isTouchDevice = 'ontouchstart' in window || 
                           navigator.maxTouchPoints > 0 ||
                           (navigator as any).msMaxTouchPoints > 0

      // OS detection
      const isIOS = /iphone|ipad|ipod/.test(userAgent)
      const isAndroid = /android/.test(userAgent)

      // Orientation detection
      const orientation = height > width ? 'portrait' : 'landscape'

      // Device type priority: mobile > tablet > desktop
      let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop'
      if (isMobile) deviceType = 'mobile'
      else if (isTablet) deviceType = 'tablet'

      setDetection({
        isMobile,
        isTablet,
        isDesktop,
        isTouchDevice,
        isIOS,
        isAndroid,
        orientation,
        screenSize: { width, height },
        deviceType,
      })
    }

    // Initial detection
    updateDetection()

    // Listen for resize and orientation changes
    window.addEventListener('resize', updateDetection)
    window.addEventListener('orientationchange', updateDetection)

    return () => {
      window.removeEventListener('resize', updateDetection)
      window.removeEventListener('orientationchange', updateDetection)
    }
  }, [])

  return detection
}

/**
 * Hook for mobile-specific behavior
 */
export const useMobileBehavior = () => {
  const detection = useMobileDetection()

  return {
    ...detection,
    
    // Mobile-specific utilities
    shouldShowMobileMenu: detection.isMobile,
    shouldUseTouchOptimization: detection.isTouchDevice,
    shouldPreventZoom: detection.isIOS, // iOS zoom prevention
    
    // Responsive helpers
    getResponsiveColumns: (mobile: number, tablet: number, desktop: number) => {
      if (detection.isMobile) return mobile
      if (detection.isTablet) return tablet
      return desktop
    },
    
    getResponsiveSpacing: (mobile: string, desktop: string) => {
      return detection.isMobile ? mobile : desktop
    },
    
    // Touch helpers
    getTouchTargetSize: () => detection.isTouchDevice ? '44px' : '40px',
    
    // Platform-specific classes
    getPlatformClasses: () => {
      const classes: string[] = []
      
      if (detection.isMobile) classes.push('mobile')
      if (detection.isTablet) classes.push('tablet')
      if (detection.isDesktop) classes.push('desktop')
      if (detection.isTouchDevice) classes.push('touch')
      if (detection.isIOS) classes.push('ios')
      if (detection.isAndroid) classes.push('android')
      
      return classes.join(' ')
    },
  }
}

/**
 * Hook for viewport-based responsive behavior
 */
export const useViewport = () => {
  const [viewport, setViewport] = useState({
    width: 0,
    height: 0,
    aspectRatio: 1,
  })

  useEffect(() => {
    const updateViewport = () => {
      if (typeof window === 'undefined') return

      const width = window.innerWidth
      const height = window.innerHeight
      const aspectRatio = width / height

      setViewport({ width, height, aspectRatio })
    }

    updateViewport()
    window.addEventListener('resize', updateViewport)

    return () => window.removeEventListener('resize', updateViewport)
  }, [])

  return {
    ...viewport,
    
    // Viewport utilities
    isLandscape: viewport.aspectRatio > 1,
    isPortrait: viewport.aspectRatio <= 1,
    isWideScreen: viewport.aspectRatio > 1.5,
    isSquareish: Math.abs(viewport.aspectRatio - 1) < 0.2,
    
    // Breakpoint helpers
    isXs: viewport.width < 480,
    isSm: viewport.width >= 640 && viewport.width < 768,
    isMd: viewport.width >= 768 && viewport.width < 1024,
    isLg: viewport.width >= 1024 && viewport.width < 1280,
    isXl: viewport.width >= 1280 && viewport.width < 1536,
    is2Xl: viewport.width >= 1536,
    
    // Size categories
    isSmallScreen: viewport.width < 768,
    isMediumScreen: viewport.width >= 768 && viewport.width < 1024,
    isLargeScreen: viewport.width >= 1024,
  }
}

/**
 * Hook for safe area insets (iOS notch, etc.)
 */
export const useSafeArea = () => {
  const [safeArea, setSafeArea] = useState({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  })

  useEffect(() => {
    const updateSafeArea = () => {
      if (typeof window === 'undefined') return

      const computedStyle = getComputedStyle(document.documentElement)
      
      setSafeArea({
        top: parseInt(computedStyle.getPropertyValue('--safe-area-inset-top') || '0'),
        right: parseInt(computedStyle.getPropertyValue('--safe-area-inset-right') || '0'),
        bottom: parseInt(computedStyle.getPropertyValue('--safe-area-inset-bottom') || '0'),
        left: parseInt(computedStyle.getPropertyValue('--safe-area-inset-left') || '0'),
      })
    }

    updateSafeArea()
    window.addEventListener('resize', updateSafeArea)
    window.addEventListener('orientationchange', updateSafeArea)

    return () => {
      window.removeEventListener('resize', updateSafeArea)
      window.removeEventListener('orientationchange', updateSafeArea)
    }
  }, [])

  return {
    ...safeArea,
    
    // Safe area utilities
    hasSafeArea: safeArea.top > 0 || safeArea.bottom > 0,
    hasNotch: safeArea.top > 20, // Typical status bar height
    
    // CSS custom properties
    getCSSVars: () => ({
      '--safe-area-top': `${safeArea.top}px`,
      '--safe-area-right': `${safeArea.right}px`,
      '--safe-area-bottom': `${safeArea.bottom}px`,
      '--safe-area-left': `${safeArea.left}px`,
    }),
    
    // Padding helpers
    getSafeAreaPadding: () => ({
      paddingTop: safeArea.top,
      paddingRight: safeArea.right,
      paddingBottom: safeArea.bottom,
      paddingLeft: safeArea.left,
    }),
  }
}

/**
 * Hook for network-aware responsive behavior
 */
export const useNetworkAware = () => {
  const [networkInfo, setNetworkInfo] = useState({
    isOnline: true,
    effectiveType: '4g' as '2g' | '3g' | '4g' | 'slow-2g',
    downlink: 10,
    saveData: false,
  })

  useEffect(() => {
    const updateNetworkInfo = () => {
      if (typeof navigator === 'undefined') return

      const connection = (navigator as any).connection || 
                        (navigator as any).mozConnection || 
                        (navigator as any).webkitConnection

      setNetworkInfo({
        isOnline: navigator.onLine,
        effectiveType: connection?.effectiveType || '4g',
        downlink: connection?.downlink || 10,
        saveData: connection?.saveData || false,
      })
    }

    updateNetworkInfo()

    window.addEventListener('online', updateNetworkInfo)
    window.addEventListener('offline', updateNetworkInfo)

    const connection = (navigator as any).connection
    if (connection) {
      connection.addEventListener('change', updateNetworkInfo)
    }

    return () => {
      window.removeEventListener('online', updateNetworkInfo)
      window.removeEventListener('offline', updateNetworkInfo)
      
      if (connection) {
        connection.removeEventListener('change', updateNetworkInfo)
      }
    }
  }, [])

  return {
    ...networkInfo,
    
    // Network-aware helpers
    isSlowConnection: networkInfo.effectiveType === '2g' || networkInfo.effectiveType === 'slow-2g',
    isFastConnection: networkInfo.effectiveType === '4g' && networkInfo.downlink > 5,
    shouldOptimizeForBandwidth: networkInfo.saveData || networkInfo.effectiveType === '2g',
    
    // Responsive strategies
    getImageQuality: () => {
      if (networkInfo.saveData || networkInfo.effectiveType === '2g') return 'low'
      if (networkInfo.effectiveType === '3g') return 'medium'
      return 'high'
    },
    
    shouldLazyLoad: () => networkInfo.effectiveType !== '4g' || networkInfo.saveData,
    shouldPreload: () => networkInfo.effectiveType === '4g' && !networkInfo.saveData,
  }
}