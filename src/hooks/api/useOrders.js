import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api/setupAxios';
import { notifyStateChanged } from '../../utils/stateSyncHelper';

// -----------------------------
// Orders Hooks
// -----------------------------

const getCurrentUserContext = () => {
  try {
    const rawUser = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    const u = rawUser ? JSON.parse(rawUser) : null;
    return {
      userId: u?.id || null,
      tenantId: u?.tenantId || null,
      clientId: u?.clientId || u?.company_id || null,
      email: u?.email || null
    };
  } catch (_) {
    return { userId: null, tenantId: null, clientId: null, email: null };
  }
};

export const useOrders = (page = 1, limit = 10, search = '', viewerRole = '') => {
  const { userId, tenantId } = getCurrentUserContext();
  return useQuery({
    queryKey: ['orders', userId, tenantId, page, limit, search, viewerRole],
    queryFn: async () => {
      const response = await api.get('/orders', {
        params: { page, limit, search, viewerRole }
      });
      return response.data;
    },
    // Auto-refetch every 10 seconds so status changes from any portal reflect live
    refetchInterval: 10000,
    staleTime: 5000,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
  });
};

export const useDepartmentOrders = (currentDept, passedThrough) => {
  const { userId, tenantId } = getCurrentUserContext();
  return useQuery({
    queryKey: ['orders', 'dept', userId, tenantId, currentDept, passedThrough],
    queryFn: async () => {
      const response = await api.get('/orders', {
        params: { currentDept, passedThrough, limit: 100 }
      });
      return response.data;
    },
  });
};

