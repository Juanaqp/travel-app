import { useState, useMemo } from 'react'
import { View, SectionList, Pressable, Alert, StyleSheet } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTrip } from '@/hooks/useTrips'
import {
  useExpenses,
  useCreateExpense,
  useDeleteExpense,
  computeExpenseTotals,
} from '@/hooks/useExpenses'
import { useCurrencyConverter } from '@/lib/currencyConverter'
import { ExpenseForm } from '@/components/ExpenseForm'
import { Skeleton } from '@/components/ui/Skeleton'
import { Text } from '@/components/ui/Text'
import { Icon } from '@/components/ui/Icon'
import { Button } from '@/components/ui/Button'
import { useTheme } from '@/hooks/useTheme'
import { theme } from '@/constants/theme'
import { logger } from '@/lib/logger'
import type { Expense, ExpenseCategory, CreateExpenseInput } from '@travelapp/types'
import { EXPENSE_CATEGORY_LABELS } from '@travelapp/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface ExpenseSection {
  title: string
  dateKey: string
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
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateKey, items]) => ({
      title: formatDateHeader(dateKey),
      dateKey,
      data: items,
      total: items.reduce((sum, e) => sum + e.amount, 0),
    }))
}

// ─── Constantes de categoría ──────────────────────────────────────────────────

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

const CATEGORY_COLOR: Record<ExpenseCategory, string> = {
  food: '#FF9500',
  transport: '#007AFF',
  accommodation: '#8B5CF6',
  activities: '#00A699',
  shopping: '#FF5A5F',
  health: '#34C759',
  communication: '#5AC8FA',
  other: '#8E8E93',
}

// ─── Fila de gasto ────────────────────────────────────────────────────────────

interface ExpenseRowProps {
  expense: Expense
  onDelete: (id: string) => void
  baseCurrency: string
  convert: (amount: number, from: string, to: string) => number
}

