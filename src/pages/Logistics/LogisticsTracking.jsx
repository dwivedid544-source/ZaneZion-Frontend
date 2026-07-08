import React, { useState, useEffect } from 'react';
import Table from '../../components/Table';
import Modal from '../../components/Modal';
import {
  Plus, Search, Crosshair, MapPin,
  Activity, Radio, Shield, Zap,
  Wifi, Signal, Lock, Satellite,
  Navigation, AlertTriangle
} from 'lucide-react';

import { useData } from '../../context/GlobalDataContext';
import { normalizeRole } from '../../utils/authUtils';

const Tracking = () => {
  const { tracking = [], fetchTracking, addTracking, updateTracking, deleteTracking, hasMenuPermission, currentUser } = useData();

  useEffect(() => {
    if (fetchTracking) fetchTracking();
  }, [fetchTracking]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('view');
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({ id: '', asset: '', location: '', signal: 'Strong', status: 'Active', eta: '' });

  const filteredTracking = (tracking || []).filter(t =>
    t.asset?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(t.id).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAction = (type, asset) => {
    setSelectedAsset(asset);
    setModalType(type);
    setFormData(asset && asset.id ? { ...asset } : { id: `TRK-${Math.floor(100 + Math.random() * 899)}`, asset: '', location: '', signal: 'Strong', status: 'Active', eta: 'Calculating...' });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (modalType === 'add') {
      addTracking(formData);
    } else if (modalType === 'edit') {
      updateTracking({ ...selectedAsset, ...formData });
    }
    setIsModalOpen(false);
  };

  const handleDelete = () => {
    deleteTracking(selectedAsset.id);
    setIsModalOpen(false);
  };

  const columns = [
    { header: "Tracker ID", accessor: "id" },
    { header: "Asset Display", accessor: "asset" },
    { header: "Live Point", accessor: "location" },
    { header: "Signal", accessor: "signal" },
    { header: "ETA", accessor: "eta" },
    { header: "Status", accessor: "status" },
  ];

  const activeCount = (tracking || []).filter(t => t.status === 'Active').length;
  const enRouteCount = (tracking || []).filter(t => t.status === 'En Route' || t.status === 'On Way').length;
  const strongSignal = (tracking || []).filter(t => t.signal === 'Strong').length;
  const delayedCount = (tracking || []).filter(t => t.status === 'Delayed').length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-white italic uppercase flex items-center gap-3">
            <Satellite size={32} className="text-accent animate-spin-slow" />
            Geo-Spatial Tracking
          </h1>
          <p className="text-secondary text-[10px] md:text-xs mt-1 font-black uppercase tracking-[0.2em] opacity-70 leading-relaxed">Real-time telemetry and positional data for all active assets.</p>
        </div>
        {hasMenuPermission('Tracking', 'can_add') && (
          <button
            className="btn-primary flex items-center justify-center gap-3 py-4 px-8 text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-accent/10 w-full lg:w-auto"
            onClick={() => handleAction('add', {})}
          >
            <Plus size={16} /> Initiate Asset Sync
          </button>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Assets', value: activeCount, icon: Activity, color: 'text-success' },
          { label: 'En Route', value: enRouteCount, icon: Navigation, color: 'text-info' },
          { label: 'Strong Signal', value: strongSignal, icon: Signal, color: 'text-accent' },
          { label: 'Delayed', value: delayedCount, icon: AlertTriangle, color: 'text-warning' },
        ].map((stat, i) => (
          <div key={i} className="glass-card p-5 flex items-center gap-4 hover:border-accent/20 transition-all group">
            <div className={`w-10 h-10 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center ${stat.color} group-hover:scale-110 transition-transform flex-shrink-0`}>
              <stat.icon size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black text-muted uppercase tracking-widest truncate">{stat.label}</p>
              <p className="text-xl font-black text-white">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card p-4 sm:p-6 border-accent/10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
          <div className="relative w-full max-w-md group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-accent transition-colors" size={18} />
            <input
              type="text"
              placeholder="Filter by Asset or Tracker ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/[0.02] border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:outline-none focus:border-accent italic font-medium transition-all"
            />
          </div>
          <div className="flex items-center gap-3 px-5 py-3 bg-success/5 border border-success/20 rounded-2xl shrink-0 w-full lg:w-auto">
            <Signal size={16} className="text-success animate-pulse" />
            <span className="text-[10px] font-black text-success uppercase tracking-[0.2em]">Network 98.4% Online</span>
          </div>
        </div>

        <Table
          columns={columns}
          data={filteredTracking}
          actions={true}
          onView={(item) => handleAction('view', item)}
          onEdit={(item) => handleAction('edit', item)}
          onDelete={(item) => handleAction('delete', item)}
          canEdit={hasMenuPermission('Tracking', 'can_edit')}
          canDelete={hasMenuPermission('Tracking', 'can_delete')}
        />
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          modalType === 'view' ? 'Telemetry Diagnostics' :
            modalType === 'edit' ? 'Update Tracker' :
              modalType === 'delete' ? 'Disable Signal' : 'Initiate Asset Sync'
        }
      >
        {selectedAsset && (
          <div className="space-y-6">
            {modalType === 'delete' ? (
              <div className="space-y-6">
                <p className="text-secondary text-sm italic font-medium leading-relaxed">Are you sure you want to disable the tracker for <span className="text-white font-black italic">{selectedAsset.asset}</span>? Loss of telemetry signal will occur across the entire distribution network.</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-end pt-4">
                  <button onClick={() => setIsModalOpen(false)} className="py-3 px-8 text-[10px] font-black uppercase text-secondary hover:text-white transition-all">Keep Connected</button>
                  <button onClick={handleDelete} className="py-3 px-8 bg-danger/10 border border-danger/20 text-danger rounded-xl text-[10px] font-black uppercase hover:bg-danger hover:text-white transition-all shadow-xl shadow-danger/5">Cut Signal</button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                  {[
                    { label: 'Tracker ID', value: formData.id, field: 'id', disabled: modalType !== 'add' },
                    { label: 'Primary Asset', value: formData.asset, field: 'asset' },
                    { label: 'Linked Base Point', value: formData.location, field: 'location' },
                    { label: 'Signal Strength', type: 'select', options: ['Strong', 'Moderate', 'Stable', 'Weak'], field: 'signal', accent: true },
                    { label: 'Current ETA Protocol', value: formData.eta, field: 'eta' },
                    { label: 'Status Protocol', type: 'select', options: ['Active', 'En Route', 'On Way', 'Delayed'], field: 'status', accent: true }
                  ].map((input, i) => (
                    <div key={i} className="space-y-2">
                      <label className={`text-[9px] font-black uppercase tracking-widest ml-1 ${input.accent ? 'text-accent' : 'text-muted'}`}>{input.label}</label>
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
                          className="w-full bg-white/[0.02] border border-white/10 rounded-2xl px-4 py-3.5 text-xs sm:text-sm focus:border-accent outline-none font-black text-white"
                          value={formData[input.field]}
                          onChange={(e) => setFormData({ ...formData, [input.field]: e.target.value })}
                          disabled={input.disabled || modalType === 'view'}
                        />
                      )}
                    </div>
                  ))}
                </div>

                {modalType === 'view' && (
                  <div className="bg-accent/5 border border-accent/20 rounded-2xl p-6 space-y-6">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Crosshair className="text-accent" size={18} />
                        <h4 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Geo-Coordinate Lock</h4>
                      </div>
                      <span className="text-[8px] font-black text-accent bg-accent/10 border border-accent/30 px-3 py-1 rounded-full uppercase tracking-widest">Secure Trace</span>
                    </div>
                    <div className="space-y-4">
                      <div className="flex justify-between items-end border-b border-white/5 pb-2">
                        <span className="text-[9px] font-black text-muted uppercase tracking-widest">Latitude</span>
                        <span className="text-xs font-mono text-white font-black">25.7617° N</span>
                      </div>
                      <div className="flex justify-between items-end border-b border-white/5 pb-2">
                        <span className="text-[9px] font-black text-muted uppercase tracking-widest">Longitude</span>
                        <span className="text-xs font-mono text-white font-black">80.1918° W</span>
                      </div>
                      <div className="flex justify-between items-center pt-2">
                        <div className="flex items-center gap-2 text-muted opacity-40">
                          <Lock size={12} />
                          <span className="text-[8px] font-black uppercase tracking-widest">Encryption</span>
                        </div>
                        <span className="text-[8px] font-black text-success uppercase tracking-[0.2em] flex items-center gap-2">
                          <Shield size={10} /> AES-256 ACTIVE
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 justify-end pt-8 border-t border-white/5">
                  <button onClick={() => setIsModalOpen(false)} className="order-2 sm:order-1 py-4 px-10 text-[10px] font-black uppercase tracking-[0.2em] text-muted hover:text-white transition-all">{modalType === 'view' ? 'Close Link' : 'Abort Sync'}</button>
                  {modalType !== 'view' && <button onClick={handleSave} className="order-1 sm:order-2 py-4 px-12 bg-accent text-black shadow-2xl shadow-accent/20 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:scale-[1.02] transition-all flex items-center justify-center gap-3">
                    Synchronize Asset <Zap size={16} />
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

export default Tracking;
