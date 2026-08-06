import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Table from '../../components/Table';
import {
    ShoppingBag, Search, Filter, Download, Clock, CheckCircle2,
    FileCheck, Plus, ChevronRight, Zap, Car, Calendar, Users,
    Sparkles, Printer, ShieldCheck, Eye, X, ArrowUpRight
} from 'lucide-react';
import { useData } from '../../context/GlobalDataContext';
import { motion, AnimatePresence } from 'framer-motion';

import OrderModal from '../../components/OrderModal';
import StatusBadge from '../../components/StatusBadge';
import { displayOrderStatus, isoDateSlice, formatDateDisplayDMY } from '../../utils/orderWorkflow';
import { normalizeRole, roleCanCreateInstitutionalOrder } from '../../utils/authUtils';

const CATEGORY_CONFIG = {
    'Marketplace Order': { label: 'Marketplace Order', icon: ShoppingBag, color: 'bg-info/10 text-info border-info/20' },
    'Chauffeur Booking': { label: 'Chauffeur Booking', icon: Car, color: 'bg-accent/10 text-accent border-accent/20' },
    'Event Request': { label: 'Event Request', icon: Calendar, color: 'bg-warning/10 text-warning border-warning/20' },
    'Guest Request': { label: 'Guest Request', icon: Users, color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
    'Luxury Item Request': { label: 'Luxury Sourcing', icon: Sparkles, color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    'Custom Order': { label: 'Custom Requisition', icon: Zap, color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
};

const ClientOrders = () => {
    const navigate = useNavigate();
    const {
        orders = [],
        projects = [],
        missions = [],
        chauffeurRequests = [],
        events = [],
        guestRequests = [],
        luxuryItems = [],
        deliveries = [],
        currentUser,
        clients = [],
        addOrder,
        fetchOrders,
        fetchProjects,
        fetchMissions,
        fetchClients,
        fetchDeliveries,
        fetchChauffeurRequests,
        fetchLuxuryItems,
        fetchTickets,
        syncGlobalState
    } = useData();

    const userRole = localStorage.getItem('userRole') || 'client';
    const portalRole = normalizeRole(currentUser?.role || userRole);
    const canStaffCreateOrderHere = roleCanCreateInstitutionalOrder(portalRole);
    const isBusinessClient = portalRole === 'client' || portalRole === 'saas_client';

    useEffect(() => {
        fetchOrders();
        fetchClients();
        if (fetchProjects) fetchProjects();
        if (fetchMissions) fetchMissions();
        if (fetchDeliveries) fetchDeliveries();
        if (fetchChauffeurRequests) fetchChauffeurRequests();
        if (fetchLuxuryItems) fetchLuxuryItems();
        if (fetchTickets) fetchTickets();

        const handleStateChanged = () => {
            fetchOrders();
            if (fetchProjects) fetchProjects();
            if (fetchMissions) fetchMissions();
            if (fetchDeliveries) fetchDeliveries();
        };
        window.addEventListener('app:state-changed', handleStateChanged);

        const interval = setInterval(() => {
            if (syncGlobalState) syncGlobalState();
        }, 3000);
        return () => {
            window.removeEventListener('app:state-changed', handleStateChanged);
            clearInterval(interval);
        };
    }, [fetchOrders, fetchClients, fetchProjects, fetchMissions, fetchDeliveries, fetchChauffeurRequests, fetchLuxuryItems, fetchTickets, syncGlobalState]);

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
    const [modalType, setModalType] = useState('view');
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [isProofModalOpen, setIsProofModalOpen] = useState(false);

    // Match client/customer record for current user
    const myClient = useMemo(() => {
        return (clients || []).find(c => {
            const cId = String(c.id).replace('CLT-', '');
            const uId = String(currentUser?.clientId || currentUser?.company_id || currentUser?.id).replace('CLT-', '');
            return (currentUser?.clientId && cId === uId) ||
                String(c.id) === String(currentUser?.company_id) ||
                (currentUser?.email && c.email?.toLowerCase() === currentUser?.email?.toLowerCase()) ||
                (currentUser?.name && c.name?.toLowerCase() === currentUser?.name?.toLowerCase());
        });
    }, [clients, currentUser]);

    const myClientId = myClient?.id || currentUser?.clientId || currentUser?.company_id || currentUser?.id;
    const myName = (myClient?.name || currentUser?.name || '').toLowerCase();
    const myEmail = (currentUser?.email || myClient?.email || '').toLowerCase();

    // Helper to check ownership of any record
    const isMyRecord = (item) => {
        if (!item) return false;
        const itemClientId = String(item.clientId || item.client_id || item.companyId || item.company_id || '');
        const itemCustId = String(item.customer_id || item.customerId || item.created_by || item.createdById || item.userId || item.user_id || '');
        const itemClientName = String(item.client || item.clientName || item.customer_name || item.client_name || '').toLowerCase();
        const itemEmail = String(item.email || item.client_email || item.customer_email || '').toLowerCase();

        const myUserId = String(currentUser?.id || '');
        const myClientIdStr = String(myClientId || '');
        const myEmailStr = String(myEmail || '').toLowerCase();
        const myNameStr = String(myName || '').toLowerCase();

        if (myUserId && (itemCustId === myUserId || itemClientId === myUserId)) return true;
        if (myClientIdStr && (itemClientId === myClientIdStr || itemCustId === myClientIdStr)) return true;
        if (myEmailStr && itemEmail && itemEmail === myEmailStr) return true;
        if (myNameStr && itemClientName && itemClientName === myNameStr) return true;

        // Fallback for customer portal
        return portalRole === 'customer' || portalRole === 'client';
    };

    // Combine all transaction types into a unified list
    const allTransactions = useMemo(() => {
        const unified = [];

        // 1. Marketplace & Custom Orders (Exclude internal Project records)
        (orders || []).filter(o => {
            const typeStr = String(o.orderType || o.type || '').toUpperCase();
            return typeStr !== 'PROJECT' && isMyRecord(o);
        }).forEach(o => {
            const isCustom = o.order_kind === 'custom_request' || o.orderKind === 'custom_request' || String(o.type || '').toLowerCase().includes('custom');

            // Robustly parse items from all possible locations
            let rawItems = o.items;
            if (typeof rawItems === 'string') {
                try { rawItems = JSON.parse(rawItems); } catch { rawItems = []; }
            }
            if (!Array.isArray(rawItems) || rawItems.length === 0) {
                let meta = o.metadata;
                if (typeof meta === 'string') {
                    try { meta = JSON.parse(meta); } catch { meta = {}; }
                }
                meta = meta || {};
                rawItems = meta.customItems || meta.custom_items || meta.manifestItems || meta.items || meta.cart || o.customItems || [];
            }

            const orderTotal = parseFloat(o.total ?? o.total_amount ?? o.totalAmount ?? o.estimated_total ?? o.amount ?? 0);

            // Normalize each item: extract name, qty, and unit price
            let normalizedItems = (Array.isArray(rawItems) ? rawItems : []).map((itm, idx) => {
                const name = itm.name || itm.item?.name || itm.itemName || itm.title || itm.description || `Item ${idx + 1}`;
                const qty = parseInt(itm.qty || itm.quantity || 1) || 1;
                const unitPrice = parseFloat(
                    itm.unitPrice !== undefined ? itm.unitPrice :
                    itm.price !== undefined ? itm.price :
                    itm.unit_price !== undefined ? itm.unit_price :
                    itm.chauffeurFee !== undefined ? itm.chauffeurFee :
                    itm.chauffeur_fee !== undefined ? itm.chauffeur_fee : 0
                ) || 0;
                return { name, qty, price: unitPrice };
            });

            if (normalizedItems.length === 0) {
                let meta = o.metadata;
                if (typeof meta === 'string') {
                    try { meta = JSON.parse(meta); } catch { meta = {}; }
                }
                meta = meta || {};
                const fallbackName = o.product || meta.product || o.notes || meta.notes || meta.delivery_instructions || o.delivery_instructions || (o.vendor_name ? `${o.vendor_name} Order` : 'Marketplace Item');
                normalizedItems = [{
                    name: fallbackName,
                    qty: 1,
                    price: orderTotal
                }];
            }

            // Collect all identifiers & item titles for Order o
            const oIdStr = String(o.id || '');
            const oRawIdStr = String(o.rawId || o.id || '').replace(/\D/g, '');
            const firstItemName = (normalizedItems?.[0]?.name || o.product || '').toLowerCase().trim();

            // 1. Find linked projects (by orderRef, orderId, or item name match)
            const linkedProjects = (projects || []).filter(p => {
                const pRef = String(p.orderRef || p.order_ref || p.orderId || p.order_id || p.metadata?.orderRef || p.metadata?.order_ref || p.metadata?.orderId || '');
                const pName = String(p.name || '').toLowerCase();
                const pId = String(p.id || '');
                return (
                    (pRef && (pRef === oIdStr || pRef === oRawIdStr || pRef === `ORD-${oIdStr}` || pRef === `ORD-${oRawIdStr}`)) ||
                    (pId && (pId === oIdStr || pId === oRawIdStr)) ||
                    (firstItemName && firstItemName.length > 3 && pName.includes(firstItemName))
                );
            });
            const linkedProjectIds = linkedProjects.map(p => String(p.id));

            // 2. Find linked mission (by orderId, projectId, or project match)
            const linkedMission = (missions || []).find(m => {
                const mOrderId = String(m.orderId || m.order_id || m.order_id_raw || m.metadata?.orderId || m.metadata?.orderRef || '');
                const mProjectId = String(m.projectId || m.project_id || m.metadata?.projectId || m.metadata?.projectRef || '');
                return (
                    mOrderId === oIdStr ||
                    mOrderId === oRawIdStr ||
                    mOrderId === `ORD-${oIdStr}` ||
                    mOrderId === `ORD-${oRawIdStr}` ||
                    linkedProjectIds.includes(mOrderId) ||
                    linkedProjectIds.includes(mProjectId)
                );
            });

            // 3. Find linked delivery (by orderId, missionId, or project match)
            const linkedDelivery = (deliveries || []).find(d => {
                const dOrderId = String(d.orderId || d.order_id_raw || d.order_id || '');
                const dMissionId = String(d.mission_id || d.missionId || '');
                return (
                    dOrderId === oIdStr ||
                    dOrderId === oRawIdStr ||
                    dOrderId === `ORD-${oIdStr}` ||
                    dOrderId === `ORD-${oRawIdStr}` ||
                    linkedProjectIds.includes(dOrderId) ||
                    (linkedMission && (dMissionId === String(linkedMission.id) || dOrderId === String(linkedMission.orderId)))
                );
            });

            let effectiveStatus = o.status || 'pending';

            // Resolve status hierarchy: Delivery > Mission > Project > Order Status
            if (linkedDelivery) {
                const delSt = String(linkedDelivery.status || '').toLowerCase();
                if (['delivered', 'completed'].includes(delSt)) {
                    effectiveStatus = 'completed';
                } else if (['in_transit', 'en_route', 'on_way'].includes(delSt)) {
                    effectiveStatus = 'in_transit';
                } else if (['assigned', 'accepted'].includes(delSt) || linkedDelivery.driver) {
                    effectiveStatus = 'assigned';
                } else {
                    effectiveStatus = 'logistics';
                }
            } else if (linkedMission) {
                const misSt = String(linkedMission.status || '').toLowerCase();
                if (['delivered', 'completed', 'done'].includes(misSt)) {
                    effectiveStatus = 'completed';
                } else if (['in_transit', 'en_route', 'dispatched'].includes(misSt)) {
                    effectiveStatus = 'in_transit';
                } else if (['assigned', 'accepted', 'in_progress'].includes(misSt)) {
                    effectiveStatus = 'assigned';
                } else {
                    effectiveStatus = 'logistics';
                }
            } else if (linkedProjects.length > 0) {
                const hasCompletedPrj = linkedProjects.some(p => ['completed', 'delivered'].includes(String(p.status || '').toLowerCase()));
                if (hasCompletedPrj) {
                    effectiveStatus = 'completed';
                } else {
                    effectiveStatus = 'logistics';
                }
            }

            unified.push({
                id: o.id ? (String(o.id).startsWith('ORD-') ? o.id : `ORD-${o.id}`) : 'ORD-000',
                rawId: o.id,
                category: isCustom ? 'Custom Order' : 'Marketplace Order',
                serviceType: o.type || (isCustom ? 'Custom Requisition' : 'Marketplace Purchase'),
                items: normalizedItems,
                total: orderTotal,
                requestDate: o.createdAt || o.created_at || o.order_date || o.requestDate || o.date,
                dueDate: o.due_date || o.dueDate || null,
                status: effectiveStatus,
                location: linkedDelivery?.dropLocation || o.deliveryAddress || o.location || 'Client Address',
                driverName: linkedDelivery?.driver || o.driverName || null,
                source: 'orders',
                originalRecord: o
            });
        });

        // 2. Chauffeur Bookings
        (chauffeurRequests || []).filter(isMyRecord).forEach(req => {
            unified.push({
                id: req.id ? (String(req.id).startsWith('CH-') ? req.id : `CH-ORD-${req.id}`) : 'CH-000',
                rawId: req.id,
                category: 'Chauffeur Booking',
                serviceType: `Chauffeur Protocol (${req.serviceType || 'VIP Service'})`,
                items: [{ name: `VIP Chauffeur Service (${req.serviceType || 'One Way'}) - Pickup: ${req.pickupLocation || 'Nassau'}`, qty: 1 }],
                total: parseFloat(req.chauffeurFee ?? req.chauffeur_fee ?? req.total_amount ?? 120),
                requestDate: req.createdAt || req.created_at || req.requestDate || req.dueDate,
                dueDate: req.dueDate || req.returnDate || null,
                status: req.status || req.chauffeur_status || 'pending',
                location: req.pickupLocation ? `${req.pickupLocation} -> ${req.dropLocation || 'Destination'}` : 'Nassau Hub',
                driverName: req.driverName || 'Awaiting Driver Assignment',
                plateNumber: req.plateNumber || '',
                source: 'chauffeur',
                originalRecord: req
            });
        });

        // 3. Event Requests
        (events || []).filter(isMyRecord).forEach(evt => {
            const formattedId = evt.id ? (String(evt.id).startsWith('EVT-') ? evt.id : `EVT-${String(evt.id).padStart(3, '0')}`) : 'EVT-000';
            unified.push({
                id: formattedId,
                rawId: evt.id,
                category: 'Event Request',
                serviceType: evt.locationType || 'Private Residence Event',
                items: [{ name: evt.title || evt.request || evt.name || 'Concierge Event Coordination', qty: 1 }],
                total: parseFloat(evt.budget || evt.total || evt.estimatedCost || 0),
                requestDate: evt.createdAt || evt.created_at || evt.date,
                dueDate: evt.date || null,
                status: evt.status || 'planned',
                location: evt.location || 'Private Residence',
                guestCount: evt.guestCount || evt.guests || 0,
                source: 'events',
                originalRecord: evt
            });
        });

        // 4. Guest Requests
        (guestRequests || []).filter(isMyRecord).forEach(gr => {
            const formattedId = gr.id ? (String(gr.id).startsWith('GST-') ? gr.id : `GST-${String(gr.id).padStart(3, '0')}`) : 'GST-000';
            unified.push({
                id: formattedId,
                rawId: gr.id,
                category: 'Guest Request',
                serviceType: 'Concierge Guest Service',
                items: [{ name: gr.request || gr.title || gr.details || 'Guest Service Protocol', qty: 1 }],
                total: parseFloat(gr.cost || gr.total || gr.estimatedCost || 0),
                requestDate: gr.createdAt || gr.created_at || gr.date,
                dueDate: gr.dueDate || gr.date || null,
                status: gr.status || 'pending',
                location: gr.location || 'Concierge Desk',
                source: 'guest',
                originalRecord: gr
            });
        });

        // 5. Luxury Item Requests
        (luxuryItems || []).filter(isMyRecord).forEach(lux => {
            const formattedId = lux.id ? (String(lux.id).startsWith('LUX-') ? lux.id : `LUX-${String(lux.id).padStart(3, '0')}`) : 'LUX-000';
            unified.push({
                id: formattedId,
                rawId: lux.id,
                category: 'Luxury Item Request',
                serviceType: 'Luxury Item Sourcing',
                items: [{ name: lux.itemName || lux.name || lux.title || 'Exclusive Sourcing Request', qty: 1 }],
                total: parseFloat(lux.price || lux.cost || lux.total || 0),
                requestDate: lux.createdAt || lux.created_at || lux.date,
                dueDate: lux.dueDate || lux.date || null,
                status: lux.status || 'pending',
                location: lux.location || 'Global Procurement Hub',
                source: 'luxury',
                originalRecord: lux
            });
        });

        // Deduplicate and sort newest first (by timestamp, then rawId descending)
        const getTimeScore = (tx) => {
            const orig = tx.originalRecord || {};
            const rawCreated = orig.createdAt || orig.created_at || orig.updatedAt || orig.updated_at || tx.requestDate || orig.order_date || orig.date;
            if (rawCreated) {
                const d = new Date(rawCreated);
                if (!isNaN(d.getTime())) return d.getTime();
            }
            return 0;
        };

        const getIdScore = (tx) => {
            const rawId = tx.rawId || tx.id;
            const num = parseInt(String(rawId).replace(/\D/g, ''), 10);
            return !isNaN(num) ? num : 0;
        };

        const seen = new Set();
        return unified.filter(tx => {
            const key = `${tx.source}-${tx.id}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        }).sort((a, b) => {
            const timeDiff = getTimeScore(b) - getTimeScore(a);
            if (timeDiff !== 0) return timeDiff;
            return getIdScore(b) - getIdScore(a);
        });
    }, [orders, chauffeurRequests, events, guestRequests, luxuryItems, myClientId, myName, myEmail, portalRole]);

    // Filter transactions based on category, status, and search query
    const filteredTransactions = useMemo(() => {
        return allTransactions.filter(tx => {
            // Category Filter
            if (categoryFilter !== 'All' && tx.category !== categoryFilter) return false;

            // Status Filter
            const st = String(tx.status || '').toLowerCase();
            if (statusFilter === 'Active' && ['completed', 'delivered', 'cancelled', 'done'].includes(st)) return false;
            if (statusFilter === 'Closed' && !['completed', 'delivered', 'done'].includes(st)) return false;

            // Search Query
            if (searchTerm.trim() !== '') {
                const q = searchTerm.toLowerCase();
                const matchId = String(tx.id || '').toLowerCase().includes(q);
                const matchCat = String(tx.category || '').toLowerCase().includes(q);
                const matchType = String(tx.serviceType || '').toLowerCase().includes(q);
                const matchItem = tx.items.some(i => String(i.name || '').toLowerCase().includes(q));
                if (!matchId && !matchCat && !matchType && !matchItem) return false;
            }

            return true;
        });
    }, [allTransactions, categoryFilter, statusFilter, searchTerm]);

    const hasDueDate = filteredTransactions.some(tx => tx.dueDate);

    // Columns for Table component
    const columns = [
        {
            header: "Transaction ID",
            accessor: "id",
            render: (tx) => (
                <div className="flex items-center gap-2">
                    <span className="font-black text-white italic tracking-tighter text-sm">{tx.id}</span>
                </div>
            )
        },
        {
            header: "Service Category",
            accessor: "category",
            render: (tx) => {
                const cfg = CATEGORY_CONFIG[tx.category] || CATEGORY_CONFIG['Custom Order'];
                const Icon = cfg.icon;
                return (
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 border rounded-lg text-[10px] font-black uppercase tracking-wider italic ${cfg.color}`}>
                        <Icon size={12} />
                        {tx.category}
                    </span>
                );
            }
        },
        {
            header: "Description / Items",
            accessor: "items",
            render: (tx) => {
                const firstItem = tx.items[0];
                const primaryName = firstItem?.name || tx.serviceType || 'Transaction Service';
                if (tx.items.length <= 1) {
                    return <span className="font-bold text-white text-xs truncate max-w-[220px] block">{primaryName}</span>;
                }
                return (
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs truncate max-w-[180px]">{primaryName}</span>
                        <span className="px-2 py-0.5 bg-white/5 rounded-md text-[9px] font-black text-muted uppercase">+{tx.items.length - 1} More</span>
                    </div>
                );
            }
        },
        {
            header: "Total Value",
            accessor: "total",
            render: (tx) => (
                <span className="font-black text-white italic tracking-tighter text-sm">
                    ${tx.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
            )
        },
        {
            header: "Request Date",
            accessor: "requestDate",
            render: (tx) => (
                <span className="text-secondary font-black italic text-xs">
                    {formatDateDisplayDMY(tx.requestDate) || '—'}
                </span>
            )
        },
        ...(hasDueDate ? [{
            header: "Due / Service Date",
            accessor: "dueDate",
            render: (tx) => (
                <span className="text-white font-black italic text-xs">
                    {formatDateDisplayDMY(tx.dueDate) || '—'}
                </span>
            )
        }] : []),
        {
            header: "Status",
            accessor: "status",
            render: (tx) => <StatusBadge status={tx.status} />
        },
    ];

    const handleViewTransaction = (tx) => {
        setSelectedTransaction(tx);
        setIsProofModalOpen(true);
    };

    const handleSaveOrder = async (orderData) => {
        if (!roleCanCreateInstitutionalOrder(portalRole) && !isBusinessClient) {
            window.alert('Only authorised staff can create orders on behalf of clients. Use Marketplace to shop, or contact your representative.');
            setIsOrderModalOpen(false);
            return;
        }
        await addOrder({
            ...orderData,
            clientId: orderData.clientId || myClient?.id || currentUser?.id,
            client: orderData.client || myClient?.name || currentUser?.name,
            email: orderData.email || myClient?.email || currentUser?.email,
            order_date: isoDateSlice(orderData.requestDate),
            due_date: isoDateSlice(orderData.dueDate),
        });
        setIsOrderModalOpen(false);
    };

    const handlePrintProof = () => {
        if (!selectedTransaction) return;

        const tx = selectedTransaction;
        const itemsHtml = (tx.items || []).map((item, idx) => {
            const qty = parseInt(item.qty || 1) || 1;
            const unitPrice = parseFloat(item.price ?? item.unitPrice ?? item.unit_price ?? 0) || 0;
            const lineTotal = unitPrice * qty;
            return `
                <tr>
                    <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:13px;">${idx + 1}. ${item.name || item.itemName || 'Service Entry'}</td>
                    <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;color:#374151;font-size:13px;">${qty}</td>
                    <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:#374151;font-size:13px;">$${unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700;color:#111827;font-size:13px;">$${(lineTotal || unitPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>`;
        }).join('');

        const printHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8"/>
    <title>Proof of Transaction — ${tx.id}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #111827; background: #fff; padding: 40px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #111827; }
        .brand { font-size: 22px; font-weight: 900; letter-spacing: -0.5px; text-transform: uppercase; }
        .brand span { color: #b8860b; }
        .doc-title { text-align: right; }
        .doc-title h1 { font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #111; }
        .doc-title p { font-size: 11px; color: #6b7280; margin-top: 2px; }
        .section { margin-bottom: 24px; }
        .section-title { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #6b7280; margin-bottom: 10px; }
        .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
        .info-cell label { display: block; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #9ca3af; margin-bottom: 4px; }
        .info-cell p { font-size: 13px; font-weight: 700; color: #111827; }
        .ref-box { background: #fffbeb; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .ref-box .ref-id { font-size: 22px; font-weight: 900; color: #111827; }
        .ref-box .ref-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #b8860b; margin-bottom: 4px; }
        .ref-box .cat-label { font-size: 11px; font-weight: 700; color: #374151; }
        table { width: 100%; border-collapse: collapse; }
        thead th { background: #111827; color: #fff; padding: 10px 12px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; text-align: left; }
        thead th:nth-child(2) { text-align: center; }
        thead th:nth-child(3), thead th:nth-child(4) { text-align: right; }
        .total-row { background: #f9fafb; }
        .total-row td { padding: 14px 12px; font-size: 15px; font-weight: 900; }
        .status-badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; background: #dcfce7; color: #166534; text-transform: uppercase; }
        .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
        .footer p { font-size: 10px; color: #9ca3af; }
        .verified-stamp { border: 2px solid #166534; border-radius: 6px; padding: 6px 14px; color: #166534; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; }
    </style>
</head>
<body>
    <div class="header">
        <div class="brand">ZANE<span>ZION</span><br/><span style="font-size:11px;font-weight:400;letter-spacing:3px;color:#6b7280;">PLATFORM MANAGEMENT SYSTEM</span></div>
        <div class="doc-title">
            <h1>Official Proof of Transaction</h1>
            <p>Verified Institutional Record</p>
            <p style="margin-top:6px;font-size:11px;color:#374151;">Printed: ${new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}</p>
        </div>
    </div>

    <div class="ref-box">
        <div>
            <div class="ref-label">Transaction Reference</div>
            <div class="ref-id">${tx.id}</div>
        </div>
        <div style="text-align:right;">
            <div class="ref-label">Category</div>
            <div class="cat-label">${tx.category || '—'}</div>
            <div style="margin-top:8px;"><span class="status-badge">${tx.status || 'N/A'}</span></div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Transaction Overview</div>
        <div class="info-grid">
            <div class="info-cell">
                <label>Client Name</label>
                <p>${tx.client || tx.clientName || '—'}</p>
            </div>
            <div class="info-cell">
                <label>Request Date</label>
                <p>${tx.requestDate ? new Date(tx.requestDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}</p>
            </div>
            <div class="info-cell">
                <label>Due / Service Date</label>
                <p>${tx.dueDate ? new Date(tx.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}</p>
            </div>
            ${tx.location ? `<div class="info-cell" style="grid-column:span 3;"><label>Service / Delivery Location</label><p>${tx.location}</p></div>` : ''}
        </div>
    </div>

    <div class="section">
        <div class="section-title">Itemized Service Breakdown</div>
        <table>
            <thead>
                <tr>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Line Total</th>
                </tr>
            </thead>
            <tbody>
                ${itemsHtml}
                <tr class="total-row">
                    <td colspan="3" style="text-align:right;color:#6b7280;font-size:12px;font-weight:600;padding:14px 12px;">Total Settled Fiscal Amount</td>
                    <td style="text-align:right;color:#111827;padding:14px 12px;">$${tx.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
            </tbody>
        </table>
    </div>

    <div class="footer">
        <div>
            <p>ZaneZion Platform Management System</p>
            <p>This document is system-generated and serves as an official proof of transaction.</p>
        </div>
        <div class="verified-stamp">✓ Verified Record</div>
    </div>
</body>
</html>`;

        const printWindow = window.open('', '_blank', 'width=900,height=700');
        if (!printWindow) {
            window.print();
            return;
        }
        printWindow.document.write(printHtml);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
        }, 500);
    };


    return (
        <div className="space-y-10 animate-fade-in pb-10">
            <div className="no-print space-y-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-white italic uppercase flex items-center gap-3">
                            <ShieldCheck className="text-accent" size={28} />
                            Order History & Service Records
                        </h1>
                        <p className="text-secondary text-[10px] md:text-xs mt-1 font-black uppercase tracking-[0.2em] opacity-70">
                            Single source of truth & official proof of transaction for Marketplace Orders, Chauffeur Bookings, Events, Guest Requests, and Luxury Sourcing.
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search transaction history..."
                                className="bg-[#141417] border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder:text-muted/40 focus:outline-none focus:border-accent/40 w-full sm:w-64 transition-all font-bold"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/40" size={14} />
                        </div>
                        {canStaffCreateOrderHere && (
                            <button
                                type="button"
                                onClick={() => { setSelectedOrder(null); setModalType('add'); setIsOrderModalOpen(true); }}
                                className="btn-primary text-[10px] px-6 flex items-center gap-2"
                            >
                                <Plus size={14} /> Create Requisition
                            </button>
                        )}
                    </div>
                </div>

                {/* Metrics Dashboard */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="glass-card p-6 border-l-4 border-l-accent">
                        <p className="text-[10px] text-accent font-black uppercase tracking-widest mb-1">Total Transaction Value</p>
                        <p className="text-2xl font-black text-white italic font-heading tracking-tighter">
                            ${filteredTransactions.reduce((acc, tx) => acc + tx.total, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                    </div>

                    <div className="glass-card p-6 border-l-4 border-l-info">
                        <p className="text-[10px] text-info font-black uppercase tracking-widest mb-1">Active Services & Missions</p>
                        <p className="text-2xl font-black text-white italic font-heading tracking-tighter">
                            {allTransactions.filter(tx => !['completed', 'delivered', 'cancelled', 'done'].includes(String(tx.status || '').toLowerCase())).length.toString().padStart(2, '0')}
                        </p>
                    </div>

                    <div className="glass-card p-6 border-l-4 border-l-warning">
                        <p className="text-[10px] text-warning font-black uppercase tracking-widest mb-1">Total Verified Proof Records</p>
                        <p className="text-2xl font-black text-white italic font-heading tracking-tighter">
                            {allTransactions.length.toString().padStart(2, '0')} Logs
                        </p>
                    </div>

                    <div className="glass-card p-6 border-l-4 border-l-success">
                        <p className="text-[10px] text-success font-black uppercase tracking-widest mb-1">Institutional Status</p>
                        <p className="text-2xl font-black text-success italic text-glow font-heading tracking-tighter">
                            Verified Client
                        </p>
                    </div>
                </div>

                {/* Filters Section */}
                <div className="glass-card p-6 space-y-4">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        {/* Category Tabs */}
                        <div className="flex flex-wrap gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted self-center mr-2 hidden sm:inline">Category:</span>
                            {['All', 'Marketplace Order', 'Chauffeur Booking', 'Event Request', 'Guest Request', 'Luxury Item Request', 'Custom Order'].map((cat) => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => setCategoryFilter(cat)}
                                    className={`px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                                        categoryFilter === cat
                                            ? 'bg-accent text-black shadow-lg shadow-accent/20'
                                            : 'bg-white/5 text-muted hover:text-white hover:bg-white/10'
                                    }`}
                                >
                                    {cat === 'All' ? 'All Services' : cat}
                                </button>
                            ))}
                        </div>

                        {/* Status Filter */}
                        <div className="flex bg-background border border-white/10 p-1 rounded-xl w-fit">
                            {['All', 'Active', 'Closed'].map((filter) => (
                                <button
                                    key={filter}
                                    type="button"
                                    onClick={() => setStatusFilter(filter)}
                                    className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                        statusFilter === filter
                                            ? 'bg-white/15 text-white shadow'
                                            : 'text-muted hover:text-white'
                                    }`}
                                >
                                    {filter} Status
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden grid grid-cols-1 gap-4">
                    {filteredTransactions.length === 0 ? (
                        <div className="glass-card p-8 text-center border-dashed border-2 border-white/5">
                            <FileCheck size={40} className="text-muted mx-auto mb-3 opacity-20" />
                            <p className="text-muted font-black uppercase tracking-widest text-xs italic">No transaction records match criteria.</p>
                        </div>
                    ) : (
                        filteredTransactions.map((tx) => {
                            const cfg = CATEGORY_CONFIG[tx.category] || CATEGORY_CONFIG['Custom Order'];
                            const Icon = cfg.icon;
                            return (
                                <div key={`${tx.source}-${tx.id}`} className="glass-card p-5 space-y-4 hover:border-accent/30 transition-all">
                                    <div className="flex justify-between items-start gap-2">
                                        <div>
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded border text-[9px] font-black uppercase tracking-widest ${cfg.color} mb-2`}>
                                                <Icon size={10} /> {tx.category}
                                            </span>
                                            <p className="text-sm font-black text-white italic tracking-tighter">{tx.id}</p>
                                        </div>
                                        <StatusBadge status={tx.status} />
                                    </div>

                                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                                        <p className="text-xs font-bold text-white truncate">{tx.items[0]?.name || tx.serviceType}</p>
                                        {tx.items.length > 1 && (
                                            <p className="text-[10px] text-muted font-bold mt-1">+{tx.items.length - 1} additional service item(s)</p>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-[9px] text-muted font-black uppercase tracking-widest mb-0.5">Request Date</p>
                                            <p className="text-xs font-black text-secondary italic">{formatDateDisplayDMY(tx.requestDate) || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] text-muted font-black uppercase tracking-widest mb-0.5">Total Fiscal Amount</p>
                                            <p className="text-xs font-black text-white italic">${tx.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center pt-3 border-t border-white/5">
                                        <span className="text-[10px] text-muted/60 font-black uppercase tracking-widest">{tx.serviceType}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleViewTransaction(tx)}
                                            className="text-accent hover:text-accent-light transition-colors flex items-center gap-1.5 text-xs font-black uppercase tracking-wider"
                                        >
                                            <Eye size={14} /> View Proof
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Table View (Desktop) */}
                <div className="glass-card p-6 sm:p-8 hidden lg:block">
                    <div className="mb-6 flex items-center justify-between">
                        <h3 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
                            <FileCheck size={20} className="text-accent" />
                            Official Transaction Ledger
                        </h3>
                        <p className="text-[10px] font-black text-muted uppercase tracking-widest">
                            Showing {filteredTransactions.length} of {allTransactions.length} Verified Records
                        </p>
                    </div>
                    {filteredTransactions.length === 0 ? (
                        <div className="py-16 text-center border-dashed border-2 border-white/5 rounded-2xl">
                            <FileCheck size={48} className="text-muted mx-auto mb-3 opacity-20" />
                            <p className="text-muted font-black uppercase tracking-[0.2em] text-xs italic">No transaction records found matching your filters.</p>
                        </div>
                    ) : (
                        <Table
                            columns={columns}
                            data={filteredTransactions}
                            actions={true}
                            onView={(tx) => handleViewTransaction(tx)}
                        />
                    )}
                </div>

                {/* Verification Protocol Note */}
                <div className="glass-card p-6 flex flex-col md:flex-row items-center justify-between gap-6 border-l-4 border-l-accent">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-accent/20 rounded-2xl flex items-center justify-center text-accent">
                            <ShieldCheck size={26} />
                        </div>
                        <div>
                            <h4 className="font-bold text-white text-sm italic uppercase tracking-tight">Institutional Proof Protocol</h4>
                            <p className="text-xs text-secondary">
                                All service records, chauffeur manifests, concierge requests, and marketplace purchases are digitally verified and immutable.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate('/dashboard/audits')}
                        className="btn-secondary text-xs shrink-0"
                    >
                        Audit Network Records
                    </button>
                </div>
            </div>

            {/* Proof of Transaction Modal */}
            <AnimatePresence>
                {isProofModalOpen && selectedTransaction && (
                    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/90 backdrop-blur-md"
                            onClick={() => setIsProofModalOpen(false)}
                        />
                        <div className="relative z-10 flex min-h-[100dvh] items-center justify-center p-4 py-8">
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                                className="w-full max-w-2xl bg-sidebar border border-white/10 rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col"
                            >
                                {/* Modal Header */}
                                <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center text-accent">
                                            <ShieldCheck size={22} />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Official Proof of Transaction</h3>
                                            <p className="text-[10px] text-accent font-black tracking-widest uppercase">Verified Institutional Record</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsProofModalOpen(false)}
                                        className="p-2.5 bg-white/5 border border-white/10 rounded-full text-muted hover:text-white transition-all"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                {/* Proof Body */}
                                <div className="p-6 sm:p-8 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
                                    {/* Record Banner */}
                                    <div className="p-5 rounded-2xl bg-accent/10 border border-accent/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                        <div>
                                            <p className="text-[10px] font-black text-accent uppercase tracking-widest">Transaction Reference</p>
                                            <h4 className="text-2xl font-black text-white italic tracking-tighter mt-0.5">{selectedTransaction.id}</h4>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black text-muted uppercase tracking-widest">Category</p>
                                            <span className="text-xs font-black text-white uppercase tracking-wider">{selectedTransaction.category}</span>
                                        </div>
                                    </div>

                                    {/* Overview Grid */}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                                        <div>
                                            <p className="text-[9px] font-black text-muted uppercase tracking-widest">Request Date</p>
                                            <p className="text-xs font-black text-white italic">{formatDateDisplayDMY(selectedTransaction.requestDate) || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-muted uppercase tracking-widest">Due / Service Date</p>
                                            <p className="text-xs font-black text-white italic">{formatDateDisplayDMY(selectedTransaction.dueDate) || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-muted uppercase tracking-widest">Fulfillment Status</p>
                                            <div className="mt-1"><StatusBadge status={selectedTransaction.status} /></div>
                                        </div>
                                    </div>

                                    {/* Location / Protocol Info */}
                                    {selectedTransaction.location && (
                                        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                                            <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">Service / Delivery Location</p>
                                            <p className="text-xs font-bold text-white">{selectedTransaction.location}</p>
                                        </div>
                                    )}

                                    {/* Itemized Breakdown */}
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-black text-muted uppercase tracking-widest">Itemized Service Breakdown</h4>
                                        <div className="space-y-2">
                                            {selectedTransaction.items.map((item, idx) => {
                                                const qty = parseInt(item.qty || 1) || 1;
                                                const unitPrice = parseFloat(item.price ?? item.unitPrice ?? item.unit_price ?? 0) || 0;
                                                const lineTotal = unitPrice * qty;
                                                return (
                                                    <div key={idx} className="p-3.5 bg-white/[0.03] border border-white/5 rounded-xl">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <div className="w-8 h-8 shrink-0 rounded-lg bg-accent/10 flex items-center justify-center text-accent text-xs font-black">
                                                                    {qty}x
                                                                </div>
                                                                <span className="text-xs font-bold text-white truncate">{item.name || item.itemName || 'Service Entry'}</span>
                                                            </div>
                                                            <div className="text-right shrink-0">
                                                                {qty > 1 && unitPrice > 0 && (
                                                                    <p className="text-[10px] text-muted font-bold mb-0.5">
                                                                        {qty} × ${unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                                    </p>
                                                                )}
                                                                <span className="text-xs font-black text-white italic">
                                                                    ${(lineTotal || unitPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Financial Total */}
                                    <div className="p-5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                                        <div>
                                            <p className="text-[10px] font-black text-muted uppercase tracking-widest">Total Settled Fiscal Amount</p>
                                            <p className="text-xs text-secondary font-bold">Includes all service charges, tariffs & logistics</p>
                                        </div>
                                        <p className="text-2xl font-black text-white italic tracking-tighter">
                                            ${selectedTransaction.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                </div>

                                {/* Modal Actions */}
                                <div className="p-6 border-t border-white/10 flex items-center justify-between bg-white/[0.02]">
                                    <button
                                        type="button"
                                        onClick={handlePrintProof}
                                        className="btn-secondary text-xs px-6 flex items-center gap-2"
                                    >
                                        <Printer size={16} /> Print Official Proof
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsProofModalOpen(false)}
                                        className="btn-primary text-xs px-8"
                                    >
                                        Close Proof Record
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                )}
            </AnimatePresence>

            {/* Standard Order Modal (for manual creation by staff) */}
            <OrderModal
                isOpen={isOrderModalOpen}
                onClose={() => setIsOrderModalOpen(false)}
                modalType={modalType}
                selectedOrder={selectedOrder}
                onSave={handleSaveOrder}
                onDelete={null}
                role={currentUser?.role || userRole}
            />
        </div>
    );
};

export default ClientOrders;
