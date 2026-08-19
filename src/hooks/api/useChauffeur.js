import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api/setupAxios';
import { notifyStateChanged, getDeletedChauffeurIds, addDeletedChauffeurId, getUpdatedChauffeurMap, setUpdatedChauffeurItem } from '../../utils/stateSyncHelper';
import { normalizeRole } from '../../utils/authUtils';

export const useChauffeurMissions = (page = 1, limit = 10, search = '') => {
  let currentUser = null;
  try {
    const rawUser = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    currentUser = rawUser ? JSON.parse(rawUser) : null;
  } catch (_) {}

  const currentUserId = currentUser?.id || null;
  const currentUserTenant = currentUser?.tenantId || null;
  const currentUserEmail = currentUser?.email || null;
  const currentClientId = currentUser?.clientId || currentUser?.company_id || null;

  // Determine if the user is a customer/client (should see only their own) vs admin/staff (should see all)
  const rawRole = currentUser?.role;
  const roleStr = typeof rawRole === 'object' && rawRole !== null ? rawRole.name : rawRole;
  const normalizedRole = normalizeRole(roleStr);
  const isCustomerRole = ['customer', 'client', 'saas_client'].includes(normalizedRole);

  return useQuery({
    queryKey: ['chauffeurMissions', currentUserId, currentUserTenant, page, limit, search],
    queryFn: async () => {
      // Fetch from orders where orderType is CHAUFFEUR, or from missions.
      const response = await api.get('/orders', {
        params: {
          page,
          limit,
          search,
          orderType: 'CHAUFFEUR',
          // Only scope to this user's data if they're a customer/client role.
          // Admins, operations, staff etc. see all bookings in their tenant.
          ...(isCustomerRole && currentUserId && { user_id: currentUserId }),
          ...(isCustomerRole && currentUserEmail && { customer_email: currentUserEmail }),
          ...(isCustomerRole && currentClientId && { clientId: currentClientId })
        }
      });
      // Ensure data matches what the UI expects
      const raw = response.data;
      let ordersArray = [];
      if (Array.isArray(raw?.data?.orders)) {
        ordersArray = raw.data.orders;
      } else if (Array.isArray(raw?.data)) {
        ordersArray = raw.data;
      } else if (Array.isArray(raw?.orders)) {
        ordersArray = raw.orders;
      } else if (Array.isArray(raw)) {
        ordersArray = raw;
      }

      const totalItems = raw?.data?.total ?? raw?.meta?.totalItems ?? raw?.totalItems ?? raw?.total ?? ordersArray.length;
      const totalPages = raw?.data?.totalPages ?? raw?.meta?.totalPages ?? raw?.totalPages ?? 1;
      const currentPage = raw?.data?.page ?? raw?.meta?.currentPage ?? raw?.page ?? 1;

      const updatedMap = getUpdatedChauffeurMap();

      const mappedData = (ordersArray || [])
        .filter(order => {
          if (!order || typeof order !== 'object') return false;
          const status = String(order.status || '').toLowerCase();
          return status !== 'deleted';
        })
        .map(order => {
          let meta = order?.metadata;
          if (typeof meta === 'string') {
            try { meta = JSON.parse(meta); } catch { meta = {}; }
          }
          meta = meta || {};

          const customItem = meta?.customItems?.[0] || meta?.custom_items?.[0] || order?.items?.[0] || {};
          const { id: _customId, ...restCustomItem } = customItem;
          const realId = order?.id?.toString() || '';

          const resolvedPickup =
            order?.pickup_location ||
            order?.pickupLocation ||
            meta?.pickup_location ||
            meta?.pickupLocation ||
            restCustomItem?.pickupLocation ||
            restCustomItem?.pickup_location ||
            '';

          const resolvedDrop =
            order?.location ||
            order?.delivery_address ||
            order?.deliveryAddress ||
            order?.dropLocation ||
            order?.drop_location ||
            meta?.location ||
            meta?.delivery_address ||
            meta?.deliveryAddress ||
            meta?.dropLocation ||
            meta?.drop_location ||
            restCustomItem?.dropLocation ||
            restCustomItem?.drop_location ||
            restCustomItem?.location ||
            '';

          const combined = {
            ...order,
            ...restCustomItem,
            id: realId,
            db_id: order?.id,
            clientName: order?.client?.companyName || order?.client?.name || restCustomItem?.clientName || 'Guest Client',
            pickupLocation: resolvedPickup,
            pickup_location: resolvedPickup,
            dropLocation: resolvedDrop,
            drop_location: resolvedDrop,
            location: resolvedDrop,
            ...(updatedMap?.[realId] || {}),
            status: order?.status || 'pending'
          };

          const sType = combined.serviceType || restCustomItem.serviceType || 'One Way';
          const daysVal = parseInt(combined.numberOfDays || combined.dailyDays || restCustomItem.numberOfDays || 1, 10) || 1;
          const qty = sType === 'Round Trip' ? 2 : (sType === 'Daily Service' ? daysVal : 1);

          // Always use $120 as the base unit price — never read old stored values
          const baseUnit = 120;
          const rawTotal = Number((baseUnit * qty).toFixed(2));

          return {
            ...combined,
            unitPrice: baseUnit,
            price: baseUnit,
            chauffeurFee: rawTotal,
            chauffeur_fee: rawTotal,
            totalAmount: rawTotal,
            total_amount: rawTotal
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
    },
    // Auto-refetch every 8 seconds so all portals (admin, client, operations) stay in sync
    // without needing a manual page refresh.
    refetchInterval: 8000,
    staleTime: 4000,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
  });
};

export const useCreateChauffeurMission = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (missionData) => {
      const fee = Number(missionData.chauffeurFee || missionData.chauffeur_fee || missionData.totalAmount || missionData.total || 120);
      const pickupLoc = missionData.pickupLocation || missionData.pickup_location || '';
      const dropLoc = missionData.dropLocation || missionData.drop_location || missionData.location || missionData.deliveryAddress || missionData.delivery_address || '';

      const fullItem = {
        ...missionData,
        pickupLocation: pickupLoc,
        dropLocation: dropLoc,
        location: dropLoc
      };

      const payload = {
        ...missionData,
        clientId: missionData.clientId,
        orderType: 'CHAUFFEUR',
        type: 'CHAUFFEUR',
        totalAmount: fee,
        total_amount: fee,
        total: fee,
        pickupLocation: pickupLoc,
        pickup_location: pickupLoc,
        dropLocation: dropLoc,
        drop_location: dropLoc,
        location: dropLoc,
        delivery_address: dropLoc,
        status: missionData.status || 'draft',
        passengerName: missionData.passengerName || missionData.guestName,
        guestName: missionData.guestName || missionData.passengerName,
        numberOfPassengers: Number(missionData.numberOfPassengers || missionData.passengers || missionData.passengerCount || 1),
        passengers: Number(missionData.passengers || missionData.numberOfPassengers || missionData.passengerCount || 1),
        passengerCount: Number(missionData.passengerCount || missionData.numberOfPassengers || 1),
        luggage: missionData.luggage || (Number(missionData.bags || 0) > 0 ? `Yes — ${missionData.bags} bag(s)` : 'No'),
        bags: Number(missionData.bags || 0),
        stops: missionData.stops || 'No',
        stopLocations: missionData.stopLocations || null,
        amenities: missionData.amenities || [],
        wifi: missionData.wifi || (Array.isArray(missionData.amenities) && missionData.amenities.includes('WiFi') ? 'Yes' : 'No'),
        refreshments: missionData.refreshments || (Array.isArray(missionData.amenities) && missionData.amenities.includes('Refreshments') ? 'Yes' : 'No'),
        carSeat: missionData.carSeat || (Array.isArray(missionData.amenities) && (missionData.amenities.includes('Baby Car Seat') || missionData.amenities.includes('Car Seat')) ? 'Yes' : 'No'),
        serviceType: missionData.serviceType || 'One Way',
        returnDate: missionData.returnDate || null,
        returnTime: missionData.returnTime || null,
        pickupTime: missionData.pickupTime || null,
        dueDate: missionData.dueDate || null,
        items: [fullItem],
        customItems: [fullItem],
        custom_items: [fullItem],
        metadata: {
          ...missionData,
          pickupLocation: pickupLoc,
          dropLocation: dropLoc,
          location: dropLoc,
          passengerName: missionData.passengerName || missionData.guestName,
          guestName: missionData.guestName || missionData.passengerName,
          numberOfPassengers: Number(missionData.numberOfPassengers || missionData.passengers || missionData.passengerCount || 1),
          passengers: Number(missionData.passengers || missionData.numberOfPassengers || 1),
          passengerCount: Number(missionData.passengerCount || missionData.numberOfPassengers || 1),
          luggage: missionData.luggage || (Number(missionData.bags || 0) > 0 ? `Yes — ${missionData.bags} bag(s)` : 'No'),
          bags: Number(missionData.bags || 0),
          stops: missionData.stops || 'No',
          stopLocations: missionData.stopLocations || null,
          amenities: missionData.amenities || [],
          wifi: missionData.wifi || (Array.isArray(missionData.amenities) && missionData.amenities.includes('WiFi') ? 'Yes' : 'No'),
          refreshments: missionData.refreshments || (Array.isArray(missionData.amenities) && missionData.amenities.includes('Refreshments') ? 'Yes' : 'No'),
          carSeat: missionData.carSeat || (Array.isArray(missionData.amenities) && (missionData.amenities.includes('Baby Car Seat') || missionData.amenities.includes('Car Seat')) ? 'Yes' : 'No'),
          serviceType: missionData.serviceType || 'One Way',
          returnDate: missionData.returnDate || null,
          returnTime: missionData.returnTime || null,
          pickupTime: missionData.pickupTime || null,
          dueDate: missionData.dueDate || null,
          customItems: [fullItem]
        }
      };
      const response = await api.post('/orders', payload);
      return { success: true, data: response.data?.data || response.data };
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
      const fee = Number(data.chauffeurFee || data.chauffeur_fee || data.totalAmount || data.total || 120);
      const pickupLoc = data.pickupLocation || data.pickup_location || '';
      const dropLoc = data.dropLocation || data.drop_location || data.location || data.deliveryAddress || data.delivery_address || '';

      const fullItem = {
        ...data,
        pickupLocation: pickupLoc,
        dropLocation: dropLoc,
        location: dropLoc
      };

      const payload = {
        ...data,
        clientId: data.clientId,
        status: data.status,
        totalAmount: fee,
        total_amount: fee,
        total: fee,
        pickupLocation: pickupLoc,
        pickup_location: pickupLoc,
        dropLocation: dropLoc,
        drop_location: dropLoc,
        location: dropLoc,
        delivery_address: dropLoc,
        passengerName: data.passengerName || data.guestName,
        guestName: data.guestName || data.passengerName,
        numberOfPassengers: Number(data.numberOfPassengers || data.passengers || data.passengerCount || 1),
        passengers: Number(data.passengers || data.numberOfPassengers || 1),
        passengerCount: Number(data.passengerCount || data.numberOfPassengers || 1),
        luggage: data.luggage || (Number(data.bags || 0) > 0 ? `Yes — ${data.bags} bag(s)` : 'No'),
        bags: Number(data.bags || 0),
        stops: data.stops || 'No',
        stopLocations: data.stopLocations || null,
        amenities: data.amenities || [],
        wifi: data.wifi || (Array.isArray(data.amenities) && data.amenities.includes('WiFi') ? 'Yes' : 'No'),
        refreshments: data.refreshments || (Array.isArray(data.amenities) && data.amenities.includes('Refreshments') ? 'Yes' : 'No'),
        carSeat: data.carSeat || (Array.isArray(data.amenities) && (data.amenities.includes('Baby Car Seat') || data.amenities.includes('Car Seat')) ? 'Yes' : 'No'),
        serviceType: data.serviceType || 'One Way',
        returnDate: data.returnDate || null,
        returnTime: data.returnTime || null,
        pickupTime: data.pickupTime || null,
        dueDate: data.dueDate || null,
        items: [fullItem],
        customItems: [fullItem],
        custom_items: [fullItem],
        metadata: {
          ...data,
          pickupLocation: pickupLoc,
          dropLocation: dropLoc,
          location: dropLoc,
          passengerName: data.passengerName || data.guestName,
          guestName: data.guestName || data.passengerName,
          numberOfPassengers: Number(data.numberOfPassengers || data.passengers || data.passengerCount || 1),
          passengers: Number(data.passengers || data.numberOfPassengers || 1),
          passengerCount: Number(data.passengerCount || data.numberOfPassengers || 1),
          luggage: data.luggage || (Number(data.bags || 0) > 0 ? `Yes — ${data.bags} bag(s)` : 'No'),
          bags: Number(data.bags || 0),
          stops: data.stops || 'No',
          stopLocations: data.stopLocations || null,
          amenities: data.amenities || [],
          wifi: data.wifi || (Array.isArray(data.amenities) && data.amenities.includes('WiFi') ? 'Yes' : 'No'),
          refreshments: data.refreshments || (Array.isArray(data.amenities) && data.amenities.includes('Refreshments') ? 'Yes' : 'No'),
          carSeat: data.carSeat || (Array.isArray(data.amenities) && (data.amenities.includes('Baby Car Seat') || data.amenities.includes('Car Seat')) ? 'Yes' : 'No'),
          serviceType: data.serviceType || 'One Way',
          returnDate: data.returnDate || null,
          returnTime: data.returnTime || null,
          pickupTime: data.pickupTime || null,
          dueDate: data.dueDate || null,
          customItems: [fullItem]
        }
      };
      const patchId = data.db_id || id;
      try {
        const response = await api.put(`/orders/${patchId}`, payload);
        if (data.status) {
          try {
            await api.patch(`/orders/${patchId}/status`, { status: data.status });
          } catch (_) {}
        }
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

