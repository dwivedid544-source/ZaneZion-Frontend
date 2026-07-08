import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api/setupAxios';

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

      const mappedData = (ordersArray || []).map(order => ({
          ...order,
          id: order?.id?.toString() || '', // UI sometimes expects string id
          ...order?.metadata?.customItems?.[0], // Any custom payload fields
          clientName: order?.client?.companyName || order?.client?.name || 'Guest Client',
          status: order?.status,
      }));
      return {
        success: true,
        data: mappedData,
        meta: {
          totalItems,
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
      queryClient.invalidateQueries({ queryKey: ['chauffeurMissions'] });
    }
  });
};

export const useUpdateChauffeurMission = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => {
      // Send the entire updated mission as a single item in items array, so backend can update metadata.customItems
      const payload = {
          clientId: data.clientId,
          status: data.status,
          items: [data],
      };
      await api.put(`/orders/${id}`, payload);
      return { success: true, data };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chauffeurMissions'] });
    }
  });
};

export const useDeleteChauffeurMission = () => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (id) => {
        await api.delete(`/orders/${id}`);
        return { success: true };
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['chauffeurMissions'] });
      }
    });
};