const ExpenseRow = ({ expense, onDelete, baseCurrency, convert }: ExpenseRowProps) => {
  const { colors, isDark } = useTheme()
  const amountInBase = convert(expense.amount, expense.currency, baseCurrency)
  const catColor = CATEGORY_COLOR[expense.category]

  const confirmDelete = () => {
    Alert.alert(
      'Eliminar gasto',
      `¿Eliminar "${expense.description}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => onDelete(expense.id) },
      ]
    )
  }

  return (
    <View
      style={[
        styles.expenseRow,
        {
          backgroundColor: colors.background.surface,
          borderColor: colors.border,
          ...(isDark ? {} : theme.shadows.sm),
        },
      ]}
    >
      {/* Círculo de categoría 40px */}
      <View style={[styles.categoryCircle, { backgroundColor: `${catColor}18` }]}>
        <Text style={styles.categoryEmoji}>{CATEGORY_EMOJI[expense.category]}</Text>
      </View>

      {/* Descripción + categoría */}
      <View style={styles.expenseInfo}>
        <Text variant="body" weight="semibold" color={colors.text.primary} numberOfLines={1}>
          {expense.description}
        </Text>
        <View style={styles.expenseMeta}>
          <Text variant="caption" color={colors.text.tertiary}>
            {EXPENSE_CATEGORY_LABELS[expense.category]}
          </Text>
          {expense.inputMethod === 'ai_parsed' ? (
            <View style={[styles.aiBadge, { backgroundColor: `${colors.primary}15` }]}>
              <Text variant="caption" weight="semibold" color={colors.primary}>
                ✨ IA
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Montos */}
      <View style={styles.expenseAmounts}>
        <Text variant="label" weight="semibold" color={colors.text.primary}>
          {expense.currency} {expense.amount.toFixed(2)}
        </Text>
        {expense.currency !== baseCurrency ? (
          <Text variant="caption" color={colors.text.tertiary}>
            ≈ {baseCurrency} {amountInBase.toFixed(2)}
          </Text>
        ) : null}
      </View>

      {/* Borrar */}
      <Pressable
        onPress={confirmDelete}
        accessibilityRole="button"
        accessibilityLabel={`Eliminar ${expense.description}`}
        style={[styles.deleteBtn, { backgroundColor: colors.background.elevated ?? colors.background.surface }]}
      >
        <Icon name="close" size="sm" color={colors.text.tertiary} />
      </Pressable>
    </View>
  )
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function ExpensesScreen() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const { data: trip } = useTrip(tripId ?? '')
  const { data: expenses, isLoading, error, refetch } = useExpenses(tripId ?? '')
  const createMutation = useCreateExpense(tripId ?? '')
  const deleteMutation = useDeleteExpense(tripId ?? '')
  const { convert } = useCurrencyConverter()
  const { colors, isDark } = useTheme()

  const [showAddModal, setShowAddModal] = useState(false)
  const [activeCategory, setActiveCategory] = useState<ExpenseCategory | null>(null)

  const baseCurrency = trip?.baseCurrency ?? 'USD'
  const expenseList = expenses ?? []

  const totalInBase = useMemo(
    () => expenseList.reduce((sum, exp) => sum + convert(exp.amount, exp.currency, baseCurrency), 0),
    [expenseList, baseCurrency, convert]
  )

  // Totales por categoría en moneda base
  const categoryTotals = useMemo(() => {
    const totals: Partial<Record<ExpenseCategory, number>> = {}
    for (const exp of expenseList) {
      const amountBase = convert(exp.amount, exp.currency, baseCurrency)
      totals[exp.category] = (totals[exp.category] ?? 0) + amountBase
    }
    return totals
  }, [expenseList, baseCurrency, convert])

  const activeCategories = Object.entries(categoryTotals)
    .filter(([, amount]) => (amount ?? 0) > 0)
    .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0)) as [ExpenseCategory, number][]

  // Secciones con filtro de categoría activa
  const filteredExpenses = activeCategory
    ? expenseList.filter((e) => e.category === activeCategory)
    : expenseList

  const sections = useMemo(() => groupExpensesByDay(filteredExpenses), [filteredExpenses])

  const budgetProgress = trip?.totalBudget && trip.totalBudget > 0
    ? Math.min(totalInBase / trip.totalBudget, 1)
    : 0

  // ─── Alerta de presupuesto ──────────────────────────────────────────────

  const checkBudgetAlert = (newAmount: number, newCurrency: string) => {
    if (!trip?.totalBudget) return
    const newTotal = totalInBase + convert(newAmount, newCurrency, baseCurrency)
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
      <View style={[styles.root, { backgroundColor: colors.background.base, paddingTop: insets.top + theme.spacing.md }]}>
        <Pressable onPress={() => router.back()} style={styles.loadingBack}>
          <Icon name="back" size="md" color={colors.text.primary} />
        </Pressable>
        <View style={styles.skeletonContainer}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} width="100%" height={72} radius="lg" style={{ marginBottom: theme.spacing.sm }} />
          ))}
        </View>
      </View>
    )
  }

  if (error) {
    return (
      <View style={[styles.root, styles.errorContainer, { backgroundColor: colors.background.base }]}>
        <Pressable onPress={() => router.back()} style={[styles.floatingBack, { top: insets.top + theme.spacing.sm }]}>
          <Icon name="back" size="md" color={colors.text.primary} />
        </Pressable>
        <Icon name="offline" size="xl" color={colors.text.tertiary} />
        <Text variant="subheading" weight="semibold" color={colors.text.secondary} align="center">
          Error al cargar gastos
        </Text>
        <Button
          label="Reintentar"
          onPress={() => { refetch().catch(() => {}) }}
          variant="secondary"
        />
      </View>
    )
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background.base }]}>

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + theme.spacing.sm,
            backgroundColor: colors.background.base,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver al viaje"
          style={styles.backBtn}
        >
          <Icon name="back" size="md" color={colors.text.primary} />
        </Pressable>
        <Text variant="heading" weight="bold" color={colors.text.primary}>
          Gastos
        </Text>
        <View style={{ flex: 1 }} />
        <Text variant="caption" color={colors.text.tertiary}>
          {expenseList.length} gasto{expenseList.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Tarjeta resumen */}
      <View
        style={[
          styles.summaryCard,
          {
            backgroundColor: colors.background.surface,
            borderColor: colors.border,
            ...(isDark ? {} : theme.shadows.sm),
          },
        ]}
      >
        {/* Total xxxl */}
        <Text
          variant="caption"
          weight="semibold"
          color={colors.text.tertiary}
          style={styles.summaryLabel}
        >
          TOTAL GASTADO
        </Text>
        <Text
          style={[styles.totalAmount, { color: colors.text.primary }]}
        >
          {baseCurrency} {totalInBase.toFixed(2)}
        </Text>

        {/* Barra de presupuesto */}
        {trip?.totalBudget && trip.totalBudget > 0 ? (
          <View style={styles.budgetSection}>
            <View style={styles.budgetLabels}>
              <Text variant="caption" color={colors.text.tertiary}>
                Presupuesto: {baseCurrency} {trip.totalBudget.toFixed(0)}
              </Text>
              <Text
                variant="caption"
                weight="semibold"
                color={
                  budgetProgress > 0.9
                    ? colors.semantic.danger
                    : budgetProgress > 0.7
                    ? colors.semantic.warning
                    : colors.semantic.success
                }
              >
                {Math.round(budgetProgress * 100)}%
              </Text>
            </View>
            <View style={[styles.budgetTrack, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.budgetFill,
                  {
                    width: `${budgetProgress * 100}%`,
                    backgroundColor:
                      budgetProgress > 0.9
                        ? colors.semantic.danger
                        : budgetProgress > 0.7
                        ? colors.semantic.warning
                        : colors.semantic.success,
                  },
                ]}
              />
            </View>
          </View>
        ) : null}

        {/* Pills por categoría */}
        {activeCategories.length > 0 ? (
          <View style={styles.categoryPillsSection}>
            <Pressable
              onPress={() => setActiveCategory(null)}
              style={[
                styles.categoryPill,
                {
                  backgroundColor: activeCategory === null ? colors.primary : colors.background.base,
                  borderColor: activeCategory === null ? colors.primary : colors.border,
                },
              ]}
            >
              <Text variant="caption" weight="semibold" color={activeCategory === null ? '#FFFFFF' : colors.text.secondary}>
                Todo
              </Text>
            </Pressable>
            {activeCategories.map(([cat, amount]) => {
              const isActive = activeCategory === cat
              const catColor = CATEGORY_COLOR[cat]
              return (
                <Pressable
                  key={cat}
                  onPress={() => setActiveCategory(isActive ? null : cat)}
                  style={[
                    styles.categoryPill,
                    {
                      backgroundColor: isActive ? catColor : colors.background.base,
                      borderColor: isActive ? catColor : colors.border,
                    },
                  ]}
                >
                  <Text style={styles.pillEmoji}>{CATEGORY_EMOJI[cat]}</Text>
                  <Text
                    variant="caption"
                    weight="semibold"
                    color={isActive ? '#FFFFFF' : colors.text.secondary}
                  >
                    {baseCurrency} {(amount ?? 0).toFixed(0)}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        ) : null}
      </View>

      {/* Lista de gastos o estado vacío */}
      {sections.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconWrapper, { backgroundColor: `${colors.primary}18` }]}>
            <Icon name="budget" size="xl" color={colors.primary} />
          </View>
          <Text variant="heading" weight="bold" color={colors.text.primary} align="center">
            Sin gastos registrados
          </Text>
          <Text variant="body" color={colors.text.secondary} align="center">
            Registra gastos manualmente o usa IA
          </Text>
          <Button
            label="Añadir primer gasto"
            onPress={() => setShowAddModal(true)}
            variant="primary"
            icon="add"
            style={styles.emptyBtn}
          />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text variant="label" weight="semibold" color={colors.text.secondary} style={{ textTransform: 'capitalize' }}>
                {section.title}
              </Text>
              <Text variant="caption" color={colors.text.tertiary}>
                {baseCurrency}{' '}
                {convert(section.total, section.data[0]?.currency ?? baseCurrency, baseCurrency).toFixed(2)}
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <ExpenseRow
              expense={item}
              baseCurrency={baseCurrency}
              convert={convert}
              onDelete={(expId) => deleteMutation.mutate(expId)}
            />
          )}
        />
      )}

      {/* FAB añadir gasto */}
      <Pressable
        onPress={() => setShowAddModal(true)}
        accessibilityRole="button"
        accessibilityLabel="Añadir gasto"
        style={[styles.fab, { backgroundColor: colors.primary, bottom: insets.bottom + 24 }]}
      >
        <Icon name="add" size="lg" color="#FFFFFF" />
      </Pressable>

      {/* Modal nuevo gasto */}
      {showAddModal ? (
        <ExpenseForm
          tripId={tripId ?? ''}
          baseCurrency={baseCurrency}
          onSubmit={handleCreate}
          onCancel={() => setShowAddModal(false)}
          isSubmitting={createMutation.isPending}
          visible={showAddModal}
        />
      ) : null}
    </View>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  floatingBack: {
    position: 'absolute',
    left: theme.spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingBack: {
    marginLeft: theme.spacing.md,
    marginBottom: theme.spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeletonContainer: {
    paddingHorizontal: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: theme.spacing.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCard: {
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  summaryLabel: {
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  totalAmount: {
    fontSize: theme.typography.size.xxxl,
    fontWeight: '700' as const,
    lineHeight: theme.typography.size.xxxl * 1.2,
  },
  budgetSection: {
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  budgetLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetTrack: {
    height: 6,
    borderRadius: theme.radius.full,
    overflow: 'hidden',
  },
  budgetFill: {
    height: '100%',
    borderRadius: theme.radius.full,
  },
  categoryPillsSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    borderWidth: 1,
  },
  pillEmoji: {
    fontSize: 13,
  },
  listContent: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: 100,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  categoryCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryEmoji: {
    fontSize: 18,
  },
  expenseInfo: {
    flex: 1,
    gap: 2,
  },
  expenseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  aiBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
  },
  expenseAmounts: {
    alignItems: 'flex-end',
    gap: 2,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  emptyIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  emptyBtn: {
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xl,
  },
  fab: {
    position: 'absolute',
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
})