export const useOrder = (id) => {
  const { userId, tenantId } = getCurrentUserContext();
  return useQuery({
    queryKey: ['orders', userId, tenantId, id],
    queryFn: async () => {
      const response = await api.get(`/orders/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
};

export const useCreateOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderData) => {
      try {
        const response = await api.post('/orders', orderData);
        return response.data;
      } catch (err) {
        if (err.response?.data?.message === 'Selected client does not exist') {
          const fallbackPayload = { ...orderData };
          delete fallbackPayload.clientId;
          const retryRes = await api.post('/orders', fallbackPayload);
          return retryRes.data;
        }
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      notifyStateChanged(queryClient, ['orders', 'deliveries', 'dashboardStats']);
    },
  });
};

const matchOrderId = (order, targetId) => {
  if (!order || !targetId) return false;
  const t = String(targetId).trim().replace(/^#|^ORD-/i, '');
  const oId = String(order.id || '').replace(/^#|^ORD-/i, '');
  const oRawId = String(order.rawId || '').replace(/^#|^ORD-/i, '');
  const oNum = String(order.orderNumber || '').replace(/^#|^ORD-/i, '');
  return (
    String(order.id) === String(targetId) ||
    String(order.rawId) === String(targetId) ||
    String(order.orderNumber) === String(targetId) ||
    (t && oId && t === oId) ||
    (t && oRawId && t === oRawId) ||
    (t && oNum && t === oNum)
  );
};

export const useUpdateOrderStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }) => {
      const cleanId = String(id).replace(/^#|^ORD-/i, '');
      const response = await api.put(`/orders/${cleanId}/status`, { status });
      return response.data;
    },
    // Instant optimistic update (0ms immediate UI flip)
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['orders'] });
      const previousData = queryClient.getQueriesData({ queryKey: ['orders'] });

      queryClient.setQueriesData({ queryKey: ['orders'] }, (old) => {
        if (!old) return old;
        const patchOrders = (arr) =>
          Array.isArray(arr)
            ? arr.map(o => matchOrderId(o, id) ? { ...o, status, orderStatus: status } : o)
            : arr;

        if (Array.isArray(old)) return patchOrders(old);
        if (Array.isArray(old?.data)) return { ...old, data: patchOrders(old.data) };
        if (Array.isArray(old?.data?.orders))
          return { ...old, data: { ...old.data, orders: patchOrders(old.data.orders) } };
        if (Array.isArray(old?.orders)) return { ...old, orders: patchOrders(old.orders) };
        return old;
      });

      return { previousData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: (_, variables) => {
      notifyStateChanged(queryClient, ['orders', ['orders', variables.id], 'deliveries', 'dashboardStats', 'chauffeurMissions']);
    },
  });
};

export const useUpdateOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, orderData }) => {
      const cleanId = String(id).replace(/^#|^ORD-/i, '');
      const response = await api.put(`/orders/${cleanId}`, orderData);
      return response.data;
    },
    // Instant optimistic update
    onMutate: async ({ id, orderData }) => {
      await queryClient.cancelQueries({ queryKey: ['orders'] });
      const previousData = queryClient.getQueriesData({ queryKey: ['orders'] });

      queryClient.setQueriesData({ queryKey: ['orders'] }, (old) => {
        if (!old) return old;
        const patchOrders = (arr) =>
          Array.isArray(arr)
            ? arr.map(o => matchOrderId(o, id) ? { ...o, ...orderData } : o)
            : arr;

        if (Array.isArray(old)) return patchOrders(old);
        if (Array.isArray(old?.data)) return { ...old, data: patchOrders(old.data) };
        if (Array.isArray(old?.data?.orders))
          return { ...old, data: { ...old.data, orders: patchOrders(old.data.orders) } };
        if (Array.isArray(old?.orders)) return { ...old, orders: patchOrders(old.orders) };
        return old;
      });

      return { previousData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: (_, variables) => {
      notifyStateChanged(queryClient, ['orders', ['orders', variables.id], 'deliveries', 'dashboardStats']);
    },
  });
};

export const useDeleteOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const cleanId = String(id).replace(/^#|^ORD-/i, '');
      const response = await api.delete(`/orders/${cleanId}`);
      return response.data;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['orders'] });
      const previousData = queryClient.getQueriesData({ queryKey: ['orders'] });

      queryClient.setQueriesData({ queryKey: ['orders'] }, (old) => {
        if (!old) return old;
        const filterOrders = (arr) =>
          Array.isArray(arr)
            ? arr.filter(o => !matchOrderId(o, id))
            : arr;

        if (Array.isArray(old)) return filterOrders(old);
        if (Array.isArray(old?.data)) return { ...old, data: filterOrders(old.data) };
        if (Array.isArray(old?.data?.orders))
          return { ...old, data: { ...old.data, orders: filterOrders(old.data.orders) } };
        if (Array.isArray(old?.orders)) return { ...old, orders: filterOrders(old.orders) };
        return old;
      });

      return { previousData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: () => {
      notifyStateChanged(queryClient, ['orders', 'deliveries', 'dashboardStats']);
    },
  });
};

// -----------------------------
// Deliveries Hooks
// -----------------------------

export const useDeliveries = (page = 1, limit = 10, search = '') => {
  return useQuery({
    queryKey: ['deliveries', page, limit, search],
    queryFn: async () => {
      const response = await api.get('/deliveries', {
        params: { page, limit, search }
      });
      return response.data;
    },
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
      notifyStateChanged(queryClient, ['deliveries', 'orders', 'dashboardStats']);
    },
  });
};

export const useAssignDelivery = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, agentId }) => {
      const response = await api.put(`/deliveries/${id}/assign`, { agentId });
      return response.data;
    },
    onSuccess: () => {
      notifyStateChanged(queryClient, ['deliveries', 'orders', 'dashboardStats']);
    },
  });
};

export const useUpdateDeliveryStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }) => {
      const response = await api.put(`/deliveries/${id}/status`, { status });
      return response.data;
    },
    onSuccess: () => {
      notifyStateChanged(queryClient, ['deliveries', 'orders', 'dashboardStats']);
    },
  });
};

// -----------------------------
// Proof of Delivery Hooks
// -----------------------------

export const useCreateProofOfDelivery = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (podData) => {
      // Expect podData to contain deliveryId and other POD details
      const response = await api.post('/proof-of-delivery', podData);
      return response.data;
    },
    onSuccess: () => {
      notifyStateChanged(queryClient, ['deliveries', 'orders', 'dashboardStats']);
    },
  });
};

