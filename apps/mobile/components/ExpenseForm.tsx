import { useState } from 'react'
import { View, Text, TextInput, Pressable, Modal, ScrollView, Alert, ActivityIndicator } from 'react-native'
import { useParseExpense } from '@/hooks/useExpenses'
import type { CreateExpenseInput, ExpenseCategory, ParseExpenseResult } from '@travelapp/types'
import { EXPENSE_CATEGORY_LABELS } from '@travelapp/types'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ExpenseFormProps {
  tripId: string
  baseCurrency: string
  initialValues?: Partial<CreateExpenseInput>
  onSubmit: (values: CreateExpenseInput) => void
  onCancel: () => void
  isSubmitting?: boolean
}

// ─── Monedas frecuentes para el selector rápido ───────────────────────────────

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

// ─── Badge de confianza ───────────────────────────────────────────────────────

const ConfidenceBadge = ({ confidence }: { confidence: number }) => {
  const pct = Math.round(confidence * 100)
  const label = confidence >= 0.8 ? 'Alta' : confidence >= 0.5 ? 'Media' : 'Baja'
  const colorClass =
    confidence >= 0.8 ? 'bg-emerald-800' : confidence >= 0.5 ? 'bg-yellow-800' : 'bg-red-900'

  return (
    <View className={`self-start rounded-full px-2 py-0.5 ${colorClass}`}>
      <Text className="text-xs font-medium text-white">
        ✨ IA · {label} {pct}%
      </Text>
    </View>
  )
}

// ─── Formulario principal ─────────────────────────────────────────────────────

