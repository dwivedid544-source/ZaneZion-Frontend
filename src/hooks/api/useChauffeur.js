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
          ...(isCustomerRole && currentClientId && { clientId: currentClientId }),
          ...(isCustomerRole && (currentUser?.name || currentUser?.full_name) && { customer_name: currentUser?.name || currentUser?.full_name })
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

      const deletedIds = getDeletedChauffeurIds();
      const updatedMap = getUpdatedChauffeurMap();

      const mappedData = (ordersArray || [])
        .filter(order => {
          if (!order || typeof order !== 'object') return false;
          const strId = String(order?.id || '');
          if (deletedIds.includes(strId)) return false;
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
          // Filter out null, undefined, and empty string properties from restCustomItem so they don't overwrite valid order/meta data
          const sanitizedCustomItem = {};
          Object.entries(restCustomItem).forEach(([k, v]) => {
            if (v !== null && v !== undefined && v !== '') {
              sanitizedCustomItem[k] = v;
            }
          });
          const realId = order?.id?.toString() || '';

          const resolvedPickup =
            order?.pickup_location ||
            order?.pickupLocation ||
            meta?.pickup_location ||
            meta?.pickupLocation ||
            sanitizedCustomItem?.pickupLocation ||
            sanitizedCustomItem?.pickup_location ||
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
            sanitizedCustomItem?.dropLocation ||
            sanitizedCustomItem?.drop_location ||
            sanitizedCustomItem?.location ||
            '';

          const overlay = updatedMap?.[realId] || {};
          const isCancelled = ['cancelled', 'rejected', 'canceled'].includes(String(order?.status || '').toLowerCase());
          const resolvedStatus = overlay.status || (isCancelled ? 'cancelled' : (order?.status || 'pending'));

          const resolvedClientId =
            order?.clientId ||
            order?.client_id ||
            meta?.clientId ||
            meta?.client_id ||
            meta?.client?.id ||
            sanitizedCustomItem?.clientId ||
            null;

          const resolvedUserId =
            order?.createdById ||
            order?.created_by ||
            meta?.created_by ||
            meta?.userId ||
            meta?.user_id ||
            meta?.customer_id ||
            sanitizedCustomItem?.userId ||
            sanitizedCustomItem?.user_id ||
            null;

          const resolvedEmail =
            order?.client?.email ||
            meta?.email ||
            meta?.customer_email ||
            meta?.clientEmail ||
            meta?.client_email ||
            meta?.client?.email ||
            sanitizedCustomItem?.customer_email ||
            sanitizedCustomItem?.email ||
            null;

          const resolvedClientName =
            order?.client?.companyName ||
            order?.client?.name ||
            meta?.clientName ||
            meta?.client_name ||
            meta?.guestName ||
            meta?.passengerName ||
            sanitizedCustomItem?.clientName ||
            'Guest Client';

          const linkedDel = Array.isArray(order?.deliveries) ? order.deliveries.find(d => d.vehicleRef || d.assignedTo) : null;

          const resolvedDriverName =
            overlay.driverName ||
            order?.driverName ||
            meta?.driverName ||
            sanitizedCustomItem?.driverName ||
            (linkedDel?.assignee ? `${linkedDel.assignee.firstName || ''} ${linkedDel.assignee.lastName || ''}`.trim() : null) ||
            null;

          const resolvedDriverUserId =
            overlay.driver_user_id ||
            overlay.driverId ||
            order?.driver_user_id ||
            order?.driverId ||
            meta?.driver_user_id ||
            meta?.driverId ||
            sanitizedCustomItem?.driver_user_id ||
            sanitizedCustomItem?.driverId ||
            linkedDel?.assignedTo ||
            null;

          const resolvedPlateNumber =
            overlay.plateNumber ||
            overlay.vehicleId ||
            overlay.vehicle ||
            order?.plateNumber ||
            order?.vehicleId ||
            order?.vehicle ||
            order?.vehicleRef ||
            meta?.plateNumber ||
            meta?.vehicleId ||
            meta?.vehicle ||
            meta?.vehicleRef ||
            sanitizedCustomItem?.plateNumber ||
            sanitizedCustomItem?.vehicleId ||
            linkedDel?.vehicleRef ||
            null;

          const combined = {
            ...order,
            ...sanitizedCustomItem,
            id: realId,
            db_id: order?.id,
            clientId: resolvedClientId,
            userId: resolvedUserId,
            user_id: resolvedUserId,
            customer_id: resolvedUserId,
            email: resolvedEmail,
            customer_email: resolvedEmail,
            clientEmail: resolvedEmail,
            clientName: resolvedClientName,
            pickupLocation: resolvedPickup,
            pickup_location: resolvedPickup,
            dropLocation: resolvedDrop,
            drop_location: resolvedDrop,
            location: resolvedDrop,
            status: resolvedStatus,
            chauffeur_status: overlay.chauffeur_status || resolvedStatus,
            driverName: resolvedDriverName,
            driver_user_id: resolvedDriverUserId,
            driverId: resolvedDriverUserId,
            plateNumber: resolvedPlateNumber,
            vehicleId: resolvedPlateNumber,
            vehicle: resolvedPlateNumber,
            vehicleRef: resolvedPlateNumber,
            ...overlay
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
      const {
        id: _stripId,
        db_id: _stripDbId,
        tenantId: _stripTenantId,
        createdById: _stripCreatedById,
        createdAt: _stripCreatedAt,
        updatedAt: _stripUpdatedAt,
        client: _stripClient,
        creator: _stripCreator,
        tenant: _stripTenant,
        deliveries: _stripDeliveries,
        missions: _stripMissions,
        invoices: _stripInvoices,
        ...cleanData
      } = data;

      const fee = Number(cleanData.chauffeurFee || cleanData.chauffeur_fee || cleanData.totalAmount || cleanData.total || 120);
      const pickupLoc = cleanData.pickupLocation || cleanData.pickup_location || '';
      const dropLoc = cleanData.dropLocation || cleanData.drop_location || cleanData.location || cleanData.deliveryAddress || cleanData.delivery_address || '';

      const resolvedPlate = cleanData.plateNumber !== undefined ? (cleanData.plateNumber || null) : (cleanData.vehicleId !== undefined ? (cleanData.vehicleId || null) : (cleanData.vehicle || null));
      const resolvedDriver = cleanData.driverName || null;
      const resolvedDriverId = cleanData.driver_user_id || cleanData.driverId || null;

      const fullItem = {
        ...cleanData,
        pickupLocation: pickupLoc,
        dropLocation: dropLoc,
        location: dropLoc,
        driverName: resolvedDriver,
        driver_user_id: resolvedDriverId,
        driverId: resolvedDriverId,
        plateNumber: resolvedPlate,
        vehicleId: resolvedPlate,
        vehicle: resolvedPlate
      };

      const payload = {
        ...cleanData,
        clientId: cleanData.clientId,
        status: cleanData.status,
        totalAmount: fee,
        total_amount: fee,
        total: fee,
        pickupLocation: pickupLoc,
        pickup_location: pickupLoc,
        dropLocation: dropLoc,
        drop_location: dropLoc,
        location: dropLoc,
        delivery_address: dropLoc,
        passengerName: cleanData.passengerName || cleanData.guestName,
        guestName: cleanData.guestName || cleanData.passengerName,
        numberOfPassengers: Number(cleanData.numberOfPassengers || cleanData.passengers || cleanData.passengerCount || 1),
        passengers: Number(cleanData.passengers || cleanData.numberOfPassengers || 1),
        passengerCount: Number(cleanData.passengerCount || cleanData.numberOfPassengers || 1),
        driverName: resolvedDriver,
        driver_user_id: resolvedDriverId,
        driverId: resolvedDriverId,
        plateNumber: resolvedPlate,
        vehicleId: resolvedPlate,
        vehicle: resolvedPlate,
        adminApproved: cleanData.adminApproved !== undefined ? cleanData.adminApproved : (resolvedDriver ? true : undefined),
        luggage: cleanData.luggage || (Number(cleanData.bags || 0) > 0 ? `Yes — ${cleanData.bags} bag(s)` : 'No'),
        bags: Number(cleanData.bags || 0),
        stops: cleanData.stops || 'No',
        stopLocations: cleanData.stopLocations || null,
        amenities: cleanData.amenities || [],
        wifi: cleanData.wifi || (Array.isArray(cleanData.amenities) && cleanData.amenities.includes('WiFi') ? 'Yes' : 'No'),
        refreshments: cleanData.refreshments || (Array.isArray(cleanData.amenities) && cleanData.amenities.includes('Refreshments') ? 'Yes' : 'No'),
        carSeat: cleanData.carSeat || (Array.isArray(cleanData.amenities) && (cleanData.amenities.includes('Baby Car Seat') || cleanData.amenities.includes('Car Seat')) ? 'Yes' : 'No'),
        serviceType: cleanData.serviceType || 'One Way',
        returnDate: cleanData.returnDate || null,
        returnTime: cleanData.returnTime || null,
        pickupTime: cleanData.pickupTime || null,
        dueDate: cleanData.dueDate || null,
        items: [fullItem],
        customItems: [fullItem],
        custom_items: [fullItem],
        metadata: {
          ...cleanData,
          pickupLocation: pickupLoc,
          dropLocation: dropLoc,
          location: dropLoc,
          driverName: resolvedDriver,
          driver_user_id: resolvedDriverId,
          driverId: resolvedDriverId,
          plateNumber: resolvedPlate,
          vehicleId: resolvedPlate,
          vehicle: resolvedPlate,
          adminApproved: cleanData.adminApproved !== undefined ? cleanData.adminApproved : (resolvedDriver ? true : undefined),
          passengerName: cleanData.passengerName || cleanData.guestName,
          guestName: cleanData.guestName || cleanData.passengerName,
          numberOfPassengers: Number(cleanData.numberOfPassengers || cleanData.passengers || cleanData.passengerCount || 1),
          passengers: Number(cleanData.passengers || cleanData.numberOfPassengers || 1),
          passengerCount: Number(cleanData.passengerCount || cleanData.numberOfPassengers || 1),
          luggage: cleanData.luggage || (Number(cleanData.bags || 0) > 0 ? `Yes — ${cleanData.bags} bag(s)` : 'No'),
          bags: Number(cleanData.bags || 0),
          stops: cleanData.stops || 'No',
          stopLocations: cleanData.stopLocations || null,
          amenities: cleanData.amenities || [],
          wifi: cleanData.wifi || (Array.isArray(cleanData.amenities) && cleanData.amenities.includes('WiFi') ? 'Yes' : 'No'),
          refreshments: cleanData.refreshments || (Array.isArray(cleanData.amenities) && cleanData.amenities.includes('Refreshments') ? 'Yes' : 'No'),
          carSeat: cleanData.carSeat || (Array.isArray(cleanData.amenities) && (cleanData.amenities.includes('Baby Car Seat') || cleanData.amenities.includes('Car Seat')) ? 'Yes' : 'No'),
          serviceType: cleanData.serviceType || 'One Way',
          returnDate: cleanData.returnDate || null,
          returnTime: cleanData.returnTime || null,
          pickupTime: cleanData.pickupTime || null,
          dueDate: cleanData.dueDate || null,
          customItems: [fullItem]
        }
      };
      const patchId = data.db_id || id;
      try {
        const response = await api.put(`/orders/${patchId}`, payload);
        if (data.status) {
          const normStatus = String(data.status).toLowerCase();
          try {
            await api.put(`/orders/${patchId}/status`, { status: normStatus });
          } catch (_) {}
          try {
            await api.patch(`/orders/${patchId}/status`, { status: normStatus });
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

