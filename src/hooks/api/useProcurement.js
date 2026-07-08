import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api/setupAxios';

// Purchase Requests (PR)
export const usePurchaseRequests = (page = 1, limit = 10, search = '') => {
  return useQuery({
    queryKey: ['purchaseRequests', page, limit, search],
    queryFn: async () => {
      const res = await api.get('/purchase-requests', { params: { page, limit, search } });
      return res.data?.data || [];
    }
  });
};

export const useCreatePR = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const res = await api.post('/purchase-requests', data);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries(['purchaseRequests'])
  });
};

export const useUpdatePR = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await api.put(`/purchase-requests/${id}`, data);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries(['purchaseRequests'])
  });
};

export const useDeletePR = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`/purchase-requests/${id}`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries(['purchaseRequests'])
  });
};

// Request For Quotation (RFQ)
export const useRFQs = (page = 1, limit = 10) => {
  return useQuery({
    queryKey: ['rfqs', page, limit],
    queryFn: async () => {
      const res = await api.get('/rfqs', { params: { page, limit } });
      return res.data?.data || [];
    }
  });
};

export const useCreateRFQ = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const res = await api.post('/rfqs', data);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries(['rfqs'])
  });
};

export const useUpdateRFQ = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await api.put(`/rfqs/${id}`, data);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries(['rfqs'])
  });
};

export const useDeleteRFQ = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`/rfqs/${id}`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries(['rfqs'])
  });
};

export const useCreateQuotation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const res = await api.post('/quotations', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['quotations']);
      queryClient.invalidateQueries(['quotes']);
    }
  });
};

export const useUpdateQuotation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await api.put(`/quotations/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['quotations']);
      queryClient.invalidateQueries(['quotes']);
    }
  });
};

export const useDeleteQuotation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`/quotations/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['quotations']);
      queryClient.invalidateQueries(['quotes']);
    }
  });
};

// Quotes (Quotations)
export const useQuotations = (page = 1, limit = 10) => {
  return useQuery({
    queryKey: ['quotations', page, limit],
    queryFn: async () => {
      const res = await api.get('/quotations', { params: { page, limit } });
      return res.data?.data || [];
    }
  });
};

export const useQuotes = (page = 1, limit = 10) => {
  return useQuery({
    queryKey: ['quotes', page, limit],
    queryFn: async () => {
      const res = await api.get('/quotations', { params: { page, limit } });
      return res.data?.data || [];
    }
  });
};

// Purchase Orders (PO)
export const usePurchaseOrders = (page = 1, limit = 10, search = '') => {
  return useQuery({
    queryKey: ['purchaseOrders', page, limit, search],
    queryFn: async () => {
      const res = await api.get('/purchase-orders', { params: { page, limit, search } });
      return res.data?.data || [];
    }
  });
};

export const useCreatePurchaseOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const res = await api.post('/purchase-orders', data);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries(['purchaseOrders'])
  });
};

export const useUpdatePurchaseOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await api.put(`/purchase-orders/${id}`, data);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries(['purchaseOrders'])
  });
};
