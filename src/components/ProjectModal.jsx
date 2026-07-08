import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { Calendar, User, MapPin, Briefcase, Hash } from 'lucide-react';
import { useData } from '../context/GlobalDataContext';
import CustomDatePicker from './CustomDatePicker';

const ProjectModal = ({ isOpen, onClose, onSave }) => {
  const { clients, fetchClients, customerUsers = [], fetchCustomerUsers, currentUser } = useData();
  const [formData, setFormData] = useState({
    projectId: 'PRJ-' + Math.floor(100 + Math.random() * 900),
    projectName: '',
    client: '',
    clientId: '',
    companyId: '',
    customerId: '',
    clientUserId: '',
    startDate: new Date().toISOString().split('T')[0],
    location: '',
    status: 'Pending',
    deliveryType: 'Road'
  });

  useEffect(() => {
    if (isOpen) {
      fetchClients();
      fetchCustomerUsers({ include_all: true, include_client_role: true });
      setFormData({
        projectId: 'PRJ-' + Math.floor(100 + Math.random() * 900),
        projectName: '',
        client: '',
        clientId: '',
        companyId: '',
        customerId: '',
        clientUserId: '',
        startDate: new Date().toISOString().split('T')[0],
        location: '',
        status: 'Pending',
        deliveryType: 'Road'
      });
    }
  }, [isOpen, fetchClients, fetchCustomerUsers]);

  const clientOptions = React.useMemo(() => {
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
      const role = String(u.role || '').toLowerCase();
      const isCustomer = role === 'customer';
      add({
        id: u.id,
        value: `${isCustomer ? 'user' : 'company'}_${u.id}`,
        label: u.name || u.business_name || u.company_name || u.email || `Client ${u.id}`,
        email: u.email || '',
        source: isCustomer ? 'user' : 'company',
        companyId: u.company_id || u.companyId || (currentUser?.company_id || currentUser?.companyId || ''),
        customerId: u.customer_id || u.client_id || '',
        clientUserId: isCustomer ? u.id : ''
      });
    });

    return out.sort((a, b) => a.label.localeCompare(b.label));
  }, [clients, customerUsers, currentUser?.company_id, currentUser?.companyId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Project"
    >
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted uppercase">Project ID</label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
              <input
                type="text"
                value={formData.projectId}
                className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2 text-sm focus:border-accent outline-none"
                disabled
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted uppercase">Project Name</label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
              <input
                type="text"
                value={formData.projectName}
                onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                placeholder="e.g. Island Setup"
                className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2 text-sm focus:border-accent outline-none"
                required
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted uppercase">Client</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
              <select
                value={formData.clientId}
                onChange={(e) => {
                  const selectedClient = clientOptions.find(c => c.value === e.target.value);
                  setFormData({ 
                    ...formData, 
                    clientId: e.target.value, 
                    companyId: selectedClient?.companyId || '',
                    customerId: selectedClient?.customerId || '',
                    clientUserId: selectedClient?.clientUserId || '',
                    client: selectedClient ? selectedClient.label : '' 
                  });
                }}
                className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2 text-sm focus:border-accent outline-none"
                required
              >
                <option value="">Select Client</option>
                {clientOptions.map(client => (
                  <option key={client.value} value={client.value}>{client.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <CustomDatePicker
              label="Start Date"
              selectedDate={formData.startDate}
              onChange={(date) => setFormData({ ...formData, startDate: date })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted uppercase">Location</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g. Port Hercule"
                className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2 text-sm focus:border-accent outline-none"
                required
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted uppercase">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
            >
              <option>Pending</option>
              <option>In Progress</option>
              <option>Completed</option>
              <option>Cancelled</option>
            </select>
          </div>
          <div className="col-span-1 md:col-span-2 space-y-1">
            <label className="text-[10px] font-bold text-muted uppercase tracking-widest text-accent">Logistics Deployment Protocol</label>
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
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-6 border-t border-border/50">
          <button type="button" onClick={onClose} className="btn-secondary h-11 px-8 rounded-xl font-bold">Cancel</button>
          <button type="submit" className="btn-primary h-11 px-8 rounded-xl font-bold">Save Project</button>
        </div>
      </form>
    </Modal>
  );
};

export default ProjectModal;
