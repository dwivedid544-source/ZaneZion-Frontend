import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { Clock, MapPin, Plus, Trash2, Tag, DollarSign, Package, Printer } from 'lucide-react';
import CustomDatePicker from './CustomDatePicker';
import { useData } from '../context/GlobalDataContext';
import { calculateOSRMRouteDistance } from '../utils/distanceHelper';
import { ORDER_STATUS_OPTIONS, coerceOrderStatusToApi, isoDateSlice, displayOrderStatus } from '../utils/orderWorkflow';
import { normalizeRole, roleCanCreateInstitutionalOrder, roleCanUpdateOrderStatus } from '../utils/authUtils';
import { swalWarning } from '../utils/swal';

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
    const { currentUser, marketplaceVendors = [], clients, fetchVendors, fetchClients, customerUsers, fetchCustomerUsers } = useData();
    const [currentModalType, setCurrentModalType] = useState(modalType);

    useEffect(() => {
        setCurrentModalType(modalType);
    }, [modalType, isOpen]);

    const handleCancel = () => {
        if (modalType === 'view' && currentModalType === 'edit') {
            setCurrentModalType('view');
        } else {
            onClose();
        }
    };

    /** Logged-in user role drives permissions (parent `role` prop is often a portal default, e.g. ClientDashboard). */
    const portalRole = normalizeRole(currentUser?.role || role || '');
    const isPersonalCustomer = portalRole === 'customer';
    const canCreateManualOrder = roleCanCreateInstitutionalOrder(portalRole);
    const canEditOrderStatus = roleCanUpdateOrderStatus(portalRole);

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
        const fromClients = (clients || [])
            .filter((c) => {
                // Staff roles: show all clients regardless of type
                if (isStaffRole) return true;
                // Customer/non-staff: show only personal/individual accounts
                const ct = String(c.client_type || c.clientType || '').trim().toLowerCase();
                const tt = String(c.tenant_type || c.tenantType || '').trim().toLowerCase();
                const role = String(c.role || c.user_role || '').trim().toLowerCase();
                return ct === 'personal' || ct === 'individual' || tt === 'personal' || role === 'customer';
            })
            .map((c) => ({
                id: `client_${c.id}`,
                rawId: c.id,
                name: c.name || c.companyName || c.contactPerson || c.business_name || c.company_name || '',
                email: c.email,
                type: isStaffRole
                    ? (String(c.client_type || c.clientType || 'Business').trim() || 'Business')
                    : 'Personal Account',
                source: 'client',
            }));

        const fromUsers = (customerUsers || []).map((u) => ({
            id: `user_${u.id}`,
            rawId: u.id,
            name: u.name,
            email: u.email,
            type: 'Personal Account',
            source: 'user',
        }));

        // Deduplicate by email first, then by name fallback.
        const seen = new Set();
        const merged = [...fromClients, ...fromUsers].filter((x) => {
            const key = (x.email || '').trim().toLowerCase() || `name:${String(x.name || '').trim().toLowerCase()}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        return merged;
    }, [clients, customerUsers, isStaffRole]);
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
                type: initialData?.orderType || initialData?.type || 'Custom Order',
                deliveryType: initialData?.deliveryType || initialData?.delivery_mode || initialData?.deliveryMode || initialData?.mode || 'Road',
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
        } else if (selectedOrder) {
            let meta = selectedOrder.metadata;
            if (typeof meta === 'string') {
                try {
                    meta = JSON.parse(meta);
                } catch (e) {
                    meta = {};
                }
            }
            const isChauffeur = String(selectedOrder.orderType || selectedOrder.type || '').toLowerCase() === 'chauffeur';
            const firstCustom = (meta?.customItems && meta.customItems[0]) || {};

            let rawItems = selectedOrder.items || selectedOrder.customItems || meta?.customItems;
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

            let parsedItems = [];
            if (isChauffeur) {
                parsedItems = [{
                    name: `Chauffeur Service (${firstCustom.serviceType || 'Ride'})`,
                    qty: 1,
                    price: firstCustom.chauffeurFee || firstCustom.chauffeur_fee || 0
                }];
            } else {
                parsedItems = rawItems.map(itm => {
                    const name = itm.name || itm.item?.name || '';
                    const qty = itm.qty || itm.quantity || 1;
                    const price = itm.price !== undefined ? itm.price : (itm.unitPrice !== undefined ? itm.unitPrice : '');
                    return {
                        name,
                        qty: Number(qty),
                        price: price !== '' ? Number(price) : ''
                    };
                });
            }

            if (parsedItems.length === 0 && (selectedOrder.product || selectedOrder.qty)) {
                parsedItems = [{
                    name: selectedOrder.product || '',
                    qty: parseInt(selectedOrder.qty) || 1,
                    price: selectedOrder.price !== undefined && selectedOrder.price !== null ? Number(selectedOrder.price) : ''
                }];
            }
            if (parsedItems.length === 0) {
                parsedItems = [{ name: '', qty: 1, price: '' }];
            }

            const requestDate = normalizeIsoDate(selectedOrder.requestDate || selectedOrder.order_date || selectedOrder.created_at) || todayIso();
            const dueDate = clampDueDateToRequest(requestDate, selectedOrder.dueDate || selectedOrder.due_date);
            // Try to match existing order's client in dropdown list
            const existingClientId = selectedOrder.clientId || selectedOrder.client_id || '';
            const matchedDropdown = customerOnlyForDropdown.find(c =>
                String(c.rawId) === String(existingClientId)
            );
            
            const dropLoc = selectedOrder.location || selectedOrder.deliveryAddress || selectedOrder.delivery_address || firstCustom.dropLocation || firstCustom.location || '';
            const pickLoc = selectedOrder.pickupLocation || selectedOrder.pickup_location || firstCustom.pickupLocation || '';

            setFormData({
                client: (typeof selectedOrder.client === 'object' && selectedOrder.client !== null ? (selectedOrder.client.companyName || selectedOrder.client.name || '') : selectedOrder.client) || selectedOrder.customer_name || selectedOrder.created_by_name || '',
                clientId: existingClientId,
                clientDropdownId: matchedDropdown?.id || '',
                items: parsedItems,
                location: dropLoc,
                status: coerceOrderStatusToApi(selectedOrder.status, 'created'),
                requestDate,
                dueDate,
                department: selectedOrder.department || '',
                vendor: selectedOrder.vendor || '',
                vendorId: selectedOrder.vendorId || selectedOrder.vendor_id || '',
                isPreferredVendor: !!(selectedOrder.vendorId || selectedOrder.vendor_id),
                type: selectedOrder.orderType || selectedOrder.type || 'Custom Order',
                deliveryType: selectedOrder.deliveryType || selectedOrder.delivery_mode || selectedOrder.deliveryMode || selectedOrder.mode || 'Road',
                pickupLocation: pickLoc,
                pickupTime: selectedOrder.pickupTime || firstCustom.pickupTime || '',
                totalDistance: selectedOrder.totalDistance || selectedOrder.total_distance || '',
                serviceType: selectedOrder.serviceType || firstCustom.serviceType || 'One Way',
                returnDate: selectedOrder.returnDate || firstCustom.returnDate || '',
                returnTime: selectedOrder.returnTime || firstCustom.returnTime || '',
                returnLocation: selectedOrder.returnLocation || '',
                dailyDays: selectedOrder.dailyDays || firstCustom.numberOfDays || 1,
                luggage: selectedOrder.luggage || firstCustom.luggage || '',
                stops: selectedOrder.stops || firstCustom.stops || '',
                amenities: selectedOrder.amenities || (firstCustom.amenities ? firstCustom.amenities.join(', ') : '')
            });
        }
    }, [isOpen, selectedOrder, modalType]);

    useEffect(() => {
        if (currentModalType === 'view') return;

        // If editing an existing order, and the locations or transport mode haven't changed from their initial values,
        // and we already have a loaded totalDistance, skip recalculating to preserve the database value.
        if (modalType === 'edit' && selectedOrder) {
            const initialPickup = selectedOrder.pickupLocation || selectedOrder.pickup_location || '';
            const initialLocation = selectedOrder.location || '';
            const initialMode = selectedOrder.deliveryType || selectedOrder.delivery_mode || selectedOrder.deliveryMode || selectedOrder.mode || 'Road';
            const initialDistance = selectedOrder.totalDistance || selectedOrder.total_distance || '';

            if (
                formData.pickupLocation === initialPickup &&
                formData.location === initialLocation &&
                formData.deliveryType === initialMode &&
                String(formData.totalDistance) === String(initialDistance) &&
                formData.totalDistance !== ''
            ) {
                return;
            }
        }

        const calculateDistance = async () => {
            if (formData.pickupLocation && formData.location) {
                const res = await calculateOSRMRouteDistance(formData.pickupLocation, formData.location, formData.deliveryType);
                if (res && res.distanceKm != null) {
                    setFormData(prev => ({ ...prev, totalDistance: String(res.distanceKm) }));
                } else {
                    setFormData(prev => ({ ...prev, totalDistance: '' }));
                }
            } else {
                setFormData(prev => ({ ...prev, totalDistance: '' }));
            }
        };
        const timer = setTimeout(() => {
            calculateDistance();
        }, 1000);
        return () => clearTimeout(timer);
    }, [formData.pickupLocation, formData.location, formData.deliveryType, currentModalType]);

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

    const handleSubmit = (e) => {
        e.preventDefault();
        if (modalType === 'add' && !canCreateManualOrder) {
            swalWarning('Only staff can create orders. Customers can use Marketplace and view their orders.');
            return;
        }

        // Staff roles (including concierge) must select a client explicitly
        const parsedClientId = formData.clientId ? Number(formData.clientId) : null;
        if (modalType === 'add' && isStaffRole && (!parsedClientId || isNaN(parsedClientId) || parsedClientId <= 0)) {
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
            requestDate, 
            dueDate, 
            totalAmount: parseFloat(calculateTotal()), 
            clientId: parsedClientId || Number(formData.clientId) || undefined,
            orderType: formData.type || 'Custom Order'
        };
        if (!canEditOrderStatus) {
            delete payload.status;
        }
        onSave(payload);
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
                            {portalRole !== 'client' && portalRole !== 'customer' && (
                                <div className={`space-y-1 ${modalType === 'add' ? 'col-span-1 md:col-span-2' : ''}`}>
                                    <label className="text-[10px] font-bold text-muted uppercase">
                                        Client / Customer
                                        {formData.client && modalType !== 'add' && (
                                            <span className="ml-2 text-accent normal-case font-normal">
                                                — {formData.client}
                                            </span>
                                        )}
                                    </label>
                                    <select
                                        value={formData.clientDropdownId || ''}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            const selected = customerOnlyForDropdown.find(c => c.id === val);
                                            setFormData({
                                                ...formData,
                                                clientDropdownId: val,
                                                clientId: selected ? selected.rawId : '',
                                                client: selected ? selected.name : ''
                                            });
                                        }}
                                        className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold"
                                        disabled={currentModalType === 'view'}
                                    >
                                        <option value="">
                                            {formData.client
                                                ? `Current: ${formData.client}`
                                                : 'Select Customer...'}
                                        </option>
                                        {customerOnlyForDropdown.map(c => (
                                            <option key={c.id} value={c.id}>
                                                {c.name} ({c.type})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

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
                                                            value={item.name}
                                                            onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                                                            placeholder="e.g. Vintage Champagne"
                                                            className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-xs focus:border-accent outline-none font-bold"
                                                            disabled={currentModalType === 'view'}
                                                            required
                                                        />
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

                            {/* Pickup Location */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-muted uppercase">Pickup Location / Origin</label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
                                    <input
                                        type="text"
                                        value={formData.pickupLocation}
                                        onChange={(e) => setFormData({ ...formData, pickupLocation: e.target.value })}
                                        className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2 text-sm focus:border-accent outline-none font-bold"
                                        disabled={currentModalType === 'view'}
                                        placeholder="Enter pickup location"
                                    />
                                </div>
                            </div>

                            {/* Destination */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-muted uppercase">Destination Address / Drop Location</label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
                                    <input
                                        type="text"
                                        value={formData.location}
                                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                        className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2 text-sm focus:border-accent outline-none font-bold"
                                        disabled={currentModalType === 'view'}
                                        placeholder="Enter destination"
                                    />
                                </div>
                            </div>

                            {/* Total Distance */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-accent uppercase tracking-widest pl-1">Total Distance (km)</label>
                                <input
                                    type="text"
                                    value={formData.totalDistance}
                                    onChange={(e) => setFormData({ ...formData, totalDistance: e.target.value })}
                                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm text-accent font-black focus:border-accent outline-none"
                                    disabled={currentModalType === 'view'}
                                    placeholder="Distance auto-calculated..."
                                />
                            </div>
                            {currentModalType === 'view' && String(selectedOrder?.delivery_instructions || '').trim() && (
                                <div className="space-y-1 p-4 rounded-xl border border-warning/25 bg-warning/5">
                                    <label className="text-[10px] font-bold text-warning uppercase tracking-widest">Customer delivery instructions</label>
                                    <p className="text-sm text-secondary font-medium whitespace-pre-wrap leading-relaxed">
                                        {selectedOrder.delivery_instructions}
                                    </p>
                                </div>
                            )}
                            <div className="space-y-3 pt-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-bold text-muted uppercase">Vendor (Optional)</label>
                                </div>

                                <select
                                    value={formData.vendorId}
                                    onChange={(e) => {
                                        const selectedVendor = marketplaceVendors.find(v => v.id.toString() === e.target.value);
                                        setFormData({ 
                                            ...formData, 
                                            vendorId: e.target.value,
                                            vendor: selectedVendor ? selectedVendor.name : ''
                                        });
                                    }}
                                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold"
                                    disabled={currentModalType === 'view'}
                                >
                                    <option value="">Select Vendor...</option>
                                    {marketplaceVendors.map(v => (
                                        <option key={v.id} value={v.id}>{v.name} {v.category ? `(${v.category})` : ''}</option>
                                    ))}
                                </select>
                            </div>
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
                                {currentModalType === 'view' && selectedOrder?.createdAt && (
                                    <p className="text-[9px] text-muted italic mt-1">Requested On: {new Date(selectedOrder.createdAt).toLocaleDateString()}</p>
                                )}
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Logistics Transport Mode</label>
                                <div className="flex gap-2">
                                    {['Road', 'Sea', 'Air'].map((mode) => (
                                        <button
                                            key={mode}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, deliveryType: mode })}
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

                            {formData.type === 'Chauffeur Service' && (
                                <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-4 border border-accent/20 rounded-2xl bg-accent/5">
                                    <h4 className="col-span-1 md:col-span-2 text-xs font-black text-accent uppercase tracking-widest mb-2 border-b border-accent/10 pb-2">Chauffeur Mission Details</h4>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-muted uppercase">Service Type</label>
                                        <select
                                            value={formData.serviceType}
                                            onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
                                            className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
                                            disabled={currentModalType === 'view'}
                                        >
                                            <option>One Way</option>
                                            <option>Return</option>
                                            <option>Daily</option>
                                        </select>
                                    </div>

                                    {formData.serviceType === 'Daily' && (
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-muted uppercase">Number of Days</label>
                                            <input type="number" min="1" value={formData.dailyDays} onChange={e => setFormData({ ...formData, dailyDays: e.target.value })} className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none" disabled={currentModalType === 'view'} />
                                        </div>
                                    )}

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-muted uppercase">Pick-up Location</label>
                                        <input type="text" value={formData.pickupLocation} onChange={e => setFormData({ ...formData, pickupLocation: e.target.value })} className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none" disabled={currentModalType === 'view'} placeholder="e.g. LPIA Airport" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-muted uppercase">Pick-up Time</label>
                                        <input type="time" value={formData.pickupTime} onChange={e => setFormData({ ...formData, pickupTime: e.target.value })} className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none" disabled={currentModalType === 'view'} />
                                    </div>

                                    {formData.serviceType === 'Return' && (
                                        <>
                                            <div className="space-y-1">
                                                <CustomDatePicker label="Return Date" selectedDate={formData.returnDate} onChange={date => setFormData({ ...formData, returnDate: date })} disabled={currentModalType === 'view'} />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-muted uppercase">Return Time</label>
                                                <input type="time" value={formData.returnTime} onChange={e => setFormData({ ...formData, returnTime: e.target.value })} className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none" disabled={currentModalType === 'view'} />
                                            </div>
                                            <div className="col-span-1 md:col-span-2 space-y-1">
                                                <label className="text-[10px] font-bold text-muted uppercase">Return Location</label>
                                                <input type="text" value={formData.returnLocation} onChange={e => setFormData({ ...formData, returnLocation: e.target.value })} className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none" disabled={currentModalType === 'view'} />
                                            </div>
                                        </>
                                    )}

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-muted uppercase">Luggage Specification</label>
                                        <input type="text" value={formData.luggage} onChange={e => setFormData({ ...formData, luggage: e.target.value })} className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none" disabled={currentModalType === 'view'} placeholder="e.g. 2 large suitcases, 1 carry-on" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-muted uppercase">Required Stops</label>
                                        <input type="text" value={formData.stops} onChange={e => setFormData({ ...formData, stops: e.target.value })} className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none" disabled={currentModalType === 'view'} placeholder="e.g. Stop at pharmacy" />
                                    </div>
                                    <div className="col-span-1 md:col-span-2 space-y-1">
                                        <label className="text-[10px] font-bold text-muted uppercase">Special Amenities</label>
                                        <input type="text" value={formData.amenities} onChange={e => setFormData({ ...formData, amenities: e.target.value })} className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none" disabled={currentModalType === 'view'} placeholder="e.g. Baby Car Seat, Wheelchair, Stroller, Champagne" />
                                    </div>
                                </div>
                            )}
                        </div>

                        {currentModalType === 'view' && selectedOrder?.createdAt && (
                            <div className="mt-6 p-4 bg-white/5 rounded-xl border border-border space-y-4">
                                <div className="flex items-center gap-3 text-sm">
                                    <Clock size={16} className="text-accent" />
                                    <span className="text-secondary">Created At:</span>
                                    <span className="font-bold">{new Date(selectedOrder.createdAt).toLocaleString()}</span>
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
        </Modal>
        {isOpen && currentModalType === 'view' && selectedOrder && (
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
                            <p className="text-[9px] font-black text-gray-400 mt-0.5">PROTOCOL ID: {selectedOrder.id}</p>
                            <p className="text-[7px] font-black uppercase tracking-widest leading-none">ISSUED. {selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleDateString() : selectedOrder.date || formData.requestDate}</p>
                        </div>
                    </div>

                    {/* Counterparty & Status Section */}
                    <div className="grid grid-cols-2 gap-8 mb-6 px-1 print-section">
                        <div className="border-l-2 border-black pl-4">
                            <p className="text-[6px] font-black uppercase tracking-widest opacity-40 mb-0.5 underline italic">Client Details:</p>
                            <p className="text-base font-black italic tracking-tight uppercase leading-tight">{formData.client || (typeof selectedOrder.client === 'object' && selectedOrder.client ? (selectedOrder.client.companyName || selectedOrder.client.name) : selectedOrder.client) || 'Institutional Account'}</p>
                            {formData.pickupLocation && <p className="text-[8px] text-gray-500 mt-0.5 font-medium leading-tight italic">Origin: {formData.pickupLocation}</p>}
                            <p className="text-[8px] text-gray-500 mt-0.5 font-medium leading-tight italic">Destination: {formData.location}</p>
                            <p className="text-[7px] font-black mt-1 text-gray-400">REGISTRY: {formData.clientId || selectedOrder.clientId || 'ZN-ACC-EXT'}</p>
                        </div>
                        <div className="text-right">
                            <div className="inline-block bg-black text-white px-3 py-1 rounded-sm transform -skew-x-12">
                                <p className="text-[8px] font-black uppercase tracking-widest skew-x-12 leading-none">Status: {displayOrderStatus(selectedOrder?.status || formData.status)}</p>
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
                            <p className="text-[6px] text-gray-400 font-bold italic mt-1.5 text-right uppercase tracking-widest">Auth Code: ZZ-{selectedOrder.id}</p>
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
