import React, { useState, useEffect } from 'react';
import Table from '../../components/Table';
import Modal from '../../components/Modal';
import { useData } from '../../context/GlobalDataContext';
import { 
  Plus, Search, Shield, Truck, User, 
  Calendar, MapPin, Navigation, Package, 
  CheckCircle2, AlertCircle, Clock, FileText,
  Camera, Upload, DollarSign, Layers, ArrowRight,
  ExternalLink, UserCheck, X
} from 'lucide-react';
import api from '../../services/api/setupAxios.js';
import { swalSuccess, swalError } from '../../utils/swal';

const Missions = () => {
  const {
    missions, fetchMissions, users, fleet, fetchFleet, fetchStaff,
    projects, fetchProjects, orders, fetchOrders, chauffeurRequests, deliveries,
    addLog, updateMissionStatus, submitMissionPOD, assignMissionDriver, deleteMission,
    hasMenuPermission
  } = useData();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('view'); // 'view' | 'assign' | 'delete' | 'pod'
  const [selectedMission, setSelectedMission] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [assignData, setAssignData] = useState({
    driverId: '',
    vehicleId: ''
  });

  const [podData, setPodData] = useState({
    receiverName: '',
    signature: '',
    photo: null,
    notes: ''
  });
  const [isSubmittingPod, setIsSubmittingPod] = useState(false);

  useEffect(() => {
    fetchMissions();
    fetchFleet();
    fetchStaff();
    if (fetchProjects) fetchProjects();
    if (fetchOrders) fetchOrders();

    const handleSync = () => {
      fetchMissions();
      if (fetchOrders) fetchOrders();
      if (fetchProjects) fetchProjects();
    };
    window.addEventListener('app:state-changed', handleSync);
    return () => window.removeEventListener('app:state-changed', handleSync);
  }, [fetchMissions, fetchFleet, fetchStaff, fetchProjects, fetchOrders]);

  const findLinkedOrder = (mission) => {
    if (!mission) return null;
    const meta = mission.metadata || {};
    const oId = String(mission.orderId || mission.order_id || meta.orderId || meta.orderRef || '').trim();
    const delNo = String(mission.deliveryNumber || meta.deliveryNumber || (String(mission.orderId || '').startsWith('DEL-') ? mission.orderId : '')).trim();

    // 1. If we have a deliveryNumber or deliveryId, find matching delivery first
    let del = null;
    if (mission.deliveryId) {
      del = (deliveries || []).find(d => String(d.id) === String(mission.deliveryId) || String(d.db_id) === String(mission.deliveryId));
    }
    if (!del && delNo) {
      del = (deliveries || []).find(d => String(d.deliveryNumber) === delNo || String(d.id) === delNo);
    }

    const effectiveOrderId = (del && del.orderId) ? String(del.orderId) : oId;

    // 2. Check in orders (Marketplace orders)
    if (effectiveOrderId && !effectiveOrderId.startsWith('DEL-')) {
      const ord = (orders || []).find(o => 
        String(o.id) === effectiveOrderId || 
        String(o.orderNumber) === effectiveOrderId ||
        String(o.orderNumber || '').replace(/[^0-9]/g, '') === effectiveOrderId.replace(/[^0-9]/g, '')
      );
      if (ord) return { ...ord, _source: 'order', delivery: del };
    }

    // 3. Check in chauffeurRequests
    if (effectiveOrderId) {
      const fromChauffeur = (chauffeurRequests || []).find(c => 
        String(c.id) === effectiveOrderId || 
        String(c.db_id) === effectiveOrderId || 
        String(c.orderNumber) === effectiveOrderId
      );
      if (fromChauffeur) return { ...fromChauffeur, _source: 'chauffeur', delivery: del };
    }

    // 4. Fallback to delivery object itself
    if (del) return { ...del, _source: 'delivery' };

    // 5. Fallback to mission.order or mission.delivery if provided by backend relation
    if (mission.order) return { ...mission.order, _source: 'order', delivery: mission.delivery };
    if (mission.delivery) return { ...mission.delivery, _source: 'delivery' };

    return null;
  };

  // Link mission to its project by orderId or projectId
  const getProject = (mission) => {
    if (!projects || !projects.length || !mission) return null;
    const meta = mission.metadata || {};
    const pId = mission.project_id || mission.projectId || meta.projectId;
    const oId = mission.order_id || mission.orderId || meta.orderId || meta.orderRef;
    const delNo = mission.deliveryNumber || meta.deliveryNumber;

    return projects.find(p => {
      const pIdStr = String(p.id);
      const pOrderRef = String(p.orderRef || p.order_ref || p.orderId || p.order_id || '');
      
      if (pId && pIdStr === String(pId)) return true;
      if (oId && !String(oId).startsWith('DEL-') && (pIdStr === String(oId) || pOrderRef === String(oId))) return true;
      if (delNo && (pOrderRef === String(delNo) || String(p.deliveryNumber) === String(delNo))) return true;
      return false;
    }) || null;
  };

  const getVehicleDisplayName = (rawVeh) => {
    if (!rawVeh || rawVeh === 'N/A' || rawVeh === 'null' || rawVeh === 'undefined') {
      return null;
    }

    const list = fleet || [];
    if (list.length === 0) {
      return isNaN(Number(rawVeh)) ? rawVeh : `Vehicle #${rawVeh}`;
    }

    let vObj = list.find(v => 
      String(v.id) === String(rawVeh) || 
      String(v.db_id) === String(rawVeh) || 
      String(v.vehicleId) === String(rawVeh) ||
      String(v.plateNumber) === String(rawVeh) ||
      String(v.plate_number) === String(rawVeh) ||
      String(v.model || '').toLowerCase() === String(rawVeh || '').toLowerCase()
    );

    if (!vObj && !isNaN(Number(rawVeh))) {
      const num = Number(rawVeh);
      vObj = list.find(v => Number(v.id) === num || Number(v.db_id) === num || Number(v.vehicleId) === num);
    }

    if (!vObj && !isNaN(Number(rawVeh))) {
      const idx = Number(rawVeh) - 1;
      if (idx >= 0 && idx < list.length) {
        vObj = list[idx];
      }
    }

    if (vObj) {
      const name = (vObj.model && vObj.model !== 'model') ? vObj.model : (vObj.type || 'Vehicle');
      const subType = (vObj.type && vObj.type !== name) ? ` (${vObj.type})` : '';
      return `${name}${subType}`;
    }

    return isNaN(Number(rawVeh)) ? rawVeh : `Vehicle #${rawVeh}`;
  };

  const handleAction = (type, mission) => {
    setSelectedMission(mission);
    setModalType(type);
    if (type === 'assign') {
      const linked = findLinkedOrder(mission);
      setAssignData({
        driverId: mission.driverId || linked?.driver_user_id || linked?.driverId || '',
        vehicleId: mission.vehicleId || linked?.plateNumber || linked?.vehicleId || ''
      });
    } else if (type === 'pod') {
      setPodData({
        receiverName: mission.clientName || '',
        signature: '',
        photo: null,
        notes: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleAssign = async () => {
    if (!assignData.driverId) {
      swalError('Assignment Failed', 'Please select a tactical pilot (driver) from the dropdown first.');
      return;
    }
    const success = await assignMissionDriver(selectedMission.db_id || selectedMission.id, assignData.driverId, assignData.vehicleId);
    if (success !== false) {
      setIsModalOpen(false);
      swalSuccess('Personnel Assigned', `Driver and vehicle assigned successfully.`);
    } else {
      swalError('Assignment Failed', 'Could not assign personnel. Ensure they have an active employee profile.');
    }
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setPodData(prev => ({ ...prev, photo: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitPOD = async (e) => {
    e?.preventDefault();
    if (!podData.receiverName.trim()) {
      swalError('Missing Information', 'Please provide the Receiver Name.');
      return;
    }
    if (!podData.photo) {
      swalError('Proof Photo Required', 'Please capture or upload the proof of delivery photo.');
      return;
    }

    setIsSubmittingPod(true);
    try {
      const targetId = selectedMission.db_id || selectedMission.id;
      await submitMissionPOD(targetId, {
        receiverName: podData.receiverName.trim(),
        signature: podData.signature.trim() || 'Electronic Receiver Confirmation',
        photoUrl: podData.photo,
        photo: podData.photo,
        notes: podData.notes.trim() || 'Delivered & verified by Mission Control'
      });

      setIsModalOpen(false);
      swalSuccess('Delivery Verified & Completed', 'Proof of delivery submitted successfully. Marketplace order and mission marked as Completed across all dashboards.');
      await fetchMissions();
      if (fetchOrders) await fetchOrders();
    } catch (err) {
      swalError('Submission Failed', err?.response?.data?.message || err?.message || 'Could not submit proof of delivery.');
    } finally {
      setIsSubmittingPod(false);
    }
  };

  const handleUpdateStatus = async (status) => {
    await updateMissionStatus(selectedMission.db_id || selectedMission.id, status);
    setIsModalOpen(false);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteMission(selectedMission.id);
    } finally {
      setIsDeleting(false);
      setIsModalOpen(false);
    }
  };

  const filteredMissions = missions.filter(m => 
    String(m.id).toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(m.order_id || m.orderId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(m.project_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.status?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns = [
    { header: "Mission ID", accessor: "id" },
    { 
      header: "Ref / Order ID", 
      accessor: "order_id",
      render: (row) => {
        const refId = row.order_id || row.orderId || row.metadata?.orderId || '—';
        return <span className="font-mono text-accent font-bold">{refId}</span>;
      }
    },
    {
      header: "Project",
      accessor: "project_name",
      render: (row) => {
        const projName = row.project_name || getProject(row)?.name || row.metadata?.projectName;
        const projId = row.project_id || row.projectId || getProject(row)?.id;
        const orderId = row.order_id || row.orderId;

        return projName ? (
          <div className="space-y-0.5 max-w-[150px]">
            <p className="text-xs font-bold text-white truncate">{projName}</p>
            <p className="text-[9px] text-accent font-black uppercase tracking-wider">
              Ref #{projId || 'PRJ'}{orderId ? ` · ORD-${orderId}` : ''}
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            <span className="text-muted italic text-xs">No Project</span>
            {orderId && <p className="text-[9px] text-accent">ORD-{orderId}</p>}
          </div>
        );
      }
    },
    {
      header: "Destination",
      accessor: "destinationType",
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs font-bold text-white max-w-[150px] truncate">
          <MapPin size={12} className="text-accent shrink-0" />
          <span className="truncate" title={row.destinationType || row.metadata?.destination_type || 'Client Site'}>
            {row.destinationType || row.metadata?.destination_type || 'Client Site'}
          </span>
        </div>
      )
    },
    {
      header: "Type",
      accessor: "missionType",
      render: (row) => (
        <span className="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-[10px] font-black uppercase tracking-widest text-accent">
          {row.missionType}
        </span>
      )
    },
    { 
      header: "Driver", 
      accessor: "driverName",
      render: (row) => {
        const linked = findLinkedOrder(row);
        const dName = row.driverName || linked?.driverName || linked?.driver;
        return dName ? (
          <span className="text-xs font-bold text-white">{dName}</span>
        ) : (
          <span className="text-muted italic text-xs">Unassigned</span>
        );
      }
    },
    { 
      header: "Vehicle", 
      accessor: "plateNumber",
      render: (row) => {
        const linked = findLinkedOrder(row);
        const rawVeh = row.plateNumber || row.vehicleId || linked?.plateNumber || linked?.vehicleId;
        const displayName = getVehicleDisplayName(rawVeh);

        return displayName ? (
          <span className="text-xs font-bold text-accent" title={`Raw Asset Code: ${rawVeh}`}>
            {displayName}
          </span>
        ) : (
          <span className="text-muted italic text-xs">N/A</span>
        );
      }
    },
    { 
      header: "Status", 
      accessor: "status",
      render: (row) => (
        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
          row.status === 'completed' ? 'bg-success/20 text-success' :
          row.status === 'en_route' ? 'bg-info/20 text-info' :
          row.status === 'assigned' ? 'bg-accent/20 text-accent' : 'bg-muted/20 text-muted'
        }`}>
          {row.status}
        </span>
      )
    },
    { header: "Date", accessor: "date" }
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mission Control</h1>
          <p className="text-secondary mt-1">High-level tactical oversight of converted orders and active deployments.</p>
        </div>
        <div className="flex gap-2">
        </div>
      </div>

      <div className="glass-card p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
            <input
              type="text"
              placeholder="Search Missions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-background border border-border rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        <Table 
          columns={columns} 
          data={filteredMissions}
          actions={true}
          customAction={(row) => (
            <div className="flex gap-2 mr-2 border-r border-white/10 pr-2">
              {row.status === 'pending' && (
                <button 
                  onClick={(e) => { e.stopPropagation(); handleAction('assign', row); }}
                  className="px-3 py-1.5 bg-accent/20 text-accent hover:bg-accent hover:text-black rounded-lg text-[10px] font-black uppercase transition-all shadow-sm shadow-accent/5"
                >
                  Assign
                </button>
              )}
              {row.status === 'assigned' && (
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    setSelectedMission(row);
                    await updateMissionStatus(row.id, 'en_route');
                    const dest = row.destinationType || row.metadata?.destination_type || 'destination';
                    swalSuccess('Mission Dispatched', `Asset is now en route to ${dest}.`);
                  }}
                  className="px-3 py-1.5 bg-info/20 text-info hover:bg-info hover:text-black rounded-lg text-[10px] font-black uppercase transition-all shadow-sm shadow-info/5"
                >
                  Dispatch
                </button>
              )}
              {row.status === 'en_route' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAction('pod', row);
                  }}
                  className="px-3 py-1.5 bg-success/20 text-success hover:bg-success hover:text-black rounded-lg text-[10px] font-black uppercase transition-all shadow-sm shadow-success/5 flex items-center gap-1"
                >
                  <CheckCircle2 size={12} />
                  Arrived (POD)
                </button>
              )}
            </div>
          )}
          onView={(item) => handleAction('view', item)}
          onEdit={(item) => handleAction('assign', item)}
          onDelete={(item) => handleAction('delete', item)}
          canEdit={hasMenuPermission('Missions', 'can_edit')}
          canDelete={hasMenuPermission('Missions', 'can_delete')}
        />
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          modalType === 'assign' ? 'Mission Asset Assignment' : 
            modalType === 'delete' ? 'Scrap Mission' : 
            modalType === 'pod' ? 'Proof of Delivery (POD) Verification' : 'Mission Details'
        }
      >
        {selectedMission && modalType === 'delete' ? (
          <div className="space-y-6">
             <div className="p-6 bg-danger/5 border-2 border-dashed border-danger/20 rounded-2xl text-center">
                <Shield size={48} className="mx-auto text-danger mb-4 opacity-50" />
                <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2">Decommission Mission</h3>
                <p className="text-sm text-secondary">
                  Are you sure you want to scrub mission <span className="text-white font-bold">#{selectedMission.id}</span>? 
                  This will cancel all associated logistics and return items to inventory.
                </p>
              </div>
              <div className="flex gap-3 justify-end pt-4">
                 <button onClick={() => setIsModalOpen(false)} className="btn-secondary" disabled={isDeleting}>Close Protocol</button>
                 <button 
                   onClick={handleDelete} 
                   disabled={isDeleting}
                   className={`px-6 py-2 text-white rounded-lg font-bold transition-all ${isDeleting ? 'bg-danger/50 cursor-not-allowed' : 'bg-danger hover:bg-danger/80'}`}
                 >
                   {isDeleting ? 'Scrapping...' : 'Scrap Mission'}
                 </button>
              </div>
          </div>
        ) : selectedMission && modalType === 'assign' ? (
          <div className="space-y-6">
            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
              <h4 className="text-[10px] font-black text-accent uppercase tracking-widest mb-2">Target Mission</h4>
              <p className="text-sm font-bold text-white">Mission #{selectedMission.id} - Order #{selectedMission.orderId}</p>
              <p className="text-xs text-muted mt-1 uppercase font-black">
                {selectedMission.missionType} {selectedMission.destinationType ? `| ${selectedMission.destinationType}` : ''}
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Select Tactical Pilot (Driver)</label>
                <select 
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-accent outline-none font-bold"
                  value={assignData.driverId}
                  onChange={(e) => setAssignData({ ...assignData, driverId: e.target.value })}
                >
                  <option value="">Choose Personnel...</option>
                  {users.filter(u => {
                    // Only show users belonging to this mission's company
                    if (u.tenantId && selectedMission.tenantId && u.tenantId !== selectedMission.tenantId) return false;

                    const r = (typeof u.role === 'object' ? u.role?.name : u.role) || '';
                    const rLower = String(r).toLowerCase();
                    return ['staff', 'driver', 'logistics', 'field_staff'].includes(rLower);
                  }).map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Select Fleet Asset (Vehicle)</label>
                <select 
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-accent outline-none font-bold"
                  value={assignData.vehicleId}
                  onChange={(e) => setAssignData({ ...assignData, vehicleId: e.target.value })}
                >
                  <option value="">Choose Vehicle...</option>
                  {fleet.map(v => (
                    <option key={v.db_id} value={v.db_id}>{v.id} - {v.model}</option>
                  ))}
                </select>
              </div>

              <button 
                onClick={handleAssign}
                className="w-full py-3 bg-accent text-primary rounded-xl font-black uppercase tracking-[0.2em] shadow-lg shadow-accent/20 hover:scale-[1.02] transition-transform mt-4"
              >
                Confirm Assignment
              </button>
            </div>
          </div>
        ) : selectedMission && modalType === 'pod' ? (
          <form onSubmit={handleSubmitPOD} className="space-y-5">
            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-accent uppercase tracking-widest">Active Mission</p>
                <p className="text-sm font-bold text-white mt-0.5">{selectedMission.id} · Ref: {selectedMission.deliveryNumber || selectedMission.orderId || '—'}</p>
              </div>
              <span className="px-2.5 py-1 bg-info/20 text-info text-[10px] font-black uppercase rounded-lg border border-info/30">
                Awaiting Proof
              </span>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted uppercase tracking-widest flex items-center gap-1.5">
                <User size={12} className="text-accent" />
                Receiver Full Name <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Johnathan Vance"
                value={podData.receiverName}
                onChange={(e) => setPodData({ ...podData, receiverName: e.target.value })}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-accent outline-none font-bold text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted uppercase tracking-widest flex items-center gap-1.5">
                <FileText size={12} className="text-accent" />
                Signee Confirmation / Signature Note
              </label>
              <input
                type="text"
                placeholder="Receiver Signature or Verified Handover Code"
                value={podData.signature}
                onChange={(e) => setPodData({ ...podData, signature: e.target.value })}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-accent outline-none font-bold text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted uppercase tracking-widest flex items-center gap-1.5">
                <Camera size={12} className="text-accent" />
                Proof of Delivery Photo <span className="text-danger">*</span>
              </label>
              {podData.photo ? (
                <div className="relative rounded-2xl overflow-hidden border border-white/20 aspect-video bg-black flex items-center justify-center group">
                  <img src={podData.photo} alt="POD Proof" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => setPodData(prev => ({ ...prev, photo: null }))}
                      className="px-3 py-1.5 bg-danger text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg"
                    >
                      <X size={14} /> Remove Photo
                    </button>
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border hover:border-accent/50 rounded-2xl cursor-pointer bg-white/[0.02] hover:bg-white/[0.05] transition-all">
                  <Camera size={32} className="text-muted mb-2 group-hover:text-accent transition-colors" />
                  <span className="text-xs font-bold text-white">Click or Drop Photo Evidence</span>
                  <span className="text-[10px] text-muted mt-1 uppercase tracking-wider">PNG, JPG or Camera snapshot</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted uppercase tracking-widest flex items-center gap-1.5">
                <FileText size={12} className="text-accent" />
                Delivery Remarks / Handover Notes
              </label>
              <textarea
                rows={2}
                placeholder="Package condition, gate handover details, or client remarks..."
                value={podData.notes}
                onChange={(e) => setPodData({ ...podData, notes: e.target.value })}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-accent outline-none font-medium text-white resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="btn-secondary flex-1 py-3 text-xs uppercase font-bold"
                disabled={isSubmittingPod}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingPod || !podData.photo || !podData.receiverName.trim()}
                className={`flex-1 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-2 ${
                  isSubmittingPod || !podData.photo || !podData.receiverName.trim()
                    ? 'bg-success/40 text-white/50 cursor-not-allowed'
                    : 'bg-success text-white hover:bg-success/90 shadow-lg shadow-success/20'
                }`}
              >
                {isSubmittingPod ? (
                  <>Verifying Proof...</>
                ) : (
                  <>
                    <CheckCircle2 size={16} /> Complete Delivery
                  </>
                )}
              </button>
            </div>
          </form>
        ) : selectedMission && (
          <div className="space-y-6">
            {/* Top Mission Dossier */}
            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
                  <Shield size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-white uppercase tracking-tight">{selectedMission.id}</h3>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                      selectedMission.status === 'completed' ? 'bg-success/20 text-success border border-success/30' :
                      selectedMission.status === 'en_route' ? 'bg-info/20 text-info border border-info/30' :
                      selectedMission.status === 'assigned' ? 'bg-accent/20 text-accent border border-accent/30' : 'bg-white/10 text-muted'
                    }`}>
                      {selectedMission.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted font-bold tracking-wider mt-0.5">
                    TYPE: <span className="text-accent uppercase">{selectedMission.missionType || 'LOGISTICS'}</span> · LAUNCH: {selectedMission.date || 'Today'}
                  </p>
                </div>
              </div>

              {selectedMission.deliveryNumber && (
                <div className="text-left md:text-right">
                  <p className="text-[9px] font-black text-muted uppercase">Dispatch Code</p>
                  <p className="text-xs font-mono font-bold text-accent">{selectedMission.deliveryNumber}</p>
                </div>
              )}
            </div>

            {/* Linked Entity Card: Marketplace Order / Project */}
            {(() => {
              const proj = getProject(selectedMission);
              const linked = findLinkedOrder(selectedMission);
              const orderId = selectedMission.orderId || linked?.orderNumber || linked?.id || '—';

              if (proj) {
                return (
                  <div className="p-4 bg-accent/5 border border-accent/20 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black text-accent uppercase tracking-widest flex items-center gap-1.5">
                        <Layers size={12} /> Linked Project Dossier
                      </span>
                      <span className="text-[9px] font-bold text-muted uppercase">Ref #{proj.id}</span>
                    </div>
                    <p className="text-sm font-bold text-white">{proj.name || proj.title || 'Special Operations Project'}</p>
                    {proj.description && <p className="text-xs text-secondary">{proj.description}</p>}
                    <div className="flex items-center gap-4 text-[10px] text-muted font-bold pt-1 border-t border-accent/10">
                      <span>Status: <span className="text-white uppercase">{proj.status || 'Active'}</span></span>
                      {orderId !== '—' && <span>Origin Order: <span className="text-accent">ORD-{orderId}</span></span>}
                    </div>
                  </div>
                );
              }

              if (linked || orderId !== '—') {
                const totalAmt = linked?.totalAmount || linked?.totalPrice || linked?.amount || 0;
                return (
                  <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black text-accent uppercase tracking-widest flex items-center gap-1.5">
                        <Package size={12} /> Linked Marketplace Order
                      </span>
                      <span className="px-2 py-0.5 bg-white/5 text-accent text-[9px] font-mono font-bold rounded">
                        {linked?.orderNumber || (orderId ? `ORD-${orderId}` : 'Marketplace Fulfillment')}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-1 text-xs">
                      <div>
                        <p className="text-[9px] text-muted uppercase font-bold">Order Status</p>
                        <p className="text-white font-bold uppercase text-[11px]">{linked?.status || selectedMission.status}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-muted uppercase font-bold">Total Order Value</p>
                        <p className="text-accent font-bold text-[11px]">{totalAmt ? `$${Number(totalAmt).toLocaleString()}` : 'Standard Catalog'}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-muted uppercase font-bold">Pipeline Stage</p>
                        <p className="text-white font-bold uppercase text-[11px]">{linked?.currentDepartment || 'Logistics Fleet'}</p>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                  <p className="text-[9px] font-black text-muted uppercase mb-1">Linked Order / Project</p>
                  <p className="text-xs text-muted italic">No linked project or order attached to this mission record.</p>
                </div>
              );
            })()}

            {/* Client & Vectors Dossier */}
            {(() => {
              const linked = findLinkedOrder(selectedMission);
              const clientName = selectedMission.clientName || linked?.client?.companyName || linked?.client?.name || linked?.metadata?.clientName || 'VIP Client';
              const pickupLoc = selectedMission.pickupLocation || linked?.pickupLocation || linked?.delivery?.pickupLocation || 'Central Fulfillment Depot';
              const dropLoc = selectedMission.dropLocation || selectedMission.destinationType || linked?.dropLocation || linked?.delivery?.dropLocation || 'Client Destination';

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-1">
                    <p className="text-[9px] font-black text-muted uppercase tracking-widest flex items-center gap-1.5">
                      <User size={12} className="text-accent" /> Client / Consignee
                    </p>
                    <p className="text-sm font-bold text-white">{clientName}</p>
                    {linked?.client?.email && <p className="text-xs text-secondary truncate">{linked.client.email}</p>}
                  </div>

                  <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-1">
                    <p className="text-[9px] font-black text-muted uppercase tracking-widest flex items-center gap-1.5">
                      <Truck size={12} className="text-accent" /> Assigned Pilot & Asset
                    </p>
                    <p className="text-sm font-bold text-white">
                      {selectedMission.driverName || linked?.driverName || 'Unassigned Pilot'}
                    </p>
                    <p className="text-xs text-accent font-mono">
                      {getVehicleDisplayName(selectedMission.plateNumber || selectedMission.vehicleId || linked?.plateNumber) || 'No Vehicle Assigned'}
                    </p>
                  </div>

                  <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-1 md:col-span-2">
                    <p className="text-[9px] font-black text-muted uppercase tracking-widest flex items-center gap-1.5">
                      <Navigation size={12} className="text-accent" /> Delivery Route Vectors
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 text-xs">
                      <div className="p-2.5 bg-black/20 rounded-xl border border-white/5">
                        <span className="text-[8px] font-black text-muted uppercase">Origin Vector (Pickup)</span>
                        <p className="text-white font-medium text-xs mt-0.5">{pickupLoc}</p>
                      </div>
                      <div className="p-2.5 bg-black/20 rounded-xl border border-white/5">
                        <span className="text-[8px] font-black text-accent uppercase">Destination Vector (Drop)</span>
                        <p className="text-white font-medium text-xs mt-0.5">{dropLoc}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Asset Manifest Table */}
            {(() => {
              const linked = findLinkedOrder(selectedMission);
              const itemsList = (selectedMission.items && selectedMission.items.length > 0)
                ? selectedMission.items
                : (linked?.items && linked.items.length > 0
                    ? linked.items
                    : (linked?.customItems || []));

              if (itemsList && itemsList.length > 0) {
                return (
                  <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black text-accent uppercase tracking-widest flex items-center gap-1.5">
                        <Package size={12} /> Asset Manifest Items ({itemsList.length})
                      </span>
                      {selectedMission.payout && (
                        <span className="text-[10px] font-black text-success">
                          Trip Earning: ${Number(selectedMission.payout).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-white/10 text-[9px] uppercase tracking-wider text-muted">
                            <th className="pb-2">Item</th>
                            <th className="pb-2 text-center">Qty</th>
                            <th className="pb-2 text-right">Unit Price</th>
                            <th className="pb-2 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {itemsList.map((it, idx) => {
                            const name = it.item?.name || it.name || it.productName || `Asset #${idx + 1}`;
                            const qty = it.quantity != null ? it.quantity : (it.qty != null ? it.qty : 1);
                            const price = it.unitPrice != null ? it.unitPrice : (it.price != null ? it.price : 0);
                            const total = it.totalPrice != null ? it.totalPrice : (qty * price);
                            return (
                              <tr key={idx} className="hover:bg-white/[0.02]">
                                <td className="py-2 text-white font-medium">{name}</td>
                                <td className="py-2 text-center text-muted font-mono">{qty}</td>
                                <td className="py-2 text-right text-muted">${Number(price).toLocaleString()}</td>
                                <td className="py-2 text-right text-accent font-bold">${Number(total).toLocaleString()}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {/* Mission Notes */}
            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
              <p className="text-[9px] font-black text-muted uppercase mb-1">Mission Notes / Instructions</p>
              <p className="text-xs text-secondary italic">{selectedMission.notes || selectedMission.remarks || 'Standard priority dispatch protocol.'}</p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              {selectedMission.status === 'assigned' && (
                <button
                  type="button"
                  onClick={async () => {
                    await handleUpdateStatus('en_route');
                    const dest = selectedMission.destinationType || selectedMission.dropLocation || 'destination';
                    swalSuccess('Mission Dispatched', `Asset is now en route to ${dest}. Status updated across all dashboards.`);
                  }}
                  className="flex-1 py-3 bg-info text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-info/90 shadow-md shadow-info/20 transition-all flex items-center justify-center gap-1.5"
                >
                  <Navigation size={14} /> Dispatch Mission (En Route)
                </button>
              )}

              {selectedMission.status === 'en_route' && (
                <button
                  type="button"
                  onClick={() => setModalType('pod')}
                  className="flex-1 py-3 bg-success text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-success/90 shadow-md shadow-success/20 transition-all flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 size={14} /> Arrived (Submit Proof of Delivery)
                </button>
              )}

              {selectedMission.status === 'pending' && (
                <button
                  type="button"
                  onClick={() => setModalType('assign')}
                  className="flex-1 py-3 bg-accent text-primary rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-accent/90 shadow-md shadow-accent/20 transition-all"
                >
                  Assign Tactical Pilot
                </button>
              )}

              {selectedMission.status !== 'completed' && (
                <button
                  type="button"
                  onClick={() => handleUpdateStatus('failed')}
                  className="py-3 px-5 bg-danger/20 text-danger border border-danger/30 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-danger hover:text-white transition-all"
                >
                  Abort
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Missions;

