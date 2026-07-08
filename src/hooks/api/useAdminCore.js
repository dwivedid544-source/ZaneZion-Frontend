import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api/setupAxios';

export const useEmployees = (page = 1, limit = 10, search = '') => {
  return useQuery({
    queryKey: ['employees', page, limit, search],
    queryFn: async () => {
      const res = await api.get('/employees', { params: { page, limit, search } });
      return res.data?.data || [];
    }
  });
};

export const useDepartments = (page = 1, limit = 10, search = '', options = {}) => {
  return useQuery({
    queryKey: ['departments', page, limit, search],
    queryFn: async () => {
      const res = await api.get('/departments', { params: { page, limit, search } });
      return res.data?.data || [];
    },
    enabled: options.enabled !== undefined ? options.enabled : true,
  });
};
