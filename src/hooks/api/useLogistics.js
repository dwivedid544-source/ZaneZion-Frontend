import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api/setupAxios';
import { notifyStateChanged } from '../../utils/stateSyncHelper';

// -----------------------------
// Deliveries Hooks
// -----------------------------

const getCurrentUserContext = () => {
  try {
    const rawUser = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    const u = rawUser ? JSON.parse(rawUser) : null;
    return {
      userId: u?.id || null,
      tenantId: u?.tenantId || null
    };
  } catch (_) {
    return { userId: null, tenantId: null };
  }
};

export const useDeliveries = (page = 1, limit = 10, search = '') => {
  const { userId, tenantId } = getCurrentUserContext();
  return useQuery({
    queryKey: ['deliveries', userId, tenantId, page, limit, search],
    queryFn: async () => {
      const response = await api.get('/deliveries', {
        params: { page, limit, search }
      });
      return response.data;
    },
    refetchInterval: 8000,
    staleTime: 4000,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
  });
};

export const useCreateDelivery = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (deliveryData) => {
      const response = await api.post('/deliveries', deliveryData);
      return response.data;
    },
    onSuccess: () => {
      notifyStateChanged(queryClient, ['deliveries', 'orders', 'missions', 'dashboardStats']);
    },
  });
};

export const useCancelDelivery = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const response = await api.put(`/deliveries/${id}/cancel`);
      return response.data;
    },
    onSuccess: () => {
      notifyStateChanged(queryClient, ['deliveries', 'orders', 'missions', 'dashboardStats']);
    },
  });
};

export const useDeleteDelivery = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const response = await api.delete(`/deliveries/${id}`);
      return response.data;
    },
    onSuccess: () => {
      notifyStateChanged(queryClient, ['deliveries', 'orders', 'missions', 'dashboardStats']);
    },
  });
};

export const useUpdateDelivery = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await api.put(`/deliveries/${id}`, data);
      return response.data;
    },
    // Instant optimistic update on mutation
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['deliveries'] });
      const previousData = queryClient.getQueriesData({ queryKey: ['deliveries'] });

      queryClient.setQueriesData({ queryKey: ['deliveries'] }, (old) => {
        if (!old) return old;
        const patchList = (arr) =>
          Array.isArray(arr)
            ? arr.map((item) =>
                String(item.id) === String(id) || String(item.deliveryNumber) === String(id)
                  ? { ...item, ...data }
                  : item
              )
            : arr;

        if (Array.isArray(old)) return patchList(old);
        if (Array.isArray(old?.data)) return { ...old, data: patchList(old.data) };
        if (Array.isArray(old?.data?.deliveries))
          return { ...old, data: { ...old.data, deliveries: patchList(old.data.deliveries) } };
        if (Array.isArray(old?.deliveries)) return { ...old, deliveries: patchList(old.deliveries) };
        return old;
      });

      return { previousData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([key, d]) => queryClient.setQueryData(key, d));
      }
    },
    onSuccess: () => {
      notifyStateChanged(queryClient, ['deliveries', 'orders', 'missions', 'dashboardStats']);
    },
  });
};

// -----------------------------
// Missions Hooks (Logistics/Dispatch)
// -----------------------------

export const useMissions = (page = 1, limit = 10, search = '') => {
  const { userId, tenantId } = getCurrentUserContext();
  return useQuery({
    queryKey: ['missions', userId, tenantId, page, limit, search],
    queryFn: async () => {
      const response = await api.get('/missions', {
        params: { page, limit, search }
      });
      return response.data;
    },
    refetchInterval: 8000,
    staleTime: 4000,
    refetchOnWindowFocus: true,
  });
};

export const useCreateMission = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (missionData) => {
      const response = await api.post('/missions', missionData);
      return response.data;
    },
    onSuccess: () => {
      notifyStateChanged(queryClient, ['missions', 'deliveries', 'orders', 'dashboardStats']);
    },
  });
};

export const useStartMission = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const response = await api.post(`/missions/${id}/start`);
      return response.data;
    },
    onSuccess: () => {
      notifyStateChanged(queryClient, ['missions', 'deliveries', 'orders', 'dashboardStats']);
    },
  });
};

export const useSubmitPOD = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, podData }) => {
      const response = await api.post(`/missions/${id}/pod`, podData);
      return response.data;
    },
    // Instant optimistic update when POD is submitted
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ['deliveries'] });
      const previousData = queryClient.getQueriesData({ queryKey: ['deliveries'] });

      queryClient.setQueriesData({ queryKey: ['deliveries'] }, (old) => {
        if (!old) return old;
        const patchList = (arr) =>
          Array.isArray(arr)
            ? arr.map((item) =>
                String(item.id) === String(id) || String(item.deliveryNumber) === String(id)
                  ? { ...item, status: 'Delivered', clientConfirmed: true }
                  : item
              )
            : arr;

        if (Array.isArray(old)) return patchList(old);
        if (Array.isArray(old?.data)) return { ...old, data: patchList(old.data) };
        if (Array.isArray(old?.data?.deliveries))
          return { ...old, data: { ...old.data, deliveries: patchList(old.data.deliveries) } };
        if (Array.isArray(old?.deliveries)) return { ...old, deliveries: patchList(old.deliveries) };
        return old;
      });

      return { previousData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([key, d]) => queryClient.setQueryData(key, d));
      }
    },
    onSuccess: () => {
      notifyStateChanged(queryClient, ['missions', 'deliveries', 'orders', 'dashboardStats']);
    },
  });
};

