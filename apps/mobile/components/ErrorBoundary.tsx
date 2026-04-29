import React from 'react'
import { View, Text, Pressable } from 'react-native'
import { logger } from '@/lib/logger'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ErrorBoundaryProps {
  children: React.ReactNode
  // Fallback personalizado opcional — si no se pasa se muestra la UI por defecto
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

// ─── UI de fallback por defecto ───────────────────────────────────────────────

interface DefaultFallbackProps {
  onRetry: () => void
}

const DefaultFallback = ({ onRetry }: DefaultFallbackProps) => (
  <View className="flex-1 items-center justify-center bg-slate-900 px-8">
    <Text className="mb-4 text-5xl" accessibilityElementsHidden>
      ⚠️
    </Text>
    <Text className="mb-2 text-center text-xl font-bold text-white">
      Algo salió mal
    </Text>
    <Text className="mb-8 text-center text-slate-400">
      Ocurrió un error inesperado. Toca el botón para intentar de nuevo.
    </Text>
    <Pressable
      onPress={onRetry}
      accessibilityRole="button"
      accessibilityLabel="Reintentar"
      className="rounded-xl bg-indigo-600 px-8 py-3 active:bg-indigo-700"
    >
      <Text className="font-semibold text-white">Reintentar</Text>
    </Pressable>
  </View>
)

// ─── Error Boundary ───────────────────────────────────────────────────────────
// Clase obligatoria: getDerivedStateFromError y componentDidCatch solo existen en clases

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    logger.error('Error no capturado en árbol de componentes', {
      error: error.message,
      componentStack: info.componentStack ?? 'desconocido',
    })
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children
    }

    if (this.props.fallback) {
      return this.props.fallback
    }

    return <DefaultFallback onRetry={this.handleRetry} />
  }
}
