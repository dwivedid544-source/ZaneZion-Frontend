import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api/setupAxios';

// --- Plans ---
export const usePlans = (page = 1, limit = 10, search = '') => {
  return useQuery({
    queryKey: ['plans', page, limit, search],
    queryFn: async () => {
      const response = await api.get('/plans', {
        params: { page, limit, search }
      });
      return response.data;
    }
  });
};

export const useCreatePlan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (planData) => {
      const response = await api.post('/plans', planData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    }
  });
};

export const useUpdatePlan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await api.put(`/plans/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    }
  });
};

// --- Subscriptions ---
export const useSubscriptions = (page = 1, limit = 10, search = '') => {
  return useQuery({
    queryKey: ['subscriptions', page, limit, search],
    queryFn: async () => {
      const response = await api.get('/subscriptions', {
        params: { page, limit, search }
      });
      return response.data;
    }
  });
};
