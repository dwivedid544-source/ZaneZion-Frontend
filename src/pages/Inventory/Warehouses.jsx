import React, { useState } from 'react';
import { Warehouse as WarehouseIcon, MapPin, Plus, Store, RefreshCcw, Eye, Edit2, Trash2, X, User, CheckCircle, XCircle, Search } from 'lucide-react';
import { useData } from '../../context/GlobalDataContext';
import { useWarehouses, useCreateWarehouse, useUpdateWarehouse, useDeleteWarehouse } from '../../hooks/api/useInventory';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';

const EMPTY_FORM = { name: '', location: '', capacity: '', manager_id: '', status: 'active' };

const Warehouses = () => {
  const { hasMenuPermission, users, fetchStaff, currentUser } = useData();
  const userRole = (currentUser?.role?.name || currentUser?.role || '').toUpperCase();
<<<<<<< HEAD
  const isInventoryStaff = userRole === 'INVENTORY' || userRole === 'INVENTORY_STAFF';
  const canEditManager = !isInventoryStaff;
=======
  const isB2BClient = userRole === 'CLIENT' || userRole === 'BUSINESS_CLIENT';
  const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'STAFF'].includes(userRole);
  const canAdd = isAdmin || isB2BClient || hasMenuPermission('Warehouses', 'can_add');
  const canEdit = isAdmin || isB2BClient || hasMenuPermission('Warehouses', 'can_edit');
  const canDelete = isAdmin || isB2BClient || hasMenuPermission('Warehouses', 'can_delete');
