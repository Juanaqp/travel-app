// Hook que observa el estado de conectividad de red y dispara sincronización
// al recuperar conexión. Compatible con iOS, Android y web.

import { useState, useEffect, useCallback } from 'react'
import NetInfo, { NetInfoState } from '@react-native-community/netinfo'
import { Platform } from 'react-native'
import { logger } from '@/lib/logger'
import { syncPendingOperations, countPendingOperations } from '@/lib/offline/sync'

interface NetworkStatus {
  isOnline: boolean | null       // null = aún no determinado
  isInternetReachable: boolean | null
  pendingOperations: number
  isSyncing: boolean
  syncNow: () => Promise<void>
}

export const useNetworkStatus = (): NetworkStatus => {
  const [isOnline, setIsOnline] = useState<boolean | null>(null)
  const [isInternetReachable, setIsInternetReachable] = useState<boolean | null>(null)
  const [pendingOperations, setPendingOperations] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [wasOffline, setWasOffline] = useState(false)

  const refreshPendingCount = useCallback(async () => {
    const count = await countPendingOperations()
    setPendingOperations(count)
  }, [])

  const syncNow = useCallback(async () => {
    if (isSyncing || Platform.OS === 'web') return

    setIsSyncing(true)
    try {
      const { synced, failed } = await syncPendingOperations()
      if (synced > 0 || failed > 0) {
        logger.info('Sincronización manual completada', { synced, failed })
      }
      await refreshPendingCount()
    } finally {
      setIsSyncing(false)
    }
  }, [isSyncing, refreshPendingCount])

  useEffect(() => {
    if (Platform.OS === 'web') {
      // En web, usar la API nativa del navegador
      const handleOnline = () => setIsOnline(true)
      const handleOffline = () => setIsOnline(false)
      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)
      setIsOnline(navigator.onLine)
      return () => {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
      }
    }

    // Cargar el estado inicial
    refreshPendingCount()

    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const online = state.isConnected ?? false
      const reachable = state.isInternetReachable ?? null

      setIsOnline(online)
      setIsInternetReachable(reachable)

      // Auto-sincronizar al recuperar conexión
      if (online && reachable !== false && wasOffline) {
        setWasOffline(false)
        syncNow()
      } else if (!online) {
        setWasOffline(true)
      }
    })

    return unsubscribe
  }, [wasOffline, refreshPendingCount, syncNow])

  return { isOnline, isInternetReachable, pendingOperations, isSyncing, syncNow }
}
