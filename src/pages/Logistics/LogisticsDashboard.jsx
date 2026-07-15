import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { swalSuccess, swalError, swalWarning, swalInfo, swalConfirm, swalCredentials, swalCopied } from '../../utils/swal';
import KpiCard from '../../components/KpiCard';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';
import {
  Truck, Map, Navigation, Clock, AlertCircle,
  Package, Anchor, Plane, Search, Plus,
  MapPin, Activity, ShieldCheck, Timer, User, ChevronRight,
  ClipboardList, Ship, Target, Shield, Zap,
  AlertTriangle, CheckCircle2, Cloud, Wind, Box, Info, Trash2,
  ArrowUpRight, BarChart3, Radio, FileText, Smartphone
} from 'lucide-react';

import { useData } from '../../context/GlobalDataContext';
import CustomDatePicker from '../../components/CustomDatePicker';
import Table from '../../components/Table';
import DepartmentWorkflowSection from '../../components/DepartmentWorkflowSection';


const LogisticsDashboard = () => {
  const navigate = useNavigate();
  const { 
    fleet = [], routes = [], urgentTasks = [], logs = [], dispatchVehicle, 
    deliveries = [], missions = [], dashboardStats, fetchDashboardStats, fetchFleet, fetchRoutes, fetchDeliveries, fetchMissions,
    updateDelivery,
    hasMenuPermission,
    users = [],
    fetchStaff
  } = useData();
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);

  React.useEffect(() => {
    fetchDashboardStats();
    fetchFleet();
    fetchRoutes();
    fetchDeliveries();
    fetchMissions();
    fetchStaff();
  }, [fetchDashboardStats, fetchFleet, fetchRoutes, fetchDeliveries, fetchMissions, fetchStaff]);

  // Merge deliveries + project-missions into a single unified dispatch list
  const allDispatchItems = useMemo(() => {
    const deliveryItems = deliveries.map(d => ({ ...d, _source: 'delivery' }));
    // Only include missions that have no linked delivery (i.e. project-converted missions)
    const missionItems = missions
      .filter(m => !m.deliveryId && !m.delivery_id)
      .map(m => ({
        id: m.id,
        item: m.metadata?.project_name || m.remarks || `Mission ${m.id}`,
        location: m.metadata?.destination_type || m.destinationType || 'Client Site',
        mode: m.metadata?.delivery_type || 'Road',
        status: (() => {
          switch ((m.status || '').toLowerCase()) {
            case 'assigned': return 'Pending';
            case 'in_progress': return 'In Transit';
            case 'completed': return 'Delivered';
            default: return m.status || 'Pending';
          }
        })(),
        assignedStaff: m.driverName || '',
        missionNumber: m.missionNumber || m.id,
        missionType: m.missionType || 'LOGISTICS',
        _source: 'mission',
      }));
    return [...deliveryItems, ...missionItems];
  }, [deliveries, missions]);
  const [dispatchForm, setDispatchForm] = useState({
    vehicleId: '',
    routeId: '',
    driver: '',
    mission: '',
    mission_type: '',
    items: [{ name: '', qty: 1, weight: '', length: '', width: '', height: '' }],
    deliveryId: '',
    requestDate: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0]
  });
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedMission, setSelectedMission] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  const handleAddItem = () => {
    setDispatchForm({ ...dispatchForm, items: [...dispatchForm.items, { name: '', qty: 1, weight: '', length: '', width: '', height: '' }] });
  };

  const removeItem = (index) => {
    const newItems = dispatchForm.items.filter((_, i) => i !== index);
    setDispatchForm({ ...dispatchForm, items: newItems.length ? newItems : [{ name: '', qty: 1, weight: '', length: '', width: '', height: '' }] });
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...dispatchForm.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setDispatchForm({ ...dispatchForm, items: newItems });
  };

  const handleDispatch = () => {
    if (!dispatchForm.vehicleId || !dispatchForm.routeId || !dispatchForm.driver) {
      swalWarning('Missing Parameters', 'Please assign vehicle, route, and driver.');
      return;
    }

    // Call the context function
    dispatchVehicle({
      id: dispatchForm.vehicleId,
      routeId: parseInt(dispatchForm.routeId),
      driver: dispatchForm.driver,
      mission: dispatchForm.mission || dispatchForm.items[0]?.name || "Bespoke Delivery Mission",
      items: dispatchForm.items,
      deliveryId: dispatchForm.deliveryId,
      requestDate: dispatchForm.requestDate,
      dueDate: dispatchForm.dueDate
    });

    // Show success feedback
    swalSuccess('Dispatched', 'Fleet unit is now in motion.');

    setIsDispatchModalOpen(false);
    setDispatchForm({ vehicleId: '', routeId: '', driver: '', mission: '', items: [{ name: '', qty: 1, weight: '', length: '', width: '', height: '' }], deliveryId: '', requestDate: new Date().toISOString().split('T')[0], dueDate: new Date().toISOString().split('T')[0] });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-white italic uppercase">Logistics Command Center</h1>
          <p className="text-secondary text-[10px] md:text-xs mt-1 font-black uppercase tracking-[0.2em] opacity-70 leading-relaxed">Real-time fleet tracking and distribution network oversight.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <button
            className="btn-secondary flex-1 sm:flex-none flex items-center justify-center gap-2 text-[10px] sm:text-xs py-3.5 px-6"
            onClick={() => swalInfo('Fleet Sync', 'All units reporting.')}
          >
            <ClipboardList size={16} /> Audit
          </button>
          <button 
            onClick={() => navigate('/dashboard/logistics-tracking')}
            className="btn-secondary flex-1 sm:flex-none flex items-center justify-center gap-2 text-[10px] sm:text-xs py-3.5 px-6"
          >
            <Map size={16} /> Network Map
          </button>
          {hasMenuPermission('Fleet', 'can_add') && (
            <button
              className="btn-primary flex-1 sm:flex-none flex items-center justify-center gap-2 text-[10px] sm:text-xs py-3.5 px-6"
              onClick={() => setIsDispatchModalOpen(true)}
            >
              <Plus size={16} /> Dispatch Vehicle
            </button>
          )}
        </div>
      </div>

      {/* Institutional Command Stats - Optimized Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {[
          { label: 'In Progress', value: dashboardStats.activeMissionsCount ?? deliveries.filter(d => ['in transit', 'processing', 'dispatched', 'in_progress', 'en_route'].includes(String(d.status).toLowerCase())).length, icon: Truck, color: 'text-accent', trend: 'Active' },
          { label: 'Completed', value: deliveries.filter(d => ['delivered', 'completed', 'success'].includes(String(d.status).toLowerCase())).length, icon: CheckCircle2, color: 'text-success', trend: 'Success' },
          { label: 'Halted', value: deliveries.filter(d => ['canceled', 'cancelled', 'halted', 'failed', 'on_hold'].includes(String(d.status).toLowerCase())).length, icon: AlertTriangle, color: 'text-danger', trend: 'Audit' },
          { label: 'Availability', value: dashboardStats.availableVehicles !== undefined ? `${((dashboardStats.availableVehicles / (dashboardStats.availableVehicles + (dashboardStats.vehiclesOnMission || 0))) * 100).toFixed(0)}%` : `${fleet.length > 0 ? ((fleet.filter(f => f.status === 'Active').length / fleet.length) * 100).toFixed(0) : 0}%`, icon: Zap, color: 'text-primary', trend: 'Stable' }
        ].map((stat, idx) => (
          <div key={idx} className="glass-card p-4 sm:p-6 border-white/5 relative overflow-hidden group">
            <div className="absolute -right-2 -bottom-2 opacity-[0.03] group-hover:scale-125 transition-transform duration-700 pointer-events-none">
              <stat.icon size={60} className="sm:size-80" />
            </div>
            <p className="text-[8px] sm:text-[10px] font-black text-muted uppercase tracking-widest mb-1 truncate">{stat.label}</p>
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
              <h3 className={`text-xl sm:text-3xl font-black italic tracking-tighter ${stat.color}`}>{stat.value}</h3>
              <span className={`text-[7px] sm:text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-white/5 ${stat.color} w-fit`}>{stat.trend}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-8">
          {/* Main Visual Command Center - Mobile Optimized */}
          <div className="glass-card p-0 border-white/5 bg-black/40 relative overflow-hidden min-h-[350px] sm:min-h-[450px] group">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1524661135-423995f22d0b?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80')] bg-cover bg-center mix-blend-overlay opacity-30 group-hover:scale-110 transition-transform duration-[10000ms]" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

            <div className="absolute top-4 left-4 sm:top-8 sm:left-8 z-20">
              <div className="flex items-center gap-2 mb-2 sm:mb-4">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.6)]" />
                <span className="text-[8px] sm:text-[10px] text-success font-black uppercase tracking-[0.3em]">Satellite Active</span>
              </div>
              <h2 className="text-xl sm:text-3xl lg:text-5xl font-black italic font-heading text-white max-w-[90%] leading-tight tracking-tighter">ORBITAL DISPATCH CONTROL</h2>
            </div>

            <div className="absolute top-4 right-4 sm:top-8 sm:right-8 z-20 flex flex-col gap-2">
              <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-black/60 border border-white/10 rounded-xl backdrop-blur-md">
                <Cloud size={14} className="text-accent" />
                <span className="text-[10px] font-bold text-white uppercase italic tracking-widest">28°C Clear</span>
              </div>
              <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-black/60 border border-white/10 rounded-xl backdrop-blur-md">
                <Wind size={14} className="text-primary" />
                <span className="text-[10px] font-bold text-white uppercase italic tracking-widest">12 kts NE</span>
              </div>
            </div>

            <div className="absolute bottom-4 left-4 right-4 sm:bottom-8 sm:left-8 sm:right-8 z-20 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div className="flex gap-3 sm:gap-4 overflow-x-auto no-scrollbar w-full sm:w-auto">
                  <div className="glass-card bg-black/60 border-white/10 p-3 sm:p-4 rounded-xl flex items-center gap-3 backdrop-blur-md shrink-0">
                    <div className="w-8 h-8 sm:w-12 sm:h-12 bg-info/20 rounded-lg flex items-center justify-center text-info">
                      <Ship size={18} />
                    </div>
                    <div>
                      <p className="text-[8px] font-black text-muted uppercase tracking-widest">Marine</p>
                      <p className="text-[10px] sm:text-xs font-bold text-white">
                        {fleet.filter(f => ['vessel', 'boat', 'marine', 'yacht', 'ship'].some(t => (f.type || '').toLowerCase().includes(t))).length} Vessels
                      </p>
                    </div>
                  </div>
                  <div className="glass-card bg-black/60 border-white/10 p-3 sm:p-4 rounded-xl flex items-center gap-3 backdrop-blur-md shrink-0">
                    <div className="w-8 h-8 sm:w-12 sm:h-12 bg-success/20 rounded-lg flex items-center justify-center text-success">
                      <User size={18} />
                    </div>
                    <div>
                      <p className="text-[8px] font-black text-muted uppercase tracking-widest">Staff</p>
                      <p className="text-[10px] sm:text-xs font-bold text-white">{users.length} Ops</p>
                    </div>
                  </div>
                </div>
                <div className="sm:text-right w-full sm:w-auto">
                  <p className="text-[8px] sm:text-[10px] font-bold text-accent uppercase tracking-widest mb-1">Current Sector</p>
                  <p className="text-xs sm:text-2xl font-bold text-white tracking-tight truncate">{routes.length > 0 ? (routes[0].destination || routes[0].name || "NASSAU HARBOUR MARINA").toUpperCase() : "NASSAU HARBOUR MARINA"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Chauffeur Deployment Monitor - Responsive pass */}
          <div className="glass-card p-4 sm:p-6 border-accent/10">
            <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-8 flex items-center gap-3">
              <User className="text-accent" size={22} /> Deployment Monitor
            </h3>
            <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
              {deliveries.filter(d => ['in transit', 'dispatched', 'in_progress', 'en_route'].includes(String(d.status).toLowerCase())).map((del, i) => (
                <div key={i} className="p-4 bg-white/[0.01] border border-white/5 rounded-2xl flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between group hover:border-accent/40 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-accent/5 border border-accent/20 rounded-xl flex items-center justify-center text-accent group-hover:scale-105 transition-transform shrink-0">
                      <User size={24} strokeWidth={1.5} />
                    </div>
                    <div>
                      <h4 className="font-bold text-white tracking-tight text-sm md:text-base">{del.assignedStaff || del.driver || 'Elite Chauffeur'}</h4>
                      <p className="text-[10px] text-secondary mt-1 uppercase font-bold tracking-wide opacity-60 flex items-center gap-2">
                        <MapPin size={12} className="text-accent shrink-0" /> {del.location}
                      </p>
                      <p className="text-[9px] text-muted uppercase font-bold tracking-widest mt-1.5 px-2 py-0.5 bg-white/5 rounded inline-block">MISSION: {del.item}</p>
                    </div>
                  </div>
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 w-full sm:w-auto border-t sm:border-t-0 border-white/5 pt-4 sm:pt-0">
                    <StatusBadge status={del.status} />
                    <span className="text-[9px] font-black text-accent italic tracking-widest bg-accent/5 px-2 py-1 rounded shadow-inner">TRN-429 LINKED</span>
                  </div>
                </div>
              ))}
              {deliveries.filter(d => d.status === 'In Transit' || d.status === 'Dispatched').length === 0 && (
                <div className="py-20 text-center space-y-4 bg-white/[0.01] rounded-3xl border border-dashed border-white/5">
                  <Activity className="text-muted/20 mx-auto" size={48} strokeWidth={1} />
                  <p className="text-muted italic text-xs font-medium tracking-widest uppercase">No active chauffeur missions detected.</p>
                </div>
              )}
            </div>
          </div>

            {/* Mission Dispatch Queue - Tabbed Interface */}
            <div className="glass-card p-4 sm:p-6 border-white/5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
                <h3 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                  <ClipboardList className="text-accent" size={22} /> Operational Dispatch Queue
                </h3>

                <div className="flex bg-white/5 p-1 rounded-2xl w-full sm:w-auto">
                  {['pending', 'active'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`flex-1 sm:flex-none py-2.5 px-6 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === tab
                        ? 'bg-accent text-black shadow-lg shadow-accent/20'
                        : 'text-muted hover:text-white'
                        }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              <Table
                columns={[
                  {
                    header: "Dispatch ID",
                    accessor: "id",
                    render: (row) => (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-accent text-[10px] font-black tracking-widest uppercase">{row.missionNumber || row.id}</span>
                        {row._source === 'mission' && (
                          <span className="text-[8px] font-black bg-accent/10 text-accent px-1.5 py-0.5 rounded uppercase tracking-wider">PROJ</span>
                        )}
                      </div>
                    )
                  },
                  {
                    header: "Asset Manifest",
                    accessor: "item",
                    render: (row) => (
                      <div className="space-y-0.5">
                        <p className="font-black text-white italic text-xs uppercase tracking-tight">{row.item}</p>
                        <p className="text-[8px] text-muted font-bold uppercase tracking-widest">
                          {row._source === 'mission' ? 'Project Mission' : `${row.items?.length || 1} Primary Assets`}
                        </p>
                      </div>
                    )
                  },
                  {
                    header: "Coordinates / Drop",
                    accessor: "location",
                    render: (row) => <span className="text-secondary text-[10px] italic font-medium uppercase tracking-tight">{row.location}</span>
                  },
                  {
                    header: "Protocol Mode",
                    accessor: "mode",
                    render: (row) => (
                      <div className="flex items-center gap-2">
                        {row.mode === 'Sea' ? <Ship size={12} className="text-info" /> :
                          row.mode === 'Air' ? <Plane size={12} className="text-primary" /> :
                            <Truck size={12} className="text-accent" />}
                        <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">{row.mode || 'Ground'}</span>
                      </div>
                    )
                  },
                  {
                    header: "Mission State",
                    accessor: "status",
                    render: (row) => <StatusBadge status={row.status} />
                  }
                ]}
                data={allDispatchItems.filter(d =>
                  activeTab === 'pending'
                    ? (d.status === 'Pending' || d.status === 'Pending Pickup' || d.status === 'assigned')
                    : (d.status === 'In Transit' || d.status === 'Dispatched' || d.status === 'Processing' || d.status === 'in_progress')
                )}
                actions={true}
                onView={(item) => {
                  setSelectedMission(item);
                  setIsViewModalOpen(true);
                }}
                onEdit={(item) => {
                  if (item.status === 'Pending' || item.status === 'Pending Pickup') {
                    setDispatchForm({
                      ...dispatchForm,
                      deliveryId: item.db_id,
                      mission: item.item,
                      mission_type: item.mission_type || '',
                      driver: item.assignedStaff || ''
                    });
                    setIsDispatchModalOpen(true);
                  } else {
                    swalInfo('In Progress', 'Use View for active telemetry diagnostics.');
                  }
                }}
                canEdit={hasMenuPermission('Fleet', 'can_edit')}
                canDelete={hasMenuPermission('Fleet', 'can_delete')}
              />

              {/* Empty State */}
              {allDispatchItems.filter(d =>
                activeTab === 'pending'
                  ? (d.status === 'Pending' || d.status === 'Pending Pickup' || d.status === 'assigned')
                  : (d.status === 'In Transit' || d.status === 'Dispatched' || d.status === 'Processing' || d.status === 'in_progress')
              ).length === 0 && (
                  <div className="py-20 text-center border-t border-white/5 md:border-t-0">
                    <Box className="text-muted/20 mx-auto mb-4" size={48} strokeWidth={1} />
                    <p className="text-muted italic text-[10px] font-black uppercase tracking-widest">
                      {activeTab === 'pending' ? 'No pending missions detected in Sector.' : 'No active fleet deployments in progress.'}
                    </p>
                  </div>
                )}
            </div>

            {/* Department Workflow Tracker */}
            <DepartmentWorkflowSection departmentKey="logistics" departmentLabel="Logistics" />
        </div>

        <div className="space-y-6 sm:space-y-8">
          <div className="glass-card p-4 sm:p-6 border-danger/20 bg-danger/[0.03]">
            <h3 className="text-[10px] font-black text-white uppercase tracking-[0.3em] mb-8 flex items-center gap-3">
              <AlertTriangle className="text-danger" size={18} /> Urgent Action Required
            </h3>
            <div className="space-y-4">
              {urgentTasks.map((task, idx) => (
                <div key={idx} className="p-4 bg-white/[0.01] border border-white/5 rounded-2xl relative overflow-hidden group hover:border-danger/40 transition-all">
                  <div className="flex justify-between items-start mb-3">
                    <h5 className="font-black text-white italic text-xs sm:text-sm tracking-tight group-hover:text-danger transition-colors">{task.task}</h5>
                    <span className="text-[8px] font-black text-danger bg-danger/10 px-2 py-1 rounded uppercase shrink-0 ml-2">{task.time}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[9px] text-muted font-bold">
                    <span className="flex items-center gap-1.5"><MapPin size={10} className="text-danger" /> {task.location}</span>
                    <span className="flex items-center gap-1.5 text-danger"><Activity size={10} /> CRITICAL PROTOCOL</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-4 sm:p-6 border-white/5 bg-white/[0.01]">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Fleet Readiness</h3>
              <Anchor size={16} className="text-muted/40 animate-pulse" />
            </div>
            <div className="space-y-3">
              {fleet.slice(0, 5).map((vehicle, idx) => (
                <div key={idx} className="flex items-center justify-between p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl group hover:border-accent/40 transition-all cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border border-white/5 transition-transform group-hover:scale-110 ${vehicle.status === 'Active' ? 'bg-success/5 text-success' : 'bg-warning/5 text-warning'}`}>
                      {vehicle.type?.toLowerCase().includes('boat') || vehicle.type?.toLowerCase().includes('vessel') ? <Ship size={16} /> : <Truck size={16} />}
                    </div>
                    <div>
                      <p className="font-black text-white italic text-xs tracking-tight">{vehicle.id}</p>
                      <p className="text-[9px] text-muted uppercase font-black tracking-widest">{vehicle.model.split(' ')[0]}</p>
                    </div>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${vehicle.status === 'Active' ? 'bg-success shadow-[0_0_10px_rgba(34,197,94,0.6)]' : 'bg-warning animate-pulse'}`} />
                </div>
              ))}
            </div>
            <button 
              onClick={() => navigate('/dashboard/fleet')}
              className="w-full mt-6 py-3 border border-white/5 bg-white/5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] text-secondary hover:text-white transition-all"
            >
              Full Arsenal Inventory
            </button>
          </div>
        </div>
      </div>

      <Modal
        isOpen={isDispatchModalOpen}
        onClose={() => setIsDispatchModalOpen(false)}
        title="Institutional Fleet Dispatch Protocol"
      >
        <div className="space-y-6 sm:space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-muted uppercase tracking-[0.2em] ml-1">Tactical Asset</label>
              <select
                value={dispatchForm.vehicleId}
                onChange={(e) => setDispatchForm({ ...dispatchForm, vehicleId: e.target.value })}
                className="w-full bg-white/[0.02] border border-white/10 rounded-2xl px-4 py-4 text-xs sm:text-sm focus:border-accent outline-none font-black text-white transition-all hover:bg-white/[0.05]"
              >
                <option value="">Select Asset...</option>
                {fleet.filter(f => {
                   if (f.status !== 'Active') return false;
                   if (dispatchForm.mission_type === 'Chauffeur') {
                       return (f.type || '').toLowerCase().includes('luxury') || (f.type || '').toLowerCase().includes('suv') || (f.type || '').toLowerCase().includes('sedan');
                   }
                   return true;
                }).map(v => (
                  <option key={v.id} value={v.id} className="bg-sidebar">{v.id} - {v.model}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-muted uppercase tracking-[0.2em] ml-1">Route Chain</label>
              <select
                value={dispatchForm.routeId}
                onChange={(e) => setDispatchForm({ ...dispatchForm, routeId: e.target.value })}
                className="w-full bg-white/[0.02] border border-white/10 rounded-2xl px-4 py-4 text-xs sm:text-sm focus:border-accent outline-none font-black text-white transition-all hover:bg-white/[0.05]"
              >
                <option value="">Select Chain...</option>
                {routes.map(r => (
                  <option key={r.id} value={r.id} className="bg-sidebar">{r.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-[9px] font-black text-muted uppercase tracking-[0.2em] ml-1">Specialist On-Board</label>
              <select
                value={dispatchForm.driver}
                onChange={(e) => setDispatchForm({ ...dispatchForm, driver: e.target.value })}
                className="w-full bg-white/[0.02] border border-white/10 rounded-2xl px-4 py-4 text-xs sm:text-sm focus:border-accent outline-none font-black text-white transition-all hover:bg-white/[0.05]"
              >
                <option value="">Select Specialist...</option>
                {users.map(u => (
                  <option key={u.id} value={u.id} className="bg-sidebar">{u.firstName} {u.lastName} ({u.role?.name || 'Staff'})</option>
                ))}
              </select>
            </div>

            <div className="space-y-2 md:col-span-1">
              <label className="text-[9px] font-black text-muted uppercase tracking-[0.2em] ml-1">Request Date</label>
              <input
                type="text"
                value={dispatchForm.requestDate}
                disabled
                className="w-full bg-white/[0.01] border border-white/5 rounded-2xl px-4 py-4 text-xs sm:text-sm text-muted/50 font-black outline-none cursor-not-allowed"
              />
            </div>
            <div className="space-y-2 md:col-span-1">
              <CustomDatePicker
                label="Due Date"
                selectedDate={dispatchForm.dueDate}
                onChange={(date) => setDispatchForm({ ...dispatchForm, dueDate: date })}
              />
            </div>

            <div className="md:col-span-2 space-y-6 pt-6 border-t border-white/5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <label className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Mission Manifest</label>
                  <p className="text-[8px] text-secondary italic tracking-tighter mt-1">Define multi-line assets for this distribution phase</p>
                </div>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 bg-accent/5 border border-accent/20 rounded-xl text-[9px] font-black text-accent hover:bg-accent hover:text-black transition-all shadow-lg shadow-accent/5 w-full sm:w-auto"
                >
                  <Plus size={14} /> ADD ASSET
                </button>
              </div>

              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {dispatchForm.items.map((item, idx) => (
                  <div key={idx} className="flex flex-col gap-4 p-4 bg-white/[0.01] border border-white/5 rounded-2xl group transition-all hover:bg-white/[0.03]">
                    <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-end">
                      <div className="flex-1 space-y-1.5">
                        <p className="text-[8px] font-black text-muted uppercase tracking-widest ml-1">Description</p>
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                          placeholder="e.g. Secured Payload Alpha"
                          className="w-full bg-transparent border-b border-white/10 px-1 py-2 text-xs text-white focus:border-accent outline-none italic font-black"
                        />
                      </div>
                      <div className="flex items-end gap-3">
                        <div className="w-20 space-y-1.5 shrink-0">
                          <p className="text-[8px] font-black text-muted uppercase tracking-widest ml-1">Qty</p>
                          <input
                            type="number"
                            value={item.qty}
                            onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-xs text-white focus:border-accent outline-none text-center font-black"
                            min="1"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-end">
                      <div className="flex-1 space-y-1.5">
                        <p className="text-[8px] font-black text-muted uppercase tracking-widest ml-1">Weight</p>
                        <input
                          type="text"
                          value={item.weight || ''}
                          onChange={(e) => handleItemChange(idx, 'weight', e.target.value)}
                          placeholder="e.g. 10 kg"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-accent outline-none font-black"
                        />
                      </div>
                      <div className="flex-[0.5] space-y-1.5">
                        <p className="text-[8px] font-black text-muted uppercase tracking-widest ml-1">L</p>
                        <input
                          type="number"
                          value={item.length || ''}
                          onChange={(e) => handleItemChange(idx, 'length', e.target.value)}
                          placeholder="cm"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-xs text-white focus:border-accent outline-none font-black text-center"
                        />
                      </div>
                      <div className="flex-[0.5] space-y-1.5">
                        <p className="text-[8px] font-black text-muted uppercase tracking-widest ml-1">W</p>
                        <input
                          type="number"
                          value={item.width || ''}
                          onChange={(e) => handleItemChange(idx, 'width', e.target.value)}
                          placeholder="cm"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-xs text-white focus:border-accent outline-none font-black text-center"
                        />
                      </div>
                      <div className="flex-[0.5] space-y-1.5">
                        <p className="text-[8px] font-black text-muted uppercase tracking-widest ml-1">H</p>
                        <input
                          type="number"
                          value={item.height || ''}
                          onChange={(e) => handleItemChange(idx, 'height', e.target.value)}
                          placeholder="cm"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-xs text-white focus:border-accent outline-none font-black text-center"
                        />
                      </div>
                      {dispatchForm.items.length > 1 && (
                        <div className="shrink-0 flex items-end">
                          <button type="button" onClick={() => removeItem(idx)} className="p-2.5 text-danger/40 hover:text-danger hover:bg-danger/10 rounded-xl transition-all">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-end pt-8 border-t border-white/5">
            <button type="button" onClick={() => setIsDispatchModalOpen(false)} className="order-2 sm:order-1 py-4 px-10 text-[10px] font-black uppercase tracking-[0.2em] text-muted hover:text-white transition-all">Abort Mission</button>
            <button type="button" onClick={handleDispatch} className="order-1 sm:order-2 py-4 px-12 bg-accent text-black shadow-2xl shadow-accent/20 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2">
              SEND DISPATCH MISSION <ShieldCheck size={16} />
            </button>
          </div>
        </div>
      </Modal>

      {/* View Mission Modal - Consistent with Deliveries Tab */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title="Mission Telemetry Diagnostics"
      >
        {selectedMission && (
          <div className="space-y-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-lg font-black text-white italic uppercase tracking-tighter">{selectedMission.item}</h4>
                <p className="text-[10px] text-accent font-black uppercase tracking-[0.2em] mt-1">{selectedMission.id} • Sector Alpha</p>
              </div>
              <StatusBadge status={selectedMission.status} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-6">
                <div className="p-5 bg-white/[0.02] border border-white/5 rounded-3xl space-y-4">
                  <p className="text-[9px] font-black text-muted uppercase tracking-widest">Mission Parameters</p>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                        <MapPin size={18} />
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-muted uppercase tracking-widest">Destination Matrix</p>
                        <p className="text-sm font-bold text-white italic">{selectedMission.location}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center text-info">
                        <Radio size={18} />
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-muted uppercase tracking-widest">Transport Protocol</p>
                        <p className="text-sm font-bold text-white italic">{selectedMission.mode || 'Standard Ground'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <User size={18} />
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-muted uppercase tracking-widest">Operative Assigned</p>
                        <p className="text-sm font-bold text-white italic">{selectedMission.assignedStaff || selectedMission.driver || 'Sector Dispatch'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-5 bg-accent/[0.03] border border-accent/10 rounded-3xl space-y-3">
                  <p className="text-[9px] font-black text-accent uppercase tracking-widest">Internal Logistics Trace</p>
                  <p className="text-[10px] text-white/60 leading-relaxed font-medium italic">
                    "Asset has been linked to {selectedMission.mode || 'Ground'} Fleet Unit. {selectedMission.status === 'Delivered' ? 'Mission concluded at destination coordinates.' : 'Real-time telemetry active across distribution network.'}"
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="p-5 bg-white/[0.02] border border-white/5 rounded-3xl space-y-4">
                  <p className="text-[9px] font-black text-muted uppercase tracking-widest">Resource Manifest</p>
                  <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                    {(selectedMission.items || [{ name: selectedMission.item, qty: 1 }]).map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                        <span className="text-xs font-bold text-white italic">{item.name}</span>
                        <span className="text-[10px] font-black text-accent tabular-nums">x{item.qty}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-5 bg-white/[0.02] border border-white/5 rounded-3xl space-y-4">
                  <p className="text-[9px] font-black text-muted uppercase tracking-widest">Post-Transit Verification</p>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-[8px] text-muted font-bold uppercase tracking-widest">Verification ID</p>
                      <p className="text-[10px] text-white font-black italic">{selectedMission.pod?.signature || 'System Unverified'}</p>
                    </div>
                    <div className="w-14 h-14 bg-background border border-white/10 rounded-xl flex items-center justify-center text-muted/20">
                      <ShieldCheck size={28} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 justify-end pt-6 border-t border-white/5">
              {selectedMission && selectedMission.status !== 'delivered' && selectedMission.status !== 'Delivered' && selectedMission.status !== 'cancelled' && (
                <>
                  {(selectedMission.status === 'pending' || selectedMission.status === 'Pending' || selectedMission.status === 'Pending Pickup') && (
                    <button
                      onClick={async () => {
                        await updateDelivery({ ...selectedMission, status: 'en_route' });
                        setSelectedMission({ ...selectedMission, status: 'en_route' });
                      }}
                      className="px-6 py-3 bg-info/10 border border-info/20 text-info rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-info hover:text-black transition-all"
                    >
                      Mark En Route
                    </button>
                  )}
                  {(selectedMission.status === 'en_route' || selectedMission.status === 'In Transit' || selectedMission.status === 'Dispatched') && (
                    <button
                      onClick={async () => {
                        await updateDelivery({ ...selectedMission, status: 'Delivered' });
                        setSelectedMission({ ...selectedMission, status: 'Delivered' });
                      }}
                      className="px-6 py-3 bg-success/10 border border-success/20 text-success rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-success hover:text-black transition-all"
                    >
                      Mark Delivered
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      if (window.confirm('Cancel this delivery?')) {
                        await updateDelivery({ ...selectedMission, status: 'cancelled' });
                        setIsViewModalOpen(false);
                      }
                    }}
                    className="px-6 py-3 bg-danger/10 border border-danger/20 text-danger rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-danger hover:text-white transition-all"
                  >
                    Cancel Delivery
                  </button>
                </>
              )}
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="py-4 px-10 text-[10px] font-black uppercase tracking-[0.2em] text-muted hover:text-white transition-all"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default LogisticsDashboard;