>>>>>>> a0b355ae57fe62394ceab215f82cbcf4ec825bb1

  const { data: whData, isLoading, error } = useWarehouses();
  // API returns: { success, data: { warehouses: [], total, page, totalPages } }
  const warehouses = whData?.data?.warehouses || [];

  const createMutation = useCreateWarehouse();
  const updateMutation = useUpdateWarehouse();
  const deleteMutation = useDeleteWarehouse();

  React.useEffect(() => { fetchStaff?.(); }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [modal, setModal] = useState({ open: false, type: 'view', wh: null });
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const openModal = (type, wh = null) => {
    setModal({ open: true, type, wh });
    if (wh && type !== 'delete') {
      setFormData({
        id: wh.id,
        name: wh.name || '',
        location: wh.location || '',
        capacity: wh.capacity != null ? String(wh.capacity) : '',
        status: wh.status || 'active',
        manager_id: wh.manager?.userId != null ? String(wh.manager.userId) : ''
      });
    } else if (!wh) {
      setFormData(EMPTY_FORM);
    }
  };

  const closeModal = () => setModal({ open: false, type: 'view', wh: null });

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        name: formData.name,
        location: formData.location || null,
        capacity: formData.capacity !== '' && formData.capacity !== undefined ? Number(formData.capacity) : 0,
        status: formData.status || 'active',
        managerId: formData.manager_id ? Number(formData.manager_id) : null
      };

      if (modal.type === 'add') {
        await createMutation.mutateAsync(payload);
      } else if (modal.type === 'edit') {
        await updateMutation.mutateAsync({ id: formData.id || modal.wh?.id, data: payload });
      }
      closeModal();
    } catch (e) {
      console.error('Save failed:', e);
      alert(e?.response?.data?.message || e.message || 'Operation failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await deleteMutation.mutateAsync(modal.wh.id);
      closeModal();
    } catch (e) {
      console.error('Delete failed:', e);
      alert(e?.response?.data?.message || e.message || 'Delete failed');
    } finally {
      setSaving(false);
    }
  };

  const getManagerName = (wh) => {
    if (wh.manager) {
      const empName = `${wh.manager.firstName || ''} ${wh.manager.lastName || ''}`.trim();
      if (empName) return empName;
      if (wh.manager.user?.name) return wh.manager.user.name;
    }
    const mid = wh.managerId ?? wh.manager_id;
    if (!mid) return null;
    const u = (users || []).find(x => String(x.id) === String(mid));
    return u?.name || `#${mid}`;
  };

  const filtered = warehouses.filter(wh =>
    (wh.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (wh.location || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(wh.id).includes(searchTerm)
  );

  const getStatusStyle = (s) => (s || '').toLowerCase() === 'active'
    ? 'bg-success/20 text-success border border-success/30'
    : 'bg-danger/20 text-danger border border-danger/30';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-white italic uppercase">Warehouse Network</h1>
          <p className="text-secondary text-xs mt-1 font-black uppercase tracking-[0.2em] opacity-70 italic">
            Manage precision storage facilities and distribution centers
          </p>
        </div>
        <div className="flex gap-3 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
            <input
              type="text"
              placeholder="Search facilities..."
              className="bg-sidebar/50 border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-accent w-56 text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {canAdd && (
            <button className="btn-primary flex items-center gap-2 px-6" onClick={() => openModal('add')}>
              <Plus size={16} /> Add Facility
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: 'Total Facilities', value: warehouses.length, color: 'text-accent' },
          { label: 'Active', value: warehouses.filter(w => (w.status || '').toLowerCase() === 'active').length, color: 'text-success' },
          { label: 'Inactive', value: warehouses.filter(w => (w.status || '').toLowerCase() !== 'active').length, color: 'text-danger' },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className="glass-card p-5 border-l-4 border-l-accent">
            <p className={`text-3xl font-black italic tracking-tighter ${s.color}`}>{s.value}</p>
            <p className="text-[10px] font-black text-secondary uppercase tracking-widest mt-1 opacity-60">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center p-16">
            <RefreshCcw className="animate-spin text-accent" size={28} />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-danger font-bold">Failed to load warehouses. Please refresh.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.03] border-b border-border">
                  {['#', 'ID', 'Warehouse Name', 'Location', 'Capacity', 'Status', 'Manager', 'Actions'].map(h => (
                    <th key={h} className="p-5 text-[10px] font-black text-muted uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-16 text-center text-muted">
                      <WarehouseIcon className="mx-auto mb-4 opacity-20" size={48} />
                      <p className="font-bold text-sm">No warehouses found</p>
                    </td>
                  </tr>
                ) : filtered.map((wh, i) => (
                  <motion.tr key={wh.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    className="hover:bg-white/[0.01] transition-colors group">
                    <td className="p-5 text-xs text-muted font-black">{String(i + 1).padStart(2, '0')}</td>
                    <td className="p-5">
                      <span className="text-xs font-black text-accent/70 bg-accent/10 px-2 py-1 rounded">#{wh.id}</span>
                    </td>
                    <td className="p-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-accent/20 flex items-center justify-center text-accent font-black text-sm">
                          {(wh.name || 'W')[0].toUpperCase()}
                        </div>
                        <span className="text-sm font-bold text-white">{wh.name || '—'}</span>
                      </div>
                    </td>
                    <td className="p-5">
                      <div className="flex items-center gap-2 text-secondary text-sm">
                        <MapPin size={13} className="text-muted" />
                        {wh.location || '—'}
                      </div>
                    </td>
                    <td className="p-5">
                      <span className="text-sm font-bold text-white">{wh.capacity ?? '—'}</span>
                    </td>
                    <td className="p-5">
                      <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${getStatusStyle(wh.status)}`}>
                        {wh.status || 'Unknown'}
                      </span>
                    </td>
                    <td className="p-5">
                      <span className="text-sm text-secondary">{getManagerName(wh) || '—'}</span>
                    </td>
                    <td className="p-5">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openModal('view', wh)}
                          className="p-2 bg-white/5 border border-border text-secondary rounded-lg hover:text-white hover:bg-white/10 transition-all" title="View">
                          <Eye size={15} />
                        </button>
                        {canEdit && (
                          <button onClick={() => openModal('edit', wh)}
                            className="p-2 bg-white/5 border border-border text-secondary rounded-lg hover:text-accent hover:border-accent/30 transition-all" title="Edit">
                            <Edit2 size={15} />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => openModal('delete', wh)}
                            className="p-2 bg-danger/10 border border-danger/20 text-danger rounded-lg hover:bg-danger hover:text-white transition-all" title="Delete">
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-3 border-t border-border">
              <span className="text-[10px] text-muted font-black uppercase tracking-widest">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {createPortal(
        <AnimatePresence>
          {modal.open && (
            <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={closeModal} />
              <motion.div initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 30 }}
                className="w-full max-w-lg bg-sidebar border border-border rounded-[2rem] shadow-2xl relative z-10 overflow-hidden">

                {/* Modal Header */}
                <div className="p-7 border-b border-border/10 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-black text-white uppercase italic">
                      {modal.type === 'view' ? 'Facility Details' : modal.type === 'edit' ? 'Edit Facility' : modal.type === 'delete' ? 'Remove Facility' : 'Add New Facility'}
                    </h3>
                    <p className="text-[10px] text-secondary font-black uppercase tracking-widest opacity-60 mt-1">
                      {modal.type === 'view' ? 'Warehouse overview' : modal.type === 'delete' ? 'This cannot be undone' : 'Fill in warehouse details'}
                    </p>
                  </div>
                  <button onClick={closeModal} className="p-2.5 bg-white/5 border border-border rounded-xl text-muted hover:text-white transition-all">
                    <X size={18} />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-7">
                  {modal.type === 'delete' ? (
                    <div className="space-y-6">
                      <div className="p-5 bg-danger/5 border border-danger/20 rounded-2xl">
                        <p className="text-sm text-secondary">
                          Are you sure you want to remove warehouse <span className="text-white font-bold">"{modal.wh?.name}"</span>? This action cannot be undone.
                        </p>
                      </div>
                      <div className="flex gap-3 justify-end">
                        <button onClick={closeModal} className="px-6 py-3 text-secondary text-[10px] font-black uppercase tracking-widest hover:text-white transition-all">Cancel</button>
                        <button onClick={handleDelete} disabled={saving}
                          className="px-8 py-3 bg-danger text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-danger/80 transition-all flex items-center gap-2 disabled:opacity-50">
                          {saving ? <RefreshCcw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          Remove Facility
                        </button>
                      </div>
                    </div>
                  ) : modal.type === 'view' ? (
                    <div className="space-y-4">
                      {[
                        { icon: WarehouseIcon, label: 'Warehouse Name', value: modal.wh?.name },
                        { icon: MapPin, label: 'Location', value: modal.wh?.location },
                        { icon: CheckCircle, label: 'Status', value: modal.wh?.status },
                        { icon: User, label: 'Manager', value: getManagerName(modal.wh) },
                        { icon: Store, label: 'Capacity (%)', value: modal.wh?.capacity != null ? String(modal.wh.capacity) : '—' },
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-center gap-4 p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                          <item.icon size={16} className="text-accent shrink-0" />
                          <div>
                            <p className="text-[9px] font-black text-muted uppercase tracking-widest">{item.label}</p>
                            <p className="text-sm font-bold text-white mt-0.5">{item.value || '—'}</p>
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-end pt-2">
                        <button onClick={closeModal} className="px-8 py-3 bg-white/5 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-white/10 transition-all">Close</button>
                      </div>
                    </div>
                  ) : (
                    /* Add / Edit Form — matches screenshot layout */
                    <div className="space-y-5">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Facility Name</label>
                          <input type="text" value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent"
                            placeholder="" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Location</label>
                          <input type="text" value={formData.location}
                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                            className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent"
                            placeholder="" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Manager (User)</label>
<<<<<<< HEAD
                          <select value={formData.manager_id} onChange={(e) => canEditManager && setFormData({ ...formData, manager_id: e.target.value })}
                            disabled={!canEditManager}
                            className={`w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent appearance-none ${canEditManager ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
=======
                          <select value={formData.manager_id} onChange={(e) => (isAdmin || isB2BClient) && setFormData({ ...formData, manager_id: e.target.value })}
                            disabled={!(isAdmin || isB2BClient)}
                            className={`w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent appearance-none ${(isAdmin || isB2BClient) ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
>>>>>>> a0b355ae57fe62394ceab215f82cbcf4ec825bb1
                            <option value="">Select facility manager…</option>
                            {(users || []).filter(u => u?.name && (u.role?.name === 'INVENTORY' || u.role === 'INVENTORY')).map(u => (
                              <option key={u.id} value={String(u.id)}>{u.name}{u.role ? ` (${u.role?.name || u.role})` : ''}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Capacity (%)</label>
                          <input type="text" value={formData.capacity}
                            onChange={(e) => {
                              let val = e.target.value.replace(/\D/g, '');
                              if (val.length > 1 && val.startsWith('0')) {
                                val = val.replace(/^0+/, '');
                              }
                              setFormData({ ...formData, capacity: val });
                            }}
                            className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent" />
                        </div>
                      </div>

                      {/* Facility Status */}
                      <div className="p-4 bg-white/5 border border-border rounded-xl">
                        <p className="text-[10px] font-bold text-accent uppercase mb-2">Facility Status</p>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full animate-pulse ${formData.status === 'active' ? 'bg-success' : 'bg-danger'}`} />
                          <span className={`text-sm font-bold uppercase ${formData.status === 'active' ? 'text-success' : 'text-danger'}`}>
                            {formData.status === 'active' ? 'Active Operation' : 'Inactive'}
                          </span>
                          <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            className="ml-auto bg-transparent border border-border rounded-lg px-3 py-1 text-xs text-white focus:outline-none focus:border-accent appearance-none cursor-pointer">
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex gap-3 justify-end pt-2">
                        <button onClick={closeModal} className="px-6 py-2.5 text-secondary font-bold text-sm hover:text-white transition-all">Cancel</button>
                        <button onClick={handleSave} disabled={saving || !formData.name.trim()}
                          className="btn-primary flex items-center gap-2 px-8 disabled:opacity-50 disabled:cursor-not-allowed">
                          {saving && <RefreshCcw size={14} className="animate-spin" />}
                          Save Facility
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

export default Warehouses;
