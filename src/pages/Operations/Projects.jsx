import React, { useState } from 'react';
import { swalSuccess, swalError, swalWarning, swalInfo, swalConfirm, swalCredentials, swalCopied } from '../../utils/swal';
import Table from '../../components/Table';
import Modal from '../../components/Modal';
import {
  Plus, Search, Briefcase, Calendar,
  MapPin, Users, Target, Info, Clock, Rocket, CheckCircle2
} from 'lucide-react';
import CustomDatePicker from '../../components/CustomDatePicker';
import Pagination from '../../components/Common/Pagination';

import { useData } from '../../context/GlobalDataContext';

const Projects = () => {
  const { projects, addProject, updateProject, deleteProject, fetchProjects, customerUsers, fetchCustomerUsers, convertProjectToMission, missions = [], fetchMissions, hasMenuPermission, currentUser, clients = [], fetchClients } = useData();

  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  const userRole = String(currentUser?.role?.name || currentUser?.role || '').toLowerCase().replace(/\s+/g, '_');
  const isCustomer = ['customer', 'saas_client', 'client'].includes(userRole);

  const [formData, setFormData] = useState({ name: '', client: '', clientId: '', start: '', location: '', status: 'Pending', deliveryType: 'Road' });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('view');
  const [selectedProject, setSelectedProject] = useState(null);
  const [statusFilter, setStatusFilter] = useState('All');

  React.useEffect(() => {
    fetchProjects();
    fetchClients();
    fetchMissions();
    fetchCustomerUsers({ include_all: true, include_client_role: true });
  }, [fetchProjects, fetchClients, fetchMissions, fetchCustomerUsers]);

  // Check if a project has already been converted to a mission
  const isProjectRouted = (projectId) =>
    missions.some((m) => String(m.orderId || m.order_id) === String(projectId));

  const customerOptions = React.useMemo(() => {
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
      const roleName = String(u.role?.name || u.role || '').toLowerCase();
      const isCustomerRole = ['customer', 'client', 'business_client', 'saas_client'].some(r => roleName.includes(r));
      if (!isCustomerRole) return; // Skip Admins, Logistics, Operations, etc.

      // Try to find a matching Client record by email
      const matchedClient = (clients || []).find(c => String(c.email || '').toLowerCase() === String(u.email || '').toLowerCase());
      const clientRecordId = matchedClient?.id || u.customer_id || u.client_id || u.company_id || u.companyId;

      // Only include if they have a valid Client table record to prevent Axios Error 400
      if (!clientRecordId) return;

      const isCompany = !roleName.includes('customer');
      const prefix = isCompany ? 'company' : 'customer';

      add({
        id: u.id,
        value: `${prefix}_${clientRecordId}`,
        label: u.name || u.business_name || u.company_name || u.email || `Client ${u.id}`,
        email: u.email || '',
        source: isCompany ? 'company' : 'customer',
        companyId: isCompany ? clientRecordId : '',
        customerId: !isCompany ? clientRecordId : '',
        clientUserId: u.id
      });
    });

    return out.sort((a, b) => a.label.localeCompare(b.label));
  }, [clients, customerUsers, currentUser?.company_id, currentUser?.companyId]);

  // All filtering done on frontend for consistency
  const filteredProjects = projects.filter(p => {
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch = !term ||
      (p.name || '').toLowerCase().includes(term) ||
      (p.client || '').toLowerCase().includes(term) ||
      (p.location || '').toLowerCase().includes(term) ||
      String(p.id).includes(term);
    const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const itemsPerPage = 10;
  const currentProjects = filteredProjects.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);

  const handleAction = (type, prj) => {
    setSelectedProject(prj);
    setModalType(type);
    if (prj.id) {
      const cid = prj.customer_id || prj.customerId;
      const cuid = prj.client_user_id || prj.clientUserId;
      const coid = prj.company_id || prj.companyId;

      let matchedVal = '';
      if (cid) {
        const found = customerOptions.find(o => String(o.customerId) === String(cid));
        if (found) matchedVal = found.value;
      }
      if (!matchedVal && cuid) {
        const found = customerOptions.find(o => String(o.clientUserId) === String(cuid));
        if (found) matchedVal = found.value;
      }
      if (!matchedVal && coid) {
        const found = customerOptions.find(o => String(o.companyId) === String(coid) && o.source === 'company');
        if (found) matchedVal = found.value;
      }

      setFormData({
        ...prj,
        clientId: matchedVal,
        companyId: coid || '',
        customerId: cid || '',
        clientUserId: cuid || '',
        deliveryType: prj.deliveryType || prj.delivery_type || 'Road',
        start: prj.start || prj.start_date || ''
      });
    } else {
      setFormData({ name: '', client: '', clientId: '', companyId: '', customerId: '', clientUserId: '', start: '', location: '', status: 'Pending', deliveryType: 'Road' });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name?.trim()) return swalWarning('Required', 'Project name is required.');
    try {
      if (modalType === 'add') {
        await addProject(formData);
      } else if (modalType === 'edit') {
        await updateProject({ ...selectedProject, ...formData });
      }
      setIsModalOpen(false);
      // Explicitly refresh to ensure sync
      if (fetchProjects) await fetchProjects();
    } catch (e) {
      swalError('Error', 'Failed to save project changes.');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteProject(selectedProject.id);
      setIsModalOpen(false);
      if (fetchProjects) await fetchProjects();
    } catch (e) {
      swalError('Error', 'Failed to archive project.');
    }
  };

  const handleLaunchMission = async (prj) => {
    if (isProjectRouted(prj.id)) {
      swalInfo('Already Routed', 'This project has already been sent to Logistics.');
      return;
    }
    const confirm = await swalConfirm('Launch Mission', `Are you sure you want to initialize a logistics mission for ${prj.name}?`);
    if (confirm) {
      const missionData = {
        mission_type: 'Delivery',
        destination_type: prj.location || 'Client Site',
        notes: `Logistics deployment for Project ID: ${prj.id}`
      };
      await convertProjectToMission(prj.id, missionData);
      await fetchMissions();
      swalSuccess('Mission Launched', 'Project has been routed to Logistics/Missions protocol.');
    }
  };

  const columns = [
    { header: "Project ID", accessor: "id" },
    { header: "Project Name", accessor: "name" },
    { 
      header: "Client", 
      accessor: "client",
      render: (item) => {
        if (typeof item.client === 'string') return item.client;
        return item.client?.name || item.client?.companyName || item.client?.business_name || "—";
      }
    },
    { header: "Start Date", accessor: "start" },
    { header: "Location", accessor: "location" },
    { header: "Status", accessor: "status" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Project Management</h1>
          <p className="text-secondary mt-1">Coordinate high-end hospitality projects and events.</p>
        </div>
        {hasMenuPermission('Projects', 'can_add') && (
          <button className="btn-primary flex items-center gap-2" onClick={() => handleAction('add', {})}>
            <Plus size={16} /> New Project
          </button>
        )}
      </div>

      <div className="glass-card p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex flex-1 gap-4 max-w-xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                className="w-full bg-background border border-border rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <select
              className="bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="All">All Status</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <Table
          columns={columns}
          data={currentProjects}
          actions={true}
          onView={(item) => handleAction('view', item)}
          onEdit={(item) => handleAction('edit', item)}
          onDelete={(item) => handleAction('delete', item)}
          canEdit={!isCustomer && hasMenuPermission('Projects', 'can_edit')}
          canDelete={!isCustomer && hasMenuPermission('Projects', 'can_delete')}
          customAction={(item) => {
            const routed = isProjectRouted(item.id);
            return (
              <button
                onClick={(e) => { e.stopPropagation(); handleLaunchMission(item); }}
                className={`p-2 rounded-lg transition-colors group relative ${
                  routed
                    ? 'text-success cursor-default'
                    : 'hover:bg-accent/10 text-accent'
                }`}
                title={routed ? 'Already routed to Logistics' : 'Route to Logistics'}
              >
                {routed ? <CheckCircle2 size={16} /> : <Rocket size={16} />}
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-[10px] text-white rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">
                  {routed ? '✓ Sent to Logistics' : 'Route to Logistics'}
                </span>
              </button>
            );
          }}
        />
        {filteredProjects.length > itemsPerPage && (
          <div className="mt-6 border-t border-white/5 pt-6">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={filteredProjects.length}
            />
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          modalType === 'view' ? 'Project Details' :
            modalType === 'edit' ? 'Edit Project' :
              modalType === 'delete' ? 'Archive Project' : 'Create New Project'
        }
      >
        {selectedProject && (
          <div className="space-y-6">
            {modalType === 'delete' ? (
              <div className="space-y-4">
                <p className="text-secondary">Are you sure you want to archive <span className="text-primary font-bold">{selectedProject.name}</span>?</p>
                <div className="flex gap-3 justify-end pt-4">
                  <button onClick={() => setIsModalOpen(false)} className="btn-secondary">Cancel</button>
                  <button onClick={handleDelete} className="px-6 py-2 bg-danger text-white rounded-lg font-bold">Archive Project</button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted uppercase">Project ID</label>
                    <input 
                      type="text" 
                      value={selectedProject.id || 'Auto-Generated'} 
                      className="w-full bg-background border border-border text-muted rounded-lg px-4 py-2 text-sm focus:border-accent outline-none" 
                      disabled={true} 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted uppercase">Project Name</label>
                    <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none" disabled={modalType === 'view'} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted uppercase">Customer</label>
                    <select 
                      value={formData.clientId} 
                      onChange={(e) => {
                        const selectedCustomer = customerOptions.find(c => c.value === e.target.value);
                        setFormData({ 
                          ...formData, 
                          clientId: e.target.value,
                          companyId: selectedCustomer?.companyId || '',
                          customerId: selectedCustomer?.customerId || '',
                          clientUserId: selectedCustomer?.clientUserId || '',
                          client: selectedCustomer ? selectedCustomer.label : '' 
                        });
                      }} 
                      className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none" 
                      disabled={modalType === 'view'}
                    >
                      <option value="">Select Customer</option>
                      {customerOptions.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <CustomDatePicker
                      label="Start Date"
                      selectedDate={formData.start}
                      onChange={(date) => {
                        setFormData({ ...formData, start: date });
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted uppercase">Location</label>
                    <input type="text" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none" disabled={modalType === 'view'} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted uppercase">Status</label>
                    <select className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} disabled={modalType === 'view'}>
                      <option>Pending</option>
                      <option>In Progress</option>
                      <option>Completed</option>
                      <option>Cancelled</option>
                    </select>
                  </div>
                  <div className="col-span-2 space-y-1 pt-2">
                    <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Register Logistics Deployment</label>
                    <div className="flex gap-2">
                      {['Road', 'Sea', 'Air'].map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setFormData({ ...formData, deliveryType: mode })}
                          className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter border transition-all ${formData.deliveryType === mode
                            ? 'bg-accent border-accent text-black shadow-lg shadow-accent/20'
                            : 'bg-white/5 border-white/10 text-muted hover:border-white/30'
                            }`}
                          disabled={modalType === 'view'}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {modalType === 'view' && (
                  <div className="mt-6 p-4 bg-white/5 rounded-xl border border-border space-y-4">
                    <div className="flex items-center gap-3 text-sm">
                      <MapPin size={16} className="text-accent" />
                      <span className="text-secondary">Location:</span>
                      <span className="font-bold">{selectedProject.location}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Target size={16} className="text-accent" />
                      <span className="text-secondary">Objective:</span>
                      <span className="font-bold">Full VIP Concierge Setup</span>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 justify-end pt-6">
                  <button onClick={() => setIsModalOpen(false)} className="btn-secondary">{modalType === 'view' ? 'Close' : 'Cancel'}</button>
                  {modalType !== 'view' && <button onClick={handleSave} className="btn-primary">Save Project</button>}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Projects;
