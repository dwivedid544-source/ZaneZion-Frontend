import React, { useState, useMemo } from 'react';
import Table from '../../components/Table';
import Modal from '../../components/Modal';
import OrderModal from '../../components/OrderModal';
import { useData } from '../../context/GlobalDataContext';
import { Store, Search, Star, Phone, Mail, Plus, ShieldCheck, CheckCircle } from 'lucide-react';
import { swalSuccess, swalWarning } from '../../utils/swal';
import { normalizeRole } from '../../utils/authUtils';
import realApi from '../../services/api/setupAxios';

const Vendors = () => {
  const { vendors: mockVendors, addVendor: mockAddVendor, updateVendor: mockUpdateVendor, deleteVendor: mockDeleteVendor, addOrder, fetchVendors, hasMenuPermission, currentUser } = useData();
  const [realVendors, setRealVendors] = useState([]);
  const isVendorAdmin = ['superadmin', 'admin', 'procurement'].includes(normalizeRole(currentUser?.role));

  React.useEffect(() => {
    const refreshData = async () => {
      await fetchVendors();
      try {
        const res = await realApi.get('/vendors');
        setRealVendors(res.data?.data?.vendors || res.data?.data || []);
      } catch (e) {}
    };
    refreshData();
  }, [fetchVendors]);

  const refreshVendorsList = async () => {
    await fetchVendors();
    try {
      const res = await realApi.get('/vendors');
      setRealVendors(res.data?.data?.vendors || res.data?.data || []);
    } catch (e) {}
  };
  
  const vendors = realVendors.length > 0 ? realVendors : mockVendors;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [modalType, setModalType] = useState('view');
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [formData, setFormData] = useState({ name: '', rating: 0, delivery: 0, category: 'Premium Supplier' });

  // States for Direct Order Modal
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [orderModalType, setOrderModalType] = useState('add');
  const [initialOrderData, setInitialOrderData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredVendors = vendors.filter(v =>
    (v.companyName || v.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (v.category || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(v.id).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingApprovalCount = useMemo(
    () => (isVendorAdmin ? vendors.filter(v => String(v.status || '').toLowerCase() === 'inactive').length : 0),
    [isVendorAdmin, vendors]
  );

  const tableVendors = useMemo(() => {
    if (!isVendorAdmin) return filteredVendors;
    return [...filteredVendors].sort((a, b) => {
      const pa = String(a.status || '').toLowerCase() === 'inactive' ? 0 : 1;
      const pb = String(b.status || '').toLowerCase() === 'inactive' ? 0 : 1;
      return pa - pb;
    });
  }, [filteredVendors, isVendorAdmin]);

  const spotlightVendor = useMemo(
    () => vendors.find(v => String(v.status || '').toLowerCase() === 'active') || null,
    [vendors]
  );

  const handleAction = (type, vendor) => {
    setSelectedVendor(vendor);
    setModalType(type);
    setIsSaving(false);
    setFormData(vendor.id ? {
      ...vendor,
      name: vendor.companyName ?? vendor.name ?? vendor.vendor_name ?? vendor.business_name ?? vendor.company_name ?? '',
      contact: vendor.contactPerson ?? vendor.contact ?? vendor.contact_name ?? '',
      rating: vendor.rating ?? 90,
      delivery: vendor.delivery ?? 90,
      category: vendor.category ?? 'Premium Supplier',
      status: vendor.status ?? 'inactive'
    } : { name: '', rating: 90, delivery: 90, category: 'General', contact: '', address: '', phone: '', email: '', status: 'inactive' });
    setIsModalOpen(true);
  };

  const vendorSaveErrorMessage = (error) => {
    const d = error?.response?.data;
    if (typeof d?.message === 'string') return d.message;
    if (d?.message && typeof d.message === 'object') return JSON.stringify(d.message);
    if (Array.isArray(d?.errors)) return d.errors.map((e) => (typeof e === 'string' ? e : e?.msg || JSON.stringify(e))).join(' ');
    return error?.message || 'Failed to save vendor.';
  };

  const handleSave = async () => {
    if (modalType === 'add') {
      // Frontend validation
      if (!formData.name || formData.name.trim().length < 2) {
        swalWarning('Validation Error', 'Vendor name must be at least 2 characters.');
        return;
      }
      if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        swalWarning('Validation Error', 'A valid email address is required.');
        return;
      }

      try {
        setIsSaving(true);
        const apiPayload = {
          companyName: formData.name.trim(),
          contactPerson: formData.contact || '',
          email: formData.email.trim(),
          phone: formData.phone || '',
          address: formData.address || '',
          category: formData.category || 'Premium Supplier',
          rating: Number(formData.rating) || 0,
          delivery: Number(formData.delivery) || 0,
          status: formData.status || 'inactive',
          vendorCode: 'VND-' + Date.now().toString().slice(-6)
        };
        await realApi.post('/vendors', apiPayload);
        console.log('[REAL_API_SUCCESS] Vendor created successfully via real API');
        swalSuccess('Success', 'Vendor added successfully.');
        await refreshVendorsList();
        setIsModalOpen(false);
      } catch (e) {
        console.warn('[REAL_API_FAILED] Vendor creation via real API failed', e);
        swalWarning('Error', vendorSaveErrorMessage(e));
      } finally {
        setIsSaving(false);
      }
      return;
    }
    if (modalType === 'edit') {
      // Frontend validation
      if (!formData.name || formData.name.trim().length < 2) {
        swalWarning('Validation Error', 'Vendor name must be at least 2 characters.');
        return;
      }
      if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        swalWarning('Validation Error', 'A valid email address is required.');
        return;
      }

      try {
        setIsSaving(true);
        const apiPayload = {
          companyName: formData.name.trim(),
          contactPerson: formData.contact || '',
          email: formData.email.trim(),
          phone: formData.phone || '',
          address: formData.address || '',
          category: formData.category || 'Premium Supplier',
          rating: Number(formData.rating) || 0,
          delivery: Number(formData.delivery) || 0,
          status: formData.status
        };
        await realApi.put(`/vendors/${selectedVendor.id}`, apiPayload);
        console.log('[REAL_API_SUCCESS] Vendor updated successfully via real API');
        swalSuccess('Success', 'Vendor updated successfully.');
        await refreshVendorsList();
        setIsModalOpen(false);
      } catch (e) {
        console.warn('[REAL_API_FAILED] Vendor update via real API failed', e);
        swalWarning('Error', vendorSaveErrorMessage(e));
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleDelete = async () => {
    setIsSaving(true);
    try {
      await realApi.delete(`/vendors/${selectedVendor.id}`);
      console.log('[REAL_API_SUCCESS] Vendor deleted successfully via real API');
      await refreshVendorsList();
      setIsModalOpen(false);
      swalSuccess('Deleted', 'Vendor has been removed successfully.');
    } catch(e) {
      console.warn('[REAL_API_FAILED] Vendor deletion via real API failed', e);
      swalWarning('Error', 'Failed to delete vendor.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDirectOrder = (vendorName, vendorId) => {
    setInitialOrderData({
      product: `${vendorName} Supply Request`,
      client: 'Select Client...',
      qty: '10 Units',
      vendor: vendorName,
      vendorId: vendorId
    });
    setOrderModalType('add');
    setIsOrderModalOpen(true);
  };

  const handleSaveOrder = (formData) => {
    addOrder(formData);
    setIsOrderModalOpen(false);
  };

  const columns = [
    { header: "Vendor Name", accessor: "name", render: (row) => row.companyName || row.name || row.business_name || row.company_name || 'N/A' },
    { header: "Contact Person", accessor: "contact", render: (row) => row.contactPerson || row.contact || row.contact_name || 'N/A' },
    { header: "Phone Number", accessor: "phone" },
    { header: "Email", accessor: "email" },
    {
      header: "Rating",
      accessor: "rating",
      render: (row) => (
        <div className="flex items-center gap-1 text-accent">
          <Star size={14} fill="currentColor" />
          <span className="font-bold">{row.rating}%</span>
        </div>
      )
    },
    {
      header: "Delivery Performance",
      accessor: "delivery",
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
            <div className="h-full bg-success" style={{ width: `${row.delivery}%` }} />
          </div>
          <span className="text-xs font-bold">{row.delivery}%</span>
        </div>
      )
    },
    { header: "Category", accessor: "category", render: (row) => row.category || "Premium Supplier" },
    {
      header: "Directory status",
      accessor: "status",
      render: (row) => {
        const st = String(row.status || 'inactive').toLowerCase();
        if (st === 'active') return <span className="text-[10px] font-black uppercase text-success">Active</span>;
        if (st === 'blacklisted' || st === 'blocked') return <span className="text-[10px] font-black uppercase text-danger">Blocked</span>;
        return <span className="text-[10px] font-black uppercase text-warning">Pending Approval</span>;
      }
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isVendorAdmin ? 'Vendor directory' : 'Approved vendors'}
          </h1>
          <p className="text-secondary mt-1">
            {isVendorAdmin
              ? 'Approve pending partners so they appear in marketplace, checkout, and procurement for all other roles.'
              : 'Manage precision supply chain partners and procurement channels.'}
          </p>
          {isVendorAdmin && pendingApprovalCount > 0 && (
            <p className="text-[10px] font-bold text-warning mt-2 uppercase tracking-widest flex items-center gap-2">
              <CheckCircle size={14} className="text-warning shrink-0" />
              {pendingApprovalCount} vendor{pendingApprovalCount !== 1 ? 's' : ''} pending your approval (inactive)
            </p>
          )}
          {!isVendorAdmin && (
            <p className="text-[10px] font-bold text-warning mt-2 uppercase tracking-widest">New vendors you add stay hidden until HQ sets them to Active.</p>
          )}
        </div>
        <div className="flex gap-3">
          <div className="relative w-full md:w-64">
            <input
              type="text"
              placeholder="Search vendors..."
              className="bg-white/5 border border-border rounded-xl h-11 pl-11 pr-4 text-sm leading-none focus:outline-none focus:border-accent w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="absolute left-3 top-[24px] -translate-y-1/2 pointer-events-none">
              <Search className="text-muted block" size={16} strokeWidth={2} />
            </div>
          </div>
          {hasMenuPermission('Vendors', 'can_add') && (
            <button className="btn-primary flex items-center gap-2" onClick={() => handleAction('add', {})}>
              <Plus size={16} /> Add Vendor
            </button>
          )}
        </div>
      </div>

      <div className="glass-card p-6">
        <Table
          columns={columns}
          data={tableVendors}
          actions={true}
          onView={(item) => handleAction('view', item)}
          onEdit={(item) => handleAction('edit', item)}
          onDelete={(item) => handleAction('delete', item)}
          canEdit={hasMenuPermission('Vendors', 'can_edit')}
          canDelete={hasMenuPermission('Vendors', 'can_delete')}
          customAction={(row) => (
            ['superadmin'].includes(normalizeRole(currentUser?.role)) && String(row.status || '').toLowerCase() === 'inactive' ? (
              <button
                type="button"
                className="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider bg-success/15 text-success border border-success/30 hover:bg-success hover:text-black"
                title="Activate vendor for procurement"
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    try {
                      await realApi.put(`/vendors/${row.id}`, { ...row, status: 'active' });
                      console.log('[REAL_API_SUCCESS] Vendor activated successfully via real API');
                    } catch(err) {
                      console.warn('[REAL_API_FAILED] Vendor activation via real API failed', err);
                      swalWarning('Error', 'Failed to activate vendor.');
                    }
                    await fetchVendors();
                    realApi.get('/vendors').then(res => setRealVendors(res.data?.data?.vendors || res.data?.data || [])).catch(() => {});
                    await swalSuccess('Vendor approved', `${row.name || 'Vendor'} is now Active and visible to clients and staff.`);
                  } catch (err) {
                    window.alert(err?.message || 'Approve failed');
                  }
                }}
              >
                Approve
              </button>
            ) : null
          )}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-card p-6 bg-accent/[0.02]">
          <h3 className="text-lg font-bold mb-4">Vendor of the Month</h3>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-accent/20 rounded-2xl flex items-center justify-center">
              <Store size={32} className="text-accent" />
            </div>
            <div>
              <h4 className="text-xl font-bold font-heading italic">{spotlightVendor?.companyName || spotlightVendor?.name || 'No active vendors'}</h4>
              <div className="flex items-center gap-1 text-accent">
                {[1, 2, 3, 4, 5].map(i => <Star key={i} size={12} fill={i <= ((spotlightVendor?.rating || 0) / 20) ? "currentColor" : "none"} />)}
              </div>
            </div>
          </div>
          <div className="space-y-3 pt-4 border-t border-border/50">
            <div className="flex items-center gap-3 text-sm">
              <Phone size={16} className="text-secondary" />
              <span>{spotlightVendor?.phone || 'N/A'}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Mail size={16} className="text-secondary" />
              <span>{spotlightVendor?.email || 'N/A'}</span>
            </div>
          </div>
          <button
            className="w-full mt-6 btn-primary"
            onClick={() => handleDirectOrder(spotlightVendor?.name || 'N/A', spotlightVendor?.id)}
            disabled={!spotlightVendor}
          >
            Place Direct Order
          </button>
        </div>

        <div className="glass-card p-6 border-accent/10">
          <h3 className="text-sm font-bold text-muted uppercase tracking-widest mb-6">Performance Insights</h3>
          <div className="space-y-4">
            <div className="p-4 bg-white/[0.02] border border-border rounded-xl">
              <p className="text-xs text-secondary mb-1">On-Time Delivery Rate (Avg)</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                  <div className="h-full bg-accent" style={{ width: `${vendors.length > 0 ? (vendors.reduce((a, b) => a + (b.delivery || 0), 0) / vendors.length).toFixed(0) : 0}%` }} />
                </div>
                <span className="text-xs font-bold">{vendors.length > 0 ? (vendors.reduce((a, b) => a + (b.delivery || 0), 0) / vendors.length).toFixed(0) : 0}%</span>
              </div>
            </div>
            <div className="p-4 bg-white/[0.02] border border-border rounded-xl">
              <p className="text-xs text-secondary mb-1">Quality Satisfaction (Avg)</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                  <div className="h-full bg-success" style={{ width: `${vendors.length > 0 ? (vendors.reduce((a, b) => a + (b.rating || 0), 0) / vendors.length).toFixed(0) : 0}%` }} />
                </div>
                <span className="text-xs font-bold">{vendors.length > 0 ? (vendors.reduce((a, b) => a + (b.rating || 0), 0) / vendors.length).toFixed(0) : 0}%</span>
              </div>
            </div>
            <div className="p-4 bg-white/[0.02] border border-border rounded-xl">
              <p className="text-xs text-secondary mb-1">Compliance Score</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                  <div className="h-full bg-info" style={{ width: '100%' }} />
                </div>
                <span className="text-xs font-bold">100%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          modalType === 'view' ? 'Vendor Profile' :
            modalType === 'edit' ? 'Edit Vendor' :
              modalType === 'delete' ? 'Remove Vendor' : 'Add New Vendor'
        }
      >
        <div className="space-y-6">
          {modalType === 'delete' ? (
            <div className="space-y-4">
              <p className="text-secondary">Are you sure you want to remove <span className="text-primary font-bold">{selectedVendor?.name}</span> from the approved vendor list?</p>
              <div className="flex gap-3 justify-end pt-4">
                <button onClick={() => setIsModalOpen(false)} className="btn-secondary">Cancel</button>
                <button onClick={handleDelete} disabled={isSaving} className={`px-6 py-2 bg-danger text-white rounded-lg font-bold ${isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:bg-danger/80'}`}>
                  {isSaving ? 'Removing...' : 'Remove Vendor'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1 col-span-1 sm:col-span-2">
                  <label className="text-[10px] font-bold text-muted uppercase">Vendor Name <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold"
                    disabled={modalType === 'view'}
                  />
                </div>
                {modalType !== 'add' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Vendor ID</label>
                  <input
                    type="text"
                    value={formData.id ?? ''}
                    onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
                    disabled={modalType === 'view' || modalType === 'edit'}
                    placeholder="Database ID"
                  />
                </div>
                )}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold"
                    disabled={modalType === 'view'}
                  >
                    <option>Pharmacy</option>
                    <option>Jewelry</option>
                    <option>Grocery</option>
                    <option>Maintenance</option>
                    <option>Stationary Supplies</option>
                    <option>Automotive</option>
                    <option>General</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Contact Person</label>
                  <input
                    type="text"
                    value={formData.contact || ''}
                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold"
                    disabled={modalType === 'view'}
                    placeholder="Name of contact person"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Phone Number</label>
                  <input
                    type="text"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
                    disabled={modalType === 'view'}
                    placeholder="e.g. 2421234567"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Business Email <span className="text-danger">*</span></label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
                    disabled={modalType === 'view'}
                    placeholder="orders@vendor.mc"
                  />
                </div>
                <div className="col-span-1 sm:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Physical Address</label>
                  <input
                    type="text"
                    value={formData.address || ''}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
                    disabled={modalType === 'view'}
                    placeholder="Full business address"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Rating (%)</label>
                  <input
                    type="text"
                    value={formData.rating}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setFormData({ ...formData, rating: val });
                    }}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
                    disabled={modalType === 'view'}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Delivery Performance (%)</label>
                  <input
                    type="text"
                    value={formData.delivery}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setFormData({ ...formData, delivery: val });
                    }}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
                    disabled={modalType === 'view'}
                  />
                </div>
                {modalType !== 'add' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted uppercase">Status</label>
                    <select
                      value={formData.status || 'inactive'}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold"
                      disabled={modalType === 'view'}
                    >
                      <option value="active" disabled={normalizeRole(currentUser?.role) !== 'superadmin'}>Active</option>
                      <option value="inactive">Pending Approval</option>
                      <option value="blacklisted">Blocked</option>
                    </select>
                  </div>
                )}

                {modalType === 'view' && (
                  <div className="mt-6 p-4 bg-white/5 rounded-xl border border-border space-y-4 col-span-1 sm:col-span-2">
                    <div className="flex items-center gap-3 text-sm">
                      <ShieldCheck size={16} className="text-success" />
                      <span className="text-secondary">Verification Status:</span>
                      <span className="font-bold text-success">Verified Partner</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Phone size={16} className="text-accent" />
                      <span className="text-secondary">Contact:</span>
                      <span className="font-bold">{selectedVendor?.contact || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Mail size={16} className="text-accent" />
                      <span className="text-secondary">Address:</span>
                      <span className="font-bold">{selectedVendor?.address || 'N/A'}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-end pt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">{modalType === 'view' ? 'Close' : 'Cancel'}</button>
                {modalType !== 'view' && (
                  <button 
                    type="button" 
                    onClick={handleSave} 
                    disabled={isSaving}
                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>

      <OrderModal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        modalType={orderModalType}
        initialData={initialOrderData}
        onSave={handleSaveOrder}
        onDelete={() => { }}
      />
    </div>
  );
};

export default Vendors;
