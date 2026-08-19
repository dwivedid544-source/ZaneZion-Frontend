
/**
 * Utility helper to trigger application-wide state synchronization.
 * Invalidates specified TanStack Query keys and dispatches 'app:state-changed'
 * to notify GlobalDataContext and all active dashboard components.
 */
export const notifyStateChanged = (queryClient, queryKeys = []) => {
  if (queryClient) {
    if (Array.isArray(queryKeys) && queryKeys.length > 0) {
      queryKeys.forEach((key) => {
        const k = Array.isArray(key) ? key : [key];
        try {
          queryClient.invalidateQueries({ queryKey: k });
          queryClient.refetchQueries({ queryKey: k });
        } catch (_) {}
      });
    }
    // Always invalidate and actively refetch root dashboard stats and operational queries
    ['dashboardStats', 'orders', 'deliveries', 'chauffeurMissions', 'missions', 'projects'].forEach((k) => {
      try {
        queryClient.invalidateQueries({ queryKey: [k] });
        queryClient.refetchQueries({ queryKey: [k] });
      } catch (_) {}
    });
  }

  // Dispatch custom window event so GlobalDataContext and active components refetch state immediately
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app:state-changed', { detail: { queryKeys } }));
  }
};

export const getDeletedChauffeurIds = () => {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('deleted_chauffeur_ids') : null;
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
};

export const addDeletedChauffeurId = (id) => {
  if (id === null || id === undefined) return;
  try {
    const existing = getDeletedChauffeurIds();
    const strId = String(id);
    if (!existing.includes(strId)) {
      existing.push(strId);
      if (typeof window !== 'undefined') {
        localStorage.setItem('deleted_chauffeur_ids', JSON.stringify(existing));
      }
    }
  } catch (_) { }
};

export const getUpdatedChauffeurMap = () => {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('updated_chauffeur_map') : null;
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
};

export const setUpdatedChauffeurItem = (id, updatedFields) => {
  if (id === null || id === undefined) return;
  try {
    const map = getUpdatedChauffeurMap();
    const strId = String(id);
    map[strId] = { ...(map[strId] || {}), ...(updatedFields || {}) };
    if (typeof window !== 'undefined') {
      localStorage.setItem('updated_chauffeur_map', JSON.stringify(map));
    }
  } catch (_) { }
};
