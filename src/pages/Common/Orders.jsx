import React, { useState, useEffect, useRef } from 'react';
import { swalSuccess, swalError, swalWarning, swalInfo, swalConfirm } from '../../utils/swal';
import Table from '../../components/Table';
import { useData } from '../../context/GlobalDataContext';
import { isoDateSlice, displayOrderStatus } from '../../utils/orderWorkflow';
import { Search, Plus, PackageCheck, PackageX, FileText, CheckCircle, XCircle, ShoppingCart, Truck, Warehouse, ArrowRightCircle, RefreshCcw, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useOrders, useUpdateOrderStatus, useCreateOrder, useUpdateOrder, useDeleteOrder } from '../../hooks/api/useOrders';
import { useQueryClient } from '@tanstack/react-query';
import OrderModal from '../../components/OrderModal';
import InvoiceGenerationModal from '../../components/InvoiceGenerationModal';
import OrderTimeline from '../../components/OrderTimeline';
import { normalizeRole, roleCanCreateInstitutionalOrder } from '../../utils/authUtils';
import { formatClientDisplayName } from '../../utils/apiHelpers';
import { isOrderVisibleToConcierge } from '../../utils/conciergeVisibility';

/** Bespoke / concierge-path orders (store custom request or any row with a custom_request_category). */
function isCustomRequestFlowOrder(order) {
  const typeStr = String(order?.type || '').toLowerCase();
  const kindStr = String(order?.order_kind || order?.orderKind || '').toLowerCase();

  if (
    typeStr.includes('custom') || typeStr.includes('bespoke') || typeStr.includes('custom_request') ||
    kindStr.includes('custom') || kindStr.includes('bespoke') || kindStr.includes('custom_request')
  ) {
    return true;
  }
  return false;
}

