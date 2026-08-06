import React, { useState, useRef } from 'react';
import { swalSuccess, swalError, swalWarning, swalInfo, swalConfirm } from '../../utils/swal';
import Table from '../../components/Table';
import { useData } from '../../context/GlobalDataContext';
import { isoDateSlice, displayOrderStatus } from '../../utils/orderWorkflow';
import { Search, Plus, PackageCheck, PackageX, FileText, CheckCircle, ShoppingCart, Truck, Warehouse, ArrowRightCircle, RefreshCcw, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useOrders, useUpdateOrderStatus, useCreateOrder, useUpdateOrder, useDeleteOrder } from '../../hooks/api/useOrders';
import { useQueryClient } from '@tanstack/react-query';
import OrderModal from '../../components/OrderModal';
import InvoiceGenerationModal from '../../components/InvoiceGenerationModal';
import OrderTimeline from '../../components/OrderTimeline';
import { normalizeRole, roleCanCreateInstitutionalOrder } from '../../utils/authUtils';

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
    deliveries, purchaseRequests, stockMovements,
    addProject, invoices, projects, generateInvoiceFromOrder,
    currentUser, launchMissionFromOrder, convertOrderToProject,
    fetchVendors, fetchClients, clients,
    hasMenuPermission
  } = useData();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [workflowTab, setWorkflowTab] = useState('all'); // 'all' | 'current' | 'processed'
  const [timelineOrder, setTimelineOrder] = useState(null); // { id, orderNumber }

  const { data: ordersData, isLoading, error } = useOrders(page, 10, searchTerm);
  const orders = ordersData?.data?.orders || [];
  const pagination = ordersData?.data
    ? {
      page: ordersData.data.page || 1,
      total: ordersData.data.total || 0,
      limit: 10,
      totalPages: ordersData.data.totalPages || 1,
    }
    : null;
  const updateOrderStatusMutation = useUpdateOrderStatus();
  const createOrderMutation = useCreateOrder();
  const updateOrderMutation = useUpdateOrder();
  const deleteOrderMutation = useDeleteOrder();

  React.useEffect(() => {
    fetchVendors();
    fetchClients();
  }, [fetchVendors, fetchClients]);

  const normalizedRole = normalizeRole(currentUser?.role);
  const portalRole = normalizeRole(currentUser?.role);
  const canStaffCreateOrder = roleCanCreateInstitutionalOrder(portalRole);

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
    const oIdStr = String(o.id || '');
    const oRawIdStr = String(o.rawId || o.id || '').replace(/\D/g, '');
    let normItems = o.items || o.customItems || [];
    if (typeof normItems === 'string') { try { normItems = JSON.parse(normItems); } catch { normItems = []; } }
    const firstItemName = String((normItems?.[0]?.name || normItems?.[0]?.title || o.product || '').toLowerCase()).trim();

    const dbStatus = String(o.status || '').toLowerCase();
    if (['completed', 'delivered', 'done'].includes(dbStatus)) return 'completed';

    // 1. Find linked projects
    const linkedProjects = (projects || []).filter(p => {
      const pRef = String(p.orderRef || p.order_ref || p.orderId || p.order_id || p.metadata?.orderRef || p.metadata?.order_ref || p.metadata?.orderId || '');
      const pName = String(p.name || p.metadata?.name || '').toLowerCase();
      const pId = String(p.id || '');
      return (
        (pRef && (pRef === oIdStr || pRef === oRawIdStr || pRef === `ORD-${oIdStr}` || pRef === `ORD-${oRawIdStr}`)) ||
        (pId && (pId === oIdStr || pId === oRawIdStr)) ||
        (firstItemName && firstItemName.length > 3 && pName.includes(firstItemName))
      );
    });
    const linkedProjectIds = linkedProjects.map(p => String(p.id));

    // 2. Find linked mission
    const linkedMission = (missions || []).find(m => {
      const mOrderId = String(m.orderId || m.order_id || m.order_id_raw || m.metadata?.orderId || m.metadata?.orderRef || m.metadata?.order_ref || '');
      const mProjectId = String(m.projectId || m.project_id || m.metadata?.projectId || m.metadata?.projectRef || '');
      const mName = String(m.metadata?.project_name || m.route || '').toLowerCase();
      return (
        mOrderId === oIdStr ||
        mOrderId === oRawIdStr ||
        mOrderId === `ORD-${oIdStr}` ||
        mOrderId === `ORD-${oRawIdStr}` ||
        linkedProjectIds.includes(mOrderId) ||
        linkedProjectIds.includes(mProjectId) ||
        (firstItemName && firstItemName.length > 3 && mName.includes(firstItemName))
      );
    });

    // 3. Find linked delivery
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

    if (linkedDelivery) {
      const delSt = String(linkedDelivery.status || '').toLowerCase();
      if (['delivered', 'completed'].includes(delSt)) return 'completed';
      if (['in_transit', 'en_route', 'on_way'].includes(delSt)) return 'in_transit';
      if (['assigned', 'accepted'].includes(delSt) || linkedDelivery.driver) return 'assigned';
      return 'logistics';
    }
    if (linkedMission) {
      const misSt = String(linkedMission.status || '').toLowerCase();
      if (['delivered', 'completed', 'done'].includes(misSt)) return 'completed';
      if (['in_transit', 'en_route', 'dispatched'].includes(misSt)) return 'in_transit';
      if (['assigned', 'accepted', 'in_progress'].includes(misSt)) return 'assigned';
      return 'logistics';
    }
    if (linkedProjects.length > 0) {
      const hasCompletedPrj = linkedProjects.some(p => ['completed', 'delivered'].includes(String(p.status || '').toLowerCase()));
      if (hasCompletedPrj) return 'completed';
      return 'logistics';
    }

    return dbStatus || 'pending';
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

  const handleApprove = async (order, stage) => {
    const result = await swalConfirm('Confirm Approval', `Are you sure you want to move Order #${order.id} to ${stage.toUpperCase()} stage?`);
    if (result.isConfirmed) {
      try {
        await updateOrderStatusMutation.mutateAsync({ id: order.id, status: stage });
        if (syncGlobalState) await syncGlobalState();
        window.dispatchEvent(new CustomEvent('app:state-changed'));
        swalSuccess(`Order #${order.id} has been successfully moved to ${stage}.`);
      } catch (err) {
        swalError('Failed to update order status.');
      }
    }
  };

  const currentOrders = (() => {
    // Exclude converted Project records from the Orders list (they belong in Projects view)
    const nonProjectOrders = orders.filter(o => {
      const typeStr = String(o.orderType || o.type || '').toUpperCase();
      return typeStr !== 'PROJECT';
    });

    const list = workflowTab === 'history'
      ? nonProjectOrders.filter(o => {
          const status = resolveLiveOrderStatus(o);
          return status === 'completed' || status === 'delivered';
        })
      : nonProjectOrders.filter(o => {
          const status = resolveLiveOrderStatus(o);
          return status !== 'completed' && status !== 'delivered';
        });

    return [...list].sort((a, b) => {
      const timeA = new Date(a.createdAt || a.created_at || a.updatedAt || a.updated_at || a.order_date || a.date || 0).getTime();
      const timeB = new Date(b.createdAt || b.created_at || b.updatedAt || b.updated_at || b.order_date || b.date || 0).getTime();
      if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) return timeB - timeA;
      const numA = parseInt(String(a.rawId || a.id || 0).replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(String(b.rawId || b.id || 0).replace(/\D/g, ''), 10) || 0;
      return numB - numA;
    });
  })();

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
      render: (row) => {
        const meta = typeof row.metadata === 'string' ? (() => { try { return JSON.parse(row.metadata); } catch { return {}; } })() : (row.metadata || {});
        const isGeneric = (str) => !str || ['person', 'personal client', 'personal', 'guest', 'client', 'null', 'undefined'].includes(String(str).trim().toLowerCase());
        const isEmail = (str) => str && String(str).includes('@');

        const rowEmail = (row.email || row.user?.email || row.client?.email || meta.email || '').toLowerCase();
        const rowClientId = String(row.clientId || row.client_id || row.customer_id || row.userId || row.user_id || '').replace('CLT-', '');

        const matchedClient = (clients || []).find(c => {
          const cId = String(c.id || '').replace('CLT-', '');
          const cEmail = String(c.email || '').toLowerCase();
          return (rowClientId && cId === rowClientId) || (rowEmail && cEmail && cEmail === rowEmail);
        });

        let resolvedName = null;
        // Priority: real name fields — skip generic terms & email strings as names
        if (!isGeneric(row.client?.contactPerson) && !isEmail(row.client?.contactPerson)) {
          resolvedName = row.client.contactPerson;
        } else if (matchedClient && !isGeneric(matchedClient.name) && !isEmail(matchedClient.name)) {
          resolvedName = matchedClient.name;
        } else if (matchedClient && !isGeneric(matchedClient.companyName || matchedClient.business_name) && !isEmail(matchedClient.companyName || matchedClient.business_name)) {
          resolvedName = matchedClient.companyName || matchedClient.business_name;
        } else if (matchedClient && !isGeneric(matchedClient.contactPerson) && !isEmail(matchedClient.contactPerson)) {
          resolvedName = matchedClient.contactPerson;
        } else if (!isGeneric(row.customer_name) && !isEmail(row.customer_name)) {
          resolvedName = row.customer_name;
        } else if (!isGeneric(row.created_by_name) && !isEmail(row.created_by_name)) {
          resolvedName = row.created_by_name;
        } else if (!isGeneric(meta.clientName || meta.client_name) && !isEmail(meta.clientName || meta.client_name)) {
          resolvedName = meta.clientName || meta.client_name;
        } else if (!isGeneric(row.user?.name) && !isEmail(row.user?.name)) {
          resolvedName = row.user.name;
        } else if (!isGeneric(row.client?.companyName) && !isEmail(row.client?.companyName)) {
          resolvedName = row.client.companyName;
        } else if (!isGeneric(row.client?.name) && !isEmail(row.client?.name)) {
          resolvedName = row.client.name;
        }

        if (!resolvedName && matchedClient?.email) {
          resolvedName = matchedClient.email;
        }

        return resolvedName || "Personal Client";
      }
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
        const meta = typeof row.metadata === 'string'
          ? (() => { try { return JSON.parse(row.metadata); } catch { return {}; } })()
          : (row.metadata || {});

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
        const isLogistics = liveSt === 'logistics' || liveSt === 'assigned';
        const badgeCls = isDone ? 'bg-success/20 text-success border border-success/25' :
          isTransit ? 'bg-info/20 text-info border border-info/25' :
          isLogistics ? 'bg-accent/20 text-accent border border-accent/25' :
          'bg-warning/20 text-warning border border-warning/25';

        return (
          <span className={`px-2 py-1 rounded-lg text-xs font-bold uppercase ${badgeCls}`}>
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
              {[{key:'all',label:'All Orders'},{key:'history',label:'Record / History'}].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setWorkflowTab(tab.key)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    workflowTab === tab.key
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
                const isLogisticsOrTransit = ['logistics', 'in_transit', 'assigned'].includes(liveSt);

                if (isCompleted || isLogisticsOrTransit) {
                  return null;
                }

                return canManageOrders ? (
                <div className="flex items-center gap-1 flex-wrap">
                  {(['superadmin', 'operations', 'admin', 'saas_client'].includes(normalizedRole) || isBusinessClient) &&
                    String(item.status).toLowerCase() !== 'completed' && String(item.status).toLowerCase() !== 'delivered' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const oid = item.id;
                        const orderRef = item.orderNumber || String(oid);
                        navigate('/dashboard/deliveries', {
                          state: {
                            prefillOrderId: oid,
                            orderId: orderRef,
                            items: (item.items && item.items.length > 0) ? item.items : (item.customItems || item.metadata?.customItems || []),
                            client: item.client,
                            clientId: item.clientId || item.client_id || item.customer_id || '',
                            customerId: item.customer_id || item.clientId || item.client_id || '',
                            location: item.location || item.delivery_address || '',
                            pickupLocation: item.pickupLocation || item.pickup_location || '',
                            dropLocation: item.location || item.delivery_address || item.deliveryAddress || '',
                            mode: item.deliveryType || item.delivery_mode || item.deliveryMode || item.mode || 'Road',
                            deliveryInstructions: item.delivery_instructions || item.deliveryInstructions || '',
                            deliveryFee: 0,
                          }
                        });
                      }}
                      className="p-2 rounded-lg text-secondary hover:text-accent hover:bg-accent/10 transition-all flex items-center justify-center font-bold text-[10px] gap-1 border border-white/5"
                      title="Delivery action — assign marketplace fulfilment for field staff"
                    >
                      <Truck size={14} /> Delivery
                    </button>
                  )}
                  {/* Admin approval: marketplace → logistics queue (whole team sees it; assign driver in Deliveries); bespoke → concierge */}
                  {['superadmin', 'admin', 'saas_client'].includes(normalizedRole) &&
                    ['created', 'admin_review', 'pending_review'].includes(String(item.status).toLowerCase()) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApprove(item, isCustomRequestFlowOrder(item) ? 'concierge' : 'logistics');
                        }}
                        className="p-2 rounded-lg text-secondary hover:text-success hover:bg-success/10 transition-all flex items-center justify-center font-bold text-[10px] gap-2"
                        title={isCustomRequestFlowOrder(item) ? 'Approve & send to Concierge' : 'Approve & send to Logistics (dispatch queue)'}
                      >
                        <CheckCircle size={14} />{' '}
                        <span>{isCustomRequestFlowOrder(item) ? 'Approve → Concierge' : 'Approve → Logistics'}</span>
                      </button>
                    )}

                  {/* Concierge triage: forward into supply chain */}
                  {['superadmin', 'concierge', 'admin', 'saas_client'].includes(normalizedRole) &&
                    String(item.status).toLowerCase() === 'concierge' && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleApprove(item, 'operation'); }}
                          className="p-1 px-2 rounded-lg text-secondary hover:text-info hover:bg-info/10 transition-all flex items-center justify-center font-bold text-[9px] gap-1.5 border border-white/5"
                          title="Hand off to Operations"
                        >
                          <ArrowRightCircle size={13} /> <span>To Operations</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleApprove(item, 'procurement'); }}
                          className="p-1 px-2 rounded-lg text-secondary hover:text-warning hover:bg-warning/10 transition-all flex items-center justify-center font-bold text-[9px] gap-1.5 border border-white/5"
                          title="Needs procurement / sourcing"
                        >
                          <ShoppingCart size={13} /> <span>To Procurement</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleApprove(item, 'logistics'); }}
                          className="p-1 px-2 rounded-lg text-secondary hover:text-accent hover:bg-accent/10 transition-all flex items-center justify-center font-bold text-[9px] gap-1.5 border border-accent/20"
                          title="Straight to dispatch when fulfilment is logistics-only"
                        >
                          <Truck size={13} /> <span>To Dispatch</span>
                        </button>
                      </>
                    )}

                  {/* Operations Actions: operation -> procurement OR inventory OR logistics */}
                  {['superadmin', 'operations'].includes(normalizedRole) &&
                    ['operation'].includes(String(item.status).toLowerCase()) && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleApprove(item, 'procurement'); }}
                          className="p-1 px-2 rounded-lg text-secondary hover:text-warning hover:bg-warning/10 transition-all flex items-center justify-center font-bold text-[9px] gap-1.5 border border-white/5"
                          title="Needs Procurement"
                        >
                          <ShoppingCart size={13} /> <span>Procure</span>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleApprove(item, 'inventory'); }}
                          className="p-1 px-2 rounded-lg text-secondary hover:text-info hover:bg-info/10 transition-all flex items-center justify-center font-bold text-[9px] gap-1.5 border border-white/5"
                          title="Move to Inventory"
                        >
                          <Warehouse size={13} /> <span>Stock</span>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleConvertToProject(item); }}
                          disabled={!!routingOrderId}
                          className={`p-1 px-2 rounded-lg transition-all flex items-center justify-center font-bold text-[9px] gap-1.5 border border-accent/20 shadow-lg shadow-accent/5 ${
                            routingOrderId === item.id
                              ? 'text-accent bg-accent/20 cursor-wait opacity-80'
                              : routingOrderId
                              ? 'text-muted/40 bg-white/5 cursor-not-allowed opacity-40'
                              : 'text-secondary hover:text-accent hover:bg-accent/10 bg-accent/5'
                          }`}
                          title={routingOrderId === item.id ? 'Creating project...' : 'Route to Project'}
                        >
                          <ArrowRightCircle size={13} />
                          <span>{routingOrderId === item.id ? 'Routing...' : 'Route to Project'}</span>
                        </button>
                      </>
                    )}

                  {/* Procurement to Inventory: procurement -> inventory */}
                  {['superadmin', 'procurement'].includes(normalizedRole) &&
                    ['procurement'].includes(String(item.status).toLowerCase()) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleApprove(item, 'inventory'); }}
                        className="p-2 rounded-lg text-secondary hover:text-info hover:bg-info/10 transition-all flex items-center justify-center font-bold text-[10px] gap-2"
                        title="Move to Inventory"
                      >
                        <Warehouse size={14} /> <span>Store</span>
                      </button>
                    )}

                  {/* Inventory to Logistics: inventory -> logistics */}
                  {['superadmin', 'inventory'].includes(normalizedRole) &&
                    ['inventory'].includes(String(item.status).toLowerCase()) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleApprove(item, 'logistics'); }}
                        className="p-2 rounded-lg text-secondary hover:text-info hover:bg-info/10 transition-all flex items-center justify-center font-bold text-[10px] gap-2"
                        title="Send for Dispatch"
                      >
                        <Truck size={14} /> <span>Dispatch</span>
                      </button>
                    )}

                  {/* Logistics to Completed: logistics -> completed */}
                  {['superadmin', 'logistics'].includes(normalizedRole) &&
                    ['logistics'].includes(String(item.status).toLowerCase()) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleApprove(item, 'completed'); }}
                        className="p-2 rounded-lg text-secondary hover:text-success hover:bg-success/10 transition-all flex items-center justify-center font-bold text-[10px] gap-2"
                        title="Mark as Delivered"
                      >
                        <PackageCheck size={14} /> <span>Deliver</span>
                      </button>
                    )}
                </div>
              ) : null;
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
