import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api/setupAxios';

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
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
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
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
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
      queryClient.invalidateQueries({ queryKey: ['missions'] });
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
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
      queryClient.invalidateQueries({ queryKey: ['missions'] });
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
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
      queryClient.invalidateQueries({ queryKey: ['missions'] });
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
    },
  });
};
