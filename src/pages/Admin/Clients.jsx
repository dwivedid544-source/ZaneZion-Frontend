import React, { useState } from 'react';
import { swalSuccess, swalError, swalWarning, swalInfo, swalConfirm, swalCredentials, swalCopied } from '../../utils/swal';
import { createPortal } from 'react-dom';
import { useData } from '../../context/GlobalDataContext';
import { useClients, useCreateClient, useUpdateClient, useDeleteClient } from '../../hooks/api/useCRM';
import { Search, Plus, Download, User, MapPin, Package, CreditCard, Eye, EyeOff, Edit2, ToggleLeft, ToggleRight, XCircle, X, Mail, Phone, Globe, Calendar, Shield, Activity, Trash2, ShoppingCart, ChevronDown, FileText, Truck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import BootstrapPagination from '../../components/Common/Pagination';
import api from '../../services/api/setupAxios.js';
import realApi from '../../services/api/setupAxios';
import { normalizeRole } from '../../utils/authUtils';
import { useQueryClient } from '@tanstack/react-query';

const Clients = () => {
  const queryClient = useQueryClient();
  const {
    currentUser,
    subscriptionRequests, fetchSubscriptionRequests, updateSubscriptionRequest,
    generateInvoiceFromOrder, addDelivery, hasMenuPermission, cancelPersonalMembership
  } = useData();
  const roleNormalized = normalizeRole(currentUser?.role);
  const isSuperAdmin = roleNormalized === 'superadmin';
  const isAdminRole = roleNormalized === 'admin' || roleNormalized === 'client' || roleNormalized === 'saas_client' || (!isSuperAdmin && hasMenuPermission('Staff Management', 'can_edit'));
  
  
  const [searchTerm, setSearchTerm] = useState('');
  const [debounceSearch, setDebounceSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [clientTypeFilter, setClientTypeFilter] = useState(isAdminRole ? 'Customers' : 'SaaS'); // 'SaaS' | 'Personal' | 'Customers'
  const itemsPerPage = 10;

  const activeClientType = isAdminRole ? 'Personal' : (clientTypeFilter === 'Website' ? undefined : (clientTypeFilter === 'Personal' ? 'Personal' : (clientTypeFilter === 'SaaS' ? 'SaaS' : undefined)));
  
  const { data: clientsData, isLoading: isLoadingClients } = useClients(currentPage, itemsPerPage, debounceSearch, activeClientType);
  const rawClientsData = clientsData?.data || [];
  const clientsList = Array.isArray(rawClientsData) ? rawClientsData : (rawClientsData.clients || rawClientsData.data || []);
  const meta = clientsData?.meta || { totalItems: 0, totalPages: 1 };
  
  const createMutation = useCreateClient();
  const updateMutation = useUpdateClient();
  const deleteMutation = useDeleteClient();

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebounceSearch(searchTerm);
      setCurrentPage(1); // Reset to page 1 on search
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  React.useEffect(() => {
    const loadData = async () => {
      if (!isAdminRole && clientTypeFilter === 'Website') {
        if (fetchSubscriptionRequests) await fetchSubscriptionRequests();
      }
    };
    loadData();
  }, [fetchSubscriptionRequests, clientTypeFilter, isAdminRole]);

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', password: '', location: '', source: 'Manual', clientType: 'SaaS',
    companyName: '', logo: '', plan: 'Starter', billingCycle: 'Monthly', paymentMethod: 'Wire Transfer',
    contact: '', address: '', status: 'active'
  });

  // --- Personal Client Orders (for View Modal) ---
  const [clientOrders, setClientOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [viewTab, setViewTab] = useState('details'); // 'details' | 'orders'

  const fetchClientOrders = async (companyId) => {
    setLoadingOrders(true);
    try {
      let res;
      try {
        res = await realApi.get(`/orders/by-company/${companyId}`);
      } catch (err) {
        console.warn('Real API failed, falling back to mock fetchClientOrders', err);
        res = await api.get(`/orders/by-company/${companyId}`);
      }
      const rawData = res.data?.success ? res.data.data : [];
      setClientOrders(rawData.map(o => {
        let parsedItems = o.items;
        if (typeof parsedItems === 'string') {
          try { parsedItems = JSON.parse(parsedItems); } catch { parsedItems = []; }
        }
        return { ...o, items: Array.isArray(parsedItems) ? parsedItems : [], total: parseFloat(o.total_amount || 0) };
      }));
    } catch (e) { console.error('Failed to fetch client orders', e); setClientOrders([]); }
    setLoadingOrders(false);
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      try {
        await realApi.put(`/orders/${orderId}/status`, { status: newStatus });
      } catch (err) {
        console.warn('Real API failed, falling back to mock updateOrderStatus', err);
        await api.patch(`/orders/${orderId}/status`, { status: newStatus });
      }
      setClientOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      swalSuccess('Updated', `Order #${orderId} status changed to ${newStatus}`);
    } catch (e) { swalError('Error', 'Failed to update order status'); }
  };

  const handleGenerateInvoice = async (order) => {
    try {
      const items = Array.isArray(order.items) ? order.items : [];
      await generateInvoiceFromOrder({
        id: order.id,
        items: items,
        clientId: order.company_id || selectedClient?.id,
        client_id: order.company_id || selectedClient?.id,
        dueDate: order.due_date ? order.due_date.split('T')[0] : null
      });
      setClientOrders(prev => prev.map(o => o.id === order.id ? { ...o, invoiceGenerated: true } : o));
      swalSuccess('Invoice Generated', `Invoice created for Order #${order.id}`);
    } catch (e) { swalError('Error', 'Failed to generate invoice'); }
  };

  // --- Delivery creation for personal client orders ---
  const [deliveryModal, setDeliveryModal] = useState({ isOpen: false, order: null });
  const [deliveryForm, setDeliveryForm] = useState({ driver_name: '', plate_number: '', pickup_location: '', drop_location: '', delivery_date: '', status: 'pending' });

  const handleCreateDelivery = async () => {
    const order = deliveryModal.order;
    if (!order) return;
    try {
      await addDelivery({
        orderId: order.id,
        company_id: order.company_id || selectedClient?.id,
        missionType: 'Delivery',
        driver: deliveryForm.driver_name,
        vehicleId: deliveryForm.plate_number,
        pickupLocation: deliveryForm.pickup_location,
        dropLocation: deliveryForm.drop_location || order.location,
        items: order.items,
        dueDate: deliveryForm.delivery_date || (order.due_date ? order.due_date.split('T')[0] : null),
        status: deliveryForm.status
      });
      setClientOrders(prev => prev.map(o => o.id === order.id ? { ...o, deliveryCreated: true } : o));
      setDeliveryModal({ isOpen: false, order: null });
      setDeliveryForm({ driver_name: '', plate_number: '', pickup_location: '', drop_location: '', delivery_date: '', status: 'pending' });
      swalSuccess('Delivery Created', `Delivery dispatched for Order #${order.id}`);
    } catch (e) { swalError('Error', 'Failed to create delivery'); }
  };

  // Build client list based on active filter
  // "clients" state is already filtered by backend via client_type param
  const allClients = (() => {
    if (clientTypeFilter === 'Website') {
       return (subscriptionRequests || [])
        .filter(r => (r.status || '').toLowerCase() !== 'approved')
        .filter(r => {
          if (!debounceSearch) return true;
          const q = debounceSearch.toLowerCase();
          return (r.client_name || r.clientName || r.name || '').toLowerCase().includes(q) || (r.email || '').toLowerCase().includes(q);
        })
        .map(r => ({
          id: `REQ-${r.id}`,
          name: r.client_name || r.clientName || r.name,
          email: r.email,
          phone: r.phone || '',
          clientType: 'SaaS',
          client_type: 'SaaS',
          location: r.country || 'Bahamas',
          source: 'Website',
          status: r.status || 'Pending',
          plan: r.plan || 'Starter',
          created_at: r.created_at,
          isRequest: true,
          requirements: r.requirements,
          company_name: r.company_name,
          contact_person: r.contact_person,
          payment_status: r.payment_status || 'Unpaid'
        }));
    }

    return clientsList.map(c => ({ ...c, isRequest: false }));
  })();

  const filteredClients = allClients.sort((a, b) => new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0));
  const currentItems = filteredClients.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Stats
  const totalClients = allClients.length;
  const activeClients = allClients.filter(c => (c.status || '').toLowerCase() === 'active').length;
  const pendingClients = allClients.filter(c => (c.status || '').toLowerCase() === 'pending').length;
  const inactiveClients = allClients.filter(c => ['inactive', 'deactivated'].includes((c.status || '').toLowerCase())).length;

  const handleView = (client) => {
    setSelectedClient(client);
    setViewTab('details');
    setClientOrders([]);
    setShowViewModal(true);
    // Auto-fetch orders for personal clients
    const isPersonal = (client.tagline === 'Personal' || client.client_type === 'Personal' || client.plan === 'Free');
    if (isPersonal && client.id && !client.isRequest) {
      fetchClientOrders(client.id);
    }
  };

  const handleEdit = (client) => {
    setSelectedClient(client);
    setFormData({
      name: client.companyName || client.name || client.business_name || '',
      email: client.email || '',
      phone: client.phone || '',
      password: '',
      location: client.location || '',
      address: client.address || '',
      city: client.city || '',
      country: client.country || '',
      source: client.source || 'Manual',
      clientType: client.clientType || client.client_type || 'SaaS',
      companyName: client.companyName || client.company_name || client.business_name || '',
      logo: client.logoUrl || client.logo || client.logo_url || '',
      plan: client.plan || 'Starter',
      billingCycle: client.billingCycle || client.billing_cycle || 'Monthly',
      paymentMethod: client.paymentMethod || client.payment_method || 'Wire Transfer',
      contact: client.contactPerson || client.contact || client.contact_person || '',
      status: client.status || 'active'
    });
    setErrors({});
    setShowEditModal(true);
  };

  const handleAdd = () => {
    setFormData({
      name: '', email: '', phone: '', password: '', location: '', source: 'Manual',
      clientType: isAdminRole ? 'Personal' : (clientTypeFilter === 'Website' ? 'SaaS' : clientTypeFilter),
      companyName: '', logo: '', plan: 'Starter', billingCycle: 'Monthly', paymentMethod: 'Wire Transfer',
      contact: '', address: '', city: '', country: '', status: 'active'
    });
    setErrors({});
    setShowAddModal(true);
  };

  const handleSaveEdit = async () => {
    setErrors({});
    if (formData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        setErrors(prev => ({ ...prev, email: 'Invalid email' }));
        return;
      }
    }

    try {
      if (selectedClient.isRequest) {
        const numericId = selectedClient.id.toString().replace('REQ-', '');
        // Full update of website request fields (name, phone, email, etc.)
        try {
          await realApi.put(`/saas/requests/${numericId}`, {
            client_name: formData.name,
            email: formData.email,
            phone: formData.phone,
            company_name: formData.companyName,
            plan: formData.plan,
            contact_person: formData.contact,
            country: formData.location,
            status: formData.status
          });
        } catch (err) {
          console.warn('Real API failed, falling back to mock update saas request', err);
          await api.put(`/saas/requests/${numericId}`, {
            client_name: formData.name,
            email: formData.email,
            phone: formData.phone,
            company_name: formData.companyName,
            plan: formData.plan,
            contact_person: formData.contact,
            country: formData.location,
            status: formData.status
          });
        }
        // If status changed to approved/active, also provision
        if (formData.status?.toLowerCase() === 'approved' || formData.status?.toLowerCase() === 'active') {
          await updateSubscriptionRequest(numericId, 'Approved');
        }
        swalSuccess('Updated', 'Request updated successfully');
      } else {
        const updatePayload = { ...selectedClient, ...formData, client_type: formData.clientType };
        if (isAdminRole) {
          updatePayload.companyName = formData.name;
        }
        const result = await updateMutation.mutateAsync({ id: selectedClient.id, data: updatePayload });
        if (result?.credentials) {
          swalCredentials("Account Activated", result.credentials.email, result.credentials.password, result.credentials.message);
        } else {
          swalSuccess('Updated', 'Client updated successfully');
        }
      }
      setShowEditModal(false);
    } catch (e) {
      const errorMsg = e.response?.data?.message || e.message;
      const errorField = e.response?.data?.field;
      if (errorField === 'email' || errorMsg?.toLowerCase().includes('email:')) {
        setErrors(prev => ({ ...prev, email: 'Invalid email' }));
      } else {
        swalError('Error', errorMsg);
      }
    }
  };

  const handleSaveAdd = async () => {
    setErrors({});
    if (formData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        setErrors(prev => ({ ...prev, email: 'Invalid email' }));
        return;
      }
    }

    try {
      const result = await createMutation.mutateAsync({
        ...formData,
        source: 'Manual',
        client_type: formData.clientType,
        clientType: formData.clientType,
        plan: formData.clientType === 'Personal' ? 'Free' : formData.plan
      });
      console.log('Client Created Successfully:', result);
      
      if (result?.credentials) {
        swalCredentials("Account Created", result.credentials.email, result.credentials.password);
      } else {
        swalSuccess('Success', 'Customer added successfully');
      }
      setShowAddModal(false);
      
      // Force refresh query
      await queryClient.invalidateQueries({ queryKey: ['clients'] });
    } catch (e) {
      console.error('Error creating client:', e);
      const errorMsg = e.response?.data?.message || e.message;
      const errorField = e.response?.data?.field;
      if (errorField === 'email' || errorMsg?.toLowerCase().includes('email:')) {
        setErrors(prev => ({ ...prev, email: 'Invalid email' }));
      } else {
        swalError('Error', errorMsg);
      }
    }
  };

  const handleDelete = async (client) => {
    { const _r = await swalConfirm('Remove Client', `Remove ${client.companyName || client.name || client.business_name}? This cannot be undone.`); if (!_r.isConfirmed) return; }

    try {
      if (client.isRequest) {
        const numericId = client.id.toString().replace('REQ-', '');
        await updateSubscriptionRequest(numericId, 'Rejected');
      } else {
        await deleteMutation.mutateAsync(client.id);
      }
      swalSuccess('Removed', 'Client removal protocol executed.');
    } catch (e) {
      swalError('Deletion Error', e.message);
    }
  };

  const handleToggleStatus = async (client) => {
    const newStatus = (client.status || '').toLowerCase() === 'active' ? 'Inactive' : 'Active';
    if (client.isRequest) {
      const numericId = client.id.toString().replace('REQ-', '');
      if (newStatus === 'Active') {
        const result = await updateSubscriptionRequest(numericId, 'Approved');
        if (result) {
          swalCredentials("Account Activated", result.email, result.password);
        }
      }
    } else {
      const result = await updateMutation.mutateAsync({ id: client.id, data: { ...client, status: newStatus.toLowerCase(), client_type: client.clientType || client.client_type } });
      if (result?.credentials) {
        swalCredentials("Account Activated", result.credentials.email, result.credentials.password, result.credentials.message);
      } else {
        swalSuccess('Status Updated', `Client marked as ${newStatus}`);
      }
    }
  };

  const handleExport = () => {
    const headers = ['Name', 'Email', 'Phone', 'Status', 'Plan', 'Location', 'Source'].join(',');
    const rows = filteredClients.map(c => [
      `"${c.companyName || c.name || c.business_name || ''}"`,
      `"${c.email || ''}"`,
      `"${c.phone || ''}"`,
      `"${c.status || ''}"`,
      `"${c.plan || ''}"`,
      `"${c.location || ''}"`,
      `"${c.source || ''}"`
    ].join(','));
    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `saas_clients_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusColor = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'active') return 'bg-success/20 text-success';
    if (s === 'pending' || s === 'verification needed') return 'bg-warning/20 text-warning';
    if (s === 'provisioned') return 'bg-success/20 text-success';
    if (s === 'inactive' || s === 'deactivated') return 'bg-danger/20 text-danger';
    return 'bg-secondary/20 text-secondary';
  };

  const getStatusLabel = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'active') return 'Active';
    if (s === 'pending') return 'Pending';
    if (s === 'provisioned') return 'Provisioned';
    if (s === 'inactive' || s === 'deactivated') return 'Inactive';
    return status || 'Unknown';
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-white italic uppercase">
            {isAdminRole ? 'Customers' : (clientTypeFilter === 'SaaS' ? 'SaaS Clients' : (clientTypeFilter === 'Personal' ? 'Normal Clients' : 'Website Signups'))}
          </h1>
          <p className="text-secondary text-xs mt-1 font-black uppercase tracking-[0.2em] opacity-70 italic">
            {isAdminRole ? 'Manage your customers' : (clientTypeFilter === 'SaaS' ? 'Manage your registered SaaS clients' :
             clientTypeFilter === 'Personal' ? 'Manage your personal/normal clients' : 'Review and approve incoming portal requests')}
          </p>
        </div>
        <div className="flex gap-3 items-center">
          <div className="mr-4">
            <span className="text-[12px] text-muted">Role: {roleNormalized || '—'}</span>
          </div>
          <button onClick={handleExport} className="px-6 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2">
            <Download size={14} /> Export CSV
          </button>
          {!isAdminRole && clientTypeFilter !== 'Website' && (
            <button onClick={handleAdd} className="btn-primary group flex items-center gap-3 px-8 shadow-xl shadow-accent/20">
              <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" />
              <span>Add {clientTypeFilter === 'Personal' ? 'Normal' : 'SaaS'} Client</span>
            </button>
          )}
          {isAdminRole && (
            <button onClick={handleAdd} className="btn-primary group flex items-center gap-3 px-8 shadow-xl shadow-accent/20">
              <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" />
              <span>Add Customer</span>
            </button>
          )}
        </div>
      </div>

      {/* Client Type Toggle - only for super admin */}
      {!isAdminRole && (
        <div className="flex gap-2">
          {[
            { label: 'SaaS Clients', value: 'SaaS' },
            { label: 'Normal Clients', value: 'Personal' },
          ].map(tab => (
            <button
              key={tab.value}
              onClick={() => { setClientTypeFilter(tab.value); setCurrentPage(1); setSearchTerm(''); }}
              className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                clientTypeFilter === tab.value
                  ? 'bg-accent text-black border-accent shadow-lg shadow-accent/20'
                  : 'bg-white/5 text-secondary border-white/10 hover:bg-white/10 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {[
          { label: isAdminRole ? 'Total Customers' : 'Total Clients', value: totalClients, icon: User, color: 'text-accent' },
          { label: 'Active', value: activeClients, icon: Activity, color: 'text-success' },
          { label: 'Pending', value: pendingClients, icon: Globe, color: 'text-warning' },
          { label: 'Inactive', value: inactiveClients, icon: Shield, color: 'text-danger' },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card p-6 border-l-4 border-l-accent"
          >
            <div className="flex justify-between items-start mb-4">
              <stat.icon className={stat.color} size={24} />
              <span className="text-[10px] font-black text-muted uppercase tracking-widest">Status</span>
            </div>
            <p className="text-3xl font-black tracking-tighter text-white uppercase italic">{stat.value}</p>
            <p className="text-xs font-black text-secondary uppercase tracking-widest mt-1 opacity-60">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Search */}
      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="relative w-full lg:w-[500px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
          <input
            type="text"
            placeholder="Search by name, email, or ID..."
            className="w-full bg-sidebar/50 border border-border rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-accent transition-all text-white font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/[0.03] border-b border-border">
                <th className="p-6 text-[10px] font-black text-muted uppercase tracking-widest">{isAdminRole ? 'Customer Name' : 'Client Name'}</th>
                <th className="p-6 text-[10px] font-black text-muted uppercase tracking-widest">Email</th>
                {isAdminRole ? (
                  <>
                    <th className="p-6 text-[10px] font-black text-muted uppercase tracking-widest">Phone</th>
                    <th className="p-6 text-[10px] font-black text-muted uppercase tracking-widest">Address</th>
                  </>
                ) : (
                  <>
                    {clientTypeFilter !== 'Business' && <th className="p-6 text-[10px] font-black text-muted uppercase tracking-widest">Plan</th>}
                    {clientTypeFilter === 'Business' && <th className="p-6 text-[10px] font-black text-muted uppercase tracking-widest">License</th>}
                    {clientTypeFilter === 'Website' && <th className="p-6 text-[10px] font-black text-muted uppercase tracking-widest">Payment Status</th>}
                    <th className="p-6 text-[10px] font-black text-muted uppercase tracking-widest">Phone</th>
                    <th className="p-6 text-[10px] font-black text-muted uppercase tracking-widest">Source</th>
                  </>
                )}
                <th className="p-6 text-[10px] font-black text-muted uppercase tracking-widest">Status</th>
                <th className="p-6 text-[10px] font-black text-muted uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {currentItems.length === 0 ? (
                <tr>
                  <td colSpan={isAdminRole ? 6 : (clientTypeFilter === 'Website' ? 7 : 6)} className="p-12 text-center text-muted">
                    <User className="mx-auto mb-4 opacity-30" size={48} />
                    <p className="text-sm font-bold">{isAdminRole ? 'No customers found' : 'No clients found'}</p>
                  </td>
                </tr>
              ) : (
                currentItems.map((client, i) => (
                  <motion.tr
                    key={client.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="hover:bg-white/[0.01] group transition-colors"
                  >
                    <td className="p-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-accent/20 flex items-center justify-center text-accent font-black text-xs uppercase">
                          {(client.name || client.contactPerson || client.companyName || client.business_name || 'C')[0]}
                        </div>
                        <div>
                          <span className="text-sm font-bold text-white uppercase tracking-tight block">
                            {client.name || client.companyName || client.business_name || 'N/A'}
                          </span>
                          <span className="text-[10px] text-muted font-medium block mt-0.5">Contact: {client.contactPerson || client.contact || 'N/A'}</span>
                          <span className="text-[10px] text-muted font-medium">{client.phone || ''}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-6">
                      <span className="text-sm text-secondary font-medium">{client.email || 'N/A'}</span>
                    </td>
                    {isAdminRole ? (
                      <>
                        <td className="p-6">
                          <span className="text-sm text-secondary font-medium">{client.phone || 'N/A'}</span>
                        </td>
                        <td className="p-6">
                          <span className="text-sm text-secondary font-medium">{client.address || client.location || 'N/A'}</span>
                        </td>
                      </>
                    ) : (
                      <>
                        {clientTypeFilter !== 'Business' && (
                          <td className="p-6">
                            <span className="text-sm font-bold text-accent">{client.plan || 'N/A'}</span>
                          </td>
                        )}
                        {clientTypeFilter === 'Business' && (
                          <td className="p-6">
                            <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${client.business_license_url ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}`}>
                              {client.business_license_url ? 'Uploaded' : 'Pending'}
                            </span>
                          </td>
                        )}
                        {clientTypeFilter === 'Website' && (
                        <td className="p-6">
                          <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                            (client.payment_status || client.paymentStatus || 'unpaid').toLowerCase() === 'paid' ? 'bg-success/20 text-success' :
                            (client.payment_status || client.paymentStatus || 'unpaid').toLowerCase() === 'partial' ? 'bg-warning/20 text-warning' :
                            'bg-danger/20 text-danger'
                          }`}>
                            {client.payment_status || client.paymentStatus || 'Unpaid'}
                          </span>
                        </td>
                        )}
                        <td className="p-6">
                          <span className="text-sm text-secondary font-medium">{client.phone || 'N/A'}</span>
                        </td>
                        <td className="p-6">
                          <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${client.source === 'Landing Page' || client.source === 'Website' || client.source === 'Subscriber' ? 'bg-info/20 text-info' : 'bg-white/10 text-white'}`}>
                            {client.source === 'Landing Page' ? 'Website' : client.source || 'Manual'}
                          </span>
                        </td>
                      </>
                    )}
                    <td className="p-6">
                      <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${getStatusColor(client.status)}`}>
                        {getStatusLabel(client.status)}
                      </span>
                    </td>
                    <td className="p-6">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleView(client)}
                          className="p-2.5 bg-white/5 border border-border text-secondary rounded-lg hover:text-white hover:bg-white/10 transition-all"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handleEdit(client)}
                          className="p-2.5 bg-white/5 border border-border text-secondary rounded-lg hover:text-white hover:bg-white/10 transition-all"
                          title="Edit Client"
                        >
                          <Edit2 size={16} />
                        </button>
                        {(isAdminRole || isSuperAdmin) && 
                          ((client.plan && String(client.plan).toLowerCase() !== 'free' && String(client.plan).toLowerCase() !== 'basic') || 
                           client.concierge_member || 
                           client.conciergeMembership || 
                           client.is_upgraded) && (
                          <button
                            onClick={async () => {
                              const isPersonal = client.client_type === 'Personal' || client.clientType === 'Personal';
                              const confirmTitle = isPersonal ? 'Cancel Membership' : 'Cancel Subscription';
                              const ok = await swalConfirm(confirmTitle, `Cancel plan for ${client.companyName || client.name || client.business_name || client.email}?`);
                              if (!ok) return;
                              try {
                                if (isPersonal) {
                                  await cancelPersonalMembership(client.signup_user_id || client.id);
                                } else {
                                  await updateClient({ ...client, plan: 'Free' });
                                }
                                swalSuccess('Cancelled', 'Plan/membership set to Free / cancelled.');
                                if (fetchClients) fetchClients();
                              } catch (e) {
                                console.error('Cancel plan failed', e);
                                swalWarning('Error', 'Failed to cancel.');
                              }
                            }}
                            className="p-2.5 bg-warning/10 border border-warning/20 text-warning rounded-lg hover:bg-warning hover:text-black transition-all"
                            title={client.client_type === 'Personal' || client.clientType === 'Personal' ? "Cancel Membership" : "Cancel Subscription"}
                          >
                            <XCircle size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => handleToggleStatus(client)}
                          className={`p-2.5 border rounded-lg transition-all ${
                            ['active', 'provisioned'].includes((client.status || '').toLowerCase())
                              ? 'bg-success/10 border-success/20 text-success hover:bg-success hover:text-black'
                              : 'bg-warning/10 border-warning/20 text-warning hover:bg-warning hover:text-black'
                          }`}
                          title={['active', 'provisioned'].includes((client.status || '').toLowerCase()) ? 'Deactivate' : 'Activate'}
                        >
                          {['active', 'provisioned'].includes((client.status || '').toLowerCase()) ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                        </button>
                        <button
                          onClick={() => handleDelete(client)}
                          className="p-2.5 bg-danger/10 border border-danger/20 text-danger rounded-lg hover:bg-danger hover:text-white transition-all"
                          title="Delete Client"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filteredClients.length > itemsPerPage && (
          <BootstrapPagination
            activePage={currentPage}
            itemsCountPerPage={itemsPerPage}
            totalItemsCount={filteredClients.length}
            onChange={(page) => setCurrentPage(page)}
          />
        )}
      </div>

      {/* View Modal */}
      {createPortal(
      <AnimatePresence>
        {showViewModal && selectedClient && (
          <div className="fixed inset-0 z-[999] flex items-start justify-center p-4 pt-[5vh] overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowViewModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              className="w-full max-w-2xl bg-sidebar border border-border rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden mb-8"
            >
              <div className="p-8 pb-0 border-b border-border/10">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-2xl font-black text-white uppercase italic">{isAdminRole ? 'Customer Details' : 'Client Details'}</h3>
                    <p className="text-xs text-secondary italic mt-1 font-black tracking-widest uppercase opacity-70">Complete profile overview</p>
                  </div>
                  <button onClick={() => setShowViewModal(false)} className="p-3 bg-white/5 border border-border rounded-2xl text-muted hover:text-white transition-all">
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Tabs for Personal Clients */}
              {(() => {
                const isPersonal = (selectedClient.tagline === 'Personal' || selectedClient.client_type === 'Personal' || selectedClient.plan === 'Free');
                return isPersonal && !isAdminRole ? (
                  <div className="px-8 pt-4 flex gap-2 border-b border-border/10">
                    {[{ label: 'Details', value: 'details', icon: User }, { label: `Orders (${clientOrders.length})`, value: 'orders', icon: ShoppingCart }].map(tab => (
                      <button key={tab.value} onClick={() => setViewTab(tab.value)}
                        className={`flex items-center gap-2 px-6 py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${
                          viewTab === tab.value ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-white'
                        }`}>
                        <tab.icon size={14} /> {tab.label}
                      </button>
                    ))}
                  </div>
                ) : null;
              })()}

              <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {viewTab === 'details' ? (
                  <>
                    {/* Client Header Card */}
                    <div className="flex items-center gap-5 p-6 bg-white/[0.03] border border-white/5 rounded-2xl">
                      <div className="w-16 h-16 rounded-2xl bg-accent/20 flex items-center justify-center text-accent font-black text-2xl uppercase">
                        {(selectedClient.companyName || selectedClient.name || selectedClient.business_name || 'C')[0]}
                      </div>
                      <div className="flex-1">
                        <h4 className="text-lg font-black text-white uppercase tracking-tight">{selectedClient.companyName || selectedClient.name || selectedClient.business_name}</h4>
                        <p className="text-xs text-secondary mt-1">{selectedClient.email}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${getStatusColor(selectedClient.status)}`}>
                            {getStatusLabel(selectedClient.status)}
                          </span>
                          {!isAdminRole && (
                            <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-accent/20 text-accent">
                              {selectedClient.plan || 'Starter'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(isAdminRole ? [
                        { icon: User, label: 'Contact Person', value: selectedClient.contactPerson || selectedClient.contact || selectedClient.contact_person || 'N/A' },
                        { icon: Mail, label: 'Email', value: selectedClient.email || 'N/A' },
                        { icon: Phone, label: 'Phone', value: selectedClient.phone || 'N/A' },
                        { icon: MapPin, label: 'Street Address', value: selectedClient.address || selectedClient.location || 'N/A' },
                        { icon: MapPin, label: 'City', value: selectedClient.city || 'N/A' },
                        { icon: MapPin, label: 'Country', value: selectedClient.country || 'N/A' },
                        { icon: Package, label: 'Client Type', value: selectedClient.client_type || selectedClient.clientType || 'Direct' },
                        { icon: Calendar, label: 'Created', value: (selectedClient.created_at || selectedClient.createdAt) ? new Date(selectedClient.created_at || selectedClient.createdAt).toLocaleDateString() : 'N/A' },
                      ] : [
                        { icon: User, label: 'Contact Person', value: selectedClient.contactPerson || selectedClient.contact || selectedClient.contact_person || 'N/A' },
                        { icon: Mail, label: 'Email', value: selectedClient.email || 'N/A' },
                        { icon: Phone, label: 'Phone', value: selectedClient.phone || 'N/A' },
                        { icon: MapPin, label: 'Location', value: selectedClient.location || 'N/A' },
                        { icon: Globe, label: 'Source', value: selectedClient.source === 'Landing Page' ? 'Website Registration' : selectedClient.source || 'Manual' },
                        { icon: CreditCard, label: 'Payment Method', value: selectedClient.paymentMethod || selectedClient.payment_method || 'N/A' },
                        { icon: Calendar, label: 'Billing Cycle', value: selectedClient.billingCycle || selectedClient.billing_cycle || 'N/A' },
                        { icon: Package, label: 'Company', value: selectedClient.companyName || selectedClient.business_name || 'N/A' },
                      ]).map((item, idx) => (
                        <div key={idx} className="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                          <div className="flex items-center gap-2 mb-1">
                            <item.icon size={12} className="text-accent" />
                            <span className="text-[9px] font-black text-muted uppercase tracking-widest">{item.label}</span>
                          </div>
                          <p className="text-sm font-bold text-white">{item.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Portal Access Info */}
                    <div className="p-5 bg-info/5 border border-info/20 rounded-2xl">
                      <h5 className="text-[10px] font-black text-info uppercase tracking-widest mb-2">Portal Access</h5>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-[9px] text-info/60 font-bold uppercase">Login Email</span>
                          <p className="text-sm font-bold text-info">{selectedClient.email || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-[9px] text-info/60 font-bold uppercase">Login Password</span>
                          <p className="text-sm font-bold text-info">••••••••</p>
                        </div>
                        <div>
                          <span className="text-[9px] text-info/60 font-bold uppercase">Account Status</span>
                          <p className="text-sm font-bold text-info">{getStatusLabel(selectedClient.status)}</p>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Orders Tab */
                  <div className="space-y-4">
                    {loadingOrders ? (
                      <div className="py-16 text-center">
                        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-xs text-muted font-black uppercase tracking-widest">Loading Orders...</p>
                      </div>
                    ) : clientOrders.length === 0 ? (
                      <div className="py-16 text-center">
                        <ShoppingCart className="mx-auto mb-4 opacity-20" size={48} />
                        <p className="text-sm font-bold text-muted">No orders yet</p>
                        <p className="text-xs text-muted/60 mt-1">This client hasn't placed any orders</p>
                      </div>
                    ) : (
                      <>
                        {/* Order Stats */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="p-4 bg-white/[0.03] border border-white/5 rounded-xl text-center">
                            <p className="text-2xl font-black text-white italic">{clientOrders.length}</p>
                            <p className="text-[9px] text-muted font-black uppercase tracking-widest mt-1">Total Orders</p>
                          </div>
                          <div className="p-4 bg-white/[0.03] border border-white/5 rounded-xl text-center">
                            <p className="text-2xl font-black text-accent italic">
                              ${clientOrders.reduce((a, o) => a + (parseFloat(o.total_amount || o.total || 0)), 0).toLocaleString()}
                            </p>
                            <p className="text-[9px] text-muted font-black uppercase tracking-widest mt-1">Total Value</p>
                          </div>
                          <div className="p-4 bg-white/[0.03] border border-white/5 rounded-xl text-center">
                            <p className="text-2xl font-black text-warning italic">
                              {clientOrders.filter(o => o.status !== 'completed' && o.status !== 'cancelled').length}
                            </p>
                            <p className="text-[9px] text-muted font-black uppercase tracking-widest mt-1">Active</p>
                          </div>
                        </div>

                        {/* Orders List */}
                        {clientOrders.map((order) => {
                          const items = Array.isArray(order.items) ? order.items : [];
                          const statusColors = {
                            created: 'bg-blue-500/20 text-blue-400',
                            admin_review: 'bg-warning/20 text-warning',
                            concierge: 'bg-accent/20 text-accent',
                            processing: 'bg-accent/20 text-accent',
                            completed: 'bg-success/20 text-success',
                            cancelled: 'bg-danger/20 text-danger',
                          };
                          return (
                            <div key={order.id} className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-accent/20 transition-all space-y-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="text-sm font-black text-white italic">#{order.id}</span>
                                  <span className="text-[10px] text-muted ml-3 font-bold">{order.created_at ? new Date(order.created_at).toLocaleDateString() : ''}</span>
                                </div>
                                <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${statusColors[order.status] || 'bg-white/10 text-white'}`}>
                                  {(order.status || 'pending').replace(/_/g, ' ')}
                                </span>
                              </div>

                              {/* Items */}
                              <div className="flex flex-wrap gap-2">
                                {items.slice(0, 3).map((item, i) => (
                                  <span key={i} className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold text-secondary">
                                    {item.name || item.product_name} x{item.qty || item.quantity || 1}
                                  </span>
                                ))}
                                {items.length > 3 && <span className="px-3 py-1 text-[10px] text-muted font-bold">+{items.length - 3} more</span>}
                              </div>

                              {/* Location Details */}
                              {(order.pickup_location || order.pickupLocation || order.location || order.delivery_address) && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                                  {(order.pickup_location || order.pickupLocation) && (
                                    <div className="flex items-start gap-2 px-3 py-2 bg-white/[0.02] border border-white/5 rounded-xl">
                                      <span className="text-[8px] font-black text-info/60 uppercase tracking-widest mt-0.5 shrink-0">Pickup</span>
                                      <span className="text-[10px] font-bold text-info truncate">{order.pickup_location || order.pickupLocation}</span>
                                    </div>
                                  )}
                                  {(order.location || order.delivery_address) && (
                                    <div className="flex items-start gap-2 px-3 py-2 bg-white/[0.02] border border-white/5 rounded-xl">
                                      <span className="text-[8px] font-black text-accent/60 uppercase tracking-widest mt-0.5 shrink-0">Drop-off</span>
                                      <span className="text-[10px] font-bold text-accent truncate">{order.location || order.delivery_address}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                              {/* Delivery Mode */}
                              {(order.type || order.deliveryMode || order.mode) && (
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 bg-white/5 rounded text-[9px] font-black text-muted uppercase tracking-widest">
                                    {order.type || order.deliveryMode || order.mode}
                                  </span>
                                </div>
                              )}

                              <div className="flex items-center justify-between pt-3 border-t border-white/5">
                                <span className="text-sm font-black text-accent italic">${parseFloat(order.total_amount || order.total || 0).toLocaleString()}</span>

                                <div className="flex items-center gap-2">
                                  {/* Generate Invoice Button */}
                                  <button
                                    onClick={() => handleGenerateInvoice(order)}
                                    disabled={order.invoiceGenerated}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                      order.invoiceGenerated
                                        ? 'bg-success/10 text-success border border-success/20 cursor-default'
                                        : 'bg-accent/10 text-accent border border-accent/20 hover:bg-accent hover:text-black'
                                    }`}
                                  >
                                    <FileText size={12} /> {order.invoiceGenerated ? 'Invoiced' : 'Generate Invoice'}
                                  </button>

                                  {/* Dispatch Delivery Button */}
                                  <button
                                    onClick={() => { setDeliveryForm({ driver_name: '', plate_number: '', pickup_location: order.pickupLocation || order.pickup_location || '', drop_location: order.location || order.delivery_address || '', delivery_date: order.due_date ? order.due_date.split('T')[0] : '', status: 'pending' }); setDeliveryModal({ isOpen: true, order }); }}
                                    disabled={order.deliveryCreated}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                      order.deliveryCreated
                                        ? 'bg-success/10 text-success border border-success/20 cursor-default'
                                        : 'bg-info/10 text-info border border-info/20 hover:bg-info hover:text-black'
                                    }`}
                                  >
                                    <Truck size={12} /> {order.deliveryCreated ? 'Dispatched' : 'Dispatch'}
                                  </button>

                                  {/* Status Update Dropdown */}
                                  <div className="relative group">
                                    <button className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-secondary hover:text-white hover:border-accent/30 transition-all">
                                      Update Status <ChevronDown size={12} />
                                    </button>
                                    <div className="absolute right-0 bottom-full mb-1 w-48 bg-sidebar border border-border rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                                      {['created', 'admin_review', 'concierge', 'operation', 'procurement', 'inventory', 'logistics', 'completed', 'cancelled'].map(s => (
                                        <button key={s} onClick={() => updateOrderStatus(order.id, s)}
                                          className={`w-full text-left px-4 py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all first:rounded-t-xl last:rounded-b-xl ${
                                            order.status === s ? 'text-accent bg-accent/5' : 'text-secondary'
                                          }`}>
                                          {s.replace(/_/g, ' ')}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-border flex justify-end gap-3">
                <button onClick={() => { setShowViewModal(false); handleEdit(selectedClient); }} className="px-8 py-3 bg-accent/10 text-accent text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-accent hover:text-black transition-all">Edit Client</button>
                <button onClick={() => setShowViewModal(false)} className="px-8 py-3 bg-white/5 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-white/10 transition-all">Close</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      , document.body)}

      {/* Edit / Add Modal */}
      {createPortal(
      <AnimatePresence>
        {(showEditModal || showAddModal) && (
          <div className="fixed inset-0 z-[999] flex items-start justify-center p-4 pt-[5vh] overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => { setShowEditModal(false); setShowAddModal(false); }}
            />
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              className="w-full max-w-2xl bg-sidebar border border-border rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden mb-8"
            >
              <div className="p-8 pb-0 border-b border-border/10">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-2xl font-black text-white uppercase italic">{showAddModal ? (isAdminRole ? 'Add New Customer' : `Add ${clientTypeFilter} Client`) : 'Edit Client'}</h3>
                    <p className="text-xs text-secondary italic mt-1 font-black tracking-widest uppercase opacity-70">
                      {showAddModal ? (isAdminRole ? 'Register a new customer' : (clientTypeFilter === 'Personal' ? 'Free subscription - same features, no billing' : 'Register a new SaaS client')) : `Updating: ${selectedClient?.name || selectedClient?.business_name}`}
                    </p>
                  </div>
                  <button onClick={() => { setShowEditModal(false); setShowAddModal(false); }} className="p-3 bg-white/5 border border-border rounded-2xl text-muted hover:text-white transition-all">
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest pl-1">{isAdminRole ? 'Customer Name' : 'Client Name'}<span className="text-danger"> *</span></label>
                    <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-accent font-bold" placeholder="Full Name" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest pl-1">Email Address<span className="text-danger"> *</span></label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => {
                        setFormData({ ...formData, email: e.target.value });
                        if (errors.email) {
                          setErrors(prev => ({ ...prev, email: null }));
                        }
                      }}
                      className={`w-full bg-background border ${errors.email ? 'border-danger focus:border-danger' : 'border-border focus:border-accent'} rounded-xl px-4 py-3 text-sm text-white focus:outline-none font-bold`}
                      placeholder="email@example.com"
                    />
                    {errors.email && (
                      <p className="text-danger text-[10px] font-bold pl-1">{errors.email}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest pl-1">Phone Number</label>
                    <input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-accent font-bold" placeholder="+1 234 567 890" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest pl-1">Contact Person</label>
                    <input type="text" value={formData.contact} onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-accent font-bold" placeholder="Primary Contact" />
                  </div>
                  <>
                    <div className={`space-y-2 ${isAdminRole ? 'md:col-span-2' : ''}`}>
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest pl-1">{isAdminRole ? 'Street Address' : 'Address'}</label>
                      <input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-accent font-bold" placeholder={isAdminRole ? "123 Main St" : "Street Address"} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest pl-1">City</label>
                      <input type="text" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-accent font-bold" placeholder={isAdminRole ? "New York" : "City"} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest pl-1">Country</label>
                      <input type="text" value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                        className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-accent font-bold" placeholder={isAdminRole ? "USA" : "Country"} />
                    </div>
                  </>
                  {!isAdminRole && formData.clientType !== 'Personal' && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest pl-1">Company Name</label>
                      <input type="text" value={formData.companyName} onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                        className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-accent font-bold" placeholder="Business Name" />
                    </div>
                  )}
                  {showAddModal && (
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest pl-1">Login Password<span className="text-danger"> *</span></label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          className="w-full bg-background border border-border rounded-xl pl-4 pr-12 py-3 text-sm text-white focus:outline-none focus:border-accent font-bold font-mono"
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary hover:text-white transition-colors"
                          title={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  )}
                  {!isAdminRole && clientTypeFilter !== 'Personal' && (
                    <>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted uppercase tracking-widest pl-1">Subscription Plan</label>
                        <select value={formData.plan} onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                          className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-accent font-bold appearance-none cursor-pointer">
                          <option>Starter</option>
                          <option>Standard</option>
                          <option>Executive</option>
                          <option>Platinum</option>
                          <option>Custom Enterprise</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted uppercase tracking-widest pl-1">Billing Cycle</label>
                        <select value={formData.billingCycle} onChange={(e) => setFormData({ ...formData, billingCycle: e.target.value })}
                          className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-accent font-bold appearance-none cursor-pointer">
                          <option>Monthly</option>
                          <option>Quarterly</option>
                          <option>Yearly</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted uppercase tracking-widest pl-1">Payment Method</label>
                        <select value={formData.paymentMethod} onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                          className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-accent font-bold appearance-none cursor-pointer">
                          <option>Wire Transfer</option>
                          <option>Credit Card</option>
                          <option>Direct Debit</option>
                          <option>Cash</option>
                        </select>
                      </div>
                    </>
                  )}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest pl-1">Account Status</label>
                    <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-accent font-bold appearance-none cursor-pointer">
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="Pending">Pending</option>
                    </select>
                  </div>
                </div>
                {!isAdminRole && (
                <>
                  {/* Additional address inputs at the bottom for non-admin if needed, but handled above now */}
                </>
                )}
              </div>

              <div className="p-6 border-t border-border flex justify-end gap-3">
                <button onClick={() => { setShowEditModal(false); setShowAddModal(false); }} className="px-8 py-4 text-secondary text-[10px] font-black uppercase tracking-widest hover:text-white transition-all italic">Cancel</button>
                
                {showEditModal && (
                  <button 
                    onClick={async () => {
                      const _r = await swalConfirm('Reset Password', 'A new password will be generated.');
                      if (_r.isConfirmed) {
                        try {
                          const result = await updateClient({ ...selectedClient, resetPassword: true });
                          if (result?.credentials) {
                            swalCredentials("Credentials Reset", result.credentials.email, result.credentials.password);
                          }
                          setShowEditModal(false);
                        } catch (e) {
                          swalError('Error', e.message);
                        }
                      }
                    }} 
                    className="px-6 py-4 bg-warning/10 text-warning text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-warning hover:text-black transition-all"
                  >
                    Reset Password
                  </button>
                )}

                <button 
                  onClick={showAddModal ? handleSaveAdd : handleSaveEdit} 
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="btn-primary flex items-center gap-3 px-10 shadow-xl shadow-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>
                    {showAddModal 
                      ? (createMutation.isPending ? 'Registering...' : (isAdminRole ? 'Register Customer' : 'Register Client')) 
                      : (updateMutation.isPending ? 'Updating...' : 'Update Portfolio')
                    }
                  </span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      , document.body)}

      {/* Delivery Dispatch Modal */}
      {createPortal(
      <AnimatePresence>
        {deliveryModal.isOpen && deliveryModal.order && (
          <div className="fixed inset-0 z-[999] flex items-start justify-center p-4 pt-[10vh] overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setDeliveryModal({ isOpen: false, order: null })}
            />
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              className="w-full max-w-lg bg-sidebar border border-border rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden mb-8"
            >
              <div className="p-8 pb-4 border-b border-border/10">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-black text-white uppercase italic">Dispatch Delivery</h3>
                    <p className="text-xs text-secondary italic mt-1 font-black tracking-widest uppercase opacity-70">Order #{deliveryModal.order.id}</p>
                  </div>
                  <button onClick={() => setDeliveryModal({ isOpen: false, order: null })} className="p-3 bg-white/5 border border-border rounded-2xl text-muted hover:text-white transition-all">
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="p-8 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest pl-1">Driver Name</label>
                    <input type="text" value={deliveryForm.driver_name} onChange={(e) => setDeliveryForm({ ...deliveryForm, driver_name: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-accent font-bold" placeholder="Driver name" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest pl-1">Vehicle / Plate</label>
                    <input type="text" value={deliveryForm.plate_number} onChange={(e) => setDeliveryForm({ ...deliveryForm, plate_number: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-accent font-bold" placeholder="Plate number" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest pl-1">Pickup Location</label>
                    <input type="text" value={deliveryForm.pickup_location} onChange={(e) => setDeliveryForm({ ...deliveryForm, pickup_location: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-accent font-bold" placeholder="Warehouse / Hub" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest pl-1">Drop Location</label>
                    <input type="text" value={deliveryForm.drop_location} onChange={(e) => setDeliveryForm({ ...deliveryForm, drop_location: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-accent font-bold" placeholder="Client address" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest pl-1">Delivery Date</label>
                    <input type="date" value={deliveryForm.delivery_date} onChange={(e) => setDeliveryForm({ ...deliveryForm, delivery_date: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-accent font-bold" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest pl-1">Status</label>
                    <select value={deliveryForm.status} onChange={(e) => setDeliveryForm({ ...deliveryForm, status: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-accent font-bold appearance-none cursor-pointer">
                      <option value="pending">Pending</option>
                      <option value="assigned">Assigned</option>
                      <option value="en_route">En Route</option>
                      <option value="delivered">Delivered</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-border flex justify-end gap-3">
                <button onClick={() => setDeliveryModal({ isOpen: false, order: null })} className="px-8 py-3 text-secondary text-[10px] font-black uppercase tracking-widest hover:text-white transition-all italic">Cancel</button>
                <button onClick={handleCreateDelivery} className="btn-primary flex items-center gap-3 px-10 shadow-xl shadow-accent/20">
                  <Truck size={16} /> <span>Dispatch Now</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      , document.body)}
    </div>
  );
};

export default Clients;

