import { describe, it, expect, vi } from 'vitest'
import { create, act } from 'react-test-renderer'
import React from 'react'

// Mock completo de react-native — strings como tipos de host para snapshots limpios
vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  TextInput: 'TextInput',
  ActivityIndicator: 'ActivityIndicator',
  Animated: {
    View: 'AnimatedView',
    Value: class MockAnimatedValue {
      private _value: number
      constructor(value: number) { this._value = value }
      setValue(v: number) { this._value = v }
    },
    timing: vi.fn(() => ({ start: (cb?: () => void) => cb?.() })),
    loop: vi.fn(() => ({ start: (cb?: () => void) => cb?.() })),
    sequence: vi.fn(() => ({ start: (cb?: () => void) => cb?.() })),
  },
  Platform: { OS: 'ios' },
  StyleSheet: { create: (s: Record<string, unknown>) => s },
  useColorScheme: vi.fn(() => 'dark'),
}))

// Importar los componentes DESPUÉS de los mocks
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Input } from '../components/Input'
import { EmptyState } from '../components/EmptyState'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { Badge } from '../components/Badge'
import { Header } from '../components/Header'

// ─── Button ─────────────────────────────────────────────────────────────────

describe('Button', () => {
  it('renderiza la variante primary por defecto', () => {
    const tree = create(
      <Button label="Crear viaje" onPress={() => {}} />
    ).toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('renderiza la variante secondary', () => {
    const tree = create(
      <Button label="Cancelar" onPress={() => {}} variant="secondary" />
    ).toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('renderiza la variante ghost', () => {
    const tree = create(
      <Button label="Ver más" onPress={() => {}} variant="ghost" />
    ).toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('renderiza la variante danger', () => {
    const tree = create(
      <Button label="Eliminar" onPress={() => {}} variant="danger" />
    ).toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('renderiza en estado deshabilitado', () => {
    const tree = create(
      <Button label="Guardar" onPress={() => {}} isDisabled />
    ).toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('renderiza en estado de carga con indicador', () => {
    const tree = create(
      <Button label="Guardando..." onPress={() => {}} isLoading />
    ).toJSON()
    expect(tree).toMatchSnapshot()
  })
})

// ─── Card ────────────────────────────────────────────────────────────────────

describe('Card', () => {
  it('renderiza hijos correctamente', () => {
    const tree = create(
      <Card>
        <>{/* Texto de prueba */}</>
      </Card>
    ).toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('aplica className adicional', () => {
    const tree = create(
      <Card className="mt-4">
        <>{/* Contenido */}</>
      </Card>
    ).toJSON()
    expect(tree).toMatchSnapshot()
  })
})

// ─── Input ───────────────────────────────────────────────────────────────────

describe('Input', () => {
  it('renderiza con label y valor', () => {
    const tree = create(
      <Input label="Email" value="user@example.com" onChangeText={() => {}} />
    ).toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('renderiza con mensaje de error', () => {
    const tree = create(
      <Input
        label="Email"
        value=""
        onChangeText={() => {}}
        error="El email es requerido"
      />
    ).toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('renderiza en estado deshabilitado', () => {
    const tree = create(
      <Input label="Email" value="bloqueado@example.com" onChangeText={() => {}} editable={false} />
    ).toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('no muestra texto de error cuando no hay error', () => {
    const renderer = create(
      <Input label="Email" value="ok@example.com" onChangeText={() => {}} />
    )
    // El árbol no debe contener nodo de texto de error (alerta)
    const json = renderer.toJSON()
    expect(JSON.stringify(json)).not.toContain('"alert"')
  })
})

// ─── EmptyState ──────────────────────────────────────────────────────────────

describe('EmptyState', () => {
  it('renderiza título y subtítulo', () => {
    const tree = create(
      <EmptyState
        title="Aún no tienes viajes"
        subtitle="Crea tu primer viaje y planifícalo con IA"
      />
    ).toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('renderiza con botón de acción cuando se proveen actionLabel y onAction', () => {
    const tree = create(
      <EmptyState
        title="Sin documentos"
        actionLabel="Agregar documento"
        onAction={() => {}}
      />
    ).toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('no renderiza botón si falta onAction', () => {
    const tree = create(
      <EmptyState title="Sin resultados" actionLabel="Acción" />
    ).toJSON()
    const json = JSON.stringify(tree)
    // No debe haber un botón cuando falta onAction
    expect(json).not.toContain('Acción')
  })
})

// ─── LoadingSkeleton ─────────────────────────────────────────────────────────

describe('LoadingSkeleton', () => {
  it('renderiza 1 ítem por defecto', () => {
    let tree: unknown
    act(() => {
      tree = create(<LoadingSkeleton />).toJSON()
    })
    expect(tree).toMatchSnapshot()
  })

  it('renderiza el número de ítems indicado', () => {
    let renderer: ReturnType<typeof create>
    act(() => {
      renderer = create(<LoadingSkeleton count={3} height={60} />)
    })
    // El contenedor debe tener 3 hijos AnimatedView
    const json = renderer!.toJSON() as { children: unknown[] }
    expect(json.children).toHaveLength(3)
  })
})

// ─── Badge ───────────────────────────────────────────────────────────────────

describe('Badge', () => {
  it('renderiza con variante default', () => {
    const tree = create(<Badge label="Planificando" />).toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('renderiza con variante success', () => {
    const tree = create(<Badge label="Confirmado" variant="success" />).toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('renderiza con variante warning', () => {
    const tree = create(<Badge label="Pendiente" variant="warning" />).toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('renderiza con variante danger', () => {
    const tree = create(<Badge label="Cancelado" variant="danger" />).toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('renderiza con variante info', () => {
    const tree = create(<Badge label="En progreso" variant="info" />).toJSON()
    expect(tree).toMatchSnapshot()
  })
})

// ─── Header ──────────────────────────────────────────────────────────────────

describe('Header', () => {
  it('renderiza solo el título', () => {
    const tree = create(<Header title="Mis Viajes" />).toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('renderiza título con botón de acción', () => {
    const tree = create(
      <Header title="Mis Viajes" actionLabel="+ Nuevo" onAction={() => {}} />
    ).toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('no renderiza botón si falta onAction', () => {
    const tree = create(
      <Header title="Mis Viajes" actionLabel="+ Nuevo" />
    ).toJSON()
    const json = JSON.stringify(tree)
    expect(json).not.toContain('+ Nuevo')
  })
})
