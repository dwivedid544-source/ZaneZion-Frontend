import React, { useState } from 'react';
import Table from '../../components/Table';
import Modal from '../../components/Modal';
import {
  Plus, Search, Truck, Anchor, Plane,
  Settings, Battery, Fuel, Gauge, Shield
} from 'lucide-react';

import { useData } from '../../context/GlobalDataContext';

const Fleet = () => {
  const { fleet, routes, addFleet, updateFleet, deleteFleet, deliveries, dispatchVehicle, fetchFleet, fetchDeliveries, fetchRoutes, hasMenuPermission } = useData();

  React.useEffect(() => {
    fetchFleet();
    fetchDeliveries();
    fetchRoutes();
  }, [fetchFleet, fetchDeliveries, fetchRoutes]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('view');
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({ id: '', type: 'Luxury Truck', model: '', fuel: '100%', status: 'Active', capacity: '', routeId: '', markUrgent: false });

  const filteredFleet = fleet.filter(asset =>
    asset.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(asset.id).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAction = (type, vehicle) => {
    setSelectedVehicle(vehicle);
    setModalType(type);
    setFormData(vehicle.id ? { ...vehicle } : { id: '', type: 'Luxury Truck', model: '', fuel: '100%', status: 'Active', capacity: '', routeId: '', markUrgent: false });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (modalType === 'add') {
      addFleet(formData);
    } else if (modalType === 'edit') {
      updateFleet({ ...selectedVehicle, ...formData });
    }
    setIsModalOpen(false);
  };

  const handleDelete = () => {
    deleteFleet(selectedVehicle.id);
    setIsModalOpen(false);
  };

  const columns = [
    { header: "Fleet ID", accessor: "id" },
    { header: "Asset Type", accessor: "type" },
    { header: "Model", accessor: "model" },
    { header: "Fuel/Charge", accessor: "fuel" },
    { header: "Capacity", accessor: "capacity" },
    {
      header: "Insurance",
      accessor: "insurancePolicy",
      render: (row) => (
        <span className="text-secondary font-mono text-[10px]">{row.insurancePolicy || 'N/A'}</span>
      )
    },
    {
      header: "Reg. Expiry",
      accessor: "registrationExpiry",
      render: (row) => {
        const expiry = new Date(row.registrationExpiry);
        const soon = new Date();
        soon.setMonth(soon.getMonth() + 1);
        const isExpired = expiry < new Date();
        const isSoon = expiry < soon && !isExpired;
        return (
          <span className={`font-bold ${isExpired ? 'text-danger' : isSoon ? 'text-warning' : 'text-success'}`}>
            {row.registrationExpiry || 'N/A'}
            {isExpired && " (EXPIRED)"}
          </span>
        );
      }
    },
    { header: "Status", accessor: "status" },
    {
      header: "Health",
      accessor: "diagnosticStatus",
      render: (row) => (
        <span className={`text-[10px] font-black uppercase ${row.diagnosticStatus === 'Healthy' ? 'text-success' : 'text-warning'}`}>
          {row.diagnosticStatus || 'Healthy'}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-white italic uppercase">Luxury Fleet</h1>
          <p className="text-secondary text-[10px] md:text-xs mt-1 font-black uppercase tracking-[0.2em] opacity-70 leading-relaxed">Manage high-end transportation assets across air, land, and sea.</p>
        </div>
        {hasMenuPermission('Fleet', 'can_add') && (
          <button
            className="btn-primary flex items-center justify-center gap-3 py-4 px-8 text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-accent/10 w-full lg:w-auto"
            onClick={() => handleAction('add', {})}
          >
            <Plus size={16} /> Register Asset
          </button>
        )}
      </div>

      <div className="glass-card p-4 sm:p-6 border-white/5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div className="relative w-full max-w-md group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-accent transition-colors" size={18} />
            <input
              type="text"
              placeholder="Search by ID or Model..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/[0.02] border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:outline-none focus:border-accent italic font-medium transition-all"
            />
          </div>
        </div>

        <Table
          columns={columns}
          data={filteredFleet}
          actions={true}
          onView={(item) => handleAction('view', item)}
          onEdit={(item) => handleAction('edit', item)}
          onDelete={(item) => handleAction('delete', item)}
          canEdit={hasMenuPermission('Fleet', 'can_edit')}
          canDelete={hasMenuPermission('Fleet', 'can_delete')}
          customAction={(item) => (
            <button
              onClick={() => handleAction('dispatch', item)}
              title="Dispatch Asset"
              className="p-2 rounded-lg text-accent hover:text-white hover:bg-accent/10 transition-all"
            >
              <Truck size={15} />
            </button>
          )}
        />
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          modalType === 'view' ? 'Asset Diagnostics' :
            modalType === 'edit' ? 'Modify Asset' :
              modalType === 'delete' ? 'Decommission Asset' :
                modalType === 'dispatch' ? 'Institutional Dispatch Protocol' : 'Register New Asset'
        }
      >
        {selectedVehicle && (
          <div className="space-y-6">
            {modalType === 'delete' ? (
              <div className="space-y-6">
                <p className="text-secondary text-sm italic font-medium leading-relaxed">Are you sure you want to decommission <span className="text-white font-black italic">{selectedVehicle.id}</span>? This will remove all telemetry data from active tracking protocols.</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-end pt-4">
                  <button onClick={() => setIsModalOpen(false)} className="py-3 px-8 text-[10px] font-black uppercase text-secondary hover:text-white transition-all">Abort</button>
                  <button onClick={handleDelete} className="py-3 px-8 bg-danger/10 border border-danger/20 text-danger rounded-xl text-[10px] font-black uppercase hover:bg-danger hover:text-white transition-all shadow-xl shadow-danger/5">Confirm Decommission</button>
                </div>
              </div>
            ) : modalType === 'dispatch' ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                  <div className="space-y-1.5 px-1">
                    <label className="text-[9px] font-black text-muted uppercase tracking-widest ml-1">Selected Asset</label>
                    <p className="text-sm font-black text-white italic">{selectedVehicle.model}</p>
                    <p className="text-[10px] text-accent font-mono">{selectedVehicle.id}</p>
                  </div>

                  <div className="sm:col-span-2 space-y-2">
                    <label className="text-[9px] font-black text-muted uppercase tracking-[0.2em] ml-1">Link Pending Mission</label>
                    <select
                      className="w-full bg-white/[0.02] border border-white/10 rounded-2xl px-4 py-4 text-xs sm:text-sm focus:border-accent outline-none font-black text-white"
                      onChange={(e) => {
                        const del = deliveries.find(d => d.id === e.target.value);
                        if (del) {
                          setFormData({
                            ...formData,
                            deliveryId: del.id,
                            mission: del.item,
                            driver: del.assignedStaff || '',
                            location: del.location
                          });
                        }
                      }}
                    >
                      <option value="">Select a Mission Trace...</option>
                      {deliveries.filter(d => d.status === 'Pending' || d.status === 'Pending Pickup').map(del => (
                        <option key={del.id} value={del.id} className="bg-sidebar">{del.id}: {del.item}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-muted uppercase tracking-widest ml-1">Specialist Operator</label>
                    <input
                      type="text"
                      className="w-full bg-white/[0.02] border border-white/10 rounded-2xl px-4 py-4 text-xs sm:text-sm focus:border-accent outline-none font-black text-white"
                      placeholder="Operator Name"
                      value={formData.driver || ''}
                      onChange={(e) => setFormData({ ...formData, driver: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-muted uppercase tracking-widest ml-1">Target Coordinates</label>
                    <input
                      type="text"
                      className="w-full bg-white/[0.02] border border-white/10 rounded-2xl px-4 py-4 text-xs sm:text-sm focus:border-accent outline-none font-black text-white"
                      placeholder="Mooring / Address"
                      value={formData.location || ''}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-[9px] font-black text-muted uppercase tracking-widest ml-1">Dispatch Route</label>
                    <select
                      className="w-full bg-white/[0.02] border border-white/10 rounded-2xl px-4 py-4 text-xs sm:text-sm focus:border-accent outline-none font-black text-white"
                      value={formData.routeId || ''}
                      onChange={(e) => setFormData({ ...formData, routeId: e.target.value })}
                    >
                      <option value="">Select route...</option>
                      {(routes || []).map((r) => (
                        <option key={r.id} value={r.id} className="bg-sidebar">
                          {r.name} ({r.dist || 'N/A'})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <label className="inline-flex items-center gap-3 text-[10px] font-black text-danger uppercase tracking-widest cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!formData.markUrgent}
                        onChange={(e) => setFormData({ ...formData, markUrgent: e.target.checked })}
                        className="w-4 h-4 accent-red-500"
                      />
                      Mark as urgent for admin monitoring
                    </label>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-[9px] font-black text-muted uppercase tracking-widest ml-1">Mission Manifest Details</label>
                    <textarea
                      className="w-full bg-white/[0.02] border border-white/10 rounded-2xl px-4 py-4 text-xs sm:text-sm focus:border-accent outline-none h-28 italic font-medium"
                      placeholder="Cargo specs, handling requirements..."
                      value={formData.mission || ''}
                      onChange={(e) => setFormData({ ...formData, mission: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex gap-3 justify-end pt-4">
                  <button onClick={() => setIsModalOpen(false)} className="btn-secondary">Abort</button>
                  <button
                    onClick={() => {
                      dispatchVehicle({
                        id: selectedVehicle.id,
                        db_id: selectedVehicle.db_id,
                        deliveryId: formData.deliveryId,
                        delivery_db_id: deliveries.find((d) => String(d.id) === String(formData.deliveryId))?.db_id,
                        driver: formData.driver,
                        mission: formData.mission,
                        routeId: formData.routeId ? parseInt(formData.routeId, 10) : null,
                        routeName: routes.find((r) => String(r.id) === String(formData.routeId))?.name || '',
                        markUrgent: !!formData.markUrgent
                      });
                      setIsModalOpen(false);
                    }}
                    className="btn-primary shadow-lg shadow-accent/20"
                  >
                    Initiate Dispatch
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                  {[
                    { label: 'Fleet ID', value: formData.id, field: 'id', disabled: modalType !== 'add' },
                    { label: 'Asset Type', type: 'select', options: ['Luxury Truck', 'Luxury Car', 'Speed Boat', 'Private Jet', 'Cargo Van'], field: 'type' },
                    { label: 'Model Name', value: formData.model, field: 'model' },
                    { label: 'Capacity', value: formData.capacity, field: 'capacity' },
                    { label: 'Fuel/Charge', value: formData.fuel, field: 'fuel' },
                    { label: 'Status', type: 'select', options: ['Active', 'Inactive', 'Maintenance'], field: 'status' },
                    { label: 'Insurance Policy', value: formData.insurancePolicy || '', field: 'insurancePolicy', accent: true },
                    { label: 'Registration Expiry', type: 'date', value: formData.registrationExpiry || '', field: 'registrationExpiry' },
                    { label: 'Inspection Date', type: 'date', value: formData.inspectionDate || '', field: 'inspectionDate' },
                    { label: 'Diagnostic Status', type: 'select', options: ['Healthy', 'Optimal', 'Service Due', 'Maintenance Required', 'Critical Failure'], field: 'diagnosticStatus', accent: true, italic: true }
                  ].map((input, i) => (
                    <div key={i} className="space-y-2">
                      <label className={`text-[9px] font-black uppercase tracking-widest ml-1 ${input.accent ? 'text-accent' : 'text-muted'}`}>{input.label}</label>
                      {input.type === 'select' ? (
                        <select
                          className={`w-full bg-white/[0.02] border border-white/10 rounded-2xl px-4 py-3.5 text-xs sm:text-sm focus:border-accent outline-none font-black text-white ${input.italic ? 'italic' : ''}`}
                          value={input.value || formData[input.field]}
                          onChange={(e) => setFormData({ ...formData, [input.field]: e.target.value })}
                          disabled={modalType === 'view'}
                        >
                          {input.options.map(opt => <option key={opt} value={opt} className="bg-sidebar">{opt}</option>)}
                        </select>
                      ) : (
                        <input
                          type={input.type || 'text'}
                          className="w-full bg-white/[0.02] border border-white/10 rounded-2xl px-4 py-3.5 text-xs sm:text-sm focus:border-accent outline-none font-black text-white"
                          value={input.value !== undefined ? input.value : formData[input.field]}
                          onChange={(e) => setFormData({ ...formData, [input.field]: e.target.value })}
                          disabled={input.disabled || modalType === 'view'}
                        />
                      )}
                    </div>
                  ))}
                </div>

                {modalType === 'view' && (
                  <div className="mt-6 grid grid-cols-3 gap-3">
                    <div className="p-3 bg-white/5 rounded-xl border border-border text-center">
                      <Battery size={16} className="mx-auto mb-2 text-accent" />
                      <p className="text-[10px] text-muted font-bold uppercase">Energy</p>
                      <p className="text-sm font-bold">{selectedVehicle.fuel || '100%'}</p>
                    </div>
                    <div className="p-3 bg-white/5 rounded-xl border border-border text-center">
                      <Gauge size={16} className="mx-auto mb-2 text-accent" />
                      <p className="text-[10px] text-muted font-bold uppercase">Usage</p>
                      <p className="text-sm font-bold">
                        {deliveries.some(d => d.vehicle === selectedVehicle.id && (d.status === 'In Transit' || d.status === 'Pending Pickup')) ? 'Active' : 'Standby'}
                      </p>
                    </div>
                    <div className="p-3 bg-white/5 rounded-xl border border-border text-center">
                      <Shield size={16} className="mx-auto mb-2 text-accent" />
                      <p className="text-[10px] text-muted font-bold uppercase">Security</p>
                      <p className="text-sm font-bold text-success">Verified</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 justify-end pt-6">
                  <button onClick={() => setIsModalOpen(false)} className="btn-secondary">{modalType === 'view' ? 'Close' : 'Cancel'}</button>
                  {modalType !== 'view' && <button onClick={handleSave} className="btn-primary">Save Configuration</button>}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Fleet;
