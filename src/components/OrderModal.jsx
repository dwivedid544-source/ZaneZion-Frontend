import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { Clock, MapPin, Plus, Trash2, Tag, DollarSign, Package, Printer, CheckCircle, Car, Navigation, User, Users, CheckCircle2, Calendar, Wifi, Coffee, Briefcase, ShieldCheck, ArrowRight } from 'lucide-react';
import CustomDatePicker from './CustomDatePicker';
import { useData } from '../context/GlobalDataContext';
import { calculateOSRMRouteDistance } from '../utils/distanceHelper';
import { ORDER_STATUS_OPTIONS, coerceOrderStatusToApi, isoDateSlice, displayOrderStatus } from '../utils/orderWorkflow';
import { normalizeRole, roleCanCreateInstitutionalOrder, roleCanUpdateOrderStatus } from '../utils/authUtils';
import { swalWarning } from '../utils/swal';
import { useOrder } from '../hooks/api/useOrders';
import { isClientBusinessAccount, getAssignedAccountManager, isOrderHeldFromFieldStaff } from '../utils/accountManagerService';

const todayIso = () => new Date().toISOString().split('T')[0];
const normalizeIsoDate = (v) => {
    if (!v) return '';
    const d = isoDateSlice(v);
    return d || '';
};
const clampDueDateToRequest = (requestDate, dueDate) => {
    const req = normalizeIsoDate(requestDate) || todayIso();
    const due = normalizeIsoDate(dueDate) || req;
    return due < req ? req : due;
};

