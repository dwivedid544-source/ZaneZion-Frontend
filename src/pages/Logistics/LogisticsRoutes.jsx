import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Table from '../../components/Table';
import Modal from '../../components/Modal';
import {
  Plus, Search, Navigation, MapPin,
  Clock, Map, Route as RouteIcon, Info,
  TrendingDown, TrendingUp
} from 'lucide-react';

import { useData } from '../../context/GlobalDataContext';
import { normalizeRole } from '../../utils/authUtils';

const Routes = () => {
  const navigate = useNavigate();
  const { routes, addRoute, updateRoute, deleteRoute, fetchRoutes, hasMenuPermission, currentUser } = useData();

  React.useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('view');
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({ id: '', name: '', type: 'Land', dist: '', time: '', status: 'Active' });

  const filteredRoutes = routes.filter(r =>
    r.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(r.id).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAction = (type, route) => {
    setSelectedRoute(route);
    setModalType(type);
    setFormData(route.id ? { ...route } : { id: '', name: '', type: 'Land', dist: '', time: '', status: 'Active' });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (modalType === 'add') {
      addRoute(formData);
    } else if (modalType === 'edit') {
      updateRoute({ ...selectedRoute, ...formData });
    }
    setIsModalOpen(false);
  };

  const handleDelete = () => {
    deleteRoute(selectedRoute.id);
    setIsModalOpen(false);
  };

  const columns = [
    { header: "Route ID", accessor: "id" },
    { header: "Path Name", accessor: "name" },
    { header: "Type", accessor: "type" },
    { header: "Assigned Pilot/Driver", accessor: "driver", render: (item) => item.driver || "Pending Dispatch" },
    { header: "Distance", accessor: "dist" },
    { header: "Avg. Time", accessor: "time" },
    { header: "Status", accessor: "status" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-white italic uppercase">Supply Chain Routes</h1>
          <p className="text-secondary text-[10px] md:text-xs mt-1 font-black uppercase tracking-[0.2em] opacity-70 leading-relaxed">Strategic distribution paths and logistics corridors.</p>
        </div>
        {hasMenuPermission('Routes', 'can_add') && (
          <button
            className="btn-primary flex items-center justify-center gap-3 py-4 px-8 text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-accent/10 w-full lg:w-auto"
            onClick={() => handleAction('add', {})}
          >
            <Plus size={16} /> Define Route
          </button>
        )}
      </div>

      <div className="glass-card p-4 sm:p-6 border-white/5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div className="relative w-full max-w-md group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-accent transition-colors" size={18} />
            <input
              type="text"
              placeholder="Search routes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/[0.02] border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:outline-none focus:border-accent italic font-medium transition-all"
            />
          </div>
        </div>

        <Table
          columns={columns}
          data={filteredRoutes}
          actions={true}
          onView={(item) => handleAction('view', item)}
          onEdit={(item) => handleAction('edit', item)}
          onDelete={(item) => handleAction('delete', item)}
          canEdit={hasMenuPermission('Routes', 'can_edit')}
          canDelete={hasMenuPermission('Routes', 'can_delete')}
        />
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          modalType === 'view' ? 'Route Analytics' :
            modalType === 'edit' ? 'Update Corridors' :
              modalType === 'delete' ? 'Disable Path' : 'Establish New Route'
        }
      >
        {selectedRoute && (
          <div className="space-y-6">
            {modalType === 'delete' ? (
              <div className="space-y-6">
                <p className="text-secondary text-sm italic font-medium leading-relaxed">Are you sure you want to disable the <span className="text-white font-black italic">{selectedRoute.name}</span> corridor? This may disrupt critical distribution operations.</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-end pt-4">
                  <button onClick={() => setIsModalOpen(false)} className="py-3 px-8 text-[10px] font-black uppercase text-secondary hover:text-white transition-all">Abort</button>
                  <button onClick={handleDelete} className="py-3 px-8 bg-danger/10 border border-danger/20 text-danger rounded-xl text-[10px] font-black uppercase hover:bg-danger hover:text-white transition-all shadow-xl shadow-danger/5">Disable Route</button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                  {[
                    { label: 'Route ID', value: formData.id, field: 'id', disabled: modalType !== 'add' },
                    { label: 'Route Type', type: 'select', options: ['Sea', 'Land', 'Air', 'Custom'], field: 'type', accent: true },
                    { label: 'Route Definition (From → To)', value: formData.name, field: 'name', fullWidth: true, placeholder: 'Warehouse A → Marina X' },
                    { label: 'Distance / Coordinates', value: formData.dist, field: 'dist', placeholder: 'e.g. 120km' },
                    { label: 'Avg. Time Protocol', value: formData.time, field: 'time', placeholder: 'e.g. 45m', icon: Clock },
                    { label: 'Route Status', type: 'select', options: ['Active', 'Pending', 'Planning', 'Disabled'], field: 'status', fullWidth: true, accent: true }
                  ].map((input, i) => (
                    <div key={i} className={`space-y-2 ${input.fullWidth ? 'sm:col-span-2' : ''}`}>
                      <label className={`text-[9px] font-black uppercase tracking-widest ml-1 ${input.accent ? 'text-accent' : 'text-muted'}`}>{input.label}</label>
                      <div className="relative">
                        {input.icon && <input.icon size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />}
                        {input.type === 'select' ? (
                          <select
                            className={`w-full bg-white/[0.02] border border-white/10 rounded-2xl px-4 py-3.5 text-xs sm:text-sm focus:border-accent outline-none font-black text-white`}
                            value={formData[input.field]}
                            onChange={(e) => setFormData({ ...formData, [input.field]: e.target.value })}
                            disabled={modalType === 'view'}
                          >
                            {input.options.map(opt => <option key={opt} value={opt} className="bg-sidebar">{opt}</option>)}
                          </select>
                        ) : (
                          <input
                            type="text"
                            placeholder={input.placeholder}
                            className={`w-full bg-white/[0.02] border border-white/10 rounded-2xl py-3.5 ${input.icon ? 'pl-11' : 'px-4'} pr-4 text-xs sm:text-sm focus:border-accent outline-none font-black text-white`}
                            value={formData[input.field]}
                            onChange={(e) => setFormData({ ...formData, [input.field]: e.target.value })}
                            disabled={input.disabled || modalType === 'view'}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {modalType === 'view' && (
                  <div className="mt-6 p-4 bg-white/5 rounded-xl border border-border space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-secondary">
                        <Navigation size={16} className="text-accent" />
                        Live Tracking:
                      </div>
                      <span 
                        onClick={() => navigate('/dashboard/logistics-tracking')}
                        className="font-bold text-accent animate-pulse cursor-pointer underline"
                      >
                        Open Logistics Map
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-secondary">
                        <TrendingUp size={16} className="text-success" />
                        Efficiency Rating:
                      </div>
                      <span className="font-bold text-success">Optimal</span>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 justify-end pt-6">
                  <button onClick={() => setIsModalOpen(false)} className="btn-secondary">{modalType === 'view' ? 'Close' : 'Cancel'}</button>
                  {modalType !== 'view' && <button onClick={handleSave} className="btn-primary flex items-center gap-2">
                    {modalType === 'add' ? 'Establish Route' : 'Update Network'} <RouteIcon size={14} />
                  </button>}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Routes;
