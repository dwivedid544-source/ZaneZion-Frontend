import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api/setupAxios';
import { notifyStateChanged } from '../../utils/stateSyncHelper';

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
    onSuccess: () => {
      notifyStateChanged(queryClient, ['deliveries', 'orders', 'missions', 'dashboardStats']);
    },
  });
};

// -----------------------------
// Missions Hooks (Logistics/Dispatch)
// -----------------------------

export const useMissions = (page = 1, limit = 10, search = '') => {
  return useQuery({
    queryKey: ['missions', page, limit, search],
    queryFn: async () => {
      const response = await api.get('/missions', {
        params: { page, limit, search }
      });
      return response.data;
    },
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
    onSuccess: () => {
      notifyStateChanged(queryClient, ['missions', 'deliveries', 'orders', 'dashboardStats']);
    },
  });
};

