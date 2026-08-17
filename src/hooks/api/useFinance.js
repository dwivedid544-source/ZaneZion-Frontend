import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api/setupAxios';
import { notifyStateChanged } from '../../utils/stateSyncHelper';

// -----------------------------
// Invoices Hooks
// -----------------------------

const getCurrentUserContext = () => {
  try {
    const rawUser = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    const u = rawUser ? JSON.parse(rawUser) : null;
    return {
      userId: u?.id || null,
      tenantId: u?.tenantId || null
    };
  } catch (_) {
    return { userId: null, tenantId: null };
  }
};

export const useInvoices = (page = 1, limit = 10, search = '', status = '') => {
  const { userId, tenantId } = getCurrentUserContext();
  return useQuery({
    queryKey: ['invoices', userId, tenantId, page, limit, search, status],
    queryFn: async () => {
      const response = await api.get('/invoices', {
        params: { page, limit, search, ...(status && { status }) }
      });
      return response.data;
    },
  });
};

export const useInvoice = (id) => {
  const { userId, tenantId } = getCurrentUserContext();
  return useQuery({
    queryKey: ['invoices', userId, tenantId, id],
    queryFn: async () => {
      const response = await api.get(`/invoices/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
};

export const useCreateInvoice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invoiceData) => {
      const response = await api.post('/invoices', invoiceData);
      return response.data;
    },
    onSuccess: () => {
      notifyStateChanged(queryClient, ['invoices', 'dashboardStats']);
    },
  });
};

export const useUpdateInvoiceStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }) => {
      const response = await api.put(`/invoices/${id}/status`, { status });
      return response.data;
    },
    onSuccess: (_, variables) => {
      notifyStateChanged(queryClient, ['invoices', ['invoices', variables.id], 'dashboardStats']);
    },
  });
};

export const useUpdateInvoice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, invoiceData }) => {
      const response = await api.put(`/invoices/${id}`, invoiceData);
      return response.data;
    },
    onSuccess: (_, variables) => {
      notifyStateChanged(queryClient, ['invoices', ['invoices', variables.id], 'dashboardStats']);
    },
  });
};

export const useDeleteInvoice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const response = await api.delete(`/invoices/${id}`);
      return response.data;
    },
    onSuccess: () => {
      notifyStateChanged(queryClient, ['invoices', 'dashboardStats']);
    },
  });
};

// -----------------------------
// Payments & Receipts Hooks
// -----------------------------

export const usePayments = (page = 1, limit = 10, search = '') => {
  return useQuery({
    queryKey: ['payments', page, limit, search],
    queryFn: async () => {
      const response = await api.get('/payments', {
        params: { page, limit, search }
      });
      return response.data;
    },
  });
};

export const useCreatePayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (paymentData) => {
      const response = await api.post('/payments', paymentData);
      return response.data;
    },
    onSuccess: () => {
      notifyStateChanged(queryClient, ['payments', 'invoices', 'dashboardStats']);
    },
  });
};

export const useReceipt = (id) => {
  return useQuery({
    queryKey: ['receipts', id],
    queryFn: async () => {
      const response = await api.get(`/payments/receipts/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
};

