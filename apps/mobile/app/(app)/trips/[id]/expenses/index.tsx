import { useState, useMemo } from 'react'
import { View, Text, SectionList, Pressable, Modal, Alert } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useTrip } from '@/hooks/useTrips'
import {
  useExpenses,
  useCreateExpense,
  useDeleteExpense,
  computeExpenseTotals,
} from '@/hooks/useExpenses'
import { useCurrencyConverter } from '@/lib/currencyConverter'
import { ExpenseForm } from '@/components/ExpenseForm'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'
import { EmptyState } from '@/components/EmptyState'
import { Badge } from '@/components/Badge'
import { logger } from '@/lib/logger'
import type { Expense, ExpenseCategory, CreateExpenseInput } from '@travelapp/types'
import { EXPENSE_CATEGORY_LABELS } from '@travelapp/types'

// ─── Agrupación por día ───────────────────────────────────────────────────────

interface ExpenseSection {
  title: string      // fecha legible: "Lunes, 12 may"
  dateKey: string    // YYYY-MM-DD para ordenar
  data: Expense[]
  total: number
}

const formatDateHeader = (isoDate: string): string => {
  const date = new Date(isoDate + 'T12:00:00')
  return date.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'short' })
}

const groupExpensesByDay = (expenses: Expense[]): ExpenseSection[] => {
  const grouped = new Map<string, Expense[]>()

  for (const exp of expenses) {
    const dateKey = exp.spentAt.slice(0, 10)
    const existing = grouped.get(dateKey) ?? []
    existing.push(exp)
    grouped.set(dateKey, existing)
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => b.localeCompare(a))      // más reciente primero
    .map(([dateKey, items]) => ({
      title: formatDateHeader(dateKey),
      dateKey,
      data: items,
      total: items.reduce((sum, e) => sum + e.amount, 0),
    }))
}

// ─── Componente de fila de gasto ──────────────────────────────────────────────

const CATEGORY_EMOJI: Record<ExpenseCategory, string> = {
  food: '🍽️',
  transport: '🚌',
  accommodation: '🏨',
  activities: '🎭',
  shopping: '🛍️',
  health: '💊',
  communication: '📱',
  other: '📦',
}

interface ExpenseRowProps {
  expense: Expense
  onDelete: (id: string) => void
  baseCurrency: string
  convert: (amount: number, from: string, to: string) => number
}

