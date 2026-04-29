import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  StyleSheet: { create: (s: Record<string, unknown>) => s },
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// Importar DESPUÉS de los mocks
import { ErrorBoundary } from '../components/ErrorBoundary'
import { useToastStore } from '../stores/useToastStore'
import { logger } from '../lib/logger'

// ─── ErrorBoundary tests — se prueban los métodos de clase directamente ───────
// Usar instancia directa del error boundary evita la limitación de react-test-renderer
// con class components en entorno node: toJSON() retorna null al no tener host DOM.

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getDerivedStateFromError retorna hasError=true con el error', () => {
    const error = new Error('Error de prueba')
    const state = ErrorBoundary.getDerivedStateFromError(error)
    expect(state.hasError).toBe(true)
    expect(state.error).toBe(error)
  })

  it('getDerivedStateFromError preserva el objeto Error original', () => {
    const error = new Error('Error específico de red')
    const state = ErrorBoundary.getDerivedStateFromError(error)
    expect(state.error?.message).toBe('Error específico de red')
  })

  it('componentDidCatch llama a logger.error con el mensaje del error', () => {
    const boundary = new ErrorBoundary({ children: null })
    const error = new Error('Error de prueba')
    const errorInfo: React.ErrorInfo = { componentStack: '\n    in ThrowingComponent', digest: undefined }
    boundary.componentDidCatch(error, errorInfo)
    expect(logger.error).toHaveBeenCalledWith(
      'Error no capturado en árbol de componentes',
      expect.objectContaining({ error: 'Error de prueba' })
    )
  })

  it('componentDidCatch pasa el componentStack en los datos del log', () => {
    const boundary = new ErrorBoundary({ children: null })
    const error = new Error('Test')
    const errorInfo: React.ErrorInfo = { componentStack: '\n    in MyComponent\n    in App', digest: undefined }
    boundary.componentDidCatch(error, errorInfo)
    expect(logger.error).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ componentStack: '\n    in MyComponent\n    in App' })
    )
  })

  it('componentDidCatch usa "desconocido" si componentStack es null', () => {
    const boundary = new ErrorBoundary({ children: null })
    boundary.componentDidCatch(new Error('Test'), { componentStack: null as unknown as string, digest: undefined })
    expect(logger.error).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ componentStack: 'desconocido' })
    )
  })

  it('handleRetry llama a setState con hasError=false y error=null', () => {
    const boundary = new ErrorBoundary({ children: null })
    boundary.setState = vi.fn()
    boundary.handleRetry()
    expect(boundary.setState).toHaveBeenCalledWith({ hasError: false, error: null })
  })

  it('render retorna children cuando no hay error (hasError=false)', () => {
    const child = React.createElement('View', null, 'hijo')
    const boundary = new ErrorBoundary({ children: child })
    boundary.state = { hasError: false, error: null }
    const output = boundary.render()
    expect(output).toBe(child)
  })

  it('render retorna el fallback personalizado cuando hasError=true y se pasó fallback', () => {
    const customFallback = React.createElement('Text', null, 'Error personalizado')
    const boundary = new ErrorBoundary({
      children: React.createElement('View', null),
      fallback: customFallback,
    })
    boundary.state = { hasError: true, error: new Error('test') }
    const output = boundary.render()
    expect(output).toBe(customFallback)
  })

  it('render retorna DefaultFallback (ReactElement) cuando hasError=true y no hay fallback', () => {
    const boundary = new ErrorBoundary({ children: React.createElement('View', null) })
    boundary.state = { hasError: true, error: new Error('test') }
    const output = boundary.render() as React.ReactElement
    expect(output).not.toBeNull()
    expect(React.isValidElement(output)).toBe(true)
  })
})

// ─── useToastStore tests ──────────────────────────────────────────────────────

describe('useToastStore', () => {
  beforeEach(() => {
    // Resetear estado del store entre tests para evitar contaminación
    useToastStore.setState({ message: '', type: 'info', visible: false })
  })

  it('estado inicial: visible=false, message vacío, type=info', () => {
    const state = useToastStore.getState()
    expect(state.visible).toBe(false)
    expect(state.message).toBe('')
    expect(state.type).toBe('info')
  })

  it('showToast con type="success" actualiza todos los campos correctamente', () => {
    useToastStore.getState().showToast('Operación exitosa', 'success')
    const state = useToastStore.getState()
    expect(state.visible).toBe(true)
    expect(state.message).toBe('Operación exitosa')
    expect(state.type).toBe('success')
  })

  it('showToast sin type usa "info" por defecto', () => {
    useToastStore.getState().showToast('Mensaje sin tipo')
    const state = useToastStore.getState()
    expect(state.type).toBe('info')
    expect(state.visible).toBe(true)
  })

  it('showToast con type="error" establece el tipo correcto', () => {
    useToastStore.getState().showToast('Algo falló', 'error')
    const state = useToastStore.getState()
    expect(state.type).toBe('error')
    expect(state.message).toBe('Algo falló')
  })

  it('showToast con type="warning" establece el tipo correcto', () => {
    useToastStore.getState().showToast('Aviso importante', 'warning')
    expect(useToastStore.getState().type).toBe('warning')
  })

  it('hideToast establece visible=false sin borrar el mensaje', () => {
    useToastStore.getState().showToast('Mensaje temporal', 'success')
    useToastStore.getState().hideToast()
    const state = useToastStore.getState()
    expect(state.visible).toBe(false)
    // El mensaje se conserva para la animación de salida del componente Toast
    expect(state.message).toBe('Mensaje temporal')
  })

  it('múltiples showToast consecutivos actualizan siempre al último mensaje', () => {
    useToastStore.getState().showToast('Primero', 'info')
    useToastStore.getState().showToast('Segundo', 'error')
    useToastStore.getState().showToast('Tercero', 'warning')
    const state = useToastStore.getState()
    expect(state.message).toBe('Tercero')
    expect(state.type).toBe('warning')
    expect(state.visible).toBe(true)
  })

  it('showToast después de hideToast vuelve a hacer visible=true', () => {
    useToastStore.getState().showToast('Primer mensaje', 'info')
    useToastStore.getState().hideToast()
    expect(useToastStore.getState().visible).toBe(false)
    useToastStore.getState().showToast('Segundo mensaje', 'success')
    expect(useToastStore.getState().visible).toBe(true)
    expect(useToastStore.getState().message).toBe('Segundo mensaje')
  })

  it('hideToast en estado ya oculto no cambia el mensaje', () => {
    useToastStore.setState({ message: 'test', type: 'info', visible: false })
    useToastStore.getState().hideToast()
    expect(useToastStore.getState().message).toBe('test')
    expect(useToastStore.getState().visible).toBe(false)
  })
})
