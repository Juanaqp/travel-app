// Tipos del dominio de gastos de viaje

// Categoría de gasto — refleja el enum SQL expense_category
export type ExpenseCategory =
  | 'transport'
  | 'accommodation'
  | 'food'
  | 'activities'
  | 'shopping'
  | 'health'
  | 'communication'
  | 'other'

// Cómo se introdujo el gasto — refleja el enum SQL expense_input_method
export type ExpenseInputMethod = 'manual' | 'ocr' | 'ai_parsed'

// Etiquetas legibles para la UI — en español
export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  transport: 'Transporte',
  accommodation: 'Alojamiento',
  food: 'Comida y bebida',
  activities: 'Actividades',
  shopping: 'Compras',
  health: 'Salud',
  communication: 'Comunicación',
  other: 'Otros',
}

// Entidad Expense tal como viene de la base de datos
export interface Expense {
  id: string
  tripId: string
  userId: string
  description: string
  amount: number
  currency: string           // ISO 4217
  amountInBaseCurrency?: number
  category: ExpenseCategory
  inputMethod: ExpenseInputMethod
  spentAt: string            // ISO datetime
  location?: string
  notes?: string
  receiptStoragePath?: string
  deletedAt?: string | null
  createdAt: string
  updatedAt: string
}

// Input de creación — sin campos generados por servidor
export interface CreateExpenseInput {
  tripId: string
  description: string
  amount: number
  currency: string
  amountInBaseCurrency?: number
  category?: ExpenseCategory
  inputMethod?: ExpenseInputMethod
  spentAt?: string
  location?: string
  notes?: string
  receiptStoragePath?: string
}

// Input de actualización — todos los campos opcionales excepto id
export interface UpdateExpenseInput {
  id: string
  description?: string
  amount?: number
  currency?: string
  amountInBaseCurrency?: number
  category?: ExpenseCategory
  spentAt?: string
  location?: string
  notes?: string
}

// Totales agrupados para la pantalla de gastos
export interface ExpenseTotals {
  total: number                              // total en moneda base
  byCategory: Record<ExpenseCategory, number>
  count: number
}

// Campos estructurados que devuelve la Edge Function
export interface ParsedExpenseFields {
  amount: number | null
  currency: string | null
  category: ExpenseCategory | null
  title: string | null
  date: string | null
}

// Resultado completo de parse-expense — consistente con ParseDocumentResult
export interface ParseExpenseResult {
  type: 'expense'
  confidence: number
  raw_text: string
  fields: ParsedExpenseFields
  cached: boolean
  tripId?: string
}

// Input para la Edge Function parse-expense
export interface ParseExpenseInput {
  text: string
  tripId?: string
  language?: 'es' | 'en'
  currentDate?: string          // YYYY-MM-DD — para calcular fechas relativas
}