export const ExpenseForm = ({
  tripId,
  baseCurrency,
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: ExpenseFormProps) => {
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

      // Autocompletar campos con los datos extraídos
      if (result.fields.title) setDescription(result.fields.title)
      if (result.fields.amount != null) setAmountText(String(result.fields.amount))
      if (result.fields.currency) setCurrency(result.fields.currency)
      if (result.fields.category) setCategory(result.fields.category as ExpenseCategory)
      if (result.fields.date) setSpentAt(result.fields.date)

      setShowAiModal(false)
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

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View className="flex-1 bg-slate-900">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Botón de IA */}
        <View className="mx-4 mb-4 mt-2">
          <Pressable
            onPress={() => setShowAiModal(true)}
            accessibilityRole="button"
            accessibilityLabel="Describir gasto con texto o voz"
            className="flex-row items-center justify-center gap-2 rounded-xl border border-indigo-500 bg-indigo-950 px-4 py-3"
          >
            <Text className="text-lg">✨</Text>
            <Text className="text-sm font-semibold text-indigo-300">
              Describir con texto o voz
            </Text>
          </Pressable>

          {lastParseResult ? (
            <View className="mt-2">
              <ConfidenceBadge confidence={lastParseResult.confidence} />
              <Text className="mt-1 text-xs text-slate-500" numberOfLines={1}>
                "{lastParseResult.raw_text}"
              </Text>
            </View>
          ) : null}
        </View>

        {/* Separador */}
        <View className="mx-4 mb-4 flex-row items-center gap-3">
          <View className="h-px flex-1 bg-slate-700" />
          <Text className="text-xs text-slate-600">o ingresa manualmente</Text>
          <View className="h-px flex-1 bg-slate-700" />
        </View>

        {/* Descripción */}
        <View className="mx-4 mb-4">
          <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Descripción *
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Ej: Cena en restaurante"
            placeholderTextColor="#475569"
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white"
            maxLength={120}
            returnKeyType="next"
          />
        </View>

        {/* Monto + Moneda */}
        <View className="mx-4 mb-4 flex-row gap-3">
          <View className="flex-1">
            <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Monto *
            </Text>
            <TextInput
              value={amountText}
              onChangeText={setAmountText}
              placeholder="0.00"
              placeholderTextColor="#475569"
              keyboardType="decimal-pad"
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white"
            />
          </View>

          <View className="w-24">
            <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Moneda
            </Text>
            <Pressable
              onPress={() => setShowCurrencyPicker(true)}
              accessibilityRole="button"
              accessibilityLabel={`Moneda seleccionada: ${currency}`}
              className="items-center justify-center rounded-xl border border-slate-700 bg-slate-800 py-3"
            >
              <Text className="font-semibold text-white">{currency}</Text>
            </Pressable>
          </View>
        </View>

        {/* Categoría */}
        <View className="mx-4 mb-4">
          <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Categoría
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2">
              {(Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]).map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => setCategory(cat)}
                  accessibilityRole="button"
                  accessibilityLabel={`Categoría ${EXPENSE_CATEGORY_LABELS[cat]}`}
                  accessibilityState={{ selected: category === cat }}
                  className={`flex-row items-center gap-1.5 rounded-full px-3 py-1.5 ${
                    category === cat
                      ? 'bg-indigo-600'
                      : 'border border-slate-700 bg-slate-800'
                  }`}
                >
                  <Text className="text-sm">{CATEGORY_EMOJI[cat]}</Text>
                  <Text
                    className={`text-xs font-medium ${
                      category === cat ? 'text-white' : 'text-slate-400'
                    }`}
                  >
                    {EXPENSE_CATEGORY_LABELS[cat]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Fecha */}
        <View className="mx-4 mb-4">
          <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Fecha
          </Text>
          <TextInput
            value={spentAt}
            onChangeText={setSpentAt}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#475569"
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white"
            maxLength={10}
          />
        </View>

        {/* Notas */}
        <View className="mx-4 mb-6">
          <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Notas (opcional)
          </Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Información adicional"
            placeholderTextColor="#475569"
            multiline
            numberOfLines={2}
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white"
            maxLength={300}
          />
        </View>

        {/* Botones de acción */}
        <View className="mx-4 flex-row gap-3">
          <Pressable
            onPress={onCancel}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel="Cancelar"
            className="flex-1 rounded-xl border border-slate-700 py-3 active:bg-slate-800 disabled:opacity-50"
          >
            <Text className="text-center font-semibold text-slate-400">Cancelar</Text>
          </Pressable>

          <Pressable
            onPress={handleSubmit}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel="Guardar gasto"
            className="flex-1 rounded-xl bg-indigo-600 py-3 active:bg-indigo-700 disabled:opacity-50"
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text className="text-center font-semibold text-white">Guardar</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>

      {/* Modal de IA — texto libre o voz */}
      <Modal
        visible={showAiModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAiModal(false)}
      >
        <View className="flex-1 bg-slate-900 px-4 pt-6">
          <Text className="mb-1 text-xl font-bold text-white">Describir gasto</Text>
          <Text className="mb-6 text-sm text-slate-400">
            Describe el gasto en lenguaje natural. La IA extraerá los datos automáticamente.
          </Text>

          <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Descripción libre
          </Text>
          <TextInput
            value={aiInputText}
            onChangeText={setAiInputText}
            placeholder="Ej: gasté 40 euros en cena en Roma ayer"
            placeholderTextColor="#475569"
            multiline
            numberOfLines={3}
            className="mb-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white"
            autoFocus
            maxLength={500}
          />

          {/* Nota sobre voz — se activa cuando expo-speech-recognition esté disponible */}
          <Text className="mb-6 text-xs text-slate-600">
            🎙 Para entrada por voz, instala expo-speech-recognition en una versión futura.
          </Text>

          <View className="flex-row gap-3">
            <Pressable
              onPress={() => {
                setShowAiModal(false)
                setAiInputText('')
              }}
              className="flex-1 rounded-xl border border-slate-700 py-3"
            >
              <Text className="text-center font-semibold text-slate-400">Cancelar</Text>
            </Pressable>

            <Pressable
              onPress={handleAiParse}
              disabled={!aiInputText.trim() || parseExpenseMutation.isPending}
              className="flex-1 rounded-xl bg-indigo-600 py-3 active:bg-indigo-700 disabled:opacity-50"
            >
              {parseExpenseMutation.isPending ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-center font-semibold text-white">✨ Analizar</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Modal selector de moneda */}
      <Modal
        visible={showCurrencyPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCurrencyPicker(false)}
      >
        <View className="flex-1 bg-slate-900 px-4 pt-6">
          <Text className="mb-4 text-xl font-bold text-white">Seleccionar moneda</Text>

          {QUICK_CURRENCIES.map((code) => (
            <Pressable
              key={code}
              onPress={() => {
                setCurrency(code)
                setShowCurrencyPicker(false)
              }}
              accessibilityRole="button"
              accessibilityLabel={`Seleccionar ${code}`}
              className={`mb-2 rounded-xl px-4 py-3 ${
                currency === code ? 'bg-indigo-600' : 'border border-slate-700 bg-slate-800'
              }`}
            >
              <Text className={`font-medium ${currency === code ? 'text-white' : 'text-slate-300'}`}>
                {code}
              </Text>
            </Pressable>
          ))}

          <Pressable
            onPress={() => setShowCurrencyPicker(false)}
            className="mt-2 rounded-xl border border-slate-700 py-3"
          >
            <Text className="text-center font-semibold text-slate-400">Cancelar</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  )
}
