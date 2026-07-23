import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api/setupAxios';
import { notifyStateChanged } from '../../utils/stateSyncHelper';

export const useItems = (page = 1, limit = 10, search = '') => {
  return useQuery({
    queryKey: ['items', page, limit, search],
    queryFn: async () => {
      const res = await api.get('/items', { params: { page, limit, search } });
      return res.data?.data || [];
    }
  });
};

export const useItemCategories = () => {
  return useQuery({
    queryKey: ['itemCategories'],
    queryFn: async () => {
      const res = await api.get('/item-categories', { params: { limit: 100 } });
      return res.data?.data || [];
    }
  });
};

export const useItemUnits = () => {
  return useQuery({
    queryKey: ['itemUnits'],
    queryFn: async () => {
      const res = await api.get('/item-units', { params: { limit: 100 } });
      return res.data?.data || [];
    }
  });
};

export const useWarehouses = () => {
  return useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const res = await api.get('/warehouses');
      // Return full response so component can extract warehouses array
      return res.data;
    }
  });
};

export const useCreateWarehouse = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const res = await api.post('/warehouses', data);
      return res.data;
    },
    onSuccess: () => notifyStateChanged(queryClient, ['warehouses', 'inventory', 'dashboardStats'])
  });
};

export const useUpdateWarehouse = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await api.put(`/warehouses/${id}`, data);
      return res.data;
    },
    onSuccess: () => notifyStateChanged(queryClient, ['warehouses', 'inventory', 'dashboardStats'])
  });
};

export const useDeleteWarehouse = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`/warehouses/${id}`);
      return res.data;
    },
    onSuccess: () => notifyStateChanged(queryClient, ['warehouses', 'inventory', 'dashboardStats'])
  });
};

export const useStock = (warehouseId = null) => {
  return useQuery({
    queryKey: ['stock', warehouseId],
    queryFn: async () => {
      const params = warehouseId ? { warehouseId } : {};
      const res = await api.get('/stock', { params });
      return res.data?.data || [];
    }
  });
};

export const useCreateGRN = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const res = await api.post('/grn', data);
      return res.data;
    },
    onSuccess: () => {
      notifyStateChanged(queryClient, ['stock', 'inventory', 'warehouses', 'dashboardStats']);
    }
  });
};

