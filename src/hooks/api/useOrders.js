import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api/setupAxios';

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
      queryClient.invalidateQueries({ queryKey: ['orders'] });
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
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders', variables.id] });
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
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders', variables.id] });
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
      queryClient.invalidateQueries({ queryKey: ['orders'] });
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
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
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
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
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
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
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
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
};
