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
