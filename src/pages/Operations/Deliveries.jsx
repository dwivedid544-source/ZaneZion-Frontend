import React, { useState, useEffect } from 'react';
import { swalSuccess, swalError, swalWarning, swalInfo, swalConfirm, swalCredentials, swalCopied } from '../../utils/swal';
import Table from '../../components/Table';
import Modal from '../../components/Modal';
import { useLocation } from 'react-router-dom';
import {
  Plus, Search, Truck, MapPin, Camera,
  Clock, Phone, Navigation, PackageCheck, PenTool, Image as ImageIcon, Ship, Plane, AlertCircle, RefreshCcw, CheckCircle2, Activity, Trash2, Car, UserPlus
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Pagination from '../../components/Common/Pagination';
import { useDeliveries, useCreateDelivery, useUpdateDelivery, useCancelDelivery, useDeleteDelivery, useCreateMission, useStartMission, useSubmitPOD } from '../../hooks/api/useLogistics';
import { useItems } from '../../hooks/api/useInventory';

import { useData } from '../../context/GlobalDataContext';
import CustomDatePicker from '../../components/CustomDatePicker';

/** Roles that can be chosen as delivery / field drivers (not only `staff`). */
function isAssignableDeliveryRole(roleRaw) {
  const roleName = typeof roleRaw === 'object' && roleRaw !== null ? roleRaw.name : roleRaw;
  const r = String(roleName || '').toLowerCase().replace(/\s+/g, '_');
  return ['staff', 'logistics', 'operations', 'operation', 'driver', 'field_staff', 'concierge'].includes(r);
}

function displayDeliveryStatus(raw) {
  const k = String(raw || '').toLowerCase().replace(/\s+/g, '_');
  if (k === 'pending' || k === 'pending_pickup' || k === 'pending_review') return 'Pending pickup';
  if (k === 'assigned' || k === 'accepted') return 'Driver assigned';
  if (k === 'en_route' || k === 'in_transit' || k === 'dispatched') return 'Out for delivery';
  if (k === 'delivered' || k === 'completed') return 'Delivered';
  if (k === 'cancelled' || k === 'canceled') return 'Cancelled';
  return raw ? String(raw) : '—';
}

const Deliveries = () => {
  const { users, fleet, fetchFleet, fetchStaff, hasMenuPermission, warehouses, fetchWarehouses, currentUser, clients = [], fetchClients, customerUsers = [], fetchCustomerUsers, inventory } = useData();
  const { data: dbItemsData } = useItems(1, 100);
  const dbItems = Array.isArray(dbItemsData) ? dbItemsData : (Array.isArray(dbItemsData?.items) ? dbItemsData.items : []);

  const [searchTerm, setSearchTerm] = useState('');
  const [debounceSearch, setDebounceSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { data: deliveriesData, isLoading, error } = useDeliveries(currentPage, itemsPerPage, debounceSearch);
  const deliveries = Array.isArray(deliveriesData?.data) ? deliveriesData.data : (deliveriesData?.data?.deliveries || []);
  const meta = {
    totalPages: deliveriesData?.data?.totalPages || deliveriesData?.totalPages || 1,
    totalItems: deliveriesData?.data?.total || deliveriesData?.total || deliveries.length
  };

  const createDeliveryMutation = useCreateDelivery();
  const updateDeliveryMutation = useUpdateDelivery();
  const cancelDeliveryMutation = useCancelDelivery();
  const deleteDeliveryMutation = useDeleteDelivery();
  const createMissionMutation = useCreateMission();
  const startMissionMutation = useStartMission();
  const submitPODMutation = useSubmitPOD();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounceSearch(searchTerm);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchWarehouses();
    fetchStaff();
    fetchClients();
    fetchCustomerUsers({ include_all: true, include_client_role: true });
    if (fetchFleet) fetchFleet();
  }, [fetchWarehouses, fetchStaff, fetchClients, fetchCustomerUsers, fetchFleet]);

  const clientOptions = React.useMemo(() => {
    const out = [];
    const seen = new Set();
    const add = (entry) => {
      const key = entry.email ? `email:${entry.email.toLowerCase()}` : `${entry.source}:${entry.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(entry);
    };
    (clients || []).forEach((c) => {
      const type = String(c.client_type || c.clientType || c.account_type || c.accountType || c.role || '').toLowerCase();
      const isCustomer = ['personal', 'direct', 'individual', 'customer'].some((x) => type.includes(x));
      add({
        id: c.id,
        value: `${isCustomer ? 'customer' : 'company'}_${c.id}`,
        label: c.companyName || c.business_name || c.name || c.email || `Client ${c.id}`,
        email: c.email || '',
        source: isCustomer ? 'customer' : 'company',
        companyId: c.company_id || c.companyId || (!isCustomer ? c.id : (currentUser?.company_id || currentUser?.companyId || '')),
        customerId: isCustomer ? c.id : '',
        clientUserId: c.signup_user_id || ''
      });
    });
    (customerUsers || []).forEach((u) => {
      // role can be an object { name: "ADMIN" } or a string — normalize it
      const rawRole = typeof u.role === 'object' && u.role !== null ? u.role.name : u.role;
      const role = String(rawRole || '').toUpperCase().replace(/\s+/g, '_');
      // Only include actual client/customer roles
      const clientRoles = ['CUSTOMER', 'INDIVIDUAL_CLIENT', 'BUSINESS_CLIENT', 'SAAS_CLIENT', 'CLIENT'];
      if (!clientRoles.includes(role)) return;
      const isCustomer = ['CUSTOMER', 'INDIVIDUAL_CLIENT'].includes(role);
      add({
        id: u.id,
        value: `${isCustomer ? 'user' : 'company'}_${u.id}`,
        label: u.name || u.business_name || u.company_name || u.email || `Client ${u.id}`,
        email: u.email || '',
        source: isCustomer ? 'user' : 'company',
        companyId: u.company_id || u.companyId || (currentUser?.company_id || currentUser?.companyId || ''),
        customerId: u.customer_id || u.client_id || '',
        clientUserId: isCustomer ? u.id : ''
      });
    });
    return out.sort((a, b) => a.label.localeCompare(b.label));
  }, [clients, customerUsers, currentUser?.company_id, currentUser?.companyId]);

  const portalRole = String(currentUser?.role?.name || currentUser?.role || '').toLowerCase().replace(/\s+/g, '_');
  const canAssignDriverUi =
    hasMenuPermission('Deliveries', 'can_edit') ||
    ['logistics', 'super_admin', 'superadmin', 'admin', 'operations', 'operation', 'concierge'].includes(portalRole);

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };
  const locationState = useLocation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('view');
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  // Default pay rate per km for staff (can be overridden per mission)
  const DEFAULT_RATE_PER_KM = 2.50;

  const [formData, setFormData] = useState({
    items: [{ name: '', qty: 1, weight: '', length: '', width: '', height: '' }],
    missionType: 'Delivery', // 'Delivery', 'Pickup', 'Transfer', or 'Chauffeur'
    passengerInfo: { name: '', count: 1, phone: '' },
    packageDetails: { weight: '', dimensions: '', type: 'General' },
    orderId: '',
    clientId: '',
    client: '',
    companyId: '',
    customerId: '',
    clientUserId: '',
    vehicle: '',
    vesselOrFlight: '',
    eta: new Date().toISOString().split('T')[0],
    requestDate: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0],
    location: '',
    dropLocation: '', // for Chauffeur
    pickupLocation: '', // for Logistics/Chauffeur
    status: 'Pending',
    driver: '',
    mode: 'Road',
    route_distance: '',     // Distance in KM for this mission
    staff_pay_rate: DEFAULT_RATE_PER_KM, // Rate per KM paid to staff
    delivery_fee: 0,        // Staff payout = route_distance × staff_pay_rate
    pod: { signature: null, image: null, actualTime: null }
  });

  // Recalculate delivery_fee whenever route_distance or staff_pay_rate changes
  const handleDistanceOrRateChange = (field, value) => {
    const updated = { ...formData, [field]: value };
    const dist = parseFloat(updated.route_distance) || 0;
    const rate = parseFloat(updated.staff_pay_rate) || 0;
    updated.delivery_fee = parseFloat((dist * rate).toFixed(2));
    setFormData(updated);
  };

  const handleAddItem = () => {
    setFormData({ ...formData, items: [...formData.items, { name: '', qty: 1, weight: '', length: '', width: '', height: '' }] });
  };

  const removeItem = (index) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems.length ? newItems : [{ name: '', qty: 1, weight: '', length: '', width: '', height: '' }] });
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  // Catch Order State for Auto-Mission Launch
  useEffect(() => {
    const st = locationState.state;
    if (!st) return;

    if (st.orderId && !st.prefillOrderId) {
      const { orderId, items, client, location, mode, pickupLocation, dropLocation } = st;
      handleAction('add', {
        orderId,
        items,
        client: client || '',
        clientId: st.clientId || st.client_id || '',
        customerId: st.customerId || st.customer_id || '',
        pickupLocation: pickupLocation || 'TBD - Warehouse',
        dropLocation: dropLocation || location || '',
        mode: mode || 'Road',
        passengerInfo: { name: client || '', count: 1, phone: '' }
      });
      window.history.replaceState({}, document.title);
      return;
    }

    if (st.prefillOrderId != null) {
      const oid = st.prefillOrderId;
      const orderRef = st.orderId || String(oid);
      handleAction('add', {
        orderId: orderRef,
        items: Array.isArray(st.items) ? st.items : [],
        client: st.client || '',
        clientId: st.clientId || st.client_id || '',
        customerId: st.customerId || st.customer_id || '',
        pickupLocation: st.pickupLocation || st.pickup_location || 'TBD - Warehouse',
        dropLocation: st.dropLocation || st.drop_location || st.location || '',
        mode: st.mode || 'Road',
        missionType: 'Delivery',
        passengerInfo: { name: st.client || '', count: 1, phone: '' },
        delivery_instructions: st.deliveryInstructions || '',
        delivery_fee: st.deliveryFee != null && st.deliveryFee !== '' ? Number(st.deliveryFee) : 0,
      });
      window.history.replaceState({}, document.title);
    }
  }, [locationState]);

  const logisticsOnlyDeliveries = deliveries.filter((d) =>
    String(d.mission_type || '').toLowerCase() !== 'chauffeur'
  );

  const currentItems = logisticsOnlyDeliveries; // Pagination is server-side now
  const totalPages = meta.totalPages;

  const handleAction = (type, del) => {
    setSelectedDelivery(del || {});
    const nextModalType = type === 'delivered' ? 'edit' : type;
    setModalType(nextModalType);
    const parseItems = (raw) => {
      if (Array.isArray(raw)) return raw;
      if (typeof raw === 'string') { try { const p = JSON.parse(raw); if (Array.isArray(p)) return p; } catch (e) { } }
      return null;
    };
    const initialFee = del?.delivery_fee || 0;
    const initialRate = del?.staff_pay_rate || DEFAULT_RATE_PER_KM;
    // Parse remarks JSON to restore all free-text manifest data
    let parsedRemarks = {};
    if (del?.remarks) {
      try { parsedRemarks = JSON.parse(del.remarks); } catch (e) { /* not JSON, plain text */ }
    }
    const restoredItems = parsedRemarks.manifestItems && parsedRemarks.manifestItems.length > 0
      ? parsedRemarks.manifestItems
      : (del?.items && del.items.length > 0)
        ? del.items.map(it => ({ name: it.item?.name || 'Asset', qty: it.quantity, weight: '', length: '', width: '', height: '' }))
        : [{ name: '', qty: 1, weight: '', length: '', width: '', height: '' }];

    const podData = del?.pod || (del?.proofsOfDelivery?.[0] ? {
      signature: del.proofsOfDelivery[0].receiverSignature,
      image: del.proofsOfDelivery[0].deliveryPhoto,
      notes: del.proofsOfDelivery[0].remarks,
      actualTime: del.proofsOfDelivery[0].createdAt
    } : (del?.proofs?.[0] ? {
      signature: del.proofs[0].receiverSignature,
      image: del.proofs[0].deliveryPhoto,
      notes: del.proofs[0].remarks,
      actualTime: del.proofs[0].createdAt
    } : {}));

    const nextFormData = del && del.id ? {
      ...del,
      orderId: del.order?.orderNumber || del.deliveryNumber || del.orderId || '',
      clientId: parsedRemarks.clientId || String(del.clientId || ''),
      client: typeof del.client === 'object' ? del.client?.companyName : (del.clientName || ''),
      items: restoredItems,
      packageDetails: parsedRemarks.packageDetails || del.packageDetails || { weight: '', dimensions: '', type: 'General' },
      passengerInfo: parsedRemarks.passengerInfo || del.passengerInfo || { name: '', count: 1, phone: '' },
      delivery_instructions: parsedRemarks.delivery_instructions || del.delivery_instructions || del.order_instructions || '',
      route_distance: del.routeDistance || del.route_distance || (initialFee > 0 ? parseFloat((initialFee / initialRate).toFixed(2)) : ''),
      staff_pay_rate: del.staffPayRate || del.staff_pay_rate || DEFAULT_RATE_PER_KM,
      delivery_fee: del.deliveryFee || del.delivery_fee || 0,
      assigned_driver: parsedRemarks.assigned_driver || del.assignedTo || del.assigned_driver || del.driverId || del.driver_id || ((users || []).find(u => u.name === (del.driver || del.driver_name))?.id || null),
      driver: parsedRemarks.driver || (del.assignee ? `${del.assignee.firstName} ${del.assignee.lastName}` : (del.driver || '')),
      mode: del.transportMode || del.mode || 'Road',
      missionType: del.missionType || 'Delivery',
      vehicle: del.vehicleRef || del.vehicle || '',
      vesselOrFlight: del.vehicleRef || del.vesselOrFlight || '',
      eta: del.etaSchedule ? new Date(del.etaSchedule).toISOString().split('T')[0] : (del.eta || new Date().toISOString().split('T')[0]),
      requestDate: del.requestDate ? new Date(del.requestDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      dueDate: del.dueDate ? new Date(del.dueDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      pickupLocation: del.pickupLocation || '',
      dropLocation: del.dropLocation || '',
      route: parsedRemarks.route || del.route || '',
      pod: Object.keys(podData).length > 0 ? podData : { signature: null, image: null, actualTime: null }
    } : {
      items: [{ name: '', qty: 1, weight: '', length: '', width: '', height: '' }],
      missionType: 'Delivery',
      passengerInfo: { name: '', count: 1, phone: '' },
      packageDetails: { weight: '', dimensions: '', type: 'General' },
      orderId: '',
      clientId: '',
      client: '',
      companyId: '',
      customerId: '',
      clientUserId: '',
      vehicle: '',
      vesselOrFlight: '',
      eta: new Date().toISOString().split('T')[0],
      requestDate: new Date().toISOString().split('T')[0],
      dueDate: new Date().toISOString().split('T')[0],
      location: '',
      pickupLocation: '',
      dropLocation: '',
      status: 'Pending',
      driver: '',
      mode: 'Road',
      delivery_instructions: '',
      route_distance: '',
      staff_pay_rate: DEFAULT_RATE_PER_KM,
      delivery_fee: 0,
      pod: { signature: null, image: null, actualTime: null },
      ...(del && !del.id ? {
        orderId: del.orderId || '',
        clientId: del.clientId || del.client_id || del.customer_id || '',
        client: del.client || del.clientName || '',
        customerId: del.customerId || del.customer_id || del.client_id || '',
        companyId: del.companyId || del.company_id || '',
        pickupLocation: del.pickupLocation || '',
        dropLocation: del.dropLocation || '',
        missionType: del.missionType || 'Delivery',
        mode: del.mode || 'Road',
        items: Array.isArray(del.items) && del.items.length ? del.items : [{ name: '', qty: 1, weight: '', length: '', width: '', height: '' }],
        delivery_instructions: del.delivery_instructions || del.order_instructions || '',
        route_distance: del.route_distance || (del.delivery_fee > 0 ? parseFloat((del.delivery_fee / (del.staff_pay_rate || DEFAULT_RATE_PER_KM)).toFixed(2)) : ''),
        staff_pay_rate: del.staff_pay_rate || DEFAULT_RATE_PER_KM,
        delivery_fee: del.delivery_fee != null ? del.delivery_fee : 0,
        passengerInfo: del.passengerInfo || { name: '', count: 1, phone: '' },
      } : {}),
    };
    // Quick "Complete Delivery" flow from list action.
    setFormData(type === 'delivered' ? { ...nextFormData, status: 'Delivered' } : nextFormData);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    // POD Enforcement
    if ((formData.status === 'Completed' || formData.status === 'Delivered') && modalType === 'edit') {
      const hasSignature = !!formData.pod?.signature;
      const hasCarrierVerification = !!(formData.pod?.carrierName && formData.pod?.documentRef);

      if (!hasSignature && !hasCarrierVerification) {
        swalWarning('Protocol Violation', 'Please provide signature or verification to finalize.');
        return;
      }
    }

    const finalData = {
      ...formData,
      pod: formData.status === 'Completed' || formData.status === 'Delivered'
        ? { ...formData.pod, actualTime: new Date().toISOString() }
        : formData.pod
    };
    if (modalType === 'add') {
      // Serialize all free-text manifest data into remarks so it persists
      const manifestMeta = {
        manifestItems: finalData.items,
        packageDetails: finalData.packageDetails || {},
        passengerInfo: finalData.passengerInfo || {},
        delivery_instructions: finalData.delivery_instructions || '',
        route: finalData.route || '',
        driver: finalData.driver || '',
        assigned_driver: finalData.assigned_driver || null,
        clientId: finalData.clientId || ''
      };

      if (!finalData.pickupLocation) {
        swalError('Validation Error', finalData.missionType === 'Chauffeur'
          ? 'Please enter a Pickup Area (e.g. Lobby, Airport Terminal, Hotel Entrance)'
          : 'Please select a pickup location (Warehouse)');
        return;
      }

      const resolvedClientId =
        (finalData.clientId && Number(String(finalData.clientId).replace(/\D/g, ''))) ||
        (currentUser?.clientId ? Number(currentUser.clientId) : null) ||
        (currentUser?.company_id ? Number(currentUser.company_id) : null) ||
        null;

      if (!resolvedClientId) {
        swalError('Validation Error', 'Please select a Linked Client for this mission.');
        return;
      }

      const matchedWarehouse = (warehouses || []).find(w => w.name === finalData.pickupLocation);
      const itemsWithRealIds = finalData.items.map(item => {
        const matchedItem = (dbItems || []).find(i => 
          String(i.name || '').trim().toLowerCase() === String(item.name || '').trim().toLowerCase()
        );
        return {
          orderItemId: (item.orderItemId || item.id) ? Number(item.orderItemId || item.id) : null,
          itemId: matchedItem ? Number(matchedItem.id) : Number(item.itemId || item.id || 1),
          quantity: Number(item.qty || item.quantity || 1)
        };
      });

      // Resolve orderId: The backend can accept either a numeric ID or the string order reference (like ORD-272).
      const rawOrderId = finalData.orderId ? String(finalData.orderId).trim() : null;
      const resolvedOrderId = rawOrderId;

      // Create Delivery via backend
      createDeliveryMutation.mutateAsync({
        orderId: resolvedOrderId,
        clientId: resolvedClientId,
        items: itemsWithRealIds,
        warehouseId: matchedWarehouse ? matchedWarehouse.id : undefined,
        remarks: JSON.stringify(manifestMeta),
        missionType: finalData.missionType,
        transportMode: finalData.mode,
        vehicleRef: finalData.vehicle || finalData.vesselOrFlight,
        etaSchedule: finalData.eta,
        requestDate: finalData.requestDate,
        dueDate: finalData.dueDate,
        pickupLocation: finalData.pickupLocation,
        dropLocation: finalData.dropLocation,
        routeDistance: finalData.route_distance ? Number(finalData.route_distance) : undefined,
        staffPayRate: finalData.staff_pay_rate ? Number(finalData.staff_pay_rate) : undefined,
        deliveryFee: finalData.delivery_fee ? Number(finalData.delivery_fee) : undefined,
      })
      .then(() => {
        swalSuccess("Success", "Mission deployed successfully");
        setIsModalOpen(false);
      })
      .catch(() => swalError("Error", "Could not create delivery"));
    } else if (modalType === 'edit') {
      const manifestMeta = {
        manifestItems: finalData.items,
        packageDetails: finalData.packageDetails || {},
        passengerInfo: finalData.passengerInfo || {},
        delivery_instructions: finalData.delivery_instructions || '',
        route: finalData.route || '',
        driver: finalData.driver || '',
        assigned_driver: finalData.assigned_driver || null,
        clientId: finalData.clientId || ''
      };

      const updatePayload = {
        missionType: finalData.missionType,
        transportMode: finalData.mode,
        vehicleRef: finalData.vehicle || finalData.vesselOrFlight,
        etaSchedule: finalData.eta,
        requestDate: finalData.requestDate,
        dueDate: finalData.dueDate,
        pickupLocation: finalData.pickupLocation,
        dropLocation: finalData.dropLocation,
        routeDistance: finalData.route_distance ? Number(finalData.route_distance) : null,
        staffPayRate: finalData.staff_pay_rate ? Number(finalData.staff_pay_rate) : null,
        deliveryFee: finalData.delivery_fee ? Number(finalData.delivery_fee) : null,
        status: finalData.status || undefined,
        remarks: JSON.stringify(manifestMeta)
      };

      if (formData.status === 'Completed' || formData.status === 'Delivered') {
        // It's a POD completion
        submitPODMutation.mutateAsync({
          id: finalData.id,
          podData: {
            receiverName: typeof finalData.client === 'object'
              ? (finalData.client?.name || finalData.client?.companyName || 'Authorized Receiver')
              : (finalData.client || finalData.passengerInfo?.name || 'Authorized Receiver'),
            receiverSignature: finalData.pod?.signature || '',
            remarks: finalData.pod?.notes || 'Delivered'
          }
        })
        .then(() => {
          swalSuccess("Success", "POD submitted successfully");
          setIsModalOpen(false);
        })
        .catch(() => swalError("Error", "Could not submit POD"));
      } else {
        // Standard update of form fields
        updateDeliveryMutation.mutateAsync({ id: finalData.id, data: updatePayload })
          .then(() => {
            // If driver is assigned, create mission
            if (finalData.assigned_driver) {
              createMissionMutation.mutateAsync({
                deliveryId: finalData.id,
                assignedEmployeeId: finalData.assigned_driver,
                vehicleId: 1
              })
              .then(() => {
                swalSuccess("Success", "Delivery updated and driver assigned successfully");
                setIsModalOpen(false);
              })
              .catch(() => {
                swalSuccess("Success", "Delivery updated successfully");
                setIsModalOpen(false);
              });
            } else {
              swalSuccess("Success", "Delivery updated successfully");
              setIsModalOpen(false);
            }
          })
          .catch(() => swalError("Error", "Could not update delivery"));
      }
    } else if (modalType === 'delete') {
      deleteDeliveryMutation.mutateAsync(selectedDelivery.id)
        .then(() => {
          swalSuccess("Success", "Delivery deleted successfully");
          setIsModalOpen(false);
        })
        .catch(() => swalError("Error", "Could not delete delivery"));
    }
  };

  const columns = [
    { header: "Dispatch ID", accessor: "id" },
    {
      header: "Order Ref",
      accessor: "orderId",
      render: (item) => item.order?.orderNumber || item.orderId || '—'
    },
    { header: "Client", accessor: "client", render: (item) => (typeof item.client === 'object' ? item.client?.companyName : item.client) || item.clientName || '—' },
    {
      header: "Personnel",
      accessor: "driver",
      render: (item) => {
        if (item.assignee) {
          return `${item.assignee.firstName} ${item.assignee.lastName}`;
        }
        return item.driver || '—';
      }
    },
    {
      header: "Manifest Summary",
      accessor: "items",
      render: (item) => {
        let manifestItems = [];
        if (item.remarks) {
          try {
            const parsed = JSON.parse(item.remarks);
            if (parsed && Array.isArray(parsed.manifestItems)) {
              manifestItems = parsed.manifestItems;
            }
          } catch (e) {}
        }
        if (manifestItems.length === 0 && item.items) {
          manifestItems = item.items.map(it => ({ name: it.item?.name || 'Asset', qty: it.quantity }));
        }

        if (manifestItems.length === 0) return item.item || "—";
        const first = manifestItems[0];
        const name = first.name || first.itemName || 'Asset';
        if (manifestItems.length === 1) return `${name} (x${first.qty || first.quantity || 1})`;
        return `${name} (x${first.qty || first.quantity || 1}) (+${manifestItems.length - 1})`;
      }
    },
    {
      header: "Transport Mode",
      accessor: "mode",
      render: (item) => (
        <div className="flex items-center gap-2">
          {item.mode === 'Sea' ? <Ship size={14} className="text-accent" /> :
            item.mode === 'Air' ? <Plane size={14} className="text-secondary" /> :
              <Truck size={14} className="text-primary" />}
          <span className="text-xs font-bold uppercase tracking-tight">{item.mode}</span>
        </div>
      )
    },
    { header: "ETA / Actual", accessor: "eta", render: (item) => item.pod?.actualTime ? new Date(item.pod.actualTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : item.eta || "TBD" },
    {
      header: "Status",
      accessor: "status",
      render: (item) => {
        const label = displayDeliveryStatus(item.status);
        return (
          <div className="space-y-1">
            <div className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase text-center border ${item.status === 'Completed' || item.status === 'Delivered' ? 'bg-success/10 border-success/30 text-success' :
              item.status === 'Failed' ? 'bg-danger/10 border-danger/30 text-danger' :
                item.status === 'Re-routed' ? 'bg-warning/10 border-warning/30 text-warning' :
                  'bg-accent/10 border-accent/30 text-accent'
              }`}>
              {label}
            </div>
            {item.clientConfirmed && (
              <div className="flex items-center justify-center gap-1 text-[8px] font-bold text-success uppercase">
                <CheckCircle2 size={8} /> Client Verified
              </div>
            )}
          </div>
        );
      }
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Institutional Logistics</h1>
          <p className="text-secondary mt-1">Multi-modal dispatch coordination with verified proof of delivery.</p>
        </div>
        {(hasMenuPermission('Deliveries', 'can_add') || ['saas_client', 'client', 'business_client'].includes(portalRole)) && (
          <button className="btn-primary flex items-center gap-2" onClick={() => handleAction('add', {})}>
            <Plus size={16} /> Deploy New Mission
          </button>
        )}
      </div>

      <div className="glass-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-accent/25 bg-white/[0.02]">
        <p className="text-xs text-secondary max-w-xl">
          <span className="font-black text-white uppercase tracking-widest text-[10px] block mb-1">Routing</span>
          <strong className="text-white">Flow:</strong> Admin approves order → mission appears here as <em>Pending pickup</em> → use <strong className="text-accent">Assign driver</strong> or <strong className="text-accent">Edit</strong>, pick staff, Save → driver sees the run in their portal.{' '}
          <strong className="text-accent">Chauffeur / VIP</strong> rides: Chauffeur protocol.
        </p>
        <Link to="/dashboard/chauffeur" className="btn-secondary inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest shrink-0 py-2.5 px-4">
          <Car size={16} className="text-accent" /> Chauffeur protocol
        </Link>
      </div>

      <div className="glass-card p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
            <input
              type="text"
              placeholder="Search by ID, Order, or Item..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-background border border-border rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-12"><RefreshCcw className="animate-spin text-accent" /></div>
        ) : error ? (
          <div className="text-danger p-4">Failed to load deliveries.</div>
        ) : (
          <>
            <Table
              columns={columns}
              data={currentItems}
              actions={true}
              onView={(item) => handleAction('view', item)}
              onEdit={(item) => handleAction('edit', item)}
              onDelete={(item) => handleAction('delete', item)}
              canEdit={canAssignDriverUi}
              canDelete={hasMenuPermission('Deliveries', 'can_delete') || ['saas_client', 'client', 'business_client'].includes(portalRole)}
              customAction={(item) => {
                const statusLower = String(item.status || '').toLowerCase();
                const isDelivered = statusLower === 'completed' || statusLower === 'delivered';

                return (
                  <div className="flex items-center gap-1 flex-wrap justify-end">
                    {canAssignDriverUi && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAction('edit', item);
                        }}
                        className="px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wide text-accent border border-accent/35 bg-accent/10 hover:bg-accent/20 transition-all flex items-center gap-1"
                        title="Assign driver / vehicle and save"
                      >
                        <UserPlus size={12} /> Assign
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        if (isDelivered) return;
                        e.stopPropagation();
                        handleAction('delivered', item);
                      }}
                      className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wide transition-all ${isDelivered
                          ? 'text-success/30 border border-success/10 bg-success/5 cursor-not-allowed opacity-50'
                          : 'text-success border border-success/30 bg-success/10 hover:bg-success/20'
                        }`}
                      title={isDelivered ? "Already Delivered" : "Complete Delivery (POD)"}
                      disabled={isDelivered}
                    >
                      {isDelivered ? 'Delivered' : 'Deliver'}
                    </button>
                  </div>
                );
              }}
            />
            {currentItems.length === 0 && (
              <div className="mt-4 text-center text-[10px] font-black uppercase tracking-widest text-muted">
                No logistics deliveries found. Chauffeur rides are tracked in Chauffeur protocol.
              </div>
            )}
            {meta.totalItems > itemsPerPage && (
              <div className="mt-6 border-t border-white/5 pt-6 px-6 pb-6">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                  totalItems={meta.totalItems}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Tactical Route Map Placeholder */}
      <div className="glass-card p-6 border-accent/10 overflow-hidden relative min-h-[400px]">
        <div className="flex items-center justify-between mb-6 relative z-10">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2">
              <MapPin className="text-accent" size={20} /> Tactical Global Logistics Map
            </h3>
            <p className="text-[10px] text-muted uppercase font-black tracking-widest mt-1">Real-time Asset Orbit Distribution</p>
          </div>
          <div className="flex gap-2">
            <span className="px-3 py-1 bg-success/20 text-success rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-success rounded-full animate-ping" /> Satellite Online
            </span>
          </div>
        </div>

        <div className="absolute inset-0 z-0 bg-sidebar/50">
          {/* Animated Map Grid Placeholder */}
          <div className="w-full h-full opacity-10" style={{
            backgroundImage: `linear-gradient(#C8A96A 1px, transparent 1px), linear-gradient(90deg, #C8A96A 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-4">
              <Navigation className="text-accent/20 mx-auto animate-pulse" size={64} />
              <p className="text-secondary font-bold uppercase tracking-widest text-[10px]">Initializing Encryption & Satellite Feed...</p>
            </div>
          </div>
        </div>

        {/* Legend Overlay */}
        <div className="absolute bottom-6 left-6 p-4 glass-card bg-black/60 backdrop-blur-md border-accent/20 space-y-3 z-10">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-success rounded-full shadow-[0_0_8px_#22c55e]" />
            <span className="text-[10px] font-bold text-white uppercase">In Transit (Verified)</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-accent rounded-full shadow-[0_0_8px_#C8A96A]" />
            <span className="text-[10px] font-bold text-white uppercase">Pending Dispatch</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-danger rounded-full shadow-[0_0_8px_#ef4444]" />
            <span className="text-[10px] font-bold text-white uppercase">Critical Deviation</span>
          </div>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          modalType === 'view' ? 'Institutional Dispatch Manifest' :
            modalType === 'edit' ? 'Update Logistics State' :
              modalType === 'delete' ? 'Decommission Dispatch' : 'Initiate Multi-modal Dispatch'
        }
      >
        {selectedDelivery && (
          <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
            {modalType === 'delete' ? (
              <div className="py-6 text-center space-y-4">
                <div className="w-20 h-20 bg-danger/10 border border-danger/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                  <AlertCircle size={40} className="text-danger" />
                </div>
                <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Confirm Decommissioning</h3>
                <p className="text-secondary text-xs uppercase font-bold tracking-widest max-w-xs mx-auto">
                  Are you sure you want to terminate mission <span className="text-white">{selectedDelivery.id}</span>? This action will purge all logistics telemetry from the active ledger.
                </p>
                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl text-left">
                  <p className="text-[10px] font-black text-muted uppercase mb-2">Impact Assessment</p>
                  <ul className="text-[10px] space-y-1 text-secondary font-bold italic">
                    <li className="flex items-center gap-2"><div className="w-1 h-1 bg-danger rounded-full" /> Fleet telemetry will be severed</li>
                    <li className="flex items-center gap-2"><div className="w-1 h-1 bg-danger rounded-full" /> POD records will be archived/lost</li>
                    <li className="flex items-center gap-2"><div className="w-1 h-1 bg-danger rounded-full" /> Order ref {selectedDelivery.orderId} status will decouple</li>
                  </ul>
                </div>
              </div>
            ) : modalType === 'view' ? (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Header Section: Status & Mode */}
                <div className="flex items-center justify-between p-6 bg-white/[0.03] border border-white/5 rounded-3xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5">
                    {formData.mode === 'Sea' ? <Ship size={80} /> : formData.mode === 'Air' ? <Plane size={80} /> : <Truck size={80} />}
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-muted uppercase tracking-[0.3em]">Mission Authorization</p>
                    <h2 className="text-2xl font-black text-white italic tracking-tighter">{formData.id}</h2>
                    <div className="flex gap-2 mt-2">
                      <span className="px-3 py-1 bg-accent/20 text-accent rounded-full text-[9px] font-black uppercase tracking-widest border border-accent/30">{formData.mode} Transit</span>
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${formData.status === 'Completed' || formData.status === 'Delivered' ? 'bg-success/20 border-success/30 text-success' :
                        formData.status === 'In Transit' ? 'bg-info/20 border-info/30 text-info animate-pulse' : 'bg-warning/20 border-warning/30 text-warning'
                        }`}>{formData.status}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-bold text-muted uppercase">ZaneZion Ref</p>
                    <p className="text-sm font-black text-white tracking-widest">{formData.orderId || 'INTERNAL'}</p>
                  </div>
                </div>

                {/* Parameters Matrix */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                        <MapPin size={10} className="text-accent" /> Deployment Vector
                      </p>
                      <p className="text-xs font-bold text-white pl-4">{formData.pickupLocation || 'Nassau Central Hub'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                        <Navigation size={10} className="text-accent" /> Target Coordinate
                      </p>
                      <p className="text-xs font-bold text-white pl-4">{formData.dropLocation || formData.location || 'Client Perimeter'}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                        <Clock size={10} className="text-accent" /> Temporal Schedule
                      </p>
                      <div className="pl-4 space-y-1">
                        <p className="text-[10px] text-secondary font-bold">Planned ETA: <span className="text-white">{formData.eta}</span></p>
                        <p className="text-[10px] text-secondary font-bold">Request: <span className="text-white">{formData.requestDate}</span></p>
                      </div>
                    </div>
                  </div>
                </div>

                {formData.missionType !== 'Chauffeur' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-accent/5 rounded-2xl border border-accent/15 space-y-1">
                      <p className="text-[9px] font-black text-muted uppercase tracking-widest">Customer drop-off address</p>
                      <p className="text-sm font-bold text-white leading-snug">{formData.dropLocation || formData.location || '—'}</p>
                    </div>
                    {(() => {
                      const cleanInst = String(formData.delivery_instructions || '').replace(/\[request_meta\].*/g, '').trim();
                      if (!cleanInst) return null;
                      return (
                        <div className="p-4 bg-warning/5 rounded-2xl border border-warning/20 space-y-1">
                          <p className="text-[9px] font-black text-warning uppercase tracking-widest flex items-center gap-2">
                            <AlertCircle size={12} /> Delivery instructions
                          </p>
                          <p className="text-xs text-secondary font-bold leading-relaxed whitespace-pre-wrap">
                            {cleanInst}
                          </p>
                        </div>
                      );
                    })()}
                    <div className="p-4 bg-white/[0.03] rounded-2xl border border-white/10 sm:col-span-2 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[9px] font-black text-muted uppercase tracking-widest">Manifest / items</p>
                        <p className="text-sm font-bold text-white">
                          {Array.isArray(formData.items) && formData.items.length
                            ? formData.items.map((it) => `${it.name || 'Item'} ×${it.qty ?? 1}`).join(' · ')
                            : (formData.item || '—')}
                        </p>
                      </div>
                      <div className="text-right space-y-1">
                        <p className="text-[9px] font-black text-muted uppercase tracking-widest">
                          {portalRole === 'staff' || portalRole === 'driver' ? 'Expected Earning' : 'Est. collection (order total)'}
                        </p>
                        <p className="text-lg font-black text-accent">${parseFloat(formData.delivery_fee || 0).toFixed(2)}</p>
                        {(portalRole === 'staff' || portalRole === 'driver') && formData.route_distance && (
                          <p className="text-[9px] text-secondary font-bold italic">Distance: {formData.route_distance} km</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Logistics Intelligence */}
                <div className="bg-white/[0.02] rounded-3xl p-6 border border-white/5 space-y-6">
                  <h4 className="text-[10px] font-black text-accent uppercase tracking-[0.2em] border-b border-accent/10 pb-2">Logistics Intelligence</h4>
                  <div className="grid grid-cols-2 gap-8">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-accent/10 flex items-center justify-center text-accent border border-accent/20 shadow-lg shadow-accent/5">
                        <PenTool size={18} />
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-muted uppercase">Assigned Pilot</p>
                        <p className="text-xs font-bold text-white uppercase italic tracking-tighter">{formData.driver || 'Pending Assignment'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary border border-secondary/20 shadow-lg shadow-secondary/5">
                        <Truck size={18} />
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-muted uppercase">Fleet Asset</p>
                        <p className="text-xs font-bold text-white uppercase italic tracking-tighter">{formData.vehicle || 'Deploying Unit'}</p>
                      </div>
                    </div>
                  </div>

                  {formData.route && (
                    <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Activity size={12} className="text-info animate-pulse" />
                        <span className="text-[10px] font-bold text-secondary uppercase">Active ProtocolPath:</span>
                      </div>
                      <span className="text-[10px] font-black text-white italic tracking-widest">{formData.route}</span>
                    </div>
                  )}
                  {formData.missionType === 'Chauffeur' && (
                    <div className="bg-accent/5 rounded-3xl p-6 border border-accent/10 space-y-4">
                      <h4 className="text-[10px] font-black text-accent uppercase tracking-[0.2em] border-b border-accent/10 pb-2">Passenger Intelligence</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-[8px] font-black text-muted uppercase">Primary Guest</p>
                          <p className="text-xs font-bold text-white uppercase italic">{formData.passengerInfo?.name || 'VIP Guest'}</p>
                        </div>
                        <div className="space-y-1 text-right">
                          <p className="text-[8px] font-black text-muted uppercase">Pax Count</p>
                          <p className="text-xs font-bold text-white uppercase italic">{formData.passengerInfo?.count || 1} Person(s)</p>
                        </div>
                        <div className="space-y-1 col-span-2 pt-2 border-t border-accent/5">
                          <p className="text-[8px] font-black text-muted uppercase">Navigation Point (Drop)</p>
                          <p className="text-xs font-bold text-white uppercase italic">{formData.dropLocation || 'Confirmed Estate/Airport'}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Manifest Details - Show only for Logistics */}
                {formData.missionType !== 'Chauffeur' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Manifest Payload</h4>
                      <span className="px-2 py-0.5 bg-white/10 rounded-md text-[9px] font-black text-secondary">{formData.items.length} Assets</span>
                    </div>
                    <div className="overflow-hidden border border-white/5 rounded-2xl">
                      <table className="w-full text-left text-[10px]">
                        <thead className="bg-white/5 font-black text-muted uppercase">
                          <tr>
                            <th className="px-4 py-3">Description</th>
                            <th className="px-4 py-3 text-center">Qty</th>
                            <th className="px-4 py-3 text-right">Metrics</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {(Array.isArray(formData.items) ? formData.items : []).map((item, idx) => (
                            <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                              <td className="px-4 py-3 font-bold text-white italic">{item.name || 'Provisioning Asset'}</td>
                              <td className="px-4 py-3 text-center font-black text-secondary">x{item.qty}</td>
                              <td className="px-4 py-3 text-right text-muted font-bold">
                                {item.weight && <span className="mr-2">{item.weight}</span>}
                                {item.length && <span>{item.length}x{item.width}x{item.height}cm</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Enhanced POD View */}
                {(formData.status === 'Completed' || formData.status === 'Delivered') && (
                  <div className="pt-6 border-t border-white/10 space-y-4">
                    <h4 className="text-[10px] font-black text-success uppercase tracking-[0.2em] flex items-center gap-2">
                      <PackageCheck size={14} /> Mission Debrief & Verification
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="aspect-video bg-white/5 rounded-2xl border border-white/10 overflow-hidden relative group">
                        {formData.pod?.image ? (
                          <img src={formData.pod.image} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" alt="POD Evidence" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-2 opacity-30">
                            <ImageIcon size={24} />
                            <span className="text-[8px] font-black uppercase tracking-widest text-center">Visual Telemetry<br />Not Captured</span>
                          </div>
                        )}
                        <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 text-[8px] font-black text-white uppercase tracking-widest">Visual Evidence</div>
                      </div>
                      <div className="aspect-video bg-white/5 rounded-2xl border border-white/10 flex flex-col items-center justify-center p-4 relative text-center">
                        <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 text-[8px] font-black text-white uppercase tracking-widest">Authentication</div>
                        {formData.pod?.signature ? (
                          <>
                            <p className="text-xl font-black italic underline decoration-accent text-white mb-1">{formData.pod.signature}</p>
                            <p className="text-[8px] font-bold text-muted uppercase">Institutional Receiver Signature</p>
                          </>
                        ) : (
                          <>
                            <p className="text-xs font-black text-accent uppercase italic mb-1">{formData.pod?.carrierName || 'CARRIER VERIFIED'}</p>
                            <p className="text-[8px] font-bold text-muted uppercase tracking-widest">3rd Party Transmission Protocol</p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[10px] font-bold text-muted uppercase">Selection: Mission Classification</label>
                    <div className="flex gap-2">
                      {['Delivery', 'Chauffeur'].map(type => (
                        <button
                          key={type}
                          onClick={() => {
                            const defaultPickup = type === 'Chauffeur'
                              ? ''
                              : ((warehouses || []).length > 0 ? warehouses[0].name : '');
                            setFormData({ ...formData, missionType: type, pickupLocation: defaultPickup });
                          }}
                          className={`flex-1 py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${formData.missionType === type ? 'bg-accent border-accent text-primary' : 'bg-white/5 border-border text-muted hover:border-accent/40'}`}
                          disabled={modalType === 'view'}
                        >
                          {type} Mission
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted uppercase">ZaneZion Reference</label>
                    <input
                      type="text"
                      value={formData.orderId}
                      onChange={(e) => setFormData({ ...formData, orderId: e.target.value })}
                      className={`w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-accent outline-none font-bold ${
                        modalType === 'add' ? 'text-white' : 'text-muted bg-background/50 cursor-not-allowed'
                      }`}
                      disabled={modalType !== 'add'}
                      placeholder="e.g. 254 or ORD-2026-254"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted uppercase">Linked Client</label>
                    <select
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-accent outline-none font-bold appearance-none cursor-pointer"
                      value={
                        clientOptions.some(c => c.value === formData.clientId)
                          ? formData.clientId
                          : clientOptions.find(c => String(c.id) === String(formData.clientId))?.value || formData.clientId || ''
                      }
                      onChange={(e) => {
                        const selected = clientOptions.find(c => c.value === e.target.value);
                        setFormData({
                          ...formData,
                          clientId: e.target.value,
                          client: selected?.label || '',
                          companyId: selected?.companyId || '',
                          customerId: selected?.customerId || '',
                          clientUserId: selected?.clientUserId || ''
                        });
                      }}
                      disabled={modalType === 'view'}
                    >
                      <option value="">Link Client...</option>
                      {clientOptions.length === 0 && (
                        <option value="" disabled>No Clients Available</option>
                      )}
                      {clientOptions.map(client => (
                        <option key={client.value} value={client.value}>{client.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted uppercase">Request Date</label>
                    <input type="text" value={formData.requestDate} disabled className="w-full bg-background/50 border border-border rounded-xl px-4 py-3 text-xs text-muted" />
                  </div>
                  <div className="space-y-1">
                    <CustomDatePicker
                      label="Due Date"
                      selectedDate={formData.dueDate}
                      onChange={(date) => setFormData({ ...formData, dueDate: date })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted uppercase">Transport Mode</label>
                    <select className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-accent outline-none font-bold appearance-none cursor-pointer" value={formData.mode} onChange={(e) => setFormData({ ...formData, mode: e.target.value })} disabled={modalType === 'view'}>
                      <option>Road</option>
                      <option>Sea</option>
                      <option>Air</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted uppercase">Staff / Delivery Personnel</label>
                    <select
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-accent outline-none font-bold appearance-none cursor-pointer"
                      value={formData.driver}
                      onChange={(e) => {
                        const name = e.target.value;
                        const user = (users || []).find((u) => u.name === name);
                        setFormData({
                          ...formData,
                          driver: name,
                          assigned_driver: user?.id != null ? user.id : null,
                        });
                      }}
                      disabled={modalType === 'view'}
                    >
                      <option value="">Assign Personnel...</option>
                      {(users || []).filter((u) => isAssignableDeliveryRole(u.role)).map((u) => (
                        <option key={u.id} value={u.name}>{u.name} ({String(u.role?.name || u.role || '')})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted uppercase">{formData.mode === 'Sea' ? 'Vessel Name/No.' : formData.mode === 'Air' ? 'Flight No.' : 'Vehicle Registration'}</label>
                    {formData.mode === 'Road' ? (
                      <select
                        className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-accent outline-none font-bold appearance-none cursor-pointer"
                        value={formData.vehicle}
                        onChange={(e) => setFormData({ ...formData, vehicle: e.target.value })}
                        disabled={modalType === 'view'}
                      >
                        <option value="">Select Vehicle...</option>
                        {fleet.map(v => (
                          <option key={v.id} value={v.id}>{v.id} ({v.model})</option>
                        ))}
                      </select>
                    ) : (
                      <input type="text" value={formData.vehicle || formData.vesselOrFlight} onChange={(e) => setFormData({ ...formData, vehicle: e.target.value })} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-accent outline-none font-bold text-accent" disabled={modalType === 'view'} placeholder="Enter Vessel/Flight ID" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <CustomDatePicker
                      label="ETA Schedule"
                      selectedDate={formData.eta}
                      onChange={(date) => setFormData({ ...formData, eta: date })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted uppercase">Mapped Route</label>
                    <select
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-accent outline-none font-bold appearance-none cursor-pointer"
                      value={formData.route || ''}
                      onChange={(e) => setFormData({ ...formData, route: e.target.value })}
                      disabled={modalType === 'view'}
                    >
                      <option value="">Select Protocol...</option>
                      <option>Route Gamma (Coastal)</option>
                      <option>Route Alpha (Central)</option>
                      <option>Route Omega (International)</option>
                      <option>Other</option>
                    </select>
                  </div>
                  {formData.route === 'Other' && (
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-[10px] font-bold text-muted uppercase">Manual Route Specification</label>
                      <input
                        type="text"
                        value={formData.customRoute || ''}
                        onChange={(e) => setFormData({ ...formData, customRoute: e.target.value })}
                        className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-accent outline-none"
                        placeholder="Specify custom coordinates or route path"
                        disabled={modalType === 'view'}
                      />
                    </div>
                  )}

                  <div className="space-y-1 sm:col-span-2 p-4 bg-white/5 border border-border rounded-3xl">
                    <h4 className="text-[10px] font-black text-accent uppercase tracking-widest mb-4 italic text-center border-b border-accent/10 pb-2">
                      {formData.missionType !== 'Chauffeur' ? 'Goods Manifest Details' : 'Passenger & Concierge Details'}
                    </h4>
                    {formData.missionType !== 'Chauffeur' ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[8px] font-bold text-muted uppercase">Pickup Location (Hub)</label>
                            <select
                              value={formData.pickupLocation || ''}
                              onChange={(e) => setFormData({ ...formData, pickupLocation: e.target.value })}
                              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs outline-none focus:border-accent font-bold appearance-none cursor-pointer"
                              disabled={modalType === 'view'}
                            >
                              <option value="">Select Warehouse / Hub...</option>
                              {formData.pickupLocation &&
                                !(warehouses || []).some(wh => wh.name === formData.pickupLocation) &&
                                !['Third Party Vendor', 'Client Site'].includes(formData.pickupLocation) && (
                                  <option value={formData.pickupLocation}>{formData.pickupLocation}</option>
                                )}
                              {(warehouses || []).map(wh => (
                                <option key={wh.id} value={wh.name}>{wh.name}</option>
                              ))}
                              <option value="Third Party Vendor">Third Party Vendor</option>
                              <option value="Client Site">Client Site</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] font-bold text-muted uppercase">Package Weight</label>
                            <input type="text" value={formData.packageDetails?.weight || ''} onChange={(e) => setFormData({ ...formData, packageDetails: { ...formData.packageDetails, weight: e.target.value } })} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs outline-none focus:border-accent" placeholder="e.g. 50kg Total" disabled={modalType === 'view'} />
                          </div>
                        </div>

                        <div className="space-y-4 pt-2 border-t border-accent/10 mt-4">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div>
                              <label className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Mission Manifest</label>
                              <p className="text-[8px] text-secondary italic tracking-tighter mt-1">Define multi-line assets for this distribution phase</p>
                            </div>
                            {modalType !== 'view' && (
                              <button
                                type="button"
                                onClick={handleAddItem}
                                className="flex items-center justify-center gap-2 px-4 py-2 bg-accent/5 border border-accent/20 rounded-xl text-[9px] font-black text-accent hover:bg-accent hover:text-black transition-all shadow-lg shadow-accent/5 w-full sm:w-auto"
                              >
                                <Plus size={14} /> ADD ASSET
                              </button>
                            )}
                          </div>

                          <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            {(Array.isArray(formData.items) ? formData.items : []).map((item, idx) => (
                              <div key={idx} className="flex flex-col gap-3 p-4 bg-white/[0.01] border border-white/5 rounded-2xl group transition-all hover:bg-white/[0.03]">
                                <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-end">
                                  <div className="flex-1 space-y-1.5">
                                    <p className="text-[8px] font-black text-muted uppercase tracking-widest ml-1">Description</p>
                                    <input
                                      type="text"
                                      value={item.name}
                                      onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                                      placeholder="e.g. Secured Payload Alpha"
                                      className="w-full bg-transparent border-b border-white/10 px-1 py-2 text-xs text-white focus:border-accent outline-none italic font-black"
                                      disabled={modalType === 'view'}
                                    />
                                  </div>
                                  <div className="flex items-end gap-3">
                                    <div className="w-20 space-y-1.5 shrink-0">
                                      <p className="text-[8px] font-black text-muted uppercase tracking-widest ml-1">Qty</p>
                                      <input
                                        type="number"
                                        value={item.qty}
                                        onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-xs text-white focus:border-accent outline-none text-center font-black"
                                        min="1"
                                        disabled={modalType === 'view'}
                                      />
                                    </div>
                                  </div>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-end">
                                  <div className="flex-1 space-y-1.5">
                                    <p className="text-[8px] font-black text-muted uppercase tracking-widest ml-1">Weight</p>
                                    <input
                                      type="text"
                                      value={item.weight || ''}
                                      onChange={(e) => handleItemChange(idx, 'weight', e.target.value)}
                                      placeholder="e.g. 10 kg"
                                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-accent outline-none font-black"
                                      disabled={modalType === 'view'}
                                    />
                                  </div>
                                  <div className="flex-[0.5] space-y-1.5">
                                    <p className="text-[8px] font-black text-muted uppercase tracking-widest ml-1">L</p>
                                    <input
                                      type="number"
                                      value={item.length || ''}
                                      onChange={(e) => handleItemChange(idx, 'length', e.target.value)}
                                      placeholder="cm"
                                      className="w-full bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-xs text-white focus:border-accent outline-none font-black text-center"
                                      disabled={modalType === 'view'}
                                    />
                                  </div>
                                  <div className="flex-[0.5] space-y-1.5">
                                    <p className="text-[8px] font-black text-muted uppercase tracking-widest ml-1">W</p>
                                    <input
                                      type="number"
                                      value={item.width || ''}
                                      onChange={(e) => handleItemChange(idx, 'width', e.target.value)}
                                      placeholder="cm"
                                      className="w-full bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-xs text-white focus:border-accent outline-none font-black text-center"
                                      disabled={modalType === 'view'}
                                    />
                                  </div>
                                  <div className="flex-[0.5] space-y-1.5">
                                    <p className="text-[8px] font-black text-muted uppercase tracking-widest ml-1">H</p>
                                    <input
                                      type="number"
                                      value={item.height || ''}
                                      onChange={(e) => handleItemChange(idx, 'height', e.target.value)}
                                      placeholder="cm"
                                      className="w-full bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-xs text-white focus:border-accent outline-none font-black text-center"
                                      disabled={modalType === 'view'}
                                    />
                                  </div>
                                  {modalType !== 'view' && formData.items.length > 1 && (
                                    <div className="shrink-0 flex items-end">
                                      <button
                                        type="button"
                                        onClick={() => removeItem(idx)}
                                        className="p-2.5 text-danger/40 hover:text-danger hover:bg-danger/10 rounded-xl transition-all"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[8px] font-bold text-muted uppercase">Passenger Name</label>
                          <input type="text" value={formData.passengerInfo?.name || ''} onChange={(e) => setFormData({ ...formData, passengerInfo: { ...formData.passengerInfo, name: e.target.value } })} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs outline-none focus:border-accent" placeholder="VIP / Guest Name" disabled={modalType === 'view'} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-bold text-muted uppercase">Pax Count</label>
                          <input type="number" value={formData.passengerInfo?.count || 1} onChange={(e) => setFormData({ ...formData, passengerInfo: { ...formData.passengerInfo, count: e.target.value } })} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs outline-none focus:border-accent" disabled={modalType === 'view'} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-bold text-muted uppercase">Pickup Area</label>
                          <input type="text" value={formData.pickupLocation || ''} onChange={(e) => setFormData({ ...formData, pickupLocation: e.target.value })} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs outline-none focus:border-accent" placeholder="Lobby / Dock" disabled={modalType === 'view'} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-bold text-muted uppercase">Drop Location</label>
                          <input type="text" value={formData.dropLocation || ''} onChange={(e) => setFormData({ ...formData, dropLocation: e.target.value })} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs outline-none focus:border-accent" placeholder="Airport / Estate" disabled={modalType === 'view'} />
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-[8px] font-bold text-muted uppercase">Luggage Option</label>
                          <select className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs outline-none focus:border-accent appearance-none cursor-pointer" value={formData.luggage || 'No'} onChange={(e) => setFormData({ ...formData, luggage: e.target.value })} disabled={modalType === 'view'}>
                            <option>No</option>
                            <option>Standard</option>
                            <option>Heavy / Multi-piece</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted uppercase">Destination Matrix</label>
                    <select
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-accent outline-none font-bold appearance-none cursor-pointer"
                      value={formData.destinationType || 'Domestic'}
                      onChange={(e) => setFormData({ ...formData, destinationType: e.target.value })}
                      disabled={modalType === 'view'}
                    >
                      <option>Domestic</option>
                      <option>International</option>
                      <option>Private Island</option>
                      <option>Deep Sea</option>
                    </select>
                  </div>
                  {formData.destinationType === 'International' && (
                    <div className="space-y-1 sm:col-span-2 p-4 bg-accent/5 rounded-2xl border border-accent/20 flex items-center justify-between">
                      <div>
                        <label className="text-[10px] font-bold text-accent uppercase tracking-widest block">Customs Clearance Protocol</label>
                        <p className="text-[8px] text-muted">Required for border intersection at {formData.location || 'Terminal'}</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.customsClearance || false}
                        onChange={(e) => setFormData({ ...formData, customsClearance: e.target.checked })}
                        className="w-6 h-6 rounded-lg accent-accent"
                        disabled={modalType === 'view'}
                      />
                    </div>
                  )}
                  {/* Staff Payout Calculation */}
                  <div className="sm:col-span-2 p-4 bg-accent/5 border border-accent/20 rounded-2xl space-y-3">
                    <p className="text-[10px] font-black text-accent uppercase tracking-widest flex items-center gap-2 border-b border-accent/10 pb-2">
                      💰 Staff Payout Calculation
                    </p>
                    <p className="text-[9px] text-muted italic">Staff are paid a rate per km driven — NOT the full order total. Set the route distance and rate below.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-muted uppercase tracking-widest">Route Distance (km)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={formData.route_distance || ''}
                          onChange={(e) => handleDistanceOrRateChange('route_distance', e.target.value)}
                          placeholder="e.g. 25.5"
                          className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-accent"
                          disabled={modalType === 'view'}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-muted uppercase tracking-widest">Rate per km ($/km)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.staff_pay_rate ?? 2.50}
                          onChange={(e) => handleDistanceOrRateChange('staff_pay_rate', e.target.value)}
                          placeholder="e.g. 2.50"
                          className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-accent"
                          disabled={modalType === 'view'}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-muted uppercase tracking-widest">Staff Payout (auto)</label>
                        <div className="w-full bg-accent/10 border border-accent/30 rounded-xl px-3 py-2 text-xs font-black text-accent">
                          ${parseFloat(formData.delivery_fee || 0).toFixed(2)}
                        </div>
                        <p className="text-[8px] text-muted italic">{formData.route_distance ? `${formData.route_distance} km × $${parseFloat(formData.staff_pay_rate || 0).toFixed(2)}/km` : 'Enter distance to calculate'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[10px] font-bold text-muted uppercase tracking-[0.2em]">Logistics Protocol State</label>
                    <select
                      className="w-full bg-background border border-accent/20 rounded-xl px-4 py-3 text-sm focus:border-accent outline-none font-bold text-accent shadow-sm shadow-accent/5 transition-all appearance-none cursor-pointer"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      disabled={modalType === 'view'}
                    >
                      <option>Pending</option>
                      <option value="Pending Pickup">Awaiting Pickup</option>
                      <option value="In Transit">In Transit (Dispatched)</option>
                      <option>Re-routed</option>
                      <option>Failed</option>
                      <option>Completed</option>
                      <option>Delivered</option>
                    </select>
                  </div>
                </div>

                {/* Dynamic Mission State Monitor */}
                <div className="p-4 bg-accent/[0.03] border border-accent/10 rounded-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-3">
                    <Activity size={12} className="text-accent/30 animate-pulse" />
                  </div>
                  <label className="text-[9px] font-black text-accent uppercase tracking-widest mb-2 block">Dynamic Logistics Protocol Trace</label>
                  <div className="flex gap-4 items-center">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all ${formData.status === 'In Transit' ? 'bg-info/20 border-info text-info animate-pulse' :
                      formData.status === 'Pending' || formData.status === 'Pending Pickup' ? 'bg-warning/20 border-warning text-warning' :
                        formData.status === 'Completed' || formData.status === 'Delivered' ? 'bg-success/20 border-success text-success' : 'bg-muted/20 border-muted text-muted'
                      }`}>
                      <Navigation size={20} />
                    </div>
                    <div className="flex-1">
                      <h5 className="text-xs font-black text-white italic uppercase tracking-tighter">
                        {formData.status === 'Pending' ? 'Stage 00: Mission Initiation' :
                          formData.status === 'Pending Pickup' ? 'Stage 01: Procurement/Pickup Queue' :
                            formData.status === 'In Transit' ? 'Stage 02: Fleet Active / Intercept Point' :
                              formData.status === 'Delivered' ? 'Stage 03: Post-Transit Handover' :
                                formData.status === 'Completed' ? 'Stage 04: Mission Termination (Verified)' : 'Interrupted Command Chain'}
                      </h5>
                      <p className="text-[10px] text-muted font-bold mt-1">
                        {formData.status === 'Pending' ? 'Deployment authorized. Awaiting fleet coordinator dispatch.' :
                          formData.status === 'Pending Pickup' ? 'Stock identified. Asset awaiting field staff collection.' :
                            formData.status === 'In Transit' ? `Live tracking enabled. Pilot ${formData.driver || 'Elite Agent'} is mobile.` :
                              formData.status === 'Delivered' ? 'Item reached destination matrix. Awaiting signature/POD.' :
                                formData.status === 'Completed' ? 'Mission concluded. Proof of Delivery synchronized with ledger.' : 'Manual override status protocol active.'}
                      </p>
                    </div>
                  </div>

                  {/* Sub-context for live fleet data if dispatched */}
                  {formData.status === 'In Transit' && (
                    <div className="mt-3 pt-3 border-t border-accent/5 flex items-center justify-between text-[9px] uppercase font-black tracking-widest text-info">
                      <span className="flex items-center gap-1"><Truck size={10} /> Fleet Asset: {formData.vehicle || 'Live Unit'}</span>
                      <span className="flex items-center gap-1"><Clock size={10} /> Dispatch Time: {formData.dispatchedAt ? new Date(formData.dispatchedAt).toLocaleTimeString() : 'ActiveNow'}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Asset Manifest</label>
                  <div className="p-3 bg-white/5 border border-border rounded-xl space-y-2">
                    {(Array.isArray(formData.items) ? formData.items : []).map((item, idx) => (
                      <div key={idx} className="flex justify-between text-xs">
                        <span className="font-bold text-primary">{item.name || 'Provisioning Asset'}</span>
                        <span className="text-secondary text-right">x{item.qty}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {(formData.status === 'Completed' || formData.status === 'Delivered') && (
                  <div className="pt-4 border-t border-border/50">
                    <p className="text-[10px] font-black text-accent uppercase tracking-widest mb-3 flex items-center gap-2">
                      <CheckCircle2 size={12} /> Proof of Delivery (POD)
                    </p>

                    {/* Specialized Sea/Air Verification Option */}
                    {(formData.mode === 'Sea' || formData.mode === 'Air') && (
                      <div className="mb-4 p-3 bg-accent/5 border border-accent/20 rounded-xl">
                        <p className="text-[9px] font-bold text-accent uppercase mb-2">Carrier / Third-Party Verification</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[8px] font-bold text-muted uppercase">Agent / Carrier Name</label>
                            <input
                              type="text"
                              placeholder="e.g. DHL, Port Authority"
                              className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs focus:border-accent outline-none"
                              value={formData.pod?.carrierName || ''}
                              onChange={(e) => setFormData(prev => ({ ...prev, pod: { ...prev.pod, carrierName: e.target.value } }))}
                              disabled={modalType === 'view'}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] font-bold text-muted uppercase">{formData.mode === 'Sea' ? 'Bill of Lading (BoL)' : 'Air Waybill (AWB)'}</label>
                            <input
                              type="text"
                              placeholder="Ref Number"
                              className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs focus:border-accent outline-none"
                              value={formData.pod?.documentRef || ''}
                              onChange={(e) => setFormData(prev => ({ ...prev, pod: { ...prev.pod, documentRef: e.target.value } }))}
                              disabled={modalType === 'view'}
                            />
                          </div>
                        </div>
                        <p className="text-[8px] text-muted mt-2 italic">Note: Use this when no ZaneZion employee is present at the location.</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      {/* Image — file upload in edit, static display in view */}
                      <div className="space-y-2">
                        <label className="text-[8px] font-bold text-muted uppercase">Visual Evidence (Photo/Doc Scan)</label>
                        {modalType === 'edit' ? (
                          <div className="space-y-2">
                            <label className="relative aspect-video bg-white/5 border border-dashed border-accent/40 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-white/10 transition-all overflow-hidden group">
                              {formData.pod?.image ? (
                                <img src={formData.pod.image} className="absolute inset-0 w-full h-full object-cover rounded-xl" alt="POD" />
                              ) : (
                                <>
                                  <Camera size={20} className="text-accent" />
                                  <span className="text-[8px] font-bold text-accent mt-1">Upload Receipt/Photo</span>
                                </>
                              )}
                              <input
                                type="file"
                                accept="image/*"
                                className="sr-only"
                                onChange={(e) => {
                                  const file = e.target.files[0];
                                  if (!file) return;
                                  const reader = new FileReader();
                                  reader.onload = (ev) => setFormData(prev => ({ ...prev, pod: { ...prev.pod, image: ev.target.result } }));
                                  reader.readAsDataURL(file);
                                }}
                              />
                            </label>
                            {formData.pod?.image && (
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, pod: { ...prev.pod, image: null } }))}
                                className="text-[8px] text-danger font-bold uppercase tracking-wide"
                              >Remove Image</button>
                            )}
                          </div>
                        ) : (
                          <div className="aspect-video bg-white/5 border border-dashed border-border rounded-xl flex items-center justify-center overflow-hidden">
                            {formData.pod?.image
                              ? <img src={formData.pod.image} className="w-full h-full object-cover" alt="POD" />
                              : <span className="text-[8px] text-muted">No Evidence Provided</span>
                            }
                          </div>
                        )}
                      </div>

                      {/* Signature — text input in edit, styled display in view */}
                      <div className="space-y-2">
                        <label className="text-[8px] font-bold text-muted uppercase">Recipient Signature {formData.mode === 'Road' ? '*' : '(Optional if Carrier Verified)'}</label>
                        {modalType === 'edit' ? (
                          <>
                            <input
                              type="text"
                              placeholder="Recipient full name"
                              value={formData.pod?.signature || ''}
                              onChange={(e) => setFormData(prev => ({ ...prev, pod: { ...prev.pod, signature: e.target.value } }))}
                              className="w-full bg-background border border-accent/30 rounded-lg px-3 py-2 text-sm focus:border-accent outline-none font-bold italic placeholder:font-normal placeholder:not-italic placeholder:text-muted/50"
                            />
                            <p className="text-[8px] text-muted">{formData.mode === 'Road' ? '* Required for road transit' : 'Signature or Carrier Verification Required'}</p>
                          </>
                        ) : (
                          <div className="aspect-video bg-white/5 border border-dashed border-border rounded-xl flex items-center justify-center">
                            {formData.pod?.signature
                              ? <span className="text-sm font-bold italic underline decoration-accent">{formData.pod.signature}</span>
                              : (formData.pod?.carrierName ? <span className="text-[8px] text-accent font-bold uppercase text-center">Verified by<br />{formData.pod.carrierName}</span> : <span className="text-[8px] text-muted">No Signature</span>)
                            }
                          </div>
                        )}
                      </div>
                    </div>
                    {formData.pod?.actualTime && (
                      <p className="text-[10px] text-success font-bold mt-4 flex items-center gap-2">
                        <CheckCircle2 size={12} /> Institutional Dispatch Verified on {new Date(formData.pod.actualTime).toLocaleString()}
                      </p>
                    )}

                    {/* Client Confirmation Status (Admin Only) */}
                    {selectedDelivery.clientConfirmed && (
                      <div className="mt-4 p-3 bg-success/5 border border-success/20 rounded-xl">
                        <p className="text-[9px] font-bold text-success uppercase mb-1 flex items-center gap-1">
                          <CheckCircle2 size={10} /> Client Direct Acknowledgment
                        </p>
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-secondary italic">"I have received the items in perfect condition."</span>
                          <span className="font-bold text-white px-2 py-0.5 bg-success/20 rounded-md">
                            Verified by: {selectedDelivery.clientSignature}
                          </span>
                        </div>
                        <p className="text-[8px] text-muted mt-1 text-right">Confirmed via Client Portal at {new Date(selectedDelivery.clientConfirmedAt).toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 justify-end pt-6">
              <button onClick={() => setIsModalOpen(false)} className="btn-secondary">{modalType === 'view' ? 'Close' : 'Cancel'}</button>
              {modalType !== 'view' && (
                <button
                  onClick={handleSave}
                  disabled={createDeliveryMutation.isPending || updateDeliveryMutation.isPending || deleteDeliveryMutation.isPending || submitPODMutation.isPending}
                  className={`btn-primary ${modalType === 'delete' ? 'bg-danger hover:bg-danger/80 border-danger' : ''} disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
                >
                  {(createDeliveryMutation.isPending || updateDeliveryMutation.isPending || deleteDeliveryMutation.isPending || submitPODMutation.isPending) && (
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  )}
                  {modalType === 'delete' ? 'Confirm Termination' : 'Authenticate Dispatch'}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Deliveries;
