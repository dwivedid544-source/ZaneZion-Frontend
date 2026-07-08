import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api/setupAxios';

export const useTenants = (page = 1, limit = 10, search = '') => {
  return useQuery({
    queryKey: ['tenants', page, limit, search],
    queryFn: async () => {
      const res = await api.get('/tenants', { params: { page, limit, search } });
      return res.data?.data || [];
    }
  });
};

export const useOrganizations = () => {
  return useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const res = await api.get('/organizations');
      return res.data?.data || [];
    }
  });
};

export const usePlans = () => {
  return useQuery({
    queryKey: ['plans'],
    queryFn: async () => {
      const res = await api.get('/plans');
      return res.data?.data || [];
    }
  });
};

export const useCreateTenant = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const res = await api.post('/tenants', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tenants']);
    }
  });
};
