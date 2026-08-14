'use client'

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useAuth } from '@/hooks/use-auth'
import Link from 'next/link'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Loader2,
  Eye,
  EyeOff,
  Shield,
  CheckCircle,
  AlertCircle,
  WifiOff,
  User,
  Lock,
  LogIn,
} from 'lucide-react'
import { SystemLogo } from '@/components/common/system-logo'
import { useLandingData } from '@/hooks/use-landing-data'
import { DEFAULT_SYSTEM_NAME, DEFAULT_HERO_TITLE } from '@/lib/branding-constants'

const EASE = [0.25, 0.1, 0.25, 1] as const

const FEATURES = [
  'Tickets y soporte técnico',
  'Gestión de inventario',
  'Base de conocimientos',
  'Reportes y estadísticas',
] as const

export default function LoginPage() {
  const reduceMotion = useReducedMotion()
  const { data: landing } = useLandingData()
  const systemName = landing.companyName || DEFAULT_SYSTEM_NAME
  const heroTitle = landing.heroTitle || DEFAULT_HERO_TITLE
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [oauthProviders, setOauthProviders] = useState({ google: false, microsoft: false })
  const [loadingProviders, setLoadingProviders] = useState(true)

  const { authState, login } = useAuth({ redirectOnSuccess: true, enableNetworkDetection: false })
  const { isLoading, error, loginStep } = authState

  useEffect(() => {
    fetch('/api/auth/oauth-providers')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d?.providers) setOauthProviders(d.providers)
      })
      .catch(() => {})
      .finally(() => setLoadingProviders(false))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await login({ email, password })
  }

  const getLoadingContent = () => {
    switch (loginStep) {
      case 'validating':
        return { icon: <Shield className='mr-2 h-4 w-4 animate-pulse' />, text: 'Validando...' }
      case 'authenticating':
        return { icon: <Lock className='mr-2 h-4 w-4 animate-pulse' />, text: 'Autenticando...' }
      case 'redirecting':
        return { icon: <CheckCircle className='mr-2 h-4 w-4' />, text: 'Acceso concedido...' }
      default:
        return {
          icon: <Loader2 className='mr-2 h-4 w-4 animate-spin' />,
          text: 'Iniciando sesión...',
        }
    }
  }

  const hasOAuth = !loadingProviders && (oauthProviders.google || oauthProviders.microsoft)
  const { icon: loadingIcon, text: loadingText } = getLoadingContent()

  const duration = (ms: number) => (reduceMotion ? 0 : ms)
  const offset = (px: number) => (reduceMotion ? 0 : px)

  const panelVariants = {
    hidden: { opacity: 0, x: offset(-28) },
    show: {
      opacity: 1,
      x: 0,
      transition: { duration: duration(0.55), ease: EASE },
    },
  }

  const formPanelVariants = {
    hidden: { opacity: 0, x: offset(24) },
    show: {
      opacity: 1,
      x: 0,
      transition: { duration: duration(0.5), ease: EASE, delay: reduceMotion ? 0 : 0.08 },
    },
  }

  const staggerContainer = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: reduceMotion ? 0 : 0.07,
        delayChildren: reduceMotion ? 0 : 0.12,
      },
    },
  }

  const fadeUp = {
    hidden: { opacity: 0, y: offset(14) },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: duration(0.4), ease: EASE },
    },
  }

  const featureList = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: reduceMotion ? 0 : 0.08,
        delayChildren: reduceMotion ? 0 : 0.28,
      },
    },
  }

  const featureItem = {
    hidden: { opacity: 0, x: offset(-12) },
    show: {
      opacity: 1,
      x: 0,
      transition: { duration: duration(0.35), ease: EASE },
    },
  }

  const floatTransition = (durationSec: number, delay = 0) =>
    reduceMotion
      ? { duration: 0 }
      : {
          duration: durationSec,
          repeat: Infinity,
          repeatType: 'mirror' as const,
          ease: 'easeInOut' as const,
          delay,
        }

  return (
    <div className='min-h-screen flex bg-background'>
      {/* Panel izquierdo decorativo — visible solo en lg+ */}
      <motion.div
        className='hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 relative overflow-hidden'
        style={{
          background: 'linear-gradient(135deg, hsl(222,47%,14%) 0%, hsl(222,47%,20%) 100%)',
        }}
        variants={panelVariants}
        initial='hidden'
        animate='show'
      >
        {/* Círculos decorativos — flotación sutil */}
        <motion.div
          className='absolute -top-24 -left-24 w-96 h-96 rounded-full bg-primary/10'
          animate={reduceMotion ? undefined : { y: [0, 18, 0], scale: [1, 1.04, 1] }}
          transition={floatTransition(10)}
        />
        <motion.div
          className='absolute -bottom-32 -right-16 w-80 h-80 rounded-full bg-primary/10'
          animate={reduceMotion ? undefined : { y: [0, -16, 0], scale: [1, 1.05, 1] }}
          transition={floatTransition(12, 1.2)}
        />
        <motion.div
          className='absolute top-1/3 right-8 w-48 h-48 rounded-full bg-primary/5'
          animate={reduceMotion ? undefined : { y: [0, 12, 0], x: [0, -8, 0] }}
          transition={floatTransition(9, 0.6)}
        />

        <motion.div
          className='relative z-10 text-center space-y-6 max-w-sm'
          variants={staggerContainer}
          initial='hidden'
          animate='show'
        >
          <motion.div className='flex justify-center' variants={fadeUp}>
            <SystemLogo size='xl' showText={true} className='brightness-0 invert' />
          </motion.div>
          <motion.div className='space-y-3' variants={fadeUp}>
            <h2 className='text-3xl font-bold text-white'>{systemName}</h2>
            <p className='text-white/60 text-base leading-relaxed'>
              {heroTitle}. Centraliza tickets, inventario y operaciones en un solo lugar.
            </p>
          </motion.div>
          {/* Feature bullets */}
          <motion.div className='space-y-3 text-left pt-4' variants={featureList}>
            {FEATURES.map(f => (
              <motion.div key={f} className='flex items-center gap-3' variants={featureItem}>
                <div className='w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0'>
                  <CheckCircle className='h-3 w-3 text-primary' />
                </div>
                <span className='text-sm text-white/80'>{f}</span>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Panel derecho — formulario */}
      <motion.div
        className='flex-1 flex items-center justify-center px-4 py-12 sm:px-8'
        variants={formPanelVariants}
        initial='hidden'
        animate='show'
      >
        <motion.div
          className='w-full max-w-sm space-y-8'
          variants={staggerContainer}
          initial='hidden'
          animate='show'
        >
          {/* Logo — visible solo en móvil (en desktop está en el panel izquierdo) */}
          <motion.div className='flex justify-center lg:hidden' variants={fadeUp}>
            <SystemLogo size='lg' showText={true} />
          </motion.div>

          {/* Heading */}
          <motion.div className='space-y-1' variants={fadeUp}>
            <h1 className='text-2xl font-bold text-foreground'>Bienvenido de vuelta</h1>
            <p className='text-sm text-muted-foreground'>Ingresa tus credenciales para continuar</p>
          </motion.div>

          {/* Error */}
          <AnimatePresence mode='wait'>
            {error && (
              <motion.div
                key={error.message}
                initial={{ opacity: 0, y: offset(-8), height: reduceMotion ? 'auto' : 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: offset(-6), height: reduceMotion ? 'auto' : 0 }}
                transition={{ duration: duration(0.28), ease: EASE }}
                className='overflow-hidden'
              >
                <Alert variant='destructive'>
                  <div className='flex items-start gap-2'>
                    {error.type === 'network' ? (
                      <WifiOff className='h-4 w-4 mt-0.5 flex-shrink-0' />
                    ) : (
                      <AlertCircle className='h-4 w-4 mt-0.5 flex-shrink-0' />
                    )}
                    <div>
                      <AlertDescription className='font-medium'>{error.message}</AlertDescription>
                      {error.suggestion && (
                        <p className='text-xs mt-1 opacity-80'>{error.suggestion}</p>
                      )}
                    </div>
                  </div>
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <motion.form onSubmit={handleSubmit} className='space-y-5' variants={fadeUp}>
            <div className='space-y-1.5'>
              <Label htmlFor='email' className='text-sm font-medium'>
                Email
              </Label>
              <div className='relative'>
                <User className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                <Input
                  id='email'
                  type='email'
                  placeholder='tu@email.com'
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className='pl-9 h-11 bg-background'
                  autoComplete='email'
                />
              </div>
            </div>

            <div className='space-y-1.5'>
              <div className='flex items-center justify-between'>
                <Label htmlFor='password' className='text-sm font-medium'>
                  Contraseña
                </Label>
                <Link href='/forgot-password' className='text-xs text-primary hover:underline'>
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <div className='relative'>
                <Lock className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                <Input
                  id='password'
                  type={showPassword ? 'text' : 'password'}
                  placeholder='••••••••'
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className='pl-9 pr-10 h-11 bg-background'
                  autoComplete='current-password'
                />
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  tabIndex={-1}
                  className='absolute right-0 top-0 h-full px-3 hover:bg-transparent'
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className='h-4 w-4 text-muted-foreground' />
                  ) : (
                    <Eye className='h-4 w-4 text-muted-foreground' />
                  )}
                </Button>
              </div>
            </div>

            <motion.div
              whileHover={reduceMotion || isLoading ? undefined : { scale: 1.01 }}
              whileTap={reduceMotion || isLoading ? undefined : { scale: 0.985 }}
              transition={{ duration: 0.15, ease: EASE }}
            >
              <Button
                type='submit'
                className='w-full h-11 text-sm font-semibold'
                disabled={isLoading || !email.trim() || !password.trim()}
              >
                <AnimatePresence mode='wait' initial={false}>
                  <motion.span
                    key={isLoading ? loginStep || 'loading' : 'idle'}
                    className='inline-flex items-center'
                    initial={{ opacity: 0, y: offset(4) }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: offset(-4) }}
                    transition={{ duration: duration(0.18), ease: EASE }}
                  >
                    {isLoading ? (
                      <>
                        {loadingIcon}
                        {loadingText}
                      </>
                    ) : (
                      <>
                        <LogIn className='mr-2 h-4 w-4' />
                        Iniciar Sesión
                      </>
                    )}
                  </motion.span>
                </AnimatePresence>
              </Button>
            </motion.div>
          </motion.form>

          {/* OAuth */}
          <AnimatePresence>
            {hasOAuth && (
              <motion.div
                className='space-y-4'
                initial={{ opacity: 0, y: offset(10) }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: duration(0.35),
                  ease: EASE,
                  delay: reduceMotion ? 0 : 0.05,
                }}
              >
                <div className='relative'>
                  <div className='absolute inset-0 flex items-center'>
                    <div className='w-full border-t border-border' />
                  </div>
                  <div className='relative flex justify-center text-xs'>
                    <span className='px-3 bg-background text-muted-foreground'>O continúa con</span>
                  </div>
                </div>
                <div
                  className={`grid gap-3 ${oauthProviders.google && oauthProviders.microsoft ? 'grid-cols-2' : 'grid-cols-1'}`}
                >
                  {oauthProviders.google && (
                    <motion.div
                      whileHover={reduceMotion || isLoading ? undefined : { y: -1 }}
                      whileTap={reduceMotion || isLoading ? undefined : { scale: 0.98 }}
                      transition={{ duration: 0.15, ease: EASE }}
                    >
                      <Button
                        type='button'
                        variant='outline'
                        className='w-full h-10 bg-background'
                        onClick={() => signIn('google', { callbackUrl: '/client' })}
                        disabled={isLoading}
                      >
                        <svg className='mr-2 h-4 w-4' viewBox='0 0 24 24'>
                          <path
                            fill='#4285F4'
                            d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z'
                          />
                          <path
                            fill='#34A853'
                            d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'
                          />
                          <path
                            fill='#FBBC05'
                            d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z'
                          />
                          <path
                            fill='#EA4335'
                            d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z'
                          />
                        </svg>
                        Google
                      </Button>
                    </motion.div>
                  )}
                  {oauthProviders.microsoft && (
                    <motion.div
                      whileHover={reduceMotion || isLoading ? undefined : { y: -1 }}
                      whileTap={reduceMotion || isLoading ? undefined : { scale: 0.98 }}
                      transition={{ duration: 0.15, ease: EASE }}
                    >
                      <Button
                        type='button'
                        variant='outline'
                        className='w-full h-10 bg-background'
                        onClick={() => signIn('azure-ad', { callbackUrl: '/client' })}
                        disabled={isLoading}
                      >
                        <svg className='mr-2 h-4 w-4' viewBox='0 0 23 23'>
                          <path fill='#f3f3f3' d='M0 0h23v23H0z' />
                          <path fill='#f35325' d='M1 1h10v10H1z' />
                          <path fill='#81bc06' d='M12 1h10v10H12z' />
                          <path fill='#05a6f0' d='M1 12h10v10H1z' />
                          <path fill='#ffba08' d='M12 12h10v10H12z' />
                        </svg>
                        Microsoft
                      </Button>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Register link */}
          <motion.p className='text-center text-sm text-muted-foreground' variants={fadeUp}>
            ¿No tienes cuenta?{' '}
            <Link href='/register' className='text-primary hover:underline font-semibold'>
              Regístrate aquí
            </Link>
          </motion.p>
        </motion.div>
      </motion.div>
    </div>
  )
}
