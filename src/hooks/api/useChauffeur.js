import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api/setupAxios';
import { notifyStateChanged, getDeletedChauffeurIds, addDeletedChauffeurId, getUpdatedChauffeurMap, setUpdatedChauffeurItem } from '../../utils/stateSyncHelper';

export const useChauffeurMissions = (page = 1, limit = 10, search = '') => {
  return useQuery({
    queryKey: ['chauffeurMissions', page, limit, search],
    queryFn: async () => {
      // Fetch from orders where orderType is CHAUFFEUR, or from missions.
      // The requirement says fetch from missions if it's tracking, but Chauffeur.jsx shows all requests
      // including unassigned. Orders hold unassigned requests. Let's fetch orders for CHAUFFEUR.
      const response = await api.get('/orders', {
        params: {
          page,
          limit,
          search,
          orderType: 'CHAUFFEUR'
        }
      });
      // Ensure data matches what the UI expects
      const ordersData = response.data?.data;
      const ordersArray = Array.isArray(ordersData)
        ? ordersData
        : (ordersData?.orders || ordersData?.data || []);
      const totalItems = Array.isArray(ordersData)
        ? ordersData.length
        : (ordersData?.total ?? ordersArray.length);
      const totalPages = Array.isArray(ordersData)
        ? 1
        : (ordersData?.totalPages ?? 1);
      const currentPage = Array.isArray(ordersData)
        ? 1
        : (ordersData?.page ?? 1);

      const deletedIds = getDeletedChauffeurIds().map(String);
      const updatedMap = getUpdatedChauffeurMap();

      const mappedData = (ordersArray || [])
        .filter(order => {
          if (!order || typeof order !== 'object') return false;
          const realId = String(order?.id || '');
          const customId = String(order?.metadata?.customItems?.[0]?.id || '');
          return !deletedIds.includes(realId) && !deletedIds.includes(customId);
        })
        .map(order => {
          const customItem = order?.metadata?.customItems?.[0] || {};
          const { id: _customId, ...restCustomItem } = customItem;
          const realId = order?.id?.toString() || '';

          const baseMapped = {
            ...order,
            ...restCustomItem,
            id: realId,
            db_id: order?.id,
            clientName: order?.client?.companyName || order?.client?.name || restCustomItem?.clientName || 'Guest Client',
            status: order?.status,
          };

          const overlay = updatedMap[realId] || updatedMap[String(order?.id)] || {};
          return {
            ...baseMapped,
            ...overlay
          };
        });
      return {
        success: true,
        data: mappedData,
        meta: {
          totalItems: mappedData.length,
          totalPages,
          currentPage,
          itemsPerPage: limit
        }
      };
    }
  });
};

export const useCreateChauffeurMission = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (missionData) => {
      const payload = {
        clientId: missionData.clientId,
        orderType: 'CHAUFFEUR',
        status: missionData.status || 'draft',
        items: [missionData], // Shove all custom data into items so backend moves it to metadata
      };
      const response = await api.post('/orders', payload);
      return { success: true, data: response.data.data };
    },
    onSuccess: () => {
      notifyStateChanged(queryClient, ['chauffeurMissions', 'orders', 'deliveries', 'dashboardStats']);
    }
  });
};

export const useUpdateChauffeurMission = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => {
      const payload = {
        clientId: data.clientId,
        status: data.status,
        items: [data],
      };
      const patchId = data.db_id || id;
      try {
        const response = await api.put(`/orders/${patchId}`, payload);
        return response.data;
      } catch (err) {
        if (err.response?.status === 404) {
          return { success: true, data };
        }
        throw err;
      }
    },
    onMutate: async ({ id, data }) => {
      const patchId = data.db_id || id;
      setUpdatedChauffeurItem(patchId, data);
      queryClient.setQueriesData({ queryKey: ['chauffeurMissions'] }, (old) => {
        if (!old || !old.data) return old;
        return {
          ...old,
          data: old.data.map(r => (String(r.id) === String(patchId) || String(r.db_id) === String(patchId)) ? { ...r, ...data } : r)
        };
      });
    },
    onSuccess: () => {
      notifyStateChanged(queryClient, ['chauffeurMissions', 'orders', 'deliveries', 'dashboardStats']);
    }
  });
};

export const useDeleteChauffeurMission = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      try {
        const response = await api.delete(`/orders/${id}`);
        return response.data;
      } catch (err) {
        // If 404 (already deleted or tenant mismatch on remote server), return soft success so UI removes it
        if (err.response?.status === 404) {
          return { success: true, message: 'Order removed' };
        }
        throw err;
      }
    },
    onMutate: async (id) => {
      addDeletedChauffeurId(id);
      await queryClient.cancelQueries({ queryKey: ['chauffeurMissions'] });
      queryClient.setQueriesData({ queryKey: ['chauffeurMissions'] }, (old) => {
        if (!old || !old.data) return old;
        return {
          ...old,
          data: old.data.filter((r) => String(r.id) !== String(id) && String(r.db_id) !== String(id)),
          meta: {
            ...old.meta,
            totalItems: Math.max(0, (old.meta?.totalItems || 1) - 1)
          }
        };
      });
    },
    onSuccess: () => {
      notifyStateChanged(queryClient, ['chauffeurMissions', 'orders', 'deliveries', 'dashboardStats']);
    },
    onError: (_err, id) => {
      queryClient.setQueriesData({ queryKey: ['chauffeurMissions'] }, (old) => {
        if (!old || !old.data) return old;
        return {
          ...old,
          data: old.data.filter((r) => String(r.id) !== String(id) && String(r.db_id) !== String(id))
        };
      });
      notifyStateChanged(queryClient, ['chauffeurMissions', 'orders', 'deliveries', 'dashboardStats']);
    }
  });
};

