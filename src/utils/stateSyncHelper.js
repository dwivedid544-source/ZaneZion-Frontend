
/**
 * Utility helper to trigger application-wide state synchronization.
 * Invalidates specified TanStack Query keys and dispatches 'app:state-changed'
 * to notify GlobalDataContext and all active dashboard components.
 */
export const notifyStateChanged = (queryClient, queryKeys = []) => {
  if (queryClient) {
    if (Array.isArray(queryKeys) && queryKeys.length > 0) {
      queryKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key] });
      });
    }
    // Always invalidate root dashboard stats and queries
    queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['deliveries'] });
    queryClient.invalidateQueries({ queryKey: ['chauffeurMissions'] });
  }

  // Dispatch custom window event so GlobalDataContext and non-React Query listeners refetch state
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app:state-changed', { detail: { queryKeys } }));
  }
};