const Orders = () => {
  const {
    orders: contextOrders = [], deliveries, purchaseRequests, stockMovements,
    addProject, invoices, projects, missions, generateInvoiceFromOrder,
    currentUser, launchMissionFromOrder, convertOrderToProject,
    fetchOrders, fetchDeliveries, fetchMissions, fetchProjects,
    fetchVendors, fetchClients, clients, users = [], customerUsers = [], fetchCustomerUsers,
    hasMenuPermission
  } = useData();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const updateOrderStatusMutation = useUpdateOrderStatus();
  const createOrderMutation = useCreateOrder();
  const updateOrderMutation = useUpdateOrder();
  const deleteOrderMutation = useDeleteOrder();

  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [workflowTab, setWorkflowTab] = useState('all'); // 'all' | 'current' | 'processed'
  const [timelineOrder, setTimelineOrder] = useState(null); // { id, orderNumber }

  const normalizedRole = normalizeRole(currentUser?.role);
  const portalRole = normalizeRole(currentUser?.role);
  const canStaffCreateOrder = roleCanCreateInstitutionalOrder(portalRole);

  const { data: ordersData, isLoading, error, refetch: refetchOrders } = useOrders(page, 50, searchTerm, portalRole);

  // Real-time state listener: when an order updates anywhere, auto-refresh immediately
  useEffect(() => {
    const handleStateChange = () => {
      if (refetchOrders) refetchOrders();
    };
    window.addEventListener('app:state-changed', handleStateChange);
    return () => window.removeEventListener('app:state-changed', handleStateChange);
  }, [refetchOrders]);

  const orders = React.useMemo(() => {
    const apiOrders = ordersData?.data?.orders || (Array.isArray(ordersData?.data) ? ordersData.data : (Array.isArray(ordersData?.orders) ? ordersData.orders : null));
    if (Array.isArray(apiOrders)) {
      return apiOrders;
    }
    return Array.isArray(contextOrders) ? contextOrders : [];
  }, [ordersData, contextOrders]);

  const rawRoleStr = typeof currentUser?.role === 'object' ? (currentUser?.role?.name || '') : String(currentUser?.role || '');
  const normalizeId = (id) => id ? String(id).replace('CLT-', '') : '';
  const currentClient = (clients || []).find(c => {
    const cId = normalizeId(c.id);
    const uId = normalizeId(currentUser?.clientId || currentUser?.companyId || currentUser?.company_id);
    return cId && uId && cId === uId;
  });
  const isBusinessClient = portalRole === 'client' || portalRole === 'saas_client';

  const canManageOrders = ['superadmin', 'admin', 'operations', 'procurement', 'inventory', 'logistics', 'concierge', 'saas_client'].includes(normalizedRole) || isBusinessClient;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('view');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = useState(null);
  const [routingOrderId, setRoutingOrderId] = useState(null); // tracks which order is being routed

  const resolveLiveOrderStatus = (o) => {
    if (!o) return 'pending';
    const rawSt = String(o.status || '').toLowerCase().trim();

    // 1. Direct explicit database order status
    if (['completed', 'delivered', 'done'].includes(rawSt)) return 'completed';
    if (['cancelled', 'rejected', 'canceled'].includes(rawSt)) return 'cancelled';
    if (['in_transit', 'en_route', 'out_for_delivery', 'dispatched'].includes(rawSt)) return 'in_transit';
    if (['operation', 'operations'].includes(rawSt)) return 'operation';
    if (['logistics'].includes(rawSt)) return 'logistics';
    if (['concierge'].includes(rawSt)) return 'concierge';
    if (['procurement'].includes(rawSt)) return 'procurement';
    if (['inventory'].includes(rawSt)) return 'inventory';
    if (['assigned', 'accepted'].includes(rawSt)) return 'assigned';
    if (['pending', 'created', 'admin_review', 'pending_review', 'submitted', 'draft'].includes(rawSt)) return 'pending';

    // 2. Fallback to linked delivery / mission if status is empty/unknown
    const oIdStr = String(o.id || '');
    const oRawIdStr = String(o.rawId || o.id || '').replace(/\D/g, '');

    const linkedDelivery = (deliveries || []).find(d => {
      const dOrderId = String(d.orderId || d.order_id_raw || d.order_id || '');
      return dOrderId === oIdStr || dOrderId === oRawIdStr || dOrderId === `ORD-${oIdStr}`;
    });

    if (linkedDelivery) {
      const delSt = String(linkedDelivery.status || '').toLowerCase();
      if (['delivered', 'completed'].includes(delSt)) return 'completed';
      if (['in_transit', 'en_route', 'on_way'].includes(delSt)) return 'in_transit';
      if (['assigned', 'accepted'].includes(delSt)) return 'assigned';
    }

    return rawSt || 'pending';
  };

  const handleConvertToProject = async (order) => {
    // Prevent duplicate calls
    if (routingOrderId) return;

    const confirm = await swalConfirm(
      'Route to Project?',
      `Convert Order #${order.id} ("${order.items?.[0]?.name || 'Mission'}") into a Logistics Project?`
    );
    if (!confirm?.isConfirmed) return;

    setRoutingOrderId(order.id);
    try {
      const projectData = {
        name: `Project: ${order.items?.[0]?.name || 'Mission'}`,
        client: order.client || 'Unknown Client',
        items: order.items || [],
        orderRef: order.id,
        start: order.date || new Date().toISOString().split('T')[0],
        location: order.location || 'Headquarters',
        status: 'Pending',
        deliveryType: order.deliveryType || 'Road',
        managerId: currentUser?.id,
        companyId: order.company_id || order.client_id
      };
      const newProject = await convertOrderToProject(order.id, projectData);
      if (newProject) {
        swalSuccess(`Order #${order.id} routed to Logistics Project successfully. Redirecting...`);
        navigate('/dashboard/projects');
      } else {
        swalError('Failed to route order. Please see console for details.');
      }
    } finally {
      setRoutingOrderId(null);
    }
  };

  const handleAcceptOrder = async (order) => {
    const isChauffeur = String(order.orderType || order.type || '').toLowerCase().includes('chauffeur') ||
      (order.items || []).some(it => String(it.name || '').toLowerCase().includes('chauffeur'));
    const isCustom = isCustomRequestFlowOrder(order);

    // Marketplace/Product orders go to Logistics, Chauffeur orders go to Operations, Bespoke custom orders go to Concierge
    const targetStatus = isChauffeur
      ? 'operation'
      : isCustom
        ? 'concierge'
        : 'logistics';

    const destinationLabel = isChauffeur ? 'Operations' : isCustom ? 'Concierge' : 'Logistics / Dispatch';

    const confirm = await swalConfirm(
      `Accept Order #${order.id}?`,
      `Are you sure you want to ACCEPT Order #${order.id}? It will be forwarded to ${destinationLabel} for fulfilment.`
    );

    if (confirm?.isConfirmed) {
      try {
        // onMutate optimistically updates the cache immediately, so UI flips before API responds
        await updateOrderStatusMutation.mutateAsync({ id: order.id, status: targetStatus });
        // onSuccess in the hook fires notifyStateChanged — no need for manual refetch here
        swalSuccess(
          'Order Accepted',
          `Order #${order.id} has been accepted and forwarded to ${destinationLabel}.`
        );
      } catch (err) {
        const errMsg = err?.response?.data?.message || err?.message || 'Failed to accept order.';
        swalError(errMsg);
      }
    }
  };

  const handleRejectOrder = async (order) => {
    const confirm = await swalConfirm(
      `Reject Order #${order.id}?`,
      `Are you sure you want to REJECT Order #${order.id}? This will cancel the order.`
    );

    if (confirm?.isConfirmed) {
      try {
        await updateOrderStatusMutation.mutateAsync({ id: order.id, status: 'cancelled' });
        swalSuccess(
          'Order Rejected',
          `Order #${order.id} has been rejected and cancelled.`
        );
      } catch (err) {
        const errMsg = err?.response?.data?.message || err?.message || 'Failed to reject order.';
        swalError(errMsg);
      }
    }
  };

  const currentOrders = (() => {
    // Exclude converted Project records from the Orders list (they belong in Projects view)
    const nonProjectOrders = orders.filter(o => {
      const typeStr = String(o.orderType || o.type || '').toUpperCase();
      return typeStr !== 'PROJECT';
    });

    let list = workflowTab === 'history'
      ? nonProjectOrders.filter(o => {
        const status = resolveLiveOrderStatus(o);
        return status === 'completed' || status === 'delivered';
      })
      : workflowTab === 'active'
        ? nonProjectOrders.filter(o => {
          const status = resolveLiveOrderStatus(o);
          return status !== 'completed' && status !== 'delivered';
        })
        : nonProjectOrders;

    // Concierge Portal Visibility: Concierge sees Concierge Requests + Marketplace orders of upgraded clients only
    if (portalRole === 'concierge' || normalizedRole === 'concierge') {
      list = list.filter(o => isOrderVisibleToConcierge(o, clients));
    }

    return [...list].sort((a, b) => {
      const timeA = new Date(a.createdAt || a.created_at || a.updatedAt || a.updated_at || a.order_date || a.date || 0).getTime();
      const timeB = new Date(b.createdAt || b.created_at || b.updatedAt || b.updated_at || b.order_date || b.date || 0).getTime();
      if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) return timeB - timeA;
      const numA = parseInt(String(a.rawId || a.id || 0).replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(String(b.rawId || b.id || 0).replace(/\D/g, ''), 10) || 0;
      return numB - numA;
    });
  })();

  const pagination = React.useMemo(() => {
    if (ordersData?.data?.pagination) return ordersData.data.pagination;
    if (ordersData?.pagination) return ordersData.pagination;
    const totalItems = currentOrders.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / 10));
    return {
      page: page,
      limit: 10,
      total: totalItems,
      totalPages: totalPages
    };
  }, [ordersData, currentOrders.length, page]);

  const handleAction = (type, order) => {
    setSelectedOrder(order);
    setModalType(type);
    setIsModalOpen(true);
  };

  const handleSave = async (formData) => {
    try {
      if (modalType === 'add') {
        await createOrderMutation.mutateAsync(formData);
      } else if (modalType === 'edit') {
        await updateOrderMutation.mutateAsync({ id: selectedOrder.id, orderData: formData });
      }
      setIsModalOpen(false);
      swalSuccess('Order saved successfully.');
    } catch (err) {
      const errMsg = err?.response?.data?.message || err?.message || 'Failed to save order.';
      swalError(errMsg);
    }
  };



  const handleDelete = async (id) => {
    const result = await swalConfirm('Delete Order', `Are you sure you want to delete order #${id}?`);
    if (result.isConfirmed) {
      try {
        await deleteOrderMutation.mutateAsync(id);
        setIsModalOpen(false);
        swalSuccess(`Order #${id} has been successfully deleted.`);
      } catch (err) {
        swalError('Failed to delete order.');
      }
    }
  };

  const paymentBadgeForOrder = (orderRow) => {
    const orderId = String(orderRow?.id ?? '').replace(/\D/g, '');
    const inv = (invoices || []).find((x) => String(x?.orderId ?? '').replace(/\D/g, '') === orderId);
    if (!inv) return { label: 'No Invoice', cls: 'bg-muted/20 text-muted' };
    const st = String(inv.status || '').toLowerCase();
    const paid = Number(inv.paidAmount || 0);
    const total = Number(inv.totalAmount || 0);
    if (st === 'paid' || (total > 0 && paid >= total)) return { label: 'Paid', cls: 'bg-success/20 text-success' };
    if (st.includes('partial') || (paid > 0 && total > 0 && paid < total)) return { label: 'Partially Paid', cls: 'bg-info/20 text-info' };
    if (st === 'overdue') return { label: 'Overdue', cls: 'bg-danger/20 text-danger' };
    return { label: 'Unpaid', cls: 'bg-warning/20 text-warning' };
  };

  const columns = [
    { header: "Order ID", accessor: "id" },
    {
      header: "Client",
      accessor: "client",
      render: (row) => formatClientDisplayName(row, clients, [...(users || []), ...(customerUsers || [])])
    },
    {
      header: "Order Type",
      accessor: "type",
      render: (row) => (
        <span className="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-[10px] font-black uppercase tracking-widest text-accent">
          {row.orderType || row.type || "Custom Order"}
        </span>
      )
    },
    {
      header: "Items",
      accessor: "items",
      render: (row) => {
        const typeUpper = String(row.orderType || row.type || "").toUpperCase();
        if (typeUpper.includes('CHAUFFEUR')) return "VIP Chauffeur Service";
        if (typeUpper.includes('CONCIERGE')) return "Bespoke Concierge Request";

        let itms = row.items && row.items.length > 0 ? row.items : (row.customItems || []);
        if (typeof itms === 'string') {
          try { itms = JSON.parse(itms); } catch { itms = []; }
        }

        if (Array.isArray(itms) && itms.length > 0) {
          const first = itms[0];
          const name = first?.item?.name || first?.name || first?.itemName || first?.title || first?.description;
          if (name && String(name).trim() && name !== 'Unknown Item') {
            return itms.length > 1 ? `${name} (+${itms.length - 1} more)` : name;
          }
        }

        const meta = typeof row.metadata === 'string'
          ? (() => { try { return JSON.parse(row.metadata); } catch { return {}; } })()
          : (row.metadata || {});

        const metaItems = meta.customItems || meta.manifestItems || [];
        if (Array.isArray(metaItems) && metaItems.length > 0) {
          const mName = metaItems[0]?.name || metaItems[0]?.title || metaItems[0]?.itemName;
          if (mName && String(mName).trim() && mName !== 'Unknown Item') {
            return metaItems.length > 1 ? `${mName} (+${metaItems.length - 1} more)` : mName;
          }
        }

        return row.product || row.type || "VIP Chauffeur Service";
      }
    },
    { header: "Vendor", accessor: "vendor", render: (row) => row.vendor_name || row.vendor?.name || row.vendor?.companyName || (typeof row.vendor === 'string' ? row.vendor : null) || "N/A" },
    {
      header: "Total Value",
      accessor: "totalAmount",
      render: (row) => {
        const typeUpper = String(row.orderType || row.type || "").toUpperCase();
        const meta = typeof row.metadata === 'string'
          ? (() => { try { return JSON.parse(row.metadata); } catch { return {}; } })()
          : (row.metadata || {});

        if (typeUpper.includes('CHAUFFEUR')) {
          const sType = row.serviceType || meta.customItems?.[0]?.serviceType || meta.serviceType || 'One Way';
          const days = parseInt(row.numberOfDays || row.dailyDays || meta.customItems?.[0]?.numberOfDays || meta.numberOfDays || 1, 10) || 1;
          const qty = sType === 'Round Trip' ? 2 : (sType === 'Daily Service' ? days : 1);
          const normalizedTotal = 120 * qty;
          return <span className="font-black text-accent">${parseFloat(normalizedTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
        }

        const itms = row.items && row.items.length > 0 ? row.items : (row.customItems || meta.customItems || []);

        let total = parseFloat(
          row.totalAmount ||
          row.total_amount ||
          row.estimated_total ||
          row.amount ||
          row.total ||
          row.chauffeurFee ||
          row.chauffeur_fee ||
          meta.chauffeurFee ||
          meta.chauffeur_fee ||
          meta.total_amount ||
          (itms[0] && (itms[0].chauffeurFee || itms[0].chauffeur_fee || itms[0].price || itms[0].fee || itms[0].unitPrice)) ||
          0
        );

        if (total === 0 && Array.isArray(itms) && itms.length > 0) {
          total = itms.reduce((acc, i) => acc + (parseFloat(i.price || i.unitPrice || i.chauffeurFee || i.chauffeur_fee || 0) * parseInt(i.qty || i.quantity || 1)), 0);
        }
        return <span className="font-black text-accent">${parseFloat(total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
      }
    },
    {
      header: "Status",
      accessor: "status",
      render: (row) => {
        const liveSt = resolveLiveOrderStatus(row);
        const isDone = ['completed', 'delivered'].includes(liveSt);
        const isTransit = ['in_transit', 'en_route'].includes(liveSt);
        const isAssigned = liveSt === 'assigned';
        const isLogistics = liveSt === 'logistics';
        const isOperation = liveSt === 'operation';
        const isConcierge = liveSt === 'concierge';
        const isCancelled = ['cancelled', 'rejected'].includes(liveSt);

        const badgeCls = isDone
          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
          : isTransit
            ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
            : isAssigned
              ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
              : isLogistics
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                : isOperation
                  ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                  : isConcierge
                    ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                    : isCancelled
                      ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      : 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30';

        return (
          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${badgeCls}`}>
            {displayOrderStatus(liveSt)}
          </span>
        );
      }
    },
    {
      header: "Payment",
      accessor: "id",
      render: (row) => {
        const badge = paymentBadgeForOrder(row);
        return (
          <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${badge.cls}`}>
            {badge.label}
          </span>
        );
      }
    },
    {
      header: "Delivery",
      accessor: "id",
      render: (row) => {
        const orderStatusNorm = String(row?.status || '').toLowerCase();
        const rowOrderNum = Number(String(row?.id ?? '').replace(/\D/g, '')) || null;
        const delivery = (deliveries || []).find((d) => {
          const deliveryOrderNum =
            Number(d?.order_id_raw) ||
            Number(String(d?.orderId ?? '').replace(/\D/g, '')) ||
            null;
          return rowOrderNum != null && deliveryOrderNum != null && rowOrderNum === deliveryOrderNum;
        });

        if (delivery) {
          return (
            <div className="flex flex-col gap-1">
              <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${delivery.status === 'Completed' || delivery.status === 'Delivered' ? 'bg-success/20 text-success' :
                delivery.status === 'In Transit' ? 'bg-info/20 text-info' :
                  delivery.status === 'Pending' || delivery.status === 'Pending Pickup' ? 'bg-warning/20 text-warning' : 'bg-muted/20 text-muted'
                }`}>
                {delivery.status === 'Pending Pickup' ? 'Awaiting Pickup' : delivery.status}
              </span>
              {(delivery.status === 'Completed' || delivery.status === 'Delivered') && delivery.deliveryDate && (
                <span className="text-[9px] font-black text-muted uppercase tracking-tighter">
                  {new Date(delivery.deliveryDate).toLocaleDateString()}
                </span>
              )}
            </div>
          );
        }

        if (['created', 'admin_review', 'pending_review'].includes(orderStatusNorm)) {
          return (
            <div className="flex flex-col gap-1">
              <span className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase bg-warning/20 text-warning">
                Awaiting Admin Review
              </span>
            </div>
          );
        }
        if (orderStatusNorm === 'concierge') {
          return (
            <div className="flex flex-col gap-1">
              <span className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase bg-accent/20 text-accent border border-accent/25">
                Concierge triage
              </span>
            </div>
          );
        }
        if (orderStatusNorm === 'logistics') {
          return (
            <div className="flex flex-col gap-1">
              <span className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase bg-info/20 text-info border border-info/25">
                With logistics — assign driver in Deliveries
              </span>
            </div>
          );
        }
        if (orderStatusNorm === 'operation') {
          return (
            <div className="flex flex-col gap-1">
              <span className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase bg-info/20 text-info border border-info/25">
                In Operations
              </span>
            </div>
          );
        }
        if (orderStatusNorm === 'procurement') {
          return (
            <div className="flex flex-col gap-1">
              <span className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase bg-warning/20 text-warning border border-warning/25">
                In Procurement
              </span>
            </div>
          );
        }
        if (orderStatusNorm === 'inventory') {
          return (
            <div className="flex flex-col gap-1">
              <span className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase bg-accent/20 text-accent border border-accent/25">
                In Storage
              </span>
            </div>
          );
        }
        if (orderStatusNorm === 'completed') {
          return (
            <div className="flex flex-col gap-1">
              <span className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase bg-success/20 text-success border border-success/25">
                Completed
              </span>
            </div>
          );
        }
        if (orderStatusNorm === 'cancelled') {
          return (
            <div className="flex flex-col gap-1">
              <span className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase bg-danger/20 text-danger border border-danger/25">
                Cancelled
              </span>
            </div>
          );
        }

        return (
          <div className="flex flex-col gap-1">
            <span className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase bg-muted/20 text-muted border border-white/5">
              N/A
            </span>
          </div>
        );
      }
    },
    { header: "Date", accessor: "date", render: (item) => item.date || item.requestDate || item.order_date || isoDateSlice(item.created_at || item.createdAt) || '-' },
  ];

  return (
    <div className="space-y-8">
      <div className="no-print space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Order Management</h1>
            <p className="text-secondary mt-1">Track and manage multi-line supply chain requests and deliveries.</p>
            {!canStaffCreateOrder && !isBusinessClient && (
              <p className="text-[10px] font-bold text-muted mt-2 uppercase tracking-wide">
                Manual order creation is limited to staff only — customers use Marketplace / staff-assisted fulfilment.
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button className="btn-secondary flex items-center gap-2" onClick={() => navigate('/dashboard/invoices')}>
              <FileText size={16} /> Ledger / Invoices
            </button>
            {(canStaffCreateOrder || isBusinessClient) && (hasMenuPermission('Orders', 'can_add') || isBusinessClient) && (
              <button className="btn-primary flex items-center gap-2" onClick={() => handleAction('add', {})}>
                <Plus size={16} /> Create Order
              </button>
            )}
          </div>
        </div>

        <div className="glass-card p-6">
          {/* Workflow tabs */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1 border border-white/10">
              {[
                { key: 'all', label: 'All Orders' },
                { key: 'active', label: 'Active Orders' },
                { key: 'history', label: 'Record / History' }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setWorkflowTab(tab.key);
                    setPage(1);
                  }}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${workflowTab === tab.key
                      ? 'bg-accent text-white shadow'
                      : 'text-white/50 hover:text-white hover:bg-white/10'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
              <input
                type="text"
                placeholder="Search by ID, Client or Items..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-background border border-border rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center p-12"><RefreshCcw className="animate-spin text-accent" /></div>
          ) : error ? (
            <div className="text-danger p-4">Failed to load orders.</div>
          ) : (
            <Table
              columns={columns}
              data={currentOrders}
              pagination={pagination}
              onPageChange={setPage}
              actions={true}
              onView={(item) => handleAction('view', item)}
              onEdit={(item) => handleAction('edit', item)}
              onDelete={(item) => handleDelete(item.id)}
              canEdit={(row) => {
                const status = resolveLiveOrderStatus(row);
                return (status !== 'completed' && status !== 'delivered') && (hasMenuPermission('Orders', 'can_edit') || isBusinessClient);
              }}
              canDelete={(row) => {
                const status = resolveLiveOrderStatus(row);
                return (status !== 'completed' && status !== 'delivered') && (hasMenuPermission('Orders', 'can_delete') || isBusinessClient);
              }}
              customAction={(item) => {
                const liveSt = resolveLiveOrderStatus(item);
                const isCompleted = ['completed', 'delivered'].includes(liveSt);
                const rawSt = String(item.status || '').toLowerCase();
                const isPending = ['created', 'admin_review', 'pending', 'pending_review', 'submitted', 'draft'].includes(rawSt) ||
                  ['created', 'admin_review', 'pending', 'pending_review', 'submitted', 'draft'].includes(liveSt);

                if (isCompleted) {
                  return null;
                }

                // Accept and Reject buttons are shown ONLY in the Admin section (superadmin, admin, saas_client)
                const isAdmin = ['superadmin', 'admin', 'saas_client'].includes(normalizedRole);
                if (!isAdmin || !isPending) {
                  return null;
                }

                return (
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleAcceptOrder(item)}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 hover:text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
                      title="Accept & forward order for fulfilment"
                    >
                      <CheckCircle size={13} className="text-emerald-400" />
                      <span>Accept Order</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRejectOrder(item)}
                      className="p-1.5 rounded-lg text-secondary hover:text-rose-400 hover:bg-rose-500/10 border border-white/5 hover:border-rose-500/30 transition-all active:scale-95 cursor-pointer"
                      title="Reject / Cancel Order"
                    >
                      <XCircle size={13} />
                    </button>
                  </div>
                );
              }}
            />
          )}
        </div>
      </div>

      <OrderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        modalType={modalType}
        selectedOrder={selectedOrder}
        onSave={handleSave}
        onDelete={handleDelete}
        role={currentUser?.role}
      />
      <InvoiceGenerationModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        order={selectedOrderForInvoice}
        onGenerate={(orderWithDetails) => {
          generateInvoiceFromOrder(orderWithDetails);
          navigate('/dashboard/invoices');
        }}
      />
      <OrderTimeline
        isOpen={!!timelineOrder}
        onClose={() => setTimelineOrder(null)}
        orderId={timelineOrder?.id}
        orderNumber={timelineOrder?.orderNumber}
      />
    </div>
  );
};

export default Orders;
