import { useState } from 'react'
import {
  View,
  TextInput,
  Pressable,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/hooks/useTheme'
import { theme } from '@/constants/theme'
import { Text } from '@/components/ui/Text'
import { Icon } from '@/components/ui/Icon'
import { useParseExpense } from '@/hooks/useExpenses'
import type { CreateExpenseInput, ExpenseCategory, ParseExpenseResult } from '@travelapp/types'
import { EXPENSE_CATEGORY_LABELS } from '@travelapp/types'

// ─── Monedas frecuentes ───────────────────────────────────────────────────────

const QUICK_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'MXN', 'BRL', 'ARS', 'PEN', 'CLP', 'COP']

// ─── Emojis de categoría ──────────────────────────────────────────────────────

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

// ─── Props ────────────────────────────────────────────────────────────────────

interface ExpenseFormProps {
  visible: boolean
  tripId: string
  baseCurrency: string
  initialValues?: Partial<CreateExpenseInput>
  onSubmit: (values: CreateExpenseInput) => void
  onCancel: () => void
  isSubmitting?: boolean
}

// ─── ExpenseForm ──────────────────────────────────────────────────────────────

export const ExpenseForm = ({
  visible,
  tripId,
  baseCurrency,
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: ExpenseFormProps) => {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const parseExpenseMutation = useParseExpense()

  // Estado del formulario
  const [description, setDescription] = useState(initialValues?.description ?? '')
  const [amountText, setAmountText] = useState(
    initialValues?.amount != null ? String(initialValues.amount) : ''
  )
  const [currency, setCurrency] = useState(initialValues?.currency ?? baseCurrency)
  const [category, setCategory] = useState<ExpenseCategory>(initialValues?.category ?? 'other')
  const [spentAt, setSpentAt] = useState(
    initialValues?.spentAt
      ? initialValues.spentAt.slice(0, 10)
      : new Date().toISOString().slice(0, 10)
  )
  const [notes, setNotes] = useState(initialValues?.notes ?? '')

  // Estado de la UI
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false)
  const [showAiModal, setShowAiModal] = useState(false)
  const [aiInputText, setAiInputText] = useState('')
  const [lastParseResult, setLastParseResult] = useState<ParseExpenseResult | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  // ─── Parseo con IA ────────────────────────────────────────────────────────

  const handleAiParse = async () => {
    if (!aiInputText.trim()) return

    try {
      const result = await parseExpenseMutation.mutateAsync({
        text: aiInputText.trim(),
        tripId,
        language: 'es',
        currentDate: new Date().toISOString().slice(0, 10),
      })

      setLastParseResult(result)

      if (result.fields.title) setDescription(result.fields.title)
      if (result.fields.amount != null) setAmountText(String(result.fields.amount))
      if (result.fields.currency) setCurrency(result.fields.currency)
      if (result.fields.category) setCategory(result.fields.category as ExpenseCategory)
      if (result.fields.date) setSpentAt(result.fields.date)

      setShowAiModal(false)
      setAiInputText('')
    } catch {
      Alert.alert('Error de IA', 'No se pudo analizar el texto. Inténtalo de nuevo.')
    }
  }

  // ─── Envío del formulario ─────────────────────────────────────────────────

  const handleSubmit = () => {
    const amount = parseFloat(amountText.replace(',', '.'))

    if (!description.trim()) {
      Alert.alert('Campo requerido', 'Escribe una descripción del gasto.')
      return
    }
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Monto inválido', 'Ingresa un monto mayor a 0.')
      return
    }

    onSubmit({
      tripId,
      description: description.trim(),
      amount,
      currency,
      category,
      inputMethod: lastParseResult ? 'ai_parsed' : 'manual',
      spentAt: `${spentAt}T12:00:00Z`,
      notes: notes.trim() || undefined,
    })
  }

  const confidenceColor =
    (lastParseResult?.confidence ?? 0) >= 0.8
      ? colors.semantic.success
      : (lastParseResult?.confidence ?? 0) >= 0.5
      ? colors.semantic.warning
      : colors.semantic.danger

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        style={[styles.flex, { backgroundColor: colors.background.base }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Handle bar */}
        <View style={styles.handleRow}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
        </View>

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text variant="title" weight="bold" color={colors.text.primary}>
            Nuevo gasto
          </Text>
          <Pressable
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Cerrar formulario"
            style={styles.closeBtn}
          >
            <Icon name="close" size="md" color={colors.text.tertiary} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.flex}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* ─── Botón de parseo con IA ──────────────────────────────── */}
          <Pressable
            onPress={() => setShowAiModal(true)}
            accessibilityRole="button"
            accessibilityLabel="Describir gasto con IA"
            style={[
              styles.aiParseBtn,
              { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}40` },
            ]}
          >
            <Text style={styles.aiSparkle}>✨</Text>
            <View style={styles.aiParseBtnText}>
              <Text variant="body" weight="semibold" color={colors.primary}>
                Describir con texto libre
              </Text>
              <Text variant="caption" color={colors.text.tertiary}>
                La IA completa el formulario
              </Text>
            </View>
          </Pressable>

          {/* Resultado del último parseo */}
          {lastParseResult ? (
            <View style={[styles.parseResultRow, { borderColor: colors.border }]}>
              <View style={[styles.confidencePill, { backgroundColor: `${confidenceColor}20` }]}>
                <Text variant="caption" weight="semibold" style={{ color: confidenceColor }}>
                  ✨ IA · {Math.round(lastParseResult.confidence * 100)}%
                </Text>
              </View>
              <Text variant="caption" color={colors.text.tertiary} numberOfLines={1} style={styles.flex}>
                "{lastParseResult.raw_text}"
              </Text>
            </View>
          ) : null}

          {/* Divisor */}
          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text variant="caption" color={colors.text.tertiary}>
              o ingresa manualmente
            </Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          {/* ─── Monto + moneda ─────────────────────────────────────── */}
          <View style={styles.amountRow}>
            <TextInput
              value={amountText}
              onChangeText={setAmountText}
              placeholder="0.00"
              placeholderTextColor={colors.text.tertiary}
              keyboardType="decimal-pad"
              style={[
                styles.amountInput,
                {
                  color: amountText ? colors.text.primary : colors.text.tertiary,
                  fontSize: theme.typography.size.xxxl,
                },
              ]}
            />
            <Pressable
              onPress={() => setShowCurrencyPicker(true)}
              accessibilityRole="button"
              accessibilityLabel={`Moneda: ${currency}`}
              style={[
                styles.currencyPill,
                { backgroundColor: colors.background.surface, borderColor: colors.border },
              ]}
            >
              <Text variant="body" weight="semibold" color={colors.primary}>
                {currency}
              </Text>
            </Pressable>
          </View>

          {/* ─── Categorías ─────────────────────────────────────────── */}
          <Text
            variant="caption"
            weight="semibold"
            color={colors.text.tertiary}
            style={styles.sectionLabel}
          >
            CATEGORÍA
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
          >
            {(Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]).map((cat) => {
              const isActive = category === cat
              return (
                <Pressable
                  key={cat}
                  onPress={() => setCategory(cat)}
                  accessibilityRole="button"
                  accessibilityLabel={`Categoría ${EXPENSE_CATEGORY_LABELS[cat]}`}
                  accessibilityState={{ selected: isActive }}
                  style={[
                    styles.categoryPill,
                    isActive
                      ? { backgroundColor: colors.primary, borderColor: 'transparent' }
                      : { backgroundColor: colors.background.surface, borderColor: colors.border },
                  ]}
                >
                  <Text style={styles.categoryEmoji}>{CATEGORY_EMOJI[cat]}</Text>
                  <Text
                    variant="caption"
                    weight="semibold"
                    color={isActive ? '#FFFFFF' : colors.text.secondary}
                  >
                    {EXPENSE_CATEGORY_LABELS[cat]}
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>

          {/* ─── Descripción (siempre visible, requerida) ─────────── */}
          <Text
            variant="caption"
            weight="semibold"
            color={colors.text.tertiary}
            style={styles.sectionLabel}
          >
            DESCRIPCIÓN *
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Ej: Cena en restaurante"
            placeholderTextColor={colors.text.tertiary}
            style={[
              styles.textField,
              {
                backgroundColor: colors.background.surface,
                borderColor: colors.border,
                color: colors.text.primary,
              },
            ]}
            maxLength={120}
            returnKeyType="next"
          />

          {/* ─── Más detalles colapsable (fecha + notas) ─────────── */}
          <Pressable
            onPress={() => setShowDetails((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={showDetails ? 'Ocultar detalles' : 'Más detalles'}
            style={[styles.detailsToggle, { borderColor: colors.border }]}
          >
            <Text variant="caption" weight="semibold" color={colors.text.secondary}>
              {showDetails ? '▲ Menos detalles' : '▼ Más detalles'}
            </Text>
          </Pressable>

          {showDetails ? (
            <View style={styles.detailsSection}>
              {/* Fecha */}
              <Text
                variant="caption"
                weight="semibold"
                color={colors.text.tertiary}
                style={styles.fieldLabel}
              >
                FECHA
              </Text>
              <TextInput
                value={spentAt}
                onChangeText={setSpentAt}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.text.tertiary}
                style={[
                  styles.textField,
                  {
                    backgroundColor: colors.background.surface,
                    borderColor: colors.border,
                    color: colors.text.primary,
                  },
                ]}
                maxLength={10}
              />

              {/* Notas */}
              <Text
                variant="caption"
                weight="semibold"
                color={colors.text.tertiary}
                style={styles.fieldLabel}
              >
                NOTAS (OPCIONAL)
              </Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Información adicional"
                placeholderTextColor={colors.text.tertiary}
                multiline
                numberOfLines={3}
                style={[
                  styles.textArea,
                  {
                    backgroundColor: colors.background.surface,
                    borderColor: colors.border,
                    color: colors.text.primary,
                  },
                ]}
                maxLength={300}
              />
            </View>
          ) : null}

          {/* ─── Botones de acción ───────────────────────────────── */}
          <View style={[styles.actionsRow, { marginTop: theme.spacing.lg }]}>
            <Pressable
              onPress={onCancel}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel="Cancelar"
              style={[
                styles.actionBtn,
                { backgroundColor: colors.background.surface, borderColor: colors.border },
              ]}
            >
              <Text variant="body" weight="semibold" color={colors.text.secondary}>
                Cancelar
              </Text>
            </Pressable>

            <Pressable
              onPress={handleSubmit}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel="Guardar gasto"
              style={[
                styles.actionBtnPrimary,
                { backgroundColor: colors.primary, opacity: isSubmitting ? 0.6 : 1 },
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text variant="body" weight="semibold" color="#FFFFFF">
                  Guardar
                </Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ─── Modal de IA ─────────────────────────────────────────────────── */}
      <Modal
        visible={showAiModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAiModal(false)}
      >
        <View
          style={[
            styles.innerModal,
            { backgroundColor: colors.background.base },
          ]}
        >
          <Text
            variant="title"
            weight="bold"
            color={colors.text.primary}
            style={{ marginBottom: 4 }}
          >
            Describir gasto
          </Text>
          <Text
            variant="body"
            color={colors.text.secondary}
            style={{ marginBottom: theme.spacing.lg }}
          >
            Describe el gasto en lenguaje natural. La IA extraerá los datos automáticamente.
          </Text>

          <Text
            variant="caption"
            weight="semibold"
            color={colors.text.tertiary}
            style={styles.fieldLabel}
          >
            DESCRIPCIÓN LIBRE
          </Text>
          <TextInput
            value={aiInputText}
            onChangeText={setAiInputText}
            placeholder="Ej: gasté 40 euros en cena en Roma ayer"
            placeholderTextColor={colors.text.tertiary}
            multiline
            numberOfLines={4}
            style={[
              styles.textArea,
              {
                backgroundColor: colors.background.surface,
                borderColor: colors.border,
                color: colors.text.primary,
                marginBottom: theme.spacing.sm,
              },
            ]}
            autoFocus
            maxLength={500}
          />

          <Text
            variant="caption"
            color={colors.text.tertiary}
            style={{ marginBottom: theme.spacing.lg }}
          >
            🎙 Para entrada por voz, instala expo-speech-recognition en una versión futura.
          </Text>

          <View style={styles.actionsRow}>
            <Pressable
              onPress={() => {
                setShowAiModal(false)
                setAiInputText('')
              }}
              style={[
                styles.actionBtn,
                { backgroundColor: colors.background.surface, borderColor: colors.border },
              ]}
            >
              <Text variant="body" weight="semibold" color={colors.text.secondary}>
                Cancelar
              </Text>
            </Pressable>

            <Pressable
              onPress={handleAiParse}
              disabled={!aiInputText.trim() || parseExpenseMutation.isPending}
              style={[
                styles.actionBtnPrimary,
                {
                  backgroundColor: colors.primary,
                  opacity: !aiInputText.trim() || parseExpenseMutation.isPending ? 0.5 : 1,
                },
              ]}
            >
              {parseExpenseMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text variant="body" weight="semibold" color="#FFFFFF">
                  ✨ Analizar
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ─── Modal selector de moneda ────────────────────────────────────── */}
      <Modal
        visible={showCurrencyPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCurrencyPicker(false)}
      >
        <View
          style={[
            styles.innerModal,
            { backgroundColor: colors.background.base },
          ]}
        >
          <Text
            variant="title"
            weight="bold"
            color={colors.text.primary}
            style={{ marginBottom: theme.spacing.md }}
          >
            Seleccionar moneda
          </Text>

          {QUICK_CURRENCIES.map((code) => (
            <Pressable
              key={code}
              onPress={() => {
                setCurrency(code)
                setShowCurrencyPicker(false)
              }}
              accessibilityRole="button"
              accessibilityLabel={`Seleccionar ${code}`}
              style={[
                styles.currencyOption,
                currency === code
                  ? { backgroundColor: colors.primary, borderColor: 'transparent' }
                  : { backgroundColor: colors.background.surface, borderColor: colors.border },
              ]}
            >
              <Text
                variant="body"
                weight="medium"
                color={currency === code ? '#FFFFFF' : colors.text.primary}
              >
                {code}
              </Text>
            </Pressable>
          ))}

          <Pressable
            onPress={() => setShowCurrencyPicker(false)}
            style={[
              styles.currencyOption,
              {
                backgroundColor: colors.background.surface,
                borderColor: colors.border,
                marginTop: theme.spacing.xs,
              },
            ]}
          >
            <Text
              variant="body"
              weight="semibold"
              color={colors.text.secondary}
              style={{ textAlign: 'center' }}
            >
              Cancelar
            </Text>
          </Pressable>
        </View>
      </Modal>
    </Modal>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
  },
  closeBtn: {
    padding: theme.spacing.xs,
  },
  scrollContent: {
    padding: theme.spacing.md,
  },
  aiParseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
  aiSparkle: {
    fontSize: 22,
  },
  aiParseBtnText: {
    gap: 2,
  },
  parseResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    borderTopWidth: 1,
    paddingTop: theme.spacing.sm,
  },
  confidencePill: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
    flexShrink: 0,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginVertical: theme.spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  amountInput: {
    fontWeight: '700',
    textAlign: 'center',
    minWidth: 120,
  },
  currencyPill: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.full,
    borderWidth: 1,
  },
  sectionLabel: {
    letterSpacing: 0.5,
    marginBottom: theme.spacing.sm,
  },
  categoryScroll: {
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    borderWidth: 1,
  },
  categoryEmoji: {
    fontSize: 15,
  },
  textField: {
    borderWidth: 1,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    fontSize: theme.typography.size.base,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    fontSize: theme.typography.size.base,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  detailsToggle: {
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  detailsSection: {
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  fieldLabel: {
    letterSpacing: 0.5,
    marginBottom: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  actionBtn: {
    flex: 1,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
  },
  actionBtnPrimary: {
    flex: 2,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.lg,
  },
  innerModal: {
    flex: 1,
    padding: theme.spacing.md,
    paddingTop: theme.spacing.lg,
  },
  currencyOption: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    marginBottom: theme.spacing.sm,
  },
})
