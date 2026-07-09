import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api/setupAxios';

// -----------------------------
// Invoices Hooks
// -----------------------------

export const useInvoices = (page = 1, limit = 10, search = '') => {
  return useQuery({
    queryKey: ['invoices', page, limit, search],
    queryFn: async () => {
      const response = await api.get('/invoices', {
        params: { page, limit, search }
      });
      return response.data;
    },
  });
};

export const useInvoice = (id) => {
  return useQuery({
    queryKey: ['invoices', id],
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
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
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
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoices', variables.id] });
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
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoices', variables.id] });
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
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
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
