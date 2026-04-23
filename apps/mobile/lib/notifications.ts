// Expo Push Notifications — stub para implementación en Fase 7
// TODO: Implementar con expo-notifications cuando se active la fase de notificaciones

export const notifications = {
  requestPermissions: async (): Promise<boolean> => {
    // Solicitar permisos de notificación al usuario
    return false
  },

  scheduleLocal: async (
    _title: string,
    _body: string,
    _date: Date
  ): Promise<void> => {
    // Programar notificación local en la fecha indicada
  },
}
