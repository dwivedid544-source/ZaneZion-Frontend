import React, { useState, useEffect } from 'react';
import Table from '../../components/Table';
import Modal from '../../components/Modal';
import { useData } from '../../context/GlobalDataContext';
import { 
  Plus, Search, Shield, Truck, User, 
  Calendar, MapPin, Navigation, Package, 
  CheckCircle2, AlertCircle, Clock
} from 'lucide-react';
import api from '../../services/api/setupAxios.js';
import { swalSuccess, swalError } from '../../utils/swal';

const Missions = () => {
  const {
    missions, fetchMissions, users, fleet, fetchFleet, fetchStaff,
    projects, fetchProjects,
    addLog, updateMissionStatus, assignMissionDriver, deleteMission,
    hasMenuPermission
  } = useData();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('view');
  const [selectedMission, setSelectedMission] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [assignData, setAssignData] = useState({
    driverId: '',
    vehicleId: ''
  });

  useEffect(() => {
    fetchMissions();
    fetchFleet();
    fetchStaff();
    if (fetchProjects) fetchProjects();
  }, [fetchMissions, fetchFleet, fetchStaff, fetchProjects]);

  // Link mission to its project by orderId or projectId
  const getProject = (mission) => {
    if (!projects || !projects.length) return null;
    const pId = mission.project_id || mission.projectId;
    const oId = mission.order_id || mission.orderId;
    
    return projects.find(p =>
      (pId && String(p.id) === String(pId)) ||
      (oId && (String(p.order_id || p.orderId) === String(oId) || String(p.id) === String(oId)))
    ) || null;
  };

  const handleAction = (type, mission) => {
    setSelectedMission(mission);
    setModalType(type);
    if (type === 'assign') {
      setAssignData({
        driverId: mission.driverId || '',
        vehicleId: mission.vehicleId || ''
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
      render: (row) => row.order_id || row.orderId || '—'
    },
    {
      header: "Project",
      accessor: "project_name",
      render: (row) => {
        const projName = row.project_name || getProject(row)?.name;
        const projId = row.project_id || row.projectId || getProject(row)?.id;
        const orderId = row.order_id || row.orderId;

        return projName ? (
          <div className="space-y-0.5 max-w-[150px]">
            <p className="text-xs font-bold text-white truncate">{projName}</p>
            <p className="text-[9px] text-accent font-black uppercase tracking-wider">
              Ref #{projId}{orderId ? ` · ORD-${orderId}` : ''}
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
      render: (row) => row.driverName || <span className="text-muted italic">Unassigned</span>
    },
    { 
      header: "Vehicle", 
      accessor: "plateNumber",
      render: (row) => row.plateNumber || <span className="text-muted italic">N/A</span>
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
    { header: "Date", accessor: "date" },
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
                  onClick={async (e) => {
                    e.stopPropagation();
                    setSelectedMission(row);
                    await updateMissionStatus(row.id, 'completed');
                    swalSuccess('Mission Arrived', `Asset successfully delivered to destination.`);
                  }}
                  className="px-3 py-1.5 bg-success/20 text-success hover:bg-success hover:text-black rounded-lg text-[10px] font-black uppercase transition-all shadow-sm shadow-success/5"
                >
                  Arrived
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
            modalType === 'delete' ? 'Scrap Mission' : 'Mission Details'
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
        ) : selectedMission && (
          <div className="space-y-6">
            {/* Mission identity */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                <p className="text-[8px] font-black text-muted uppercase">Mission ID</p>
                <p className="text-sm font-bold text-accent uppercase italic">{selectedMission.id}</p>
              </div>
              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                <p className="text-[8px] font-black text-muted uppercase">Reference / Order ID</p>
                <p className="text-sm font-bold text-white italic">{selectedMission.orderId || '—'}</p>
              </div>
            </div>

            {/* Project details */}
            {(() => {
              const proj = getProject(selectedMission);
              return proj ? (
                <div className="p-4 bg-accent/5 border border-accent/20 rounded-2xl space-y-2">
                  <p className="text-[8px] font-black text-accent uppercase tracking-widest">Linked Project</p>
                  <p className="text-sm font-bold text-white">{proj.name || proj.title || 'Unnamed Project'}</p>
                  {proj.description && <p className="text-xs text-secondary">{proj.description}</p>}
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-[9px] text-muted uppercase font-black">ID: <span className="text-accent">#{proj.id}</span></span>
                    {proj.status && <span className="text-[9px] text-muted uppercase font-black">Status: <span className="text-white">{proj.status}</span></span>}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                  <p className="text-[8px] font-black text-muted uppercase mb-1">Linked Project</p>
                  <p className="text-xs text-muted italic">No project linked to this mission.</p>
                </div>
              );
            })()}

            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                <p className="text-[8px] font-black text-muted uppercase">Status</p>
                <p className="text-sm font-bold text-accent uppercase italic">{selectedMission.status}</p>
              </div>
              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                <p className="text-[8px] font-black text-muted uppercase">Launch Date</p>
                <p className="text-sm font-bold text-white italic">{selectedMission.date}</p>
              </div>
            </div>

            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
              <p className="text-[8px] font-black text-muted uppercase mb-2">Mission Notes</p>
              <p className="text-xs text-secondary italic">{selectedMission.notes || 'No mission logs recorded.'}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleUpdateStatus('completed')}
                className="flex-1 py-3 bg-success/20 text-success border border-success/30 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-success hover:text-white transition-all"
              >
                Finalize Mission
              </button>
              <button
                onClick={() => handleUpdateStatus('failed')}
                className="flex-1 py-3 bg-danger/20 text-danger border border-danger/30 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-danger hover:text-white transition-all"
              >
                Abort Mission
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Missions;

