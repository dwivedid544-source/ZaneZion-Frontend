import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api/setupAxios';
import { notifyStateChanged } from '../../utils/stateSyncHelper';

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

// --- Clients ---
export const useClients = (page = 1, limit = 10, search = '', clientType = '') => {
  const { userId, tenantId } = getCurrentUserContext();
  return useQuery({
    queryKey: ['clients', userId, tenantId, page, limit, search, clientType],
    queryFn: async () => {
      const response = await api.get('/clients', {
        params: { page, limit, search, clientType }
      });
      return response.data;
    }
  });
};

export const useCreateClient = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (clientData) => {
      const response = await api.post('/clients', clientData);
      return response.data;
    },
    onSuccess: () => {
      notifyStateChanged(queryClient, ['clients', 'users', 'dashboardStats']);
    }
  });
};

export const useUpdateClient = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await api.put(`/clients/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      notifyStateChanged(queryClient, ['clients', 'users', 'dashboardStats']);
    }
  });
};

export const useDeleteClient = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const response = await api.delete(`/clients/${id}`);
      return response.data;
    },
    onSuccess: () => {
      notifyStateChanged(queryClient, ['clients', 'users', 'dashboardStats']);
    }
  });
};

// --- Users ---
export const useUsers = (page = 1, limit = 10, search = '', status = '') => {
  const { userId, tenantId } = getCurrentUserContext();
  return useQuery({
    queryKey: ['users', userId, tenantId, page, limit, search, status],
    queryFn: async () => {
      const response = await api.get('/users', {
        params: { page, limit, search, status }
      });
      const resData = response.data;
      const list = Array.isArray(resData?.data) 
        ? resData.data 
        : (Array.isArray(resData?.data?.users) ? resData.data.users : (Array.isArray(resData) ? resData : []));

      const sanitizedList = list.map(u => {
        const cached = (u.id ? localStorage.getItem(`dedicated_vacation_${u.id}`) : null) ||
                       (u.email ? localStorage.getItem(`dedicated_vacation_${String(u.email).toLowerCase()}`) : null);
        let quota = 80;
        if (cached && Number(cached) >= 0 && Number(cached) < 5000) {
          quota = Number(cached);
        } else if (u.bankingInfo?.vacationQuota && Number(u.bankingInfo.vacationQuota) < 5000) {
          quota = Number(u.bankingInfo.vacationQuota);
        } else if (u.vacationQuota && Number(u.vacationQuota) < 5000) {
          quota = Number(u.vacationQuota);
        }

        let bal = u.vacationBalance ?? u.vacation_balance;
        if (bal === undefined || bal === null || isNaN(Number(bal)) || Number(bal) >= 5000 || Number(bal) <= 0) {
          bal = quota;
        } else {
          bal = Number(bal);
        }

        return {
          ...u,
          vacationBalance: bal,
          vacation_balance: bal,
          vacationQuota: quota,
        };
      });

      if (Array.isArray(resData?.data)) {
        resData.data = sanitizedList;
      } else if (resData?.data?.users) {
        resData.data.users = sanitizedList;
      }

      return resData;
    }
  });
};

export const useCreateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userData) => {
      const response = await api.post('/users', userData);
      return response.data;
    },
    onSuccess: () => {
      notifyStateChanged(queryClient, ['users', 'clients', 'dashboardStats']);
    }
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await api.put(`/users/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      notifyStateChanged(queryClient, ['users', 'clients', 'dashboardStats']);
    }
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const response = await api.delete(`/users/${id}`);
      return response.data;
    },
    onSuccess: () => {
      notifyStateChanged(queryClient, ['users', 'clients', 'dashboardStats']);
    }
  });
};