const OrderModal = ({ isOpen, onClose, modalType, selectedOrder, onSave, onDelete, initialData, role }) => {
    const { currentUser, marketplaceVendors = [], vendors = [], clients, fetchVendors, fetchClients, customerUsers, fetchCustomerUsers, inventory = [], fetchInventory } = useData();
    const [currentModalType, setCurrentModalType] = useState(modalType);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);

    const allAvailableVendors = React.useMemo(() => {
        const list = [];
        const seen = new Set();
        [...(marketplaceVendors || []), ...(vendors || [])].forEach(v => {
            if (!v || !v.id) return;
            const key = String(v.id);
            if (!seen.has(key)) {
                seen.add(key);
                list.push(v);
            }
        });
        return list;
    }, [vendors, marketplaceVendors]);

    const { data: fetchedOrderData, isLoading: isFetchingDetails } = useOrder(
        isOpen && selectedOrder?.id && modalType !== 'add' ? selectedOrder.id : null
    );

    const effectiveOrder = fetchedOrderData?.data || selectedOrder;

    /** Logged-in user role drives permissions (parent `role` prop is often a portal default, e.g. ClientDashboard). */
    const portalRole = normalizeRole(currentUser?.role || role || '');
    const isLogisticsRole = portalRole === 'logistics';
    const isPersonalCustomer = portalRole === 'customer';

    const isBusinessClient = portalRole === 'client' || portalRole === 'saas_client';

    const canCreateManualOrder = (roleCanCreateInstitutionalOrder(portalRole) || isBusinessClient) && !isLogisticsRole;
    const canEditOrderStatus = (roleCanUpdateOrderStatus(portalRole) || isBusinessClient) && !isLogisticsRole;

    useEffect(() => {
        if (isLogisticsRole) {
            setCurrentModalType('view');
        } else {
            setCurrentModalType(modalType);
        }
        setIsDropdownOpen(false);
    }, [modalType, isOpen, isLogisticsRole]);

    const handleCancel = () => {
        if (modalType === 'view' && currentModalType === 'edit') {
            setCurrentModalType('view');
        } else {
            onClose();
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchVendors();
            fetchClients();
            fetchCustomerUsers();
        }
    }, [isOpen, fetchVendors, fetchClients, fetchCustomerUsers]);

    // Staff/concierge/admin roles see ALL clients (business + personal).
    // Customer/client roles see only personal accounts.
    const isStaffRole = ['superadmin', 'admin', 'operations', 'procurement', 'logistics', 'inventory', 'concierge', 'staff'].includes(portalRole);

    const customerOnlyForDropdown = React.useMemo(() => {
        const list = [];
        const seen = new Set();

        // 1. From clients table (Institutional / Corporate Clients)
        (clients || []).forEach((c) => {
            if (!c || !c.id) return;
            const name = c.companyName || c.name || c.contactPerson || c.business_name || c.company_name || `Client ${c.id}`;
            const email = c.email || '';
            const key = `client-${c.id}`;
            if (!seen.has(key)) {
                seen.add(key);
                list.push({
                    id: `client_${c.id}`,
                    rawId: c.id,
                    name: name,
                    email: email,
                    type: c.clientType || c.plan || 'Client',
                    source: 'client'
                });
            }
        });

        // 2. From customerUsers / users table (Portal Clients)
        (customerUsers || []).forEach((u) => {
            if (!u || !u.id) return;
            const roleStr = String(u.role?.name || u.role || '').toLowerCase();
            if (['superadmin', 'concierge', 'staff', 'admin', 'inventory', 'logistics', 'driver'].includes(roleStr)) {
                return;
            }
            const name = u.name || u.fullName || u.email || `User ${u.id}`;
            const email = u.email || '';
            const key = `user-${u.id}`;
            if (!seen.has(key)) {
                seen.add(key);
                list.push({
                    id: `user_${u.id}`,
                    rawId: u.clientId || u.company_id || u.id,
                    userId: u.id,
                    name: name,
                    email: email,
                    type: 'Personal',
                    source: 'user'
                });
            }
        });

        return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [clients, customerUsers]);
    const [formData, setFormData] = useState({
        client: '',
        clientId: '',
        items: [{ name: '', qty: 1, price: '' }],
        location: '',
        status: 'created',
        requestDate: new Date().toISOString().split('T')[0],
        dueDate: new Date().toISOString().split('T')[0],
        department: '',
        vendor: '',
        vendorId: '',
        isPreferredVendor: false,
        type: 'Custom Order',
        deliveryType: 'Road',
        transportAsset: '',
        transportAssetCustom: '',
        islandLocation: '',
        pickupLocation: '',
        pickupTime: '',
        totalDistance: '',
        serviceType: 'One Way',
        returnDate: '',
        returnTime: '',
        returnLocation: '',
        dailyDays: 1,
        luggage: '',
        stops: '',
        amenities: ''
    });

    useEffect(() => {
        // For client/customer role, find their customer record by email for proper name
        const myCustomerRecord = (portalRole === 'client' || portalRole === 'customer')
            ? clients.find(c => c.email?.toLowerCase() === currentUser?.email?.toLowerCase()) || null
            : null;

        if (modalType === 'add') {
            const requestDate = normalizeIsoDate(initialData?.requestDate) || todayIso();
            const dueDate = clampDueDateToRequest(requestDate, initialData?.dueDate || initialData?.date);

            let initialRaw = initialData?.items || initialData?.customItems || [];
            if (typeof initialRaw === 'string') {
                try {
                    initialRaw = JSON.parse(initialRaw);
                } catch (e) {
                    initialRaw = [];
                }
            }
            if (!Array.isArray(initialRaw)) {
                initialRaw = [];
            }
            let initialParsed = initialRaw.map(itm => {
                const name = itm.name || itm.item?.name || '';
                const qty = itm.qty || itm.quantity || 1;
                const price = itm.price !== undefined ? itm.price : (itm.unitPrice !== undefined ? itm.unitPrice : '');
                return {
                    name,
                    qty: Number(qty),
                    price: price !== '' ? Number(price) : ''
                };
            });
            if (initialParsed.length === 0 && (initialData?.product || initialData?.price)) {
                initialParsed = [{
                    name: initialData?.product || '',
                    qty: 1,
                    price: initialData?.price !== undefined && initialData?.price !== null ? Number(initialData?.price) : ''
                }];
            }
            if (initialParsed.length === 0) {
                initialParsed = [{ name: '', qty: 1, price: '' }];
            }

            setFormData({
                items: initialParsed,
                location: initialData?.location || '',
                status: coerceOrderStatusToApi(initialData?.status, 'created'),
                requestDate,
                dueDate,
                client: (portalRole === 'client' || portalRole === 'customer') ? (myCustomerRecord?.name || currentUser?.name) : (initialData?.client && initialData.client !== 'Select Client...' ? (typeof initialData.client === 'object' && initialData.client !== null ? (initialData.client.companyName || initialData.client.name || '') : initialData.client) : ''),
                clientId: (portalRole === 'client' || portalRole === 'customer') ? (myCustomerRecord?.id || currentUser?.id) : (initialData?.clientId || ''),
                department: initialData?.department || '',
                vendor: initialData?.vendor || '',
                vendorId: initialData?.vendorId || '',
                isPreferredVendor: false,
                type: initialData?.orderType || initialData?.type || 'Delivery',
                deliveryType: initialData?.deliveryType || initialData?.delivery_mode || initialData?.deliveryMode || initialData?.mode || 'Road',
                transportAsset: initialData?.transportAsset || initialData?.transport_asset || (initialData?.deliveryType === 'Air' ? 'Charter Jet' : (initialData?.deliveryType === 'Sea' ? 'Boat' : '')),
                transportAssetCustom: initialData?.transportAssetCustom || initialData?.transport_asset_custom || initialData?.charterDetails || initialData?.charter_details || '',
                islandLocation: initialData?.islandLocation || initialData?.island_location || '',
                pickupLocation: initialData?.pickupLocation || initialData?.pickup_location || '',
                pickupTime: initialData?.pickupTime || initialData?.pickup_time || '',
                totalDistance: initialData?.totalDistance || initialData?.total_distance || '',
                serviceType: initialData?.serviceType || 'One Way',
                returnDate: initialData?.returnDate || '',
                returnTime: initialData?.returnTime || '',
                returnLocation: initialData?.returnLocation || '',
                dailyDays: initialData?.dailyDays || 1,
                luggage: initialData?.luggage || '',
                stops: initialData?.stops || '',
                amenities: initialData?.amenities || ''
            });
        } else if (effectiveOrder) {
            let meta = effectiveOrder.metadata;
            if (typeof meta === 'string') {
                try {
                    meta = JSON.parse(meta);
                } catch (e) {
                    meta = {};
                }
            }
            const typeStr = String(effectiveOrder.orderType || effectiveOrder.type || '').toLowerCase();
            const kindStr = String(effectiveOrder.orderKind || effectiveOrder.order_kind || meta?.order_kind || meta?.type || '').toLowerCase();
            const firstItemName = String(effectiveOrder.items?.[0]?.name || effectiveOrder.product || '').toLowerCase();

            const isChauffeur = !typeStr.includes('marketplace') && 
                !typeStr.includes('product') && 
                !typeStr.includes('procurement') && 
                !typeStr.includes('provisioning') && 
                !typeStr.includes('inventory') && 
                !typeStr.includes('delivery') && 
                !typeStr.includes('custom order') && 
                !kindStr.includes('marketplace') && 
                (typeStr.includes('chauffeur') || kindStr.includes('chauffeur') || firstItemName.includes('chauffeur service') || firstItemName.startsWith('vip chauffeur'));
            const firstCustom = (meta?.customItems && meta.customItems[0]) || (effectiveOrder.customItems && effectiveOrder.customItems[0]) || (effectiveOrder.items && effectiveOrder.items[0]) || {};
            const passInfo = effectiveOrder.passenger_info || meta?.passenger_info || meta?.passengerInfo || firstCustom.passenger_info || firstCustom.passengerInfo || {};

            let rawItems = (effectiveOrder.items && effectiveOrder.items.length > 0) ? effectiveOrder.items : (effectiveOrder.customItems || meta?.customItems || []);
            if (typeof rawItems === 'string') {
                try {
                    rawItems = JSON.parse(rawItems);
                } catch (e) {
                    rawItems = [];
                }
            }
            if (!Array.isArray(rawItems)) {
                rawItems = [];
            }

            // Backward compatibility: If metadata.customItems has items that match the saved totalAmount, prioritize them
            const metaCustomList = Array.isArray(meta?.customItems) ? meta.customItems : (Array.isArray(effectiveOrder.customItems) ? effectiveOrder.customItems : []);
            if (metaCustomList.length > 0) {
                const metaSum = metaCustomList.reduce((acc, i) => acc + ((Number(i.qty || i.quantity || 1)) * (Number(i.price != null ? i.price : (i.unitPrice != null ? i.unitPrice : 0)))), 0);
                const orderTot = Number(effectiveOrder.totalAmount || effectiveOrder.total_amount || 0);
                if (orderTot > 0 && Math.abs(metaSum - orderTot) < 0.01) {
                    rawItems = metaCustomList;
                }
            }

            let parsedItems = [];
            if (isChauffeur) {
                const sType = firstCustom.serviceType || effectiveOrder.serviceType || 'One Way';
                const days = parseInt(effectiveOrder.numberOfDays || effectiveOrder.dailyDays || firstCustom.numberOfDays || firstCustom.dailyDays || 1, 10) || 1;
                const qtyMultiplier = sType === 'Round Trip' ? 2 : (sType === 'Daily Service' ? days : 1);
                const CHAUFFEUR_BASE = 120;
                const finalUnitPrice = CHAUFFEUR_BASE;

                parsedItems = [{
                    name: `VIP Chauffeur Service (${sType}${sType === 'Daily Service' ? ` - ${days} Days` : ''})`,
                    qty: qtyMultiplier,
                    price: finalUnitPrice
                }];
            } else {
                parsedItems = rawItems.map((itm, idx) => {
                    const name = itm.name || itm.item?.name || itm.itemName || itm.title || itm.description || `Item ${idx + 1}`;
                    const qty = parseInt(itm.qty || itm.quantity || 1) || 1;
                    const price = itm.unitPrice !== undefined ? itm.unitPrice
                        : itm.price !== undefined ? itm.price
                        : itm.unit_price !== undefined ? itm.unit_price
                        : itm.chauffeurFee !== undefined ? itm.chauffeurFee
                        : itm.chauffeur_fee !== undefined ? itm.chauffeur_fee
                        : '';
                    return {
                        name,
                        qty,
                        price: price !== '' && price !== null ? Number(price) : ''
                    };
                });
            }

            if (parsedItems.length === 0 && (effectiveOrder.product || effectiveOrder.qty)) {
                parsedItems = [{
                    name: effectiveOrder.product || '',
                    qty: parseInt(effectiveOrder.qty) || 1,
                    price: effectiveOrder.price !== undefined && effectiveOrder.price !== null ? Number(effectiveOrder.price) : ''
                }];
            }
            if (parsedItems.length === 0) {
                parsedItems = [{ name: '', qty: 1, price: '' }];
            }

            const requestDate = normalizeIsoDate(effectiveOrder.requestDate || effectiveOrder.order_date || effectiveOrder.created_at) || todayIso();
            const dueDate = clampDueDateToRequest(requestDate, effectiveOrder.dueDate || effectiveOrder.due_date);
            const existingClientId = effectiveOrder.clientId || effectiveOrder.client_id || '';
            const matchedDropdown = customerOnlyForDropdown.find(c =>
                String(c.rawId) === String(existingClientId)
            );

            const clientDisplayName = (typeof effectiveOrder.client === 'object' && effectiveOrder.client !== null ? (effectiveOrder.client.companyName || effectiveOrder.client.name || '') : effectiveOrder.client) || effectiveOrder.customer_name || effectiveOrder.created_by_name || '';
            const dropLoc = effectiveOrder.location || effectiveOrder.deliveryAddress || effectiveOrder.delivery_address || effectiveOrder.dropLocation || effectiveOrder.drop_location || firstCustom.dropLocation || firstCustom.location || firstCustom.deliveryAddress || meta?.location || meta?.deliveryAddress || meta?.delivery_address || meta?.dropLocation || meta?.drop_location || '';
            const pickLoc = effectiveOrder.pickupLocation || effectiveOrder.pickup_location || firstCustom.pickupLocation || firstCustom.pickup_location || meta?.pickupLocation || meta?.pickup_location || '';

            // Prioritize actual specific passenger name over generic 'personal client'
            const candidatePassengerNames = [
                firstCustom.passengerName,
                firstCustom.guestName,
                firstCustom.clientName,
                meta?.passengerName,
                meta?.guestName,
                meta?.client_name,
                passInfo.name,
                passInfo.passengerName,
                effectiveOrder.passengerName,
                effectiveOrder.guestName,
                effectiveOrder.customer_name,
                clientDisplayName
            ].filter(n => n && typeof n === 'string' && n.trim() && n.toLowerCase() !== 'personal client');

            const parsedGuestName = isChauffeur
                ? (candidatePassengerNames[0] || effectiveOrder.passengerName || effectiveOrder.guestName || firstCustom.passengerName || firstCustom.guestName || clientDisplayName || 'Executive Passenger')
                : '';

            // Prioritize actual passenger count over default 1 if custom items had it
            const candidatePax = [
                firstCustom.numberOfPassengers,
                firstCustom.passengers,
                firstCustom.passengerCount,
                passInfo.count,
                meta?.numberOfPassengers,
                meta?.passengers,
                meta?.passengerCount,
                effectiveOrder.numberOfPassengers,
                effectiveOrder.passengers,
                effectiveOrder.passengerCount
            ].map(p => parseInt(p, 10)).find(p => !isNaN(p) && p > 0);
            const parsedPax = candidatePax || 1;

            // Amenities & luggage
            const rawAmenities = [
                ...(Array.isArray(firstCustom.amenities) ? firstCustom.amenities : []),
                ...(Array.isArray(meta?.amenities) ? meta.amenities : []),
                ...(Array.isArray(effectiveOrder.amenities) ? effectiveOrder.amenities : []),
                ...(typeof firstCustom.amenities === 'string' ? firstCustom.amenities.split(',') : []),
                ...(typeof meta?.amenities === 'string' ? meta.amenities.split(',') : []),
                ...(typeof effectiveOrder.amenities === 'string' ? effectiveOrder.amenities.split(',') : [])
            ].map(s => s.trim()).filter(Boolean);
            const uniqueAmenities = [...new Set(rawAmenities)];
            const amenitiesStr = uniqueAmenities.join(', ');
            const amenitiesLower = uniqueAmenities.map(a => a.toLowerCase());

            const parsedWifi = (firstCustom.wifi === 'Yes' || meta?.wifi === 'Yes' || effectiveOrder.wifi === 'Yes' || amenitiesLower.some(a => a.includes('wifi'))) ? 'Yes' : 'No';
            const parsedRefreshments = (firstCustom.refreshments === 'Yes' || meta?.refreshments === 'Yes' || effectiveOrder.refreshments === 'Yes' || amenitiesLower.some(a => a.includes('refreshment'))) ? 'Yes' : 'No';
            const parsedCarSeat = (firstCustom.carSeat === 'Yes' || firstCustom.car_seat === 'Yes' || meta?.carSeat === 'Yes' || meta?.car_seat === 'Yes' || effectiveOrder.carSeat === 'Yes' || amenitiesLower.some(a => a.includes('car seat') || a.includes('baby'))) ? 'Yes' : 'No';

            const rawBags = [firstCustom.bags, meta?.bags, effectiveOrder.bags].map(b => parseInt(b, 10)).find(b => !isNaN(b) && b > 0) || 0;
            const parsedLuggage = (firstCustom.luggage && firstCustom.luggage !== 'No')
                ? (firstCustom.luggage.includes('bag') ? firstCustom.luggage : (rawBags > 0 ? `Yes — ${rawBags} bag(s)` : firstCustom.luggage))
                : (meta?.luggage && meta.luggage !== 'No'
                    ? (meta.luggage.includes('bag') ? meta.luggage : (rawBags > 0 ? `Yes — ${rawBags} bag(s)` : meta.luggage))
                    : (effectiveOrder.luggage && effectiveOrder.luggage !== 'No'
                        ? (effectiveOrder.luggage.includes('bag') ? effectiveOrder.luggage : (rawBags > 0 ? `Yes — ${rawBags} bag(s)` : effectiveOrder.luggage))
                        : (rawBags > 0 ? `Yes — ${rawBags} bag(s)` : 'No')));

            const parsedStops = (firstCustom.stops === 'Yes' || meta?.stops === 'Yes' || effectiveOrder.stops === 'Yes') ? 'Yes' : 'No';
            const parsedStopLocations = firstCustom.stopLocations || meta?.stopLocations || effectiveOrder.stopLocations || '';
            const parsedServiceType = firstCustom.serviceType || meta?.serviceType || effectiveOrder.serviceType || 'One Way';
            const parsedReturnDate = firstCustom.returnDate || meta?.returnDate || effectiveOrder.returnDate || '';
            const parsedReturnTime = firstCustom.returnTime || meta?.returnTime || effectiveOrder.returnTime || '';
            const parsedPickupTime = firstCustom.pickupTime || meta?.pickupTime || effectiveOrder.pickupTime || '';

            const initialDist = effectiveOrder.totalDistance || effectiveOrder.total_distance || effectiveOrder.distance || meta?.totalDistance || meta?.total_distance || meta?.distance_km || meta?.distanceKm || meta?.distance || firstCustom.totalDistance || firstCustom.total_distance || firstCustom.distance || '';
            const formattedDist = initialDist ? (String(initialDist).toLowerCase().includes('km') ? String(initialDist) : `${initialDist} km`) : '';

            const rawVendorId = effectiveOrder.vendorId || effectiveOrder.vendor_id || meta?.vendorId || meta?.vendor_id || effectiveOrder.metadata?.vendorId || effectiveOrder.metadata?.vendor_id || '';
            const rawVendorName = effectiveOrder.vendor || meta?.vendor || effectiveOrder.metadata?.vendor || meta?.vendor_name || '';

            const rawSavedType = effectiveOrder.orderType || effectiveOrder.type || meta?.orderType || meta?.type || '';
            const validOrderTypes = ['Procurement', 'Provisioning', 'Delivery', 'Inventory', 'Custom Order', 'Chauffeur Service'];
            const matchedType = validOrderTypes.find(opt => opt.toLowerCase() === String(rawSavedType).toLowerCase());
            const resolvedType = matchedType || (isChauffeur ? 'Chauffeur Service' : (rawSavedType || 'Delivery'));

            const directMode = (effectiveOrder.deliveryType && effectiveOrder.deliveryType !== 'Road')
                ? effectiveOrder.deliveryType
                : (effectiveOrder.delivery_mode || effectiveOrder.deliveryMode || meta?.delivery_mode || meta?.deliveryType || effectiveOrder.mode || effectiveOrder.deliveryType || 'Road');
            const loadedDeliveryType = directMode;
            const loadedTransportAsset = effectiveOrder.transportAsset || effectiveOrder.transport_asset || meta?.transportAsset || meta?.transport_asset || (loadedDeliveryType === 'Air' ? (effectiveOrder.transportAsset || meta?.transportAsset || 'Airplane') : (loadedDeliveryType === 'Sea' ? (effectiveOrder.transportAsset || meta?.transportAsset || 'Boat') : ''));
            const loadedTransportAssetCustom = effectiveOrder.transportAssetCustom || effectiveOrder.transport_asset_custom || effectiveOrder.charterDetails || effectiveOrder.charter_details || meta?.transportAssetCustom || meta?.transport_asset_custom || meta?.charter_details || meta?.charterDetails || '';
            const loadedIslandLocation = effectiveOrder.islandLocation || effectiveOrder.island_location || meta?.islandLocation || meta?.island_location || '';

            setFormData({
                client: clientDisplayName,
                clientId: existingClientId,
                clientDropdownId: matchedDropdown?.id || '',
                items: parsedItems,
                location: dropLoc,
                status: coerceOrderStatusToApi(effectiveOrder.status, 'created'),
                requestDate,
                dueDate,
                department: effectiveOrder.department || '',
                vendor: rawVendorName,
                vendorId: rawVendorId ? String(rawVendorId) : '',
                type: resolvedType,
                deliveryType: loadedDeliveryType,
                transportAsset: loadedTransportAsset,
                transportAssetCustom: loadedTransportAssetCustom,
                islandLocation: loadedIslandLocation,
                pickupLocation: pickLoc,
                pickupTime: isChauffeur ? parsedPickupTime : '',
                totalDistance: formattedDist,
                serviceType: isChauffeur ? parsedServiceType : 'One Way',
                returnDate: isChauffeur ? parsedReturnDate : '',
                returnTime: isChauffeur ? parsedReturnTime : '',
                returnLocation: isChauffeur ? (effectiveOrder.returnLocation || firstCustom.returnLocation || '') : '',
                dailyDays: isChauffeur ? (effectiveOrder.dailyDays || firstCustom.numberOfDays || meta?.numberOfDays || 1) : 1,
                luggage: parsedLuggage,
                passengerCount: isChauffeur ? parsedPax : '',
                passengerName: parsedGuestName,
                stops: parsedStops,
                stopLocations: parsedStopLocations,
                wifi: parsedWifi,
                refreshments: parsedRefreshments,
                carSeat: parsedCarSeat,
                amenities: isChauffeur ? amenitiesStr : ''
            });

            // If distance was missing, calculate it automatically in background
            if (!formattedDist && pickLoc && dropLoc) {
                calculateOSRMRouteDistance(pickLoc, dropLoc, effectiveOrder.deliveryType || 'Road').then(res => {
                    if (res && res.distanceKm != null) {
                        setFormData(prev => ({
                            ...prev,
                            totalDistance: `${res.distanceKm} km`
                        }));
                    }
                }).catch(() => {});
            }
        }
    }, [isOpen, effectiveOrder, modalType, customerOnlyForDropdown]);

    const triggerCalculateDistance = React.useCallback(async (pick, drop, mode) => {
        const p = (pick !== undefined ? pick : formData.pickupLocation) || '';
        const d = (drop !== undefined ? drop : formData.location) || '';
        const m = (mode !== undefined ? mode : formData.deliveryType) || 'Road';

        if (p.trim() && d.trim()) {
            setIsCalculatingDistance(true);
            try {
                const res = await calculateOSRMRouteDistance(p.trim(), d.trim(), m);
                if (res && res.distanceKm != null) {
                    setFormData(prev => ({ ...prev, totalDistance: String(res.distanceKm) }));
                }
            } catch (err) {
                console.warn('Distance calculation error:', err);
            } finally {
                setIsCalculatingDistance(false);
            }
        }
    }, [formData.pickupLocation, formData.location, formData.deliveryType]);

    useEffect(() => {
        // If we already have a loaded totalDistance from the database and locations haven't changed, keep it
        if (effectiveOrder) {
            const initialPickup = effectiveOrder.pickupLocation || effectiveOrder.pickup_location || '';
            const initialLocation = effectiveOrder.location || effectiveOrder.deliveryAddress || effectiveOrder.delivery_address || '';
            const initialMode = effectiveOrder.deliveryType || effectiveOrder.delivery_mode || effectiveOrder.deliveryMode || effectiveOrder.mode || 'Road';
            const initialDistance = effectiveOrder.totalDistance || effectiveOrder.total_distance || '';

            if (
                formData.pickupLocation === initialPickup &&
                formData.location === initialLocation &&
                formData.deliveryType === initialMode &&
                String(formData.totalDistance) === String(initialDistance) &&
                formData.totalDistance !== '' &&
                formData.totalDistance != null
            ) {
                return;
            }
        }

        // If in view mode and totalDistance is already present, no need to recalculate
        if (currentModalType === 'view' && formData.totalDistance) {
            return;
        }

        const timer = setTimeout(() => {
            if (formData.pickupLocation && formData.location) {
                triggerCalculateDistance(formData.pickupLocation, formData.location, formData.deliveryType);
            }
        }, currentModalType === 'view' ? 50 : 200);
        return () => clearTimeout(timer);
    }, [formData.pickupLocation, formData.location, formData.deliveryType, currentModalType, triggerCalculateDistance]);

    const handleAddItem = () => {
        setFormData({ ...formData, items: [...formData.items, { name: '', qty: 1, price: '' }] });
    };

    const handleRemoveItem = (index) => {
        const newItems = formData.items.filter((_, i) => i !== index);
        setFormData({ ...formData, items: newItems.length ? newItems : [{ name: '', qty: 1, price: '' }] });
    };

    const handleItemChange = (index, field, value) => {
        setFormData(prev => {
            const newItems = [...prev.items];
            newItems[index] = { ...newItems[index], [field]: value };
            return { ...prev, items: newItems };
        });
    };

    const calculateTotal = () => {
        return formData.items.reduce((acc, item) => acc + (parseFloat(item.price || 0) * (parseInt(item.qty) || 0)), 0).toFixed(2);
    };

    const isChauffeurOrder = React.useMemo(() => {
        const typeStr = String(formData.type || effectiveOrder?.orderType || effectiveOrder?.type || '').toLowerCase();
        const kindStr = String(effectiveOrder?.orderKind || effectiveOrder?.order_kind || effectiveOrder?.kind || effectiveOrder?.metadata?.order_kind || '').toLowerCase();
        const metaType = String(effectiveOrder?.metadata?.orderType || effectiveOrder?.metadata?.type || '').toLowerCase();
        const firstItemName = String(formData.items?.[0]?.name || effectiveOrder?.items?.[0]?.name || effectiveOrder?.product || '').toLowerCase();

        // Marketplace, procurement, provisioning, delivery, inventory, custom product orders are never chauffeur
        if (
            typeStr.includes('marketplace') || 
            typeStr.includes('procurement') || 
            typeStr.includes('provisioning') || 
            typeStr.includes('inventory') || 
            typeStr.includes('delivery') ||
            typeStr.includes('product') ||
            typeStr.includes('custom order') ||
            kindStr.includes('marketplace') ||
            metaType.includes('marketplace')
        ) {
            return false;
        }

        return (
            typeStr.includes('chauffeur') || 
            kindStr.includes('chauffeur') || 
            metaType.includes('chauffeur') || 
            firstItemName.includes('chauffeur service') || 
            firstItemName.startsWith('vip chauffeur')
        );
    }, [formData.type, formData.items, effectiveOrder]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (isLogisticsRole) {
            swalWarning('Logistics department has read-only access to order details.');
            return;
        }
        if (modalType === 'add' && !canCreateManualOrder) {
            swalWarning('Only staff can create orders. Customers can use Marketplace and view their orders.');
            return;
        }

        // Staff roles (including concierge) & B2B Clients must select a client explicitly
        const parsedClientId = formData.clientId ? Number(formData.clientId) : null;
        if (modalType === 'add' && (isStaffRole || isBusinessClient) && (!parsedClientId || isNaN(parsedClientId) || parsedClientId <= 0)) {
            swalWarning('Please select a client / customer to proceed.');
            return;
        }
        if (!formData.clientId && portalRole === 'customer') {
            swalWarning('Please select a client');
            return;
        }

        const requestDate = normalizeIsoDate(formData.requestDate) || todayIso();
        const dueDate = clampDueDateToRequest(requestDate, formData.dueDate);
        const payload = {
            ...formData,
            id: selectedOrder?.id,
            pickupLocation: formData.pickupLocation || '',
            location: formData.location || '',
            deliveryAddress: formData.location || '',
            dropLocation: formData.location || '',
            requestDate,
            dueDate,
            totalAmount: parseFloat(calculateTotal()),
            clientId: parsedClientId || Number(formData.clientId) || undefined,
            orderType: formData.type || (isChauffeurOrder ? 'Chauffeur Service' : 'Delivery'),
            type: formData.type || (isChauffeurOrder ? 'Chauffeur Service' : 'Delivery'),
            vendor: formData.vendor || '',
            vendorId: formData.vendorId ? (isNaN(Number(formData.vendorId)) ? formData.vendorId : Number(formData.vendorId)) : null,
            deliveryType: formData.deliveryType || 'Road',
            transportAsset: formData.transportAsset || '',
            transport_asset: formData.transportAsset || '',
            transportAssetCustom: formData.transportAssetCustom || '',
            transport_asset_custom: formData.transportAssetCustom || '',
            charterDetails: formData.transportAssetCustom || '',
            charter_details: formData.transportAssetCustom || '',
            islandLocation: formData.islandLocation || '',
            island_location: formData.islandLocation || ''
        };
        if (!canEditOrderStatus) {
            delete payload.status;
        }
        if (!isChauffeurOrder) {
            delete payload.passengerCount;
            delete payload.passengerName;
            delete payload.passengerInfo;
            delete payload.luggage;
            delete payload.stops;
            delete payload.stopLocations;
            delete payload.wifi;
            delete payload.refreshments;
            delete payload.carSeat;
            delete payload.amenities;
            delete payload.returnDate;
            delete payload.returnTime;
            delete payload.returnLocation;
        }
        onSave(payload, selectedOrder?.id);
    };

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title={
                    currentModalType === 'view' ? 'Order Details' :
                        currentModalType === 'edit' ? 'Edit Order' :
                            currentModalType === 'delete' ? 'Cancel Order' : 'Create New Order'
                }
            >
                {isFetchingDetails ? (
                    <div className="flex flex-col items-center justify-center py-10 space-y-4">
                        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-muted text-sm font-bold animate-pulse">Fetching complete order details...</p>
                    </div>
                ) : (
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        {modalType === 'delete' ? (
                            <div className="space-y-4">
                                <p className="text-secondary">Are you sure you want to cancel order <span className="text-primary font-bold">{selectedOrder?.id}</span>?</p>
                                <div className="flex gap-3 justify-end pt-4">
                                    <button type="button" onClick={onClose} className="btn-secondary">Keep Order</button>
                                    <button type="button" onClick={() => onDelete(selectedOrder.id)} className="px-6 py-2 bg-danger text-white rounded-lg font-bold">Cancel Order</button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {(currentModalType === 'view' || currentModalType === 'edit') && (
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-muted uppercase">Order ID</label>
                                            <input type="text" value={selectedOrder?.id || ''} className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none" disabled />
                                        </div>
                                    )}
                                    {(currentModalType === 'view' || currentModalType === 'edit') && (
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-muted uppercase">Status</label>
                                            <select
                                                value={formData.status}
                                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                                className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold"
                                                disabled={currentModalType === 'view' || !canEditOrderStatus}
                                            >
                                                {ORDER_STATUS_OPTIONS.map(({ value, label }) => (
                                                    <option key={value} value={value}>{label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                    {(portalRole !== 'client' && portalRole !== 'customer' || isBusinessClient) && (
                                        <div className={`space-y-1 relative ${modalType === 'add' ? 'col-span-1 md:col-span-2' : ''}`}>
                                            <label className="text-[10px] font-bold text-muted uppercase">
                                                Client / Customer
                                                {formData.client && modalType !== 'add' && (
                                                    <span className="ml-2 text-accent normal-case font-normal">
                                                        — {formData.client}
                                                    </span>
                                                )}
                                            </label>
                                            {currentModalType === 'view' ? (
                                                <div className="space-y-2">
                                                    <input
                                                        type="text"
                                                        value={formData.client || 'No Customer Assigned'}
                                                        className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm font-bold text-muted cursor-not-allowed"
                                                        disabled
                                                    />
                                                    {isClientBusinessAccount(effectiveOrder, clients) && (
                                                        <div className="p-3 rounded-lg bg-accent/10 border border-accent/25 flex flex-col gap-1">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[10px] font-black uppercase text-accent tracking-wider">
                                                                    Business Account • Direct Manager Control
                                                                </span>
                                                                <span className="text-[10px] font-bold text-white bg-accent/20 px-2 py-0.5 rounded">
                                                                    {getAssignedAccountManager(effectiveOrder, 'Assigned Account Manager')}
                                                                </span>
                                                            </div>
                                                            <span className="text-[10px] text-muted">
                                                                Field Staff Routing: {isOrderHeldFromFieldStaff(effectiveOrder, clients) ? 'Held under Account Manager supervision (Not visible to field staff)' : 'Released to Logistics / Field Drivers'}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="relative">
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                                        className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold text-left flex justify-between items-center text-white min-h-[38px]"
                                                    >
                                                        <span>
                                                            {formData.client
                                                                ? `${formData.client} (${customerOnlyForDropdown.find(c => c.id === formData.clientDropdownId)?.type || 'Account'})`
                                                                : 'Select Customer...'}
                                                        </span>
                                                        <span className="text-muted text-[10px]">▼</span>
                                                    </button>

                                                    {isDropdownOpen && (
                                                        <>
                                                            <div
                                                                className="fixed inset-0 z-[998]"
                                                                onClick={() => setIsDropdownOpen(false)}
                                                            />
                                                            <div className="absolute z-[999] w-full mt-1 bg-[#1a1a1a] border border-border rounded-lg shadow-xl max-h-48 overflow-y-auto font-bold text-sm">
                                                                <div
                                                                    onClick={() => {
                                                                        setFormData({
                                                                            ...formData,
                                                                            clientDropdownId: '',
                                                                            clientId: '',
                                                                            client: ''
                                                                        });
                                                                        setIsDropdownOpen(false);
                                                                    }}
                                                                    className="px-4 py-2 hover:bg-accent hover:text-black cursor-pointer text-muted"
                                                                >
                                                                    Select Customer...
                                                                </div>
                                                                {customerOnlyForDropdown.map(c => (
                                                                    <div
                                                                        key={c.id}
                                                                        onClick={() => {
                                                                            setFormData({
                                                                                ...formData,
                                                                                clientDropdownId: c.id,
                                                                                clientId: c.rawId,
                                                                                client: c.name
                                                                            });
                                                                            setIsDropdownOpen(false);
                                                                        }}
                                                                        className={`px-4 py-2 hover:bg-accent hover:text-black cursor-pointer text-white ${formData.clientDropdownId === c.id ? 'bg-accent/20 text-accent' : ''}`}
                                                                    >
                                                                        {c.name} ({c.type})
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {isChauffeurOrder && currentModalType === 'view' ? (
                                        <div className="col-span-1 md:col-span-2 space-y-4">
                                            {/* VIP Header Card */}
                                            <div className="p-4 rounded-2xl bg-gradient-to-r from-accent/15 via-accent/5 to-transparent border border-accent/30 flex items-center justify-between flex-wrap gap-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-11 h-11 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent shadow-lg shadow-accent/10">
                                                        <Car size={22} />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-accent">VIP Chauffeur Protocol</span>
                                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-white/10 text-white border border-white/10">
                                                                {formData.serviceType || 'One Way'}
                                                            </span>
                                                        </div>
                                                        <h3 className="text-base font-black italic tracking-tight text-white mt-0.5">
                                                            {formData.passengerName || formData.client || 'Executive Passenger'}
                                                        </h3>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[9px] font-black text-muted uppercase tracking-widest">Total Estimated Fare</p>
                                                    <p className="text-2xl font-black italic tracking-tight text-accent">${calculateTotal()}</p>
                                                </div>
                                            </div>

                                            {/* Route & Trajectory Card */}
                                            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4">
                                                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted flex items-center gap-1.5">
                                                        <Navigation size={12} className="text-accent" /> Journey Trajectory & Schedule
                                                    </span>
                                                    <span className="text-[10px] font-black text-accent uppercase tracking-wider bg-accent/10 px-2.5 py-0.5 rounded-md border border-accent/20">
                                                        {formData.totalDistance ? (String(formData.totalDistance).toLowerCase().includes('km') ? formData.totalDistance : `${formData.totalDistance} km`) : (isCalculatingDistance ? 'Calculating route...' : 'Direct Route')}
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
                                                    {/* Pickup Origin */}
                                                    <div className="p-3.5 rounded-xl bg-black/30 border border-white/5 space-y-1.5">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[9px] font-black uppercase tracking-widest text-accent flex items-center gap-1">
                                                                <MapPin size={11} /> Starting / Pickup
                                                            </span>
                                                            <span className="text-[9px] font-bold text-muted flex items-center gap-1">
                                                                <Clock size={10} /> {formData.pickupTime || 'As scheduled'}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm font-black text-white">{formData.pickupLocation || 'Not specified'}</p>
                                                        <p className="text-[10px] text-muted font-bold flex items-center gap-1">
                                                            <Calendar size={10} /> Date: {formData.requestDate || todayIso()}
                                                        </p>
                                                    </div>

                                                    {/* Drop Destination */}
                                                    <div className="p-3.5 rounded-xl bg-black/30 border border-white/5 space-y-1.5">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1">
                                                                <Navigation size={11} /> Destination / Drop-off
                                                            </span>
                                                            <span className="text-[9px] font-bold text-muted">
                                                                {formData.deliveryType || 'Executive Road Fleet'}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm font-black text-white">{formData.location || 'Not specified'}</p>
                                                        <p className="text-[10px] text-muted font-bold flex items-center gap-1">
                                                            <Clock size={10} /> Target Due: {formData.dueDate || formData.requestDate || todayIso()}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Return Schedule if Round Trip */}
                                                {formData.serviceType === 'Round Trip' && (
                                                    <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-between flex-wrap gap-2 text-xs">
                                                        <div className="flex items-center gap-2">
                                                            <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[9px] font-black uppercase tracking-wider">
                                                                Round Trip Return
                                                            </span>
                                                            <span className="text-white font-bold">
                                                                {formData.returnDate ? `Date: ${formData.returnDate}` : 'Return Date: As Scheduled'}
                                                            </span>
                                                        </div>
                                                        <span className="text-sky-300 font-bold text-[11px]">
                                                            {formData.returnTime ? `Return Departure: ${formData.returnTime}` : ''}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Passenger & Amenities Grid */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                                                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-muted flex items-center gap-1">
                                                        <Users size={11} className="text-accent" /> Passengers (PAX)
                                                    </span>
                                                    <p className="text-sm font-black text-white">{formData.passengerCount || 1} PAX</p>
                                                </div>

                                                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-muted flex items-center gap-1">
                                                        <Briefcase size={11} className="text-accent" /> Luggage
                                                    </span>
                                                    <p className="text-sm font-black text-white">{formData.luggage || 'Standard Luggage'}</p>
                                                </div>

                                                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-muted flex items-center gap-1">
                                                        <Wifi size={11} className="text-accent" /> On-Board Wi-Fi
                                                    </span>
                                                    <p className={`text-sm font-black ${formData.wifi === 'Yes' ? 'text-emerald-400' : 'text-muted'}`}>
                                                        {formData.wifi === 'Yes' ? '✓ Included' : 'No'}
                                                    </p>
                                                </div>

                                                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-muted flex items-center gap-1">
                                                        <Coffee size={11} className="text-accent" /> Refreshments
                                                    </span>
                                                    <p className={`text-sm font-black ${formData.refreshments === 'Yes' ? 'text-emerald-400' : 'text-muted'}`}>
                                                        {formData.refreshments === 'Yes' ? '✓ Included' : 'No'}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Extra Specs Bar */}
                                            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                                <div>
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-muted block mb-0.5">Child Safety Seat</span>
                                                    <span className={`font-bold ${formData.carSeat === 'Yes' ? 'text-emerald-400' : 'text-muted'}`}>
                                                        {formData.carSeat === 'Yes' ? '✓ Premium Child Safety Seat Included' : 'Not Requested'}
                                                    </span>
                                                </div>
                                                <div className="min-w-0">
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-muted block mb-0.5">Extra En-Route Stops</span>
                                                    <span className={`font-bold break-words break-all [overflow-wrap:anywhere] block ${formData.stops === 'Yes' ? 'text-white' : 'text-muted'}`}>
                                                        {formData.stops === 'Yes' ? `✓ Stops: ${formData.stopLocations || 'Requested'}` : 'Direct Journey (Non-stop)'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Fare Details */}
                                            <div className="p-4 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-between text-xs">
                                                <div className="space-y-0.5">
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-muted">Pricing Protocol</span>
                                                    <p className="text-white font-bold">
                                                        $120.00 base rate × {formData.serviceType === 'Round Trip' ? '2 (Round Trip)' : formData.dailyDays > 1 ? `${formData.dailyDays} Days` : '1 (One Way)'}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-muted">Final Amount</span>
                                                    <p className="text-lg font-black text-accent">${calculateTotal()}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="col-span-1 md:col-span-2 space-y-3">
                                                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                                                    <div className="flex flex-col">
                                                        <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">Institutional Requisition Items</label>
                                                        <p className="text-[9px] text-secondary italic uppercase tracking-tighter mt-0.5">Define multi-line asset specifications below</p>
                                                    </div>
                                                    {currentModalType !== 'view' && (
                                                        <button
                                                            type="button"
                                                            onClick={handleAddItem}
                                                            className="flex items-center gap-2 px-4 py-2 bg-accent/10 border border-accent/30 rounded-xl text-[10px] font-black text-accent hover:bg-accent hover:text-black transition-all shadow-lg shadow-accent/5 group"
                                                        >
                                                            <Plus size={14} className="group-hover:rotate-90 transition-transform duration-300" /> ADD ITEM PROTOCOL
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="space-y-4">
                                                    {(Array.isArray(formData.items) ? formData.items : []).map((item, index) => (
                                                        <div key={index} className="p-3 bg-white/[0.02] border border-border/50 rounded-2xl">
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div className="space-y-1">
                                                                    <label className="text-[9px] font-bold text-muted uppercase ml-1">Item Name</label>
                                                                    <div className="relative">
                                                                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={12} />
                                                                        <input
                                                                            type="text"
                                                                            list={`inventory-items-datalist-${index}`}
                                                                            value={item.name}
                                                                            onChange={(e) => {
                                                                                const val = e.target.value;
                                                                                handleItemChange(index, 'name', val);
                                                                                const matched = (inventory || []).find(inv => (inv.name || '').toLowerCase() === val.toLowerCase());
                                                                                if (matched) {
                                                                                    if (matched.price != null && !item.price) {
                                                                                        handleItemChange(index, 'price', matched.price);
                                                                                    }
                                                                                    const storeName = matched.store || matched.vendorName || matched.vendor;
                                                                                    if (storeName && !formData.vendor) {
                                                                                        setFormData(prev => ({ ...prev, vendor: storeName }));
                                                                                    }
                                                                                }
                                                                            }}
                                                                            placeholder="Type or select product..."
                                                                            className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-xs focus:border-accent outline-none font-bold"
                                                                            disabled={currentModalType === 'view'}
                                                                            required
                                                                        />
                                                                        <datalist id={`inventory-items-datalist-${index}`}>
                                                                            {(inventory || []).map((inv, iIdx) => (
                                                                                <option key={inv.id || iIdx} value={inv.name}>
                                                                                    {inv.name} - ${parseFloat(inv.price || 0).toFixed(2)} ({inv.vendorName || inv.store || 'Marketplace'})
                                                                                </option>
                                                                            ))}
                                                                        </datalist>
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <label className="text-[9px] font-bold text-muted uppercase ml-1">Qty</label>
                                                                    <input
                                                                        type="number"
                                                                        value={item.qty}
                                                                        onChange={(e) => handleItemChange(index, 'qty', e.target.value)}
                                                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs focus:border-accent outline-none text-center font-bold"
                                                                        disabled={currentModalType === 'view'}
                                                                        min="1"
                                                                        required
                                                                    />
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <label className="text-[9px] font-bold text-muted uppercase ml-1">Unit Price</label>
                                                                    <div className="relative">
                                                                        <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 text-muted" size={12} />
                                                                        <input
                                                                            type="number"
                                                                            value={item.price}
                                                                            onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                                                                            placeholder="0.00"
                                                                            className="w-full bg-background border border-border rounded-lg pl-6 pr-3 py-2 text-xs focus:border-accent outline-none font-bold"
                                                                            disabled={currentModalType === 'view'}
                                                                            step="0.01"
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-1 flex gap-2 items-end">
                                                                    <div className="flex-1 space-y-1">
                                                                        <label className="text-[9px] font-bold text-muted uppercase ml-1">Line Total</label>
                                                                        <div className="w-full bg-white/[0.04] border border-border rounded-lg px-3 py-2 text-xs text-accent font-black">
                                                                            ${(parseFloat(item.price || 0) * (parseInt(item.qty) || 0)).toFixed(2)}
                                                                        </div>
                                                                    </div>
                                                                    {currentModalType !== 'view' && formData.items.length > 1 && (
                                                                        <button type="button" onClick={() => handleRemoveItem(index)} className="p-2 mb-0.5 text-danger hover:bg-danger/10 rounded-lg transition-colors shrink-0">
                                                                            <Trash2 size={16} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                {currentModalType !== 'view' && (
                                                    <p className="text-[9px] text-muted italic">* Prices can be left empty if currently unknown (e.g. pending store visit).</p>
                                                )}

                                                <div className="flex justify-end pt-2 border-t border-white/5 mt-4">
                                                    <div className="text-right p-4 bg-accent/[0.03] border border-accent/10 rounded-2xl min-w-[200px]">
                                                        <p className="text-[10px] font-black text-muted uppercase tracking-widest">Grand Total (Estimated)</p>
                                                        <p className="text-2xl font-black text-accent">${calculateTotal()}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {isChauffeurOrder && currentModalType !== 'view' && (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-accent/5 rounded-2xl border border-accent/20 col-span-1 md:col-span-2">
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black text-accent uppercase tracking-widest">No. of Passengers (PAX)</label>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            value={formData.passengerCount || 1}
                                                            onChange={(e) => setFormData({ ...formData, passengerCount: e.target.value })}
                                                            className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm font-bold text-white outline-none focus:border-accent"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black text-accent uppercase tracking-widest">Guest Name / Passenger</label>
                                                        <input
                                                            type="text"
                                                            value={formData.passengerName || formData.client || ''}
                                                            onChange={(e) => setFormData({ ...formData, passengerName: e.target.value })}
                                                            className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm font-bold text-white outline-none focus:border-accent"
                                                            placeholder="Guest Name (Auto: Client Name)"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black text-accent uppercase tracking-widest">Luggage Option</label>
                                                        <input
                                                            type="text"
                                                            value={formData.luggage || 'No'}
                                                            onChange={(e) => setFormData({ ...formData, luggage: e.target.value })}
                                                            className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm font-bold text-white outline-none focus:border-accent"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black text-accent uppercase tracking-widest">Wi-Fi</label>
                                                        <select
                                                            value={formData.wifi || 'No'}
                                                            onChange={(e) => setFormData({ ...formData, wifi: e.target.value })}
                                                            className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm font-bold text-white outline-none focus:border-accent"
                                                        >
                                                            <option value="No">No</option>
                                                            <option value="Yes">Yes</option>
                                                        </select>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black text-accent uppercase tracking-widest">Refreshments</label>
                                                        <select
                                                            value={formData.refreshments || 'No'}
                                                            onChange={(e) => setFormData({ ...formData, refreshments: e.target.value })}
                                                            className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm font-bold text-white outline-none focus:border-accent"
                                                        >
                                                            <option value="No">No</option>
                                                            <option value="Yes">Yes</option>
                                                        </select>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black text-accent uppercase tracking-widest">Car Seat</label>
                                                        <select
                                                            value={formData.carSeat || 'No'}
                                                            onChange={(e) => setFormData({ ...formData, carSeat: e.target.value })}
                                                            className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm font-bold text-white outline-none focus:border-accent"
                                                        >
                                                            <option value="No">No</option>
                                                            <option value="Yes">Yes</option>
                                                        </select>
                                                    </div>
                                                    <div className="space-y-1 sm:col-span-2 md:col-span-3">
                                                        <label className="text-[10px] font-black text-accent uppercase tracking-widest">Extra Stops</label>
                                                        <input
                                                            type="text"
                                                            value={formData.stopLocations || ''}
                                                            onChange={(e) => setFormData({ ...formData, stopLocations: e.target.value, stops: e.target.value ? 'Yes' : 'No' })}
                                                            placeholder="En-route stop addresses (leave empty if none)"
                                                            className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm font-bold text-white outline-none focus:border-accent"
                                                        />
                                                    </div>
                                                    <div className="space-y-1 sm:col-span-2 md:col-span-3">
                                                        <label className="text-[10px] font-black text-accent uppercase tracking-widest">Service Protocol & Pricing</label>
                                                        <input
                                                            type="text"
                                                            value={`${formData.serviceType || 'One Way'}${formData.serviceType === 'Round Trip' ? ' (2× Round Trip Rate applied)' : formData.dailyDays > 1 ? ` (${formData.dailyDays} Days)` : ''}`}
                                                            onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
                                                            className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm font-bold text-white outline-none focus:border-accent"
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Starting / Pickup Location */}
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-muted uppercase">Starting / Pickup Location</label>
                                                <div className="relative">
                                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
                                                    <input
                                                        type="text"
                                                        value={formData.pickupLocation}
                                                        onChange={(e) => setFormData({ ...formData, pickupLocation: e.target.value })}
                                                        onBlur={() => triggerCalculateDistance()}
                                                        className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2 text-sm focus:border-accent outline-none font-bold"
                                                        disabled={currentModalType === 'view'}
                                                        placeholder="Enter starting / pickup location"
                                                    />
                                                </div>
                                            </div>

                                            {/* Destination / Delivery Location */}
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-muted uppercase">Destination / Delivery Location</label>
                                                <div className="relative">
                                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
                                                    <input
                                                        type="text"
                                                        value={formData.location}
                                                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                                        onBlur={() => triggerCalculateDistance()}
                                                        className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2 text-sm focus:border-accent outline-none font-bold"
                                                        disabled={currentModalType === 'view'}
                                                        placeholder="Enter destination / delivery address"
                                                    />
                                                </div>
                                            </div>

                                            {/* Total Distance */}
                                            <div className="space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-[10px] font-bold text-accent uppercase tracking-widest pl-1">Total Distance (km)</label>
                                                    {isCalculatingDistance ? (
                                                        <span className="text-[9px] text-accent font-bold animate-pulse">Calculating...</span>
                                                    ) : (
                                                        currentModalType !== 'view' && formData.pickupLocation && formData.location && (
                                                            <button
                                                                type="button"
                                                                onClick={() => triggerCalculateDistance()}
                                                                className="text-[9px] text-accent hover:underline font-bold"
                                                            >
                                                                Recalculate
                                                            </button>
                                                        )
                                                    )}
                                                </div>
                                                <input
                                                    type="text"
                                                    value={formData.totalDistance}
                                                    onChange={(e) => setFormData({ ...formData, totalDistance: e.target.value })}
                                                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm text-accent font-black focus:border-accent outline-none"
                                                    disabled={currentModalType === 'view'}
                                                    placeholder={isCalculatingDistance ? "Calculating route distance..." : "Distance auto-calculated..."}
                                                />
                                            </div>

                                            <div className="space-y-3 pt-2">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-[10px] font-bold text-muted uppercase">Vendor (Optional)</label>
                                                </div>

                                                <select
                                                    value={formData.vendorId ? String(formData.vendorId) : ''}
                                                    onChange={(e) => {
                                                        const selectedVal = e.target.value;
                                                        const selectedVendor = allAvailableVendors.find(v => String(v.id) === String(selectedVal));
                                                        setFormData({
                                                            ...formData,
                                                            vendorId: selectedVal,
                                                            vendor: selectedVendor ? (selectedVendor.name || selectedVendor.companyName || '') : ''
                                                        });
                                                    }}
                                                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold"
                                                    disabled={currentModalType === 'view'}
                                                >
                                                    <option value="">Select Vendor...</option>
                                                    {allAvailableVendors.map(v => (
                                                        <option key={v.id} value={String(v.id)}>{v.name || v.companyName} {v.category ? `(${v.category})` : ''}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </>
                                    )}

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-muted uppercase">Request Date</label>
                                        <input type="text" value={formData.requestDate} disabled className="w-full bg-background/50 border border-border rounded-lg px-4 py-2 text-sm text-muted focus:outline-none" />
                                    </div>
                                    <div className="space-y-1">
                                        <CustomDatePicker
                                            label="Due Date"
                                            disabled={currentModalType === 'view'}
                                            selectedDate={formData.dueDate}
                                            onChange={(date) => setFormData({ ...formData, dueDate: clampDueDateToRequest(formData.requestDate, date) })}
                                        />
                                        {currentModalType === 'view' && effectiveOrder?.createdAt && (
                                            <p className="text-[9px] text-muted italic mt-1">Requested On: {new Date(effectiveOrder.createdAt).toLocaleDateString()}</p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Logistics Transport Mode</label>
                                        <div className="flex gap-2">
                                            {['Road', 'Sea', 'Air'].map((mode) => (
                                                <button
                                                    key={mode}
                                                    type="button"
                                                    onClick={() => setFormData({
                                                        ...formData,
                                                        deliveryType: mode,
                                                        transportAsset: mode === 'Air' ? (formData.transportAsset || 'Charter Jet') : mode === 'Sea' ? (formData.transportAsset || 'Boat') : ''
                                                    })}
                                                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter border transition-all ${formData.deliveryType === mode
                                                        ? 'bg-accent/20 border-accent text-accent shadow-lg shadow-accent/5'
                                                        : 'bg-white/5 border-white/10 text-muted hover:border-white/30'
                                                        }`}
                                                    disabled={currentModalType === 'view'}
                                                >
                                                    {mode}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Air / Sea Transport & Charter Details Section */}
                                        {(formData.deliveryType === 'Air' || formData.deliveryType === 'Sea') && (
                                            <div className="p-3.5 bg-accent/5 border border-accent/20 rounded-xl space-y-3 mt-2">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-[10px] font-black text-accent uppercase tracking-widest">
                                                        {formData.deliveryType === 'Air' ? '✈ Air Charter & Aircraft Fleet' : '🛥 Sea Logistics & Marine Vessel'}
                                                    </label>
                                                </div>

                                                {/* Preset asset buttons */}
                                                <div className="flex gap-2">
                                                    {(formData.deliveryType === 'Air' 
                                                        ? ['Charter Jet', 'Airplane', 'Cargo Plane'] 
                                                        : ['Boat', 'Cargo Boat', 'Ferry']
                                                    ).map((asset) => (
                                                        <button
                                                            key={asset}
                                                            type="button"
                                                            disabled={currentModalType === 'view'}
                                                            onClick={() => setFormData({ ...formData, transportAsset: asset })}
                                                            className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
                                                                (formData.transportAsset || (formData.deliveryType === 'Air' ? 'Charter Jet' : 'Boat')) === asset
                                                                    ? 'bg-accent/20 border-accent text-accent shadow-sm'
                                                                    : 'bg-white/5 border-white/10 text-muted hover:border-white/30'
                                                            }`}
                                                        >
                                                            {asset}
                                                        </button>
                                                    ))}
                                                </div>

                                                {/* Custom charter or tail number / vessel notes */}
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-bold text-muted uppercase">
                                                        {formData.deliveryType === 'Air' ? 'Charter Specs / Tail Number / Instructions' : 'Vessel Specs / Tender Name / Instructions'}
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={formData.transportAssetCustom || ''}
                                                        onChange={(e) => setFormData({ ...formData, transportAssetCustom: e.target.value })}
                                                        placeholder={formData.deliveryType === 'Air' ? 'e.g. Private Charter Jet, tail number, flight notes' : 'e.g. Private tender, yacht name, marina berth'}
                                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-white focus:border-accent outline-none font-bold placeholder:text-muted/40"
                                                        disabled={currentModalType === 'view'}
                                                    />
                                                </div>

                                                {/* Island / Airstrip dispatch location */}
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-bold text-muted uppercase">
                                                        {formData.deliveryType === 'Air' ? 'Airstrip / Island Location' : 'Jetty / Marina / Island Location'}
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={formData.islandLocation || ''}
                                                        onChange={(e) => setFormData({ ...formData, islandLocation: e.target.value })}
                                                        placeholder={formData.deliveryType === 'Air' ? 'e.g. Exuma Airstrip, Staniel Cay' : 'e.g. Paradise Island Jetty, Blue Lagoon'}
                                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-white focus:border-accent outline-none font-bold placeholder:text-muted/40"
                                                        disabled={currentModalType === 'view'}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-muted uppercase">Order Type</label>
                                        <select
                                            value={formData.type}
                                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                            className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold"
                                            disabled={currentModalType === 'view'}
                                        >
                                            <option>Procurement</option>
                                            <option>Provisioning</option>
                                            <option>Delivery</option>
                                            <option>Inventory</option>
                                            <option>Custom Order</option>
                                            <option>Chauffeur Service</option>
                                        </select>
                                    </div>
                                </div>

                                {currentModalType === 'view' && effectiveOrder?.createdAt && (
                                    <div className="mt-6 p-4 bg-white/5 rounded-xl border border-border space-y-4">
                                        <div className="flex items-center gap-3 text-sm">
                                            <Clock size={16} className="text-accent" />
                                            <span className="text-secondary">Created At:</span>
                                            <span className="font-bold">{new Date(effectiveOrder.createdAt).toLocaleString()}</span>
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-3 justify-end pt-6">
                                    <button type="button" onClick={handleCancel} className="btn-secondary">{currentModalType === 'view' ? 'Close' : 'Cancel'}</button>
                                    {currentModalType === 'view' && (
                                        <button type="button" onClick={() => window.print()} className="btn-primary flex items-center gap-2">
                                            <Printer size={16} /> Print Acknowledgement
                                        </button>
                                    )}
                                    {currentModalType === 'view' && canCreateManualOrder && (
                                        <button type="button" onClick={() => setCurrentModalType('edit')} className="px-6 py-2.5 bg-accent border border-accent/50 text-black rounded-xl text-xs font-black uppercase tracking-widest hover:bg-accent/80 shadow-lg shadow-accent/20">
                                            Edit Details
                                        </button>
                                    )}
                                    {currentModalType !== 'view' && canCreateManualOrder && (
                                        <button type="submit" className="btn-primary">Save Order</button>
                                    )}
                                </div>
                            </div>
                        )}
                    </form>
                )}
            </Modal>
            {isOpen && !isFetchingDetails && currentModalType === 'view' && effectiveOrder && (
                <div className="hidden invoice-print-container bg-white text-black font-sans">
                    <div className="w-full flex-1 flex flex-col">
                        {/* Sovereign Header */}
                        <div className="flex justify-between items-start border-b-[3px] border-black pb-4 mb-4 print-section">
                            <div className="flex items-center gap-5">
                                <div>
                                    <h1 className="text-xl font-black italic uppercase tracking-tighter leading-none">ZANEZION</h1>
                                    <p className="text-[8px] font-black uppercase tracking-[0.2em] mt-0.5 opacity-80">Institutional Asset & Fiscal Management</p>
                                    <div className="mt-1.5 text-[7px] font-bold uppercase text-gray-400 tracking-widest leading-none">
                                        Nassau, Bahamas | Sovereign HQ | Client Services
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <h2 className="text-lg font-black text-black tracking-tighter italic border-b border-black inline-block mb-1 uppercase">Order Acknowledgement</h2>
                                <p className="text-[9px] font-black text-gray-400 mt-0.5">PROTOCOL ID: {effectiveOrder.id}</p>
                                <p className="text-[7px] font-black uppercase tracking-widest leading-none">ISSUED. {effectiveOrder.createdAt ? new Date(effectiveOrder.createdAt).toLocaleDateString() : effectiveOrder.date || formData.requestDate}</p>
                            </div>
                        </div>

                        {/* Counterparty & Status Section */}
                        <div className="grid grid-cols-2 gap-8 mb-6 px-1 print-section">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-gray-100 rounded-lg"><CheckCircle size={16} className="text-gray-400" /></div>
                                <div>
                                    <p className="text-[6px] font-black uppercase tracking-[0.2em] opacity-40 mb-1">Billed Entity</p>
                                    <p className="text-base font-black italic tracking-tight uppercase leading-tight">{formData.client || (typeof effectiveOrder.client === 'object' && effectiveOrder.client ? (effectiveOrder.client.companyName || effectiveOrder.client.name) : effectiveOrder.client) || 'Institutional Account'}</p>
                                    <div className="flex items-center gap-2 mt-1 opacity-70">
                                        <span className="px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded text-[6px] font-black uppercase tracking-widest">Corp / High-Net</span>
                                        <p className="text-[7px] font-black mt-1 text-gray-400">REGISTRY: {formData.clientId || effectiveOrder.clientId || 'ZN-ACC-EXT'}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right flex flex-col justify-end">
                                <div className="inline-block px-3 py-1.5 border-[2px] border-black text-black">
                                    <p className="text-[8px] font-black uppercase tracking-widest skew-x-12 leading-none">Status: {displayOrderStatus(effectiveOrder?.status || formData.status)}</p>
                                </div>
                                <div className="mt-2">
                                    <p className="text-[6px] font-black uppercase tracking-widest opacity-40 mb-0.5 leading-none">Required By:</p>
                                    <p className="text-sm font-black italic uppercase leading-none">{formData.dueDate || 'Immediate Action'}</p>
                                </div>
                            </div>
                        </div>

                        {/* High-Resolution Itemized Ledger */}
                        <div className="mb-6 print-section">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-y border-black">
                                        <th className="text-left py-2 px-2 text-[8px] font-black uppercase tracking-widest">Description of Sourcing / Service Protocol</th>
                                        <th className="text-center py-2 px-2 text-[8px] font-black uppercase tracking-widest w-16">Qty</th>
                                        <th className="text-right py-2 px-2 text-[8px] font-black uppercase tracking-widest w-32">Valuation (USD)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {formData.items.map((item, idx) => (
                                        <tr key={idx} className="border-b border-gray-100">
                                            <td className="py-3 px-2">
                                                <div className="flex flex-col gap-0.5">
                                                    <p className="font-black text-sm italic tracking-tight uppercase leading-tight">{item.name}</p>
                                                    <p className="text-[7px] text-gray-400 font-bold uppercase tracking-widest italic leading-none">{formData.type}</p>
                                                </div>
                                            </td>
                                            <td className="text-center py-3 px-2 font-black italic text-xs opacity-40 leading-none">{item.qty || 1}</td>
                                            <td className="text-right py-3 px-2">
                                                <span className="text-sm font-black tracking-tighter">
                                                    ${(parseFloat(item.price || 0) * parseInt(item.qty || 1)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Financial Totals & Verification */}
                        <div className="flex justify-end mb-6 pr-2 print-section">
                            <div className="w-64">
                                <div className="flex justify-between items-center py-1.5 border-t border-black mb-1.5">
                                    <p className="text-[8px] font-black uppercase tracking-tighter opacity-100 italic">Estimated Subtotal</p>
                                    <span className="text-sm font-bold italic">${parseFloat(calculateTotal()).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-black text-white rounded-none">
                                    <div className="flex flex-col">
                                        <p className="text-[6px] font-black uppercase tracking-widest opacity-60">Total Estimated</p>
                                        <p className="text-[7px] font-bold leading-none mt-0.5">Fiscal Assessment</p>
                                    </div>
                                    <h3 className="text-xl font-black italic tracking-tighter">${parseFloat(calculateTotal()).toLocaleString(undefined, { minimumFractionDigits: 2 })} USD</h3>
                                </div>
                                <p className="text-[6px] text-gray-400 font-bold italic mt-1.5 text-right uppercase tracking-widest">Auth Code: ZZ-{effectiveOrder.id}</p>
                            </div>
                        </div>

                        {/* Legal & Sovereign Terms */}
                        <div className="p-4 bg-gray-50 border-l-[6px] border-black italic print-section mb-6">
                            <h4 className="text-[8px] font-black uppercase tracking-[0.05em] mb-2 text-black underline leading-none">Order Acknowledgement Protocol</h4>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="text-[6px] text-gray-400 leading-normal uppercase font-bold text-justify">
                                    1. <strong>Commitment:</strong> This document represents an official acknowledgement of the requested services/sourcing items.
                                    2. <strong>Verification:</strong> All sourcing is strictly conducted in line with international fiscal compliance and asset authentication protocols.
                                </div>
                                <div className="text-[6px] text-gray-400 leading-normal uppercase font-bold text-justify">
                                    3. <strong>Jurisdiction:</strong> Execution and interactions are governed by the sovereign laws of the Commonwealth of the Bahamas.
                                    4. <strong>Logistics:</strong> Delivery times are approximations contingent on strategic freight movements and customs clearance.
                                </div>
                            </div>
                        </div>

                        {/* Footer Authenticator */}
                        <div className="mt-auto pt-4 border-t border-gray-100 flex justify-between items-end print-section">
                            <div>
                                <p className="text-[6px] font-black uppercase tracking-[0.2em] opacity-30 mb-0.5 italic">Authorized Service Signature</p>
                                <div className="relative">
                                    <div className="w-48 h-[1px] bg-black/20" />
                                    <p className="absolute -top-3 left-1 font-black italic text-gray-300 text-[10px] opacity-20 select-none uppercase tracking-tighter leading-none">Director of Global Operations</p>
                                </div>
                                <p className="text-[7px] font-black mt-1.5 uppercase tracking-widest leading-none">Client Services Division | ZANEZION INTELLIGENCE</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[6px] font-black uppercase tracking-[0.3em] opacity-30 mb-0.5">HASH: ZZ-ORD-{Date.now().toString(16).slice(-6).toUpperCase()}</p>
                                <p className="text-[8px] font-black tracking-tighter italic leading-none">VERIFIED ORDER PROTOCOL v1.1 // NASSAU HQ</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default OrderModal;
