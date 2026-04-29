import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastState {
  message: string
  type: ToastType
  visible: boolean
  showToast: (message: string, type?: ToastType) => void
  hideToast: () => void
}

export const useToastStore = create<ToastState>((set) => ({
  message: '',
  type: 'info',
  visible: false,
  showToast: (message, type = 'info') => set({ message, type, visible: true }),
  hideToast: () => set({ visible: false }),
}))
