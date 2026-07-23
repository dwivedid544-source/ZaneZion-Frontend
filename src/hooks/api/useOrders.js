import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api/setupAxios';
import { notifyStateChanged } from '../../utils/stateSyncHelper';

// -----------------------------
// Orders Hooks
// -----------------------------

export const useOrders = (page = 1, limit = 10, search = '') => {
  return useQuery({
    queryKey: ['orders', page, limit, search],
    queryFn: async () => {
      const response = await api.get('/orders', {
        params: { page, limit, search }
      });
      return response.data;
    },
  });
};

export const useDepartmentOrders = (currentDept, passedThrough) => {
  return useQuery({
    queryKey: ['orders', 'dept', currentDept, passedThrough],
    queryFn: async () => {
      const response = await api.get('/orders', {
        params: { currentDept, passedThrough, limit: 100 }
      });
      return response.data;
    },
  });
};

export const useOrder = (id) => {
  return useQuery({
    queryKey: ['orders', id],
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
      const response = await api.post('/orders', orderData);
      return response.data;
    },
    onSuccess: () => {
      notifyStateChanged(queryClient, ['orders', 'deliveries', 'dashboardStats']);
    },
  });
};

export const useUpdateOrderStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }) => {
      const response = await api.put(`/orders/${id}/status`, { status });
      return response.data;
    },
    onSuccess: (_, variables) => {
      notifyStateChanged(queryClient, ['orders', ['orders', variables.id], 'deliveries', 'dashboardStats']);
    },
  });
};

export const useUpdateOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, orderData }) => {
      const response = await api.put(`/orders/${id}`, orderData);
      return response.data;
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
      const response = await api.delete(`/orders/${id}`);
      return response.data;
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

