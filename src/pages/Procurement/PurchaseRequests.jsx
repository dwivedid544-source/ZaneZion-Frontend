import React, { useState } from 'react';
import Table from '../../components/Table';
import { swalWarning, swalSuccess, swalError } from '../../utils/swal';
import { Search, Plus, RefreshCcw } from 'lucide-react';
import { useData } from '../../context/GlobalDataContext';
import RequestModal from '../../components/RequestModal';
import Pagination from '../../components/Common/Pagination';
import { normalizeRole } from '../../utils/authUtils';
import { formatDateTimeEst } from '../../utils/dateEst';
import { usePurchaseRequests, useCreatePR, useUpdatePR, useDeletePR } from '../../hooks/api/useProcurement';

const PurchaseRequests = () => {
  const {
    purchaseRequests: mockRequests,
    addPurchaseRequest,
    updatePurchaseRequest,
    deletePurchaseRequest,
    fetchProcurement,
    hasMenuPermission,
    currentUser,
    fetchCustomerUsers,
    fetchStaff,
    fetchClients,
<<<<<<< HEAD
    clients,
=======
    users = [],
    customerUsers = [],
>>>>>>> 7681f7f91c603a6118bcabdcafe5674fcc7a055c
  } = useData();

  React.useEffect(() => {
    window._allGlobalUsers = [...users, ...customerUsers];
  }, [users, customerUsers]);

  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: prData, isLoading, error } = usePurchaseRequests(page, 10, searchTerm);

  const purchaseRequests = prData?.purchaseRequests || (mockRequests || []);
  const meta = prData ? { totalPages: prData.totalPages, totalItems: prData.total } : { totalPages: 1, totalItems: purchaseRequests.length };

  const createPRMutation = useCreatePR();
  const updatePRMutation = useUpdatePR();
  const deletePRMutation = useDeletePR();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('view');
  const [selectedRequest, setSelectedRequest] = useState(null);

  const portalRole = normalizeRole(currentUser?.role);
  const rawRoleStr = typeof currentUser?.role === 'object' ? (currentUser?.role?.name || '') : String(currentUser?.role || '');
  const normalizeId = (id) => id ? String(id).replace('CLT-', '') : '';
  const currentClient = (clients || []).find(c => {
    const cId = normalizeId(c.id);
    const uId = normalizeId(currentUser?.clientId || currentUser?.companyId || currentUser?.company_id);
    return cId && uId && cId === uId;
  });
  const isBusinessClient = portalRole === 'client' && (
    rawRoleStr.toLowerCase().includes('business') ||
    currentClient?.clientType === 'Business' ||
    currentClient?.client_type === 'Business'
  );

  const userRole = String(currentUser?.role?.name || currentUser?.role || '').toLowerCase().replace(/\s+/g, '_');
  const isCustomer = ['customer', 'saas_client', 'client'].includes(userRole) && !isBusinessClient;

  React.useEffect(() => {
    fetchProcurement();
    // Only fetch users/clients if the role has the required menu permissions
    if (hasMenuPermission('Personnel', 'can_view') || ['procurement', 'procurement_staff', 'admin', 'super_admin', 'superadmin'].includes(userRole)) {
      fetchStaff();
      fetchCustomerUsers({ include_all: 1 });
    }
    if (hasMenuPermission('Clients', 'can_view') || portalRole === 'client') {
      fetchClients();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  const handleAction = (type, req) => {
    setSelectedRequest(req);
    setModalType(type);
    setIsModalOpen(true);
  };

  const handleSave = async (formData) => {
    if (modalType === 'add') {
      try {
        await createPRMutation.mutateAsync(formData);
        swalSuccess('Purchase Request Created');
      } catch (e) {
        swalError('Failed to create Purchase Request');
      }
    } else if (modalType === 'edit') {
      try {
        await updatePRMutation.mutateAsync({ id: selectedRequest.id, data: formData });
        swalSuccess('Purchase Request Updated');
      } catch (e) {
        swalError('Failed to update Purchase Request');
      }
    } else if (modalType === 'delete') {
      try {
        const rawId = String(selectedRequest.id).replace('PR-', '').replace('REQ-', '');
        await deletePRMutation.mutateAsync(parseInt(rawId, 10));
        swalSuccess('Purchase Request Deleted');
      } catch (e) {
        swalError('Failed to delete Purchase Request');
      }
    }
    setIsModalOpen(false);
  };

  const handleDelete = async (id) => {
    try {
      await deletePRMutation.mutateAsync(id);
      swalSuccess('Purchase Request Deleted');
    } catch (e) {
      swalError('Failed to delete Purchase Request');
    }
    setIsModalOpen(false);
  };

  const columns = [
    {
      header: "Request ID",
      accessor: "requestId",
      render: (item) => item.prNumber || item.requestId || `REQ-${item.id}`
    },
    {
      header: "Items",
      accessor: "items",
      render: (item) => {
        const items = Array.isArray(item.items) ? item.items : [];
        if (items.length === 0) return item.item || "No Items";
        const firstItemName = items[0].name || items[0].itemName || "Unknown Item";
        if (items.length === 1) return firstItemName;
        return `${firstItemName} (+${items.length - 1} more)`;
      },
    },
    {
      header: "Requester",
      accessor: "requester",
      render: (item) => {
        // Try looking up the injected created_by (userId) or the requester's ID from our global user list
        const requesterId = item.created_by || (item.requester && typeof item.requester === 'object' ? item.requester.id : null);
        if (requesterId && window._allGlobalUsers) {
           const matchedUser = window._allGlobalUsers.find(u => Number(u.id) === Number(requesterId));
           if (matchedUser) return matchedUser.name;
        }
        
        if (item.requester && typeof item.requester === 'object') {
          return `${item.requester.firstName || ''} ${item.requester.lastName || ''}`.trim() || 'Unknown';
        }
        return item.requester || "Unknown";
      }
    },
    {
      header: "Total Est.",
      accessor: "total",
      render: (item) => {
        const items = Array.isArray(item.items) ? item.items : [];
        const total = item.total || items.reduce((acc, i) => {
          const itemPrice = parseFloat(i.price ?? i.estimatedCost ?? i.estimated_cost ?? 0);
          const itemQty = parseFloat(i.qty ?? i.quantity ?? 0);
          return acc + (itemPrice * itemQty);
        }, 0);
        return `$${parseFloat(total || 0).toLocaleString()}`;
      },
    },
    {
      header: "Department",
      accessor: "department",
      render: (item) => {
        if (item.department && typeof item.department === 'object') {
          return item.department.name || 'Unknown';
        }
        return item.department || "Unknown";
      }
    },
    { header: "Status", accessor: "status" },
    {
      header: "Date / Time (EST)",
      accessor: "date",
      render: (item) => formatDateTimeEst(item.created_at || item.createdAt || item.date || item.requestDate),
    },
  ];

  const handleNewRequest = () => {
    const role = normalizeRole(currentUser?.role);
    const clientType = currentUser?.client_type || 'Individual';
    const isPremium = currentUser?.plan?.toLowerCase().includes('premium') || currentUser?.is_upgraded;

    if (role === 'customer' && clientType === 'Individual' && !isPremium) {
      swalWarning('Upgrade Required', 'Individuals need to upgrade to a Premium Plan ($10/mo) to submit purchase requests.');
      return;
    }

    handleAction('add', {});
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white italic uppercase tracking-tighter">Purchase Requests</h1>
          <p className="text-secondary mt-1 text-sm font-medium opacity-80 italic uppercase tracking-widest">Review and approve procurement requests from departments.</p>
        </div>
        {(hasMenuPermission('Purchase Requests', 'can_add') || isCustomer || isBusinessClient) && (
          <button className="btn-primary flex items-center gap-2 px-6 py-3 rounded-xl shadow-lg shadow-accent/20" onClick={handleNewRequest}>
            <Plus size={16} /> New Request
          </button>
        )}
      </div>

      <div className="glass-card p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
            <input
              type="text"
              placeholder="Search by ID, Requester or Item..."
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
          <div className="text-danger p-4">Failed to load purchase requests.</div>
        ) : (
          <>
            <Table
              columns={columns}
              data={purchaseRequests}
              actions={true}
              onView={(item) => handleAction('view', item)}
              onEdit={(item) => handleAction('edit', item)}
              onDelete={(item) => handleAction('delete', item)}
              canEdit={hasMenuPermission('Purchase Requests', 'can_edit') || userRole === 'saas_client' || isBusinessClient}
              canDelete={hasMenuPermission('Purchase Requests', 'can_delete') || userRole === 'saas_client' || isBusinessClient}
            />
            <div className="mt-6 border-t border-white/5 pt-6">
              <Pagination currentPage={page} totalPages={meta.totalPages} onPageChange={setPage} totalItems={meta.totalItems} />
            </div>
          </>
        )}
      </div>

      <RequestModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        selectedRequest={selectedRequest}
        modalType={modalType}
      />
    </div>
  );
};

export default PurchaseRequests;
