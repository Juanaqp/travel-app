import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { useToastStore } from '@/stores/useToastStore'
import { scheduleBudgetAlert } from '@/lib/notifications'
import { saveExpensesOffline } from '@/lib/offline/reader'
import type {
  Expense,
  ExpenseCategory,
  ExpenseTotals,
  CreateExpenseInput,
  UpdateExpenseInput,
  ParseExpenseInput,
  ParseExpenseResult,
} from '@travelapp/types'

// ─── Tipo fila de BD (snake_case → camelCase) ─────────────────────────────────

type ExpenseRow = {
  id: string
  trip_id: string
  user_id: string
  description: string
  amount: string | number
  currency: string
  amount_in_base_currency: string | number | null
  category: string
  input_method: string
  spent_at: string
  location: string | null
  notes: string | null
  receipt_storage_path: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

// Convierte fila snake_case de BD al tipo camelCase del dominio
export const mapRowToExpense = (row: ExpenseRow): Expense => ({
  id: row.id,
  tripId: row.trip_id,
  userId: row.user_id,
  description: row.description,
  amount: Number(row.amount),
  currency: row.currency,
  amountInBaseCurrency: row.amount_in_base_currency != null
    ? Number(row.amount_in_base_currency)
    : undefined,
  category: row.category as ExpenseCategory,
  inputMethod: row.input_method as Expense['inputMethod'],
  spentAt: row.spent_at,
  location: row.location ?? undefined,
  notes: row.notes ?? undefined,
  receiptStoragePath: row.receipt_storage_path ?? undefined,
  deletedAt: row.deleted_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

// Calcula totales agrupados por categoría a partir de un array de gastos
export const computeExpenseTotals = (expenses: Expense[]): ExpenseTotals => {
  const byCategory = {} as Record<ExpenseCategory, number>

  const total = expenses.reduce((sum, exp) => {
    const cat = exp.category
    byCategory[cat] = (byCategory[cat] ?? 0) + exp.amount
    return sum + exp.amount
  }, 0)

  return { total, byCategory, count: expenses.length }
}

// Obtiene el usuario autenticado o lanza excepción
const getAuthenticatedUser = async () => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Usuario no autenticado')
  return user
}

const EXPENSES_QUERY_KEY = 'expenses' as const

// ─── Funciones puras de BD — testeables ──────────────────────────────────────

// Obtiene gastos de un viaje, ordenados del más reciente al más antiguo
// Guarda en caché offline tras una respuesta exitosa del servidor
export const fetchExpenses = async (tripId: string): Promise<Expense[]> => {
  const user = await getAuthenticatedUser()

  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('trip_id', tripId)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('spent_at', { ascending: false })

  if (error) {
    logger.error('Error al obtener gastos', { error, userId: user.id, tripId })
    throw error
  }

  const expenses = (data as ExpenseRow[]).map(mapRowToExpense)
  // Actualizar caché offline en background
  saveExpensesOffline(tripId, user.id, expenses).catch(() => {})
  return expenses
}

// Crea un nuevo gasto en la BD
export const createExpense = async (input: CreateExpenseInput): Promise<Expense> => {
  const user = await getAuthenticatedUser()

  const { data, error } = await supabase
    .from('expenses')
    .insert({
      trip_id: input.tripId,
      user_id: user.id,
      description: input.description,
      amount: input.amount,
      currency: input.currency,
      amount_in_base_currency: input.amountInBaseCurrency ?? null,
      category: input.category ?? 'other',
      input_method: input.inputMethod ?? 'manual',
      spent_at: input.spentAt ?? new Date().toISOString(),
      location: input.location ?? null,
      notes: input.notes ?? null,
      receipt_storage_path: input.receiptStoragePath ?? null,
    })
    .select()
    .single()

  if (error) {
    logger.error('Error al crear gasto', { error, tripId: input.tripId })
    throw error
  }

  return mapRowToExpense(data as ExpenseRow)
}

// Actualiza campos específicos de un gasto existente
export const updateExpense = async (input: UpdateExpenseInput): Promise<Expense> => {
  const user = await getAuthenticatedUser()
  const now = new Date().toISOString()

  const updates: Record<string, unknown> = { updated_at: now }
  if (input.description !== undefined) updates.description = input.description
  if (input.amount !== undefined) updates.amount = input.amount
  if (input.currency !== undefined) updates.currency = input.currency
  if (input.amountInBaseCurrency !== undefined) updates.amount_in_base_currency = input.amountInBaseCurrency
  if (input.category !== undefined) updates.category = input.category
  if (input.spentAt !== undefined) updates.spent_at = input.spentAt
  if (input.location !== undefined) updates.location = input.location
  if (input.notes !== undefined) updates.notes = input.notes

  const { data, error } = await supabase
    .from('expenses')
    .update(updates)
    .eq('id', input.id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    logger.error('Error al actualizar gasto', { error, expenseId: input.id })
    throw error
  }

  return mapRowToExpense(data as ExpenseRow)
}

// Archiva un gasto vía soft delete — nunca borrado físico
export const archiveExpense = async (expenseId: string): Promise<void> => {
  const user = await getAuthenticatedUser()
  const now = new Date().toISOString()

  const { error } = await supabase
    .from('expenses')
    .update({ deleted_at: now, updated_at: now })
    .eq('id', expenseId)
    .eq('user_id', user.id)

  if (error) {
    logger.error('Error al archivar gasto', { error, expenseId })
    throw error
  }
}

// Llama a la Edge Function parse-expense para analizar texto libre
export const parseExpenseText = async (input: ParseExpenseInput): Promise<ParseExpenseResult> => {
  const { data, error } = await supabase.functions.invoke<ParseExpenseResult>('parse-expense', {
    body: {
      text: input.text,
      tripId: input.tripId,
      language: input.language ?? 'es',
      currentDate: input.currentDate ?? new Date().toISOString().slice(0, 10),
    },
  })

  if (error || !data) {
    logger.error('Error al parsear gasto con IA', { error, textLen: input.text.length })
    throw error ?? new Error('Sin datos de parseo de la Edge Function')
  }

  return data
}

// ─── React Query hooks ────────────────────────────────────────────────────────

export const useExpenses = (tripId: string) =>
  useQuery({
    queryKey: [EXPENSES_QUERY_KEY, 'trip', tripId],
    queryFn: () => fetchExpenses(tripId),
    staleTime: 5 * 60 * 1000,
    retry: 2,
    enabled: !!tripId,
  })

// Verifica la alerta de presupuesto al agregar un gasto (totalBudget 0 = sin límite configurado)
const checkBudgetAlert = async (
  tripId: string,
  expenses: Expense[],
  totalBudget: number,
  currency: string
): Promise<void> => {
  if (totalBudget <= 0) return
  const total = expenses.reduce((sum, e) => sum + e.amount, 0)
  await scheduleBudgetAlert(tripId, total, totalBudget, currency)
}

// Hook para crear gasto con optimistic update
export const useCreateExpense = (tripId: string, totalBudget = 0, currency = 'USD') => {
  const queryClient = useQueryClient()
  const queryKey = [EXPENSES_QUERY_KEY, 'trip', tripId]

  return useMutation({
    mutationFn: createExpense,
    onMutate: async (newInput) => {
      await queryClient.cancelQueries({ queryKey })
      const previousExpenses = queryClient.getQueryData<Expense[]>(queryKey)

      // Insertar versión optimista para respuesta inmediata en la UI
      const optimistic: Expense = {
        id: `optimistic-${Date.now()}`,
        tripId: newInput.tripId,
        userId: 'optimistic',
        description: newInput.description,
        amount: newInput.amount,
        currency: newInput.currency,
        category: newInput.category ?? 'other',
        inputMethod: newInput.inputMethod ?? 'manual',
        spentAt: newInput.spentAt ?? new Date().toISOString(),
        location: newInput.location,
        notes: newInput.notes,
        deletedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      queryClient.setQueryData<Expense[]>(queryKey, (old) => [optimistic, ...(old ?? [])])
      return { previousExpenses }
    },
    onError: (error, _input, context) => {
      // Revertir al estado anterior si falla
      if (context?.previousExpenses !== undefined) {
        queryClient.setQueryData(queryKey, context.previousExpenses)
      }
      logger.error('Mutation de crear gasto falló', { error })
      useToastStore.getState().showToast('No se pudo guardar el gasto. Inténtalo de nuevo.', 'error')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
      // Verificar alerta de presupuesto con los datos actualizados
      const updated = queryClient.getQueryData<Expense[]>(queryKey) ?? []
      checkBudgetAlert(tripId, updated, totalBudget, currency).catch(() => {})
    },
  })
}

// Hook para actualizar gasto con optimistic update
export const useUpdateExpense = (tripId: string) => {
  const queryClient = useQueryClient()
  const queryKey = [EXPENSES_QUERY_KEY, 'trip', tripId]

  return useMutation({
    mutationFn: updateExpense,
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey })
      const previousExpenses = queryClient.getQueryData<Expense[]>(queryKey)

      queryClient.setQueryData<Expense[]>(queryKey, (old) =>
        old?.map((exp) =>
          exp.id === input.id
            ? {
                ...exp,
                ...(input.description !== undefined && { description: input.description }),
                ...(input.amount !== undefined && { amount: input.amount }),
                ...(input.currency !== undefined && { currency: input.currency }),
                ...(input.category !== undefined && { category: input.category }),
                ...(input.spentAt !== undefined && { spentAt: input.spentAt }),
                ...(input.location !== undefined && { location: input.location }),
                ...(input.notes !== undefined && { notes: input.notes }),
                updatedAt: new Date().toISOString(),
              }
            : exp
        ) ?? []
      )
      return { previousExpenses }
    },
    onError: (error, _input, context) => {
      if (context?.previousExpenses !== undefined) {
        queryClient.setQueryData(queryKey, context.previousExpenses)
      }
      logger.error('Mutation de actualizar gasto falló', { error })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })
}

// Hook para eliminar gasto con optimistic update
export const useDeleteExpense = (tripId: string) => {
  const queryClient = useQueryClient()
  const queryKey = [EXPENSES_QUERY_KEY, 'trip', tripId]

  return useMutation({
    mutationFn: archiveExpense,
    onMutate: async (expenseId) => {
      await queryClient.cancelQueries({ queryKey })
      const previousExpenses = queryClient.getQueryData<Expense[]>(queryKey)

      // Eliminar de la lista local antes de confirmar con el servidor
      queryClient.setQueryData<Expense[]>(queryKey, (old) =>
        old?.filter((exp) => exp.id !== expenseId) ?? []
      )
      return { previousExpenses }
    },
    onError: (error, _id, context) => {
      if (context?.previousExpenses !== undefined) {
        queryClient.setQueryData(queryKey, context.previousExpenses)
      }
      logger.error('Mutation de eliminar gasto falló', { error })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })
}

// Hook para parsear texto libre con IA
export const useParseExpense = () =>
  useMutation({
    mutationFn: parseExpenseText,
    onError: (error) => {
      logger.error('Mutation de parsear gasto falló', { error })
      useToastStore.getState().showToast('No se pudo analizar el texto con IA. Inténtalo de nuevo.', 'error')
    },
  })