const ExpenseRow = ({ expense, onDelete, baseCurrency, convert }: ExpenseRowProps) => {
  const amountInBase = convert(expense.amount, expense.currency, baseCurrency)

  const confirmDelete = () => {
    Alert.alert(
      'Eliminar gasto',
      `¿Eliminar "${expense.description}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => onDelete(expense.id),
        },
      ]
    )
  }

  return (
    <View className="mb-2 flex-row items-center rounded-xl border border-slate-700 bg-slate-800 px-4 py-3">
      <Text className="mr-3 text-2xl" accessibilityElementsHidden>
        {CATEGORY_EMOJI[expense.category]}
      </Text>

      <View className="flex-1">
        <Text className="text-sm font-semibold text-white" numberOfLines={1}>
          {expense.description}
        </Text>
        <Text className="text-xs text-slate-500">
          {EXPENSE_CATEGORY_LABELS[expense.category]}
          {expense.inputMethod === 'ai_parsed' ? ' · ✨ IA' : ''}
        </Text>
      </View>

      <View className="items-end">
        <Text className="text-sm font-bold text-white">
          {expense.currency} {expense.amount.toFixed(2)}
        </Text>
        {expense.currency !== baseCurrency ? (
          <Text className="text-xs text-slate-500">
            ≈ {baseCurrency} {amountInBase.toFixed(2)}
          </Text>
        ) : null}
      </View>

      <Pressable
        onPress={confirmDelete}
        accessibilityRole="button"
        accessibilityLabel={`Eliminar ${expense.description}`}
        className="ml-3 rounded-lg bg-slate-700 p-1.5 active:bg-red-900"
      >
        <Text className="text-sm text-slate-400">✕</Text>
      </Pressable>
    </View>
  )
}

// ─── Barra de presupuesto ─────────────────────────────────────────────────────

interface BudgetBarProps {
  spent: number
  budget: number
  currency: string
}

const BudgetBar = ({ spent, budget, currency }: BudgetBarProps) => {
  const pct = Math.min(100, Math.round((spent / budget) * 100))
  const isWarning = pct >= 80
  const isCritical = pct >= 100

  const barColor = isCritical ? 'bg-red-500' : isWarning ? 'bg-yellow-500' : 'bg-emerald-500'

  return (
    <View className="mx-4 mb-4 rounded-xl border border-slate-700 bg-slate-800 p-4">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-xs font-semibold text-slate-400">Presupuesto</Text>
        <Text className={`text-xs font-bold ${isCritical ? 'text-red-400' : isWarning ? 'text-yellow-400' : 'text-slate-300'}`}>
          {pct}%
        </Text>
      </View>

      <View className="h-2 overflow-hidden rounded-full bg-slate-700">
        <View
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </View>

      <View className="mt-2 flex-row justify-between">
        <Text className="text-xs text-slate-500">
          Gastado: {currency} {spent.toFixed(2)}
        </Text>
        <Text className="text-xs text-slate-500">
          Total: {currency} {budget.toFixed(2)}
        </Text>
      </View>

      {isCritical ? (
        <Text className="mt-2 text-xs font-semibold text-red-400">
          ⚠️ Has superado el presupuesto del viaje
        </Text>
      ) : isWarning ? (
        <Text className="mt-2 text-xs font-semibold text-yellow-400">
          ⚠️ Has usado más del 80% del presupuesto
        </Text>
      ) : null}
    </View>
  )
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function ExpensesScreen() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>()
  const { data: trip } = useTrip(tripId ?? '')
  const { data: expenses, isLoading, error, refetch } = useExpenses(tripId ?? '')
  const createMutation = useCreateExpense(tripId ?? '')
  const deleteMutation = useDeleteExpense(tripId ?? '')
  const { convert } = useCurrencyConverter()

  const [showAddModal, setShowAddModal] = useState(false)

  const baseCurrency = trip?.baseCurrency ?? 'USD'
  const sections = useMemo(() => groupExpensesByDay(expenses ?? []), [expenses])
  const totals = useMemo(() => computeExpenseTotals(expenses ?? []), [expenses])

  // Total en moneda base (convertido si hay monedas mixtas)
  const totalInBase = useMemo(() =>
    (expenses ?? []).reduce(
      (sum, exp) => sum + convert(exp.amount, exp.currency, baseCurrency),
      0
    ),
  [expenses, baseCurrency, convert])

  // ─── Alerta de presupuesto ──────────────────────────────────────────────

  const checkBudgetAlert = (newExpenseAmount: number, newExpenseCurrency: string) => {
    if (!trip?.totalBudget) return

    const newTotal = totalInBase + convert(newExpenseAmount, newExpenseCurrency, baseCurrency)
    const pct = (newTotal / trip.totalBudget) * 100

    if (pct >= 100) {
      Alert.alert(
        '⚠️ Presupuesto superado',
        `El gasto total (${baseCurrency} ${newTotal.toFixed(2)}) ha superado el presupuesto de ${baseCurrency} ${trip.totalBudget.toFixed(2)}.`,
        [{ text: 'Entendido' }]
      )
    } else if (pct >= 80) {
      Alert.alert(
        '⚠️ Presupuesto al 80%',
        `Ya has gastado el ${Math.round(pct)}% del presupuesto del viaje.`,
        [{ text: 'OK' }]
      )
    }
  }

  // ─── Crear gasto ────────────────────────────────────────────────────────

  const handleCreate = (values: CreateExpenseInput) => {
    checkBudgetAlert(values.amount, values.currency)

    createMutation.mutate(values, {
      onSuccess: () => {
        setShowAddModal(false)
        logger.info('Gasto creado correctamente', { tripId })
      },
      onError: () => {
        Alert.alert('Error', 'No se pudo guardar el gasto. Inténtalo de nuevo.')
      },
    })
  }

  // ─── Estados de carga y error ────────────────────────────────────────────

  if (isLoading) {
    return (
      <View className="flex-1 bg-slate-900 pt-14">
        <View className="px-4">
          <LoadingSkeleton count={4} height={80} />
        </View>
      </View>
    )
  }

  if (error) {
    return (
      <View className="flex-1 bg-slate-900">
        <View className="px-4 pt-14">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Volver al viaje"
          >
            <Text className="text-indigo-400">← Volver</Text>
          </Pressable>
        </View>
        <EmptyState
          title="Error al cargar gastos"
          subtitle="No pudimos cargar los gastos de este viaje"
          actionLabel="Reintentar"
          onAction={refetch}
        />
      </View>
    )
  }

  return (
    <View className="flex-1 bg-slate-900">
      {/* Header */}
      <View className="px-4 pb-3 pt-14">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver al viaje"
        >
          <Text className="mb-4 text-indigo-400">← Volver</Text>
        </Pressable>

        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-white">Gastos</Text>
          <Badge
            label={`${baseCurrency} ${totalInBase.toFixed(2)}`}
            variant="info"
          />
        </View>

        {totals.count > 0 ? (
          <Text className="mt-1 text-sm text-slate-400">
            {totals.count} gasto{totals.count !== 1 ? 's' : ''}
          </Text>
        ) : null}
      </View>

      {/* Barra de presupuesto — solo si el viaje tiene presupuesto numérico definido */}
      {trip?.totalBudget ? (
        <BudgetBar
          spent={totalInBase}
          budget={trip.totalBudget}
          currency={baseCurrency}
        />
      ) : null}

      {/* Lista de gastos o estado vacío */}
      {sections.length === 0 ? (
        <EmptyState
          title="Sin gastos registrados"
          subtitle="Registra gastos manualmente o describe con texto usando IA"
          actionLabel="Añadir primer gasto"
          onAction={() => setShowAddModal(true)}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <View className="mb-2 mt-4 flex-row items-center justify-between">
              <Text className="text-sm font-semibold capitalize text-slate-400">
                {section.title}
              </Text>
              <Text className="text-xs text-slate-500">
                {baseCurrency} {convert(section.total, section.data[0]?.currency ?? baseCurrency, baseCurrency).toFixed(2)}
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <ExpenseRow
              expense={item}
              baseCurrency={baseCurrency}
              convert={convert}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          )}
        />
      )}

      {/* FAB — añadir gasto */}
      <View className="absolute bottom-8 right-4">
        <Pressable
          onPress={() => setShowAddModal(true)}
          accessibilityRole="button"
          accessibilityLabel="Añadir gasto"
          className="rounded-full bg-indigo-600 px-5 py-4 shadow-lg active:bg-indigo-700"
        >
          <Text className="text-lg font-bold text-white">+ Gasto</Text>
        </Pressable>
      </View>

      {/* Modal de nuevo gasto */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View className="flex-1 bg-slate-900">
          <View className="px-4 pb-2 pt-6">
            <Text className="text-xl font-bold text-white">Nuevo gasto</Text>
          </View>

          <ExpenseForm
            tripId={tripId ?? ''}
            baseCurrency={baseCurrency}
            onSubmit={handleCreate}
            onCancel={() => setShowAddModal(false)}
            isSubmitting={createMutation.isPending}
          />
        </View>
      </Modal>
    </View>
  )
}
