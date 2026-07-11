import React, { useState, useEffect } from 'react';
import { swalSuccess, swalError, swalWarning, swalInfo, swalConfirm, swalCredentials, swalCopied } from '../../utils/swal';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Clock, CheckCircle, MapPin, DollarSign,
    Calendar, FileText, Upload, Play, Pause,
    CheckCircle2, AlertCircle, TrendingUp,
    Map as MapIcon, ClipboardList, Smartphone,
    User, Shield, Navigation, Plus,
    Camera, ImagePlus, X, ScanLine, Truck,
    Check, ToggleLeft, ToggleRight, Search, History,
    Edit2, Trash2
} from 'lucide-react';
import Modal from '../../components/Modal';
import { motion, AnimatePresence } from 'framer-motion';
import { useData } from '../../context/GlobalDataContext';
import StatusBadge from '../../components/StatusBadge';
import CustomDatePicker from '../../components/CustomDatePicker';
import { normalizeRole } from '../../utils/authUtils';

const EmployeePortal = () => {
    const {
        currentUser,
        staffAssignments, updateAssignment, updateMission, fetchStaff, fetchSupportingDocs,
        payHistory, addLog, recordWorkSession, fetchPayHistory,
        leaveRequests, addLeaveRequest, updateLeaveRequest, deleteLeaveRequest, fetchLeaveRequests,
        getVacationBalance, toggleAvailability,
        deliveries, updateDelivery, fetchDeliveries, reportSecurityEvent,
        securityEvents, fetchSecurityEvents,
        hasMenuPermission
    } = useData();

    const location = useLocation();
    const navigate = useNavigate();
    const queryParams = new URLSearchParams(location.search);
    const activeTab = queryParams.get('tab') || (location.pathname.includes('/leave') ? 'leave' : location.pathname.includes('/payroll') ? 'pay' : 'dashboard');

    const userRole = normalizeRole(currentUser?.role);
    const hasStaffTerminal = ['superadmin', 'staff', 'operations', 'logistics', 'inventory'].includes(userRole);

    useEffect(() => {
        console.log('[StaffPortal] Synchronizing operational data for tab:', activeTab);
        if (fetchSupportingDocs) fetchSupportingDocs();
        if (fetchDeliveries) fetchDeliveries();
        if (fetchPayHistory) fetchPayHistory();
        if (fetchLeaveRequests) fetchLeaveRequests();
        if (fetchSecurityEvents) fetchSecurityEvents();
    }, [activeTab]);

    useEffect(() => {
        let interval;
        if (activeTab === 'leave' && fetchLeaveRequests) {
            interval = setInterval(() => {
                fetchLeaveRequests();
            }, 5000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [activeTab]);

    const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
    const [leaveFormData, setLeaveFormData] = useState({ type: 'Vacation', start: '', end: '', reason: '' });
    const [editingLeaveRequest, setEditingLeaveRequest] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Security States
    const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
    const [securityModalType, setSecurityModalType] = useState('panic'); // 'panic' or 'breach'
    const [breachFormData, setBreachFormData] = useState({ type: 'Unauthorized Access', detail: '', location: currentUser?.location || '' });

    // Mission Details States
    const [isMissionModalOpen, setIsMissionModalOpen] = useState(false);
    const [selectedMission, setSelectedMission] = useState(null);


    // Filter assignments for the current user - prioritize ID
    const myAssignments = staffAssignments.filter(a => 
        (a.assigneeId && String(a.assigneeId) === String(currentUser?.id)) || 
        (a.assignee === currentUser?.name)
    );

    // Add real deliveries assigned to this driver
    const myDeliveries = deliveries.filter(d => {
        const isMine =
            (d.driverId && String(d.driverId) === String(currentUser?.id)) ||
            (d.driver === currentUser?.name);
        const isLogisticsMission = String(d.mission_type || '').toLowerCase() !== 'chauffeur';
        return isMine && isLogisticsMission;
    });
    // Chauffeur missions assigned to this driver
    const myChauffeurMissions = deliveries.filter(d => {
        const isMine =
            (d.driverId && String(d.driverId) === String(currentUser?.id)) ||
            (d.driver === currentUser?.name);
        const isChauffeur = String(d.mission_type || '').toLowerCase() === 'chauffeur';
        return isMine && isChauffeur;
    });
    const openDeliveryQueue = deliveries.filter((d) => {
        const isLogisticsMission = String(d.mission_type || '').toLowerCase() !== 'chauffeur';
        const s = String(d.status || '').toLowerCase().replace(/\s+/g, '_');
        const isOpen = ['pending', 'pending_pickup', 'pending_review', ''].includes(s);
        const hasDriver = !!(d.driverId || String(d.driver || '').trim());
        return isLogisticsMission && isOpen && !hasDriver;
    });

    const pendingAssignments = staffAssignments.filter(a => a.status === 'Pending' && !a.assigneeId);

    // Filtered assignments based on search
    const filteredMyAssignments = myAssignments.filter(asg =>
        asg.task?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asg.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(asg.id || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredPendingAssignments = pendingAssignments.filter(asg =>
        asg.task?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asg.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(asg.id || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const myPayHistory = payHistory.filter(p => {
        const payUserId = p.userId || p.user_id || p.created_by || p.requested_by;
        if (payUserId) {
            return String(payUserId) === String(currentUser?.id);
        }
        return p.userName === currentUser?.name;
    });

    const totalYTD = myPayHistory.reduce((acc, p) => acc + parseFloat((p.total || "0").replace('$', '').replace(',', '') || 0), 0);

    const activeDeliveriesCount = myDeliveries.filter(d =>
        !['delivered', 'completed', 'cancelled'].includes(String(d.status || '').toLowerCase().replace(/\s+/g, '_'))
    ).length;

    const handleStatusChange = (asg, newStatus, proofData = null) => {
        if (newStatus === 'view_details') {
            const matchingDel = deliveries.find(d => 
                (asg.orderId && d.orderId === asg.orderId) || 
                (asg.deliveryId && d.id === asg.deliveryId) || 
                (asg.id && d.taskRef === asg.id) ||
                (asg.rawId && d.id === asg.rawId)
            );
            if (matchingDel) {
                setSelectedMission(matchingDel);
                setIsMissionModalOpen(true);
            } else {
                // If it's a general task, we can still show asg details
                setSelectedMission({
                    ...asg,
                    mission_type: 'General Task',
                    pickup_location: 'Central Command',
                    drop_location: asg.location,
                    delivery_instructions: asg.detail || asg.task
                });
                setIsMissionModalOpen(true);
            }
            return;
        }

        const updatedAsg = { ...asg, status: newStatus, ...proofData };

        if (asg.source === 'delivery' || String(asg.id).startsWith('DEL-')) {
            const rawId = asg.db_id || asg.rawId || asg.id;
            const isAlreadyAssigned = String(asg.status).toLowerCase() === 'assigned';
            let finalStatus = newStatus;
            
            if (newStatus === 'in_progress') {
                finalStatus = isAlreadyAssigned ? 'en_route' : 'assigned';
            } else if (newStatus === 'Completed') {
                finalStatus = 'Delivered';
            }

            const payload = {
                id: rawId,
                status: finalStatus,
                ...proofData,
            };
            // If they are accepting, assign them
            if (newStatus === 'in_progress' || newStatus === 'assigned') {
                payload.driverId = currentUser?.id;
                payload.driver = currentUser?.name;
            }
            updateDelivery(payload);
            addLog({
                action: `Mission ${newStatus}`,
                detail: `${currentUser?.name || 'User'} updated mission ${asg.id} to ${newStatus}.`,
                type: 'system'
            });
            return;
        }
        
        if (asg.source === 'mission') {
            const isAlreadyAssigned = String(asg.status).toLowerCase() === 'assigned';
            const finalStatus = (newStatus === 'in_progress' && !isAlreadyAssigned) ? 'assigned' : newStatus;
            
            const payload = {
                id: asg.id,
                rawId: asg.rawId,
                status: finalStatus,
                assigneeId: (newStatus === 'in_progress' || newStatus === 'assigned') ? currentUser?.id : asg.assigneeId,
                assignee: (newStatus === 'in_progress' || newStatus === 'assigned') ? currentUser?.name : asg.assignee,
                ...proofData
            };
            updateMission(payload);
            addLog({
                action: `Mission ${newStatus}`,
                detail: `${currentUser?.name || 'User'} updated mission ${asg.id} to ${newStatus}.`,
                type: 'system'
            });
            return;
        }

        if (asg.status === 'Pending' && !asg.assigneeId) {
            updatedAsg.assigneeId = currentUser?.id;
            updatedAsg.assignee = currentUser?.name;
        }

        updateAssignment(updatedAsg);
        addLog({
            action: `Task ${newStatus}`,
            detail: `${currentUser?.name || 'User'} updated assignment ${asg.id} to ${newStatus}.`,
            type: 'system'
        });

        const matchingDel = deliveries.find(d => d.orderId === asg.orderId || d.id === asg.deliveryId || d.taskRef === asg.id);
        if (newStatus === 'Completed' && matchingDel) {
            updateDelivery({ ...matchingDel, status: 'Delivered', deliveredAt: new Date().toISOString() });
        }
    };

    const completedTodayCount = myAssignments.filter(a => {
        if (a.status !== 'Completed') return false;
        const date = new Date(a.updatedAt || a.date);
        const today = new Date();
        return date.toDateString() === today.toDateString();
    }).length;

    const dashboardStats = [
        { 
            label: "Remaining Tasks", 
            value: myAssignments.filter(a => !['Completed', 'Cancelled'].includes(a.status)).length.toString(), 
            icon: ClipboardList, 
            color: "text-accent" 
        },
        { 
            label: "Completed Today", 
            value: completedTodayCount.toString(), 
            icon: CheckCircle2, 
            color: "text-success" 
        },
        {
            label: "Active Deliveries",
            value: String(activeDeliveriesCount).padStart(2, '0'),
            subValue: 'Assigned routes in progress',
            icon: Truck,
            color: "text-warning"
        },
    ];

    return (
        <div className="space-y-8 pb-12">
            {/* Header — check-in/out lives in top navbar (StaffClockBar) for all eligible roles */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                <div className="flex-shrink-0">
                    <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-white italic uppercase flex items-center gap-3">
                        <Smartphone className="text-accent shrink-0" size={32} strokeWidth={2.5} /> Staff Terminal
                    </h1>
                    <p className="text-secondary text-[10px] md:text-xs mt-1 font-black uppercase tracking-[0.2em] opacity-80 flex items-center gap-2">
                        <User size={12} className="text-accent/50" /> {currentUser?.name || 'Authorized Officer'} 
                        <span className="opacity-30">|</span> 
                        <MapPin size={12} className="text-accent/50" /> {currentUser?.location || 'Central Command'}
                    </p>
                </div>

                <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4 flex-1">
                    <div className="relative flex-1 group min-w-[300px]">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-accent transition-all duration-300" size={20} />
                        <input
                            type="text"
                            placeholder="Interrogate tasks, locations, or operational IDs..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-14 pr-6 text-sm focus:outline-none focus:border-accent/50 focus:bg-white/[0.08] italic font-medium transition-all shadow-inner"
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-3 bg-white/[0.03] p-2.5 rounded-2xl border border-white/10 backdrop-blur-xl">
                        <div className="px-5 py-2 flex flex-col items-center min-w-[120px]">
                            <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-1.5 opacity-60">Leave balance</p>
                            <p className="text-lg font-black text-accent italic tracking-tighter tabular-nums flex items-center gap-2">
                                <Calendar size={14} className="opacity-50" /> {currentUser?.vacationBalance || 0}<span className="text-[10px] uppercase tracking-tighter opacity-50 not-italic ml-0.5">h</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tab Navigation Menu */}
            <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-4 border-b border-white/10 hide-scrollbar">
                {[
                    { id: 'dashboard', label: 'Command Center', icon: Smartphone },
                    { id: 'assignments', label: 'Operational Queue', icon: ClipboardList },
                    { id: 'map', label: 'Field Map', icon: MapIcon },
                    { id: 'leave', label: 'Leave & Absence', icon: Calendar },
                    { id: 'pay', label: 'Pay & Records', icon: History },
                    { id: 'security', label: 'Security Logs', icon: Shield }
                ].filter(tab => hasStaffTerminal || ['leave', 'pay'].includes(tab.id))
                .map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => {
                            const newParams = new URLSearchParams(location.search);
                            newParams.set('tab', tab.id);
                            navigate(`${location.pathname}?${newParams.toString()}`);
                        }}
                        className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                            activeTab === tab.id
                                ? 'bg-accent text-black shadow-lg shadow-accent/20'
                                : 'bg-white/5 text-muted hover:bg-white/10 hover:text-white border border-white/10'
                        }`}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>

            <AnimatePresence mode="wait">
                {activeTab === 'dashboard' && (
                    <motion.div
                        key="dashboard"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-8"
                    >
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {dashboardStats.map((stat, idx) => (
                                <div key={idx} className="glass-card p-6 flex items-center gap-4 group hover:border-accent/30 transition-all">
                                    <div className={`w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center ${stat.color} group-hover:scale-110 transition-transform`}>
                                        <stat.icon size={24} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-secondary font-black uppercase tracking-widest mb-1">{stat.label}</p>
                                        <p className="text-2xl font-black text-white italic font-heading tracking-tighter">{stat.value}</p>
                                        {stat.subValue && <p className="text-[9px] text-accent mt-1 font-black uppercase tracking-widest italic">{stat.subValue}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 space-y-6">
                                <div className="glass-card p-6 border-accent/10">
                                    <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                                        <Navigation size={20} className="text-accent" /> Priority Queue
                                    </h3>
                                    <div className="space-y-4">
                                        {filteredMyAssignments.filter(a => a.status !== 'Completed').map(asg => (
                                            <TaskCard key={asg.id} asg={asg} onAction={handleStatusChange} />
                                        ))}
                                        {filteredMyAssignments.filter(a => a.status !== 'Completed').length === 0 && (
                                            <div className="p-12 text-center border-2 border-dashed border-border rounded-3xl">
                                                <CheckCircle size={48} className="text-success mx-auto mb-4 opacity-20" />
                                                <p className="text-secondary font-bold">{searchTerm ? 'No matches found for your search.' : 'No active assignments. Check the Operational Queue.'}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="glass-card p-6">
                                    <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-4 flex items-center gap-2">
                                        <Shield size={18} className="text-accent" /> Security Protocol
                                    </h3>
                                    <div className="space-y-2">
                                        <button
                                            onClick={() => {
                                                setSecurityModalType('panic');
                                                setIsSecurityModalOpen(true);
                                                reportSecurityEvent({ eventType: 'PANIC', location: 'GPS Broadcast Active', details: 'Immediate extraction requested.' });
                                            }}
                                            className="w-full py-4 bg-danger text-white rounded-xl text-xs font-black uppercase tracking-[0.2em] hover:bg-danger/80 transition-all shadow-lg shadow-danger/20 flex items-center justify-center gap-2"
                                        >
                                            <AlertCircle size={18} /> Emergency Panic
                                        </button>
                                        <button
                                            onClick={() => {
                                                setSecurityModalType('breach');
                                                setIsSecurityModalOpen(true);
                                            }}
                                            className="w-full py-4 bg-white/5 border border-border rounded-xl text-[10px] font-black uppercase tracking-widest hover:text-white transition-all"
                                        >
                                            Report Security Breach
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {activeTab === 'assignments' && (
                    <motion.div
                        key="assignments"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                    >
                        <div className="glass-card p-6">
                            <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                                <ClipboardList size={20} className="text-accent" /> My Active Tasks
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {filteredMyAssignments.filter(a => a.status !== 'Completed').map(asg => (
                                    <TaskCard key={asg.id} asg={asg} onAction={handleStatusChange} />
                                ))}
                                {filteredMyAssignments.filter(a => a.status !== 'Completed').length === 0 && (
                                    <p className="col-span-2 text-center py-6 text-secondary italic border border-dashed border-border rounded-2xl">No active operational tasks assigned.</p>
                                )}
                            </div>
                        </div>

                        <div className="glass-card p-6">
                            <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6">Open Delivery Queue</h3>
                            <div className="space-y-4 mb-8">
                                {openDeliveryQueue.map(del => (
                                    <div key={del.id} className="p-6 bg-warning/[0.03] border border-warning/20 rounded-3xl space-y-6 relative overflow-hidden group hover:border-warning/40 transition-all">
                                        <div className="absolute top-0 right-0 p-4">
                                            <div className="px-3 py-1 bg-warning/20 rounded-full">
                                                <p className="text-[10px] font-black text-warning uppercase tracking-widest italic">EST. EARNING: {parseFloat(del.delivery_fee) > 0 ? `$${parseFloat(del.delivery_fee).toFixed(2)}` : 'Pending Setup'}{del.route_distance ? ` (${del.route_distance} km)` : ''}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 rounded-2xl bg-warning/10 flex items-center justify-center text-warning shadow-inner">
                                                <Truck size={28} />
                                            </div>
                                            <div>
                                                <p className="text-lg font-black text-white italic tracking-tighter">{del.mission_type || 'Delivery Mission'}</p>
                                                <p className="text-[10px] font-black text-warning uppercase tracking-[0.2em] opacity-80">ID: {del.orderId || del.id}</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                                            <div className="space-y-4">
                                                <div className="flex items-start gap-3">
                                                    <div className="w-6 h-6 rounded-full bg-success/20 flex items-center justify-center shrink-0 mt-1">
                                                        <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-muted uppercase tracking-widest">Pickup Point</p>
                                                        <p className="text-sm font-bold text-white italic">{del.pickup_location || del.pickupLocation || 'Main Hub'}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-start gap-3">
                                                    <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center shrink-0 mt-1">
                                                        <MapPin size={12} className="text-accent" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-muted uppercase tracking-widest">Destination</p>
                                                        <p className="text-sm font-bold text-white italic">{del.drop_location || del.dropLocation || del.location || 'Client Site'}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="space-y-4 border-l border-white/5 pl-6">
                                                <div>
                                                    <p className="text-[9px] font-black text-muted uppercase tracking-widest">Package Intelligence</p>
                                                    <p className="text-xs text-secondary italic leading-relaxed">
                                                        {(() => {
                                                            const raw = del.package_details || del.item || 'Standard Logistic Unit';
                                                            if (typeof raw === 'string' && raw.startsWith('[')) {
                                                                try {
                                                                    const parsed = JSON.parse(raw);
                                                                    if (Array.isArray(parsed) && parsed.length > 0) {
                                                                        return parsed.map(p => `${p.name || 'Item'} (x${p.qty || 1})`).join(', ');
                                                                    }
                                                                } catch (e) {}
                                                            }
                                                            return raw;
                                                        })()}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div>
                                                        <p className="text-[9px] font-black text-muted uppercase tracking-widest">Distance</p>
                                                        <p className="text-xs font-bold text-white">~{del.route_distance || '12.4'} KM</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-muted uppercase tracking-widest">Priority</p>
                                                        <span className="text-[9px] font-black text-warning uppercase">Standard</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                            <div className="flex flex-col sm:flex-row gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedMission(del);
                                                        setIsMissionModalOpen(true);
                                                    }}
                                                    className="flex-1 py-4 bg-white/5 border border-white/10 text-accent rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-accent/10 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <FileText size={16} /> View Intel
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => updateDelivery({
                                                        ...del,
                                                        status: 'assigned',
                                                        driverId: currentUser?.id,
                                                        driver: currentUser?.name
                                                    })}
                                                    className="flex-[1.5] py-4 bg-accent text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-accent/20 flex items-center justify-center gap-2"
                                                >
                                                    <Check size={18} /> Accept Mission
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => swalInfo('Mission Ignored', 'You have ignored this mission. It remains available for other staff.')}
                                                    className="flex-1 py-4 bg-white/5 border border-white/10 text-secondary rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <X size={16} /> Reject
                                                </button>
                                            </div>
                                    </div>
                                ))}
                                {openDeliveryQueue.length === 0 && (
                                    <p className="text-center py-6 text-secondary italic border border-dashed border-border rounded-2xl">No open delivery missions in queue.</p>
                                )}
                            </div>

                            <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6">Assigned Vehicle Dispatches</h3>
                            <div className="space-y-4">
                                {myDeliveries.map(del => (
                                    <div key={del.id} className="p-5 bg-accent/5 border border-accent/20 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-accent">
                                                <Truck size={24} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-black text-white italic tracking-tighter">{del.vehicle || 'Institutional Asset'}</p>
                                                <p className="text-[10px] font-black text-accent uppercase tracking-widest italic">{del.orderId || 'MISSION-ALPHA'}</p>
                                            </div>
                                        </div>
                                        <div className="flex-1 border-l border-white/10 pl-4">
                                            <p className="text-[8px] font-black text-muted uppercase tracking-[0.2em] mb-1">Manifest</p>
                                            <p className="text-xs text-secondary italic">
                                                {del.items ? del.items.map(i => i.name).join(', ') : (del.item || (currentUser?.name || 'User').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2))}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Destination</p>
                                            <p className="text-sm font-black text-white italic tracking-tighter">{del.location || 'Client Hub'}</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2 justify-end">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedMission(del);
                                                    setIsMissionModalOpen(true);
                                                }}
                                                className="p-2 bg-white/5 border border-border rounded-xl text-accent hover:bg-accent/10 transition-all flex items-center gap-2 px-3"
                                                title="View Mission Intelligence"
                                            >
                                                <FileText size={16} />
                                                <span className="text-[9px] font-black uppercase tracking-widest">View Intel</span>
                                            </button>
                                            
                                            <StatusBadge status={del.status} />
                                            {(() => {
                                                const s = String(del.status || '').toLowerCase().replace(/\s+/g, '_');
                                                const mine = String(del.driverId) === String(currentUser?.id) || del.driver === currentUser?.name;
                                                const open = ['pending', 'pending_pickup', 'pending_review', ''].includes(s);

                                                if (open) {
                                                    return (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => updateDelivery({
                                                                    ...del,
                                                                    status: 'assigned',
                                                                    driverId: currentUser?.id,
                                                                    driver: currentUser?.name
                                                                })}
                                                                className="btn-primary py-2 px-4 text-[10px]"
                                                            >
                                                                Accept
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => updateDelivery({ ...del, status: 'pending', driverId: null, driver: null })}
                                                                className="py-2 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest border border-danger/40 text-danger hover:bg-danger/10"
                                                            >
                                                                Decline
                                                            </button>
                                                        </>
                                                    );
                                                }
                                                if (s === 'assigned' && mine) {
                                                    return (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => updateDelivery({ ...del, status: 'en_route' })}
                                                                className="btn-primary py-2 px-4 text-[10px]"
                                                            >
                                                                Start trip
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => updateDelivery({ ...del, status: 'pending', driverId: null, driver: null })}
                                                                className="py-2 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest border border-danger/40 text-danger hover:bg-danger/10"
                                                            >
                                                                Decline
                                                            </button>
                                                        </>
                                                    );
                                                }
                                                if ((s === 'en_route' || s === 'in_transit') && mine) {
                                                    return (
                                                        <button
                                                            type="button"
                                                            onClick={() => updateDelivery({ ...del, status: 'Delivered' })}
                                                            className="bg-success text-white py-2 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all"
                                                        >
                                                            Mark delivered
                                                        </button>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </div>
                                    </div>
                                ))}
                                {myDeliveries.length === 0 && (
                                    <p className="text-center py-6 text-secondary italic border border-dashed border-border rounded-2xl">No active vehicle dispatches assigned.</p>
                                )}
                            </div>
                        </div>

                        {/* Chauffeur Missions Section */}
                        <div className="glass-card p-6 border-accent/10">
                            <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                                <Navigation size={20} className="text-accent" /> Assigned Chauffeur Missions
                            </h3>
                            <div className="space-y-4">
                                {myChauffeurMissions.map(del => {
                                    const s = String(del.status || '').toLowerCase().replace(/\s+/g, '_');
                                    const isCompleted = ['delivered', 'completed'].includes(s);
                                    return (
                                        <div key={del.id} className={`p-5 border rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${isCompleted ? 'bg-success/5 border-success/20' : 'bg-accent/5 border-accent/20'}`}>
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                                                    <Navigation size={24} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-white italic tracking-tighter">VIP Chauffeur Service</p>
                                                    <p className="text-[10px] font-black text-accent uppercase tracking-widest italic">{del.orderId || del.id}</p>
                                                </div>
                                            </div>
                                            <div className="flex-1 border-l border-white/10 pl-4">
                                                <p className="text-[8px] font-black text-muted uppercase tracking-[0.2em] mb-1">Route</p>
                                                <p className="text-xs text-secondary italic">
                                                    {del.pickupLocation || 'Pickup'} → {del.dropLocation || del.location || 'Destination'}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Est. Payment</p>
                                                <p className="text-sm font-black text-accent italic tracking-tighter">${(parseFloat(del.delivery_fee) || 0).toFixed(2)}</p>
                                            </div>
                                            <div className="flex flex-wrap gap-2 justify-end">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedMission(del);
                                                        setIsMissionModalOpen(true);
                                                    }}
                                                    className="p-2 bg-white/5 border border-border rounded-xl text-accent hover:bg-accent/10 transition-all flex items-center gap-2 px-3"
                                                    title="View Mission Intelligence"
                                                >
                                                    <FileText size={16} />
                                                    <span className="text-[9px] font-black uppercase tracking-widest">View Intel</span>
                                                </button>

                                                <StatusBadge status={del.status} />
                                                {(() => {
                                                    const mine = String(del.driverId) === String(currentUser?.id) || del.driver === currentUser?.name;
                                                    if (s === 'assigned' && mine) {
                                                        return (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateDelivery({ ...del, status: 'en_route' })}
                                                                    className="btn-primary py-2 px-4 text-[10px]"
                                                                >
                                                                    Start trip
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateDelivery({ ...del, status: 'pending', driverId: null, driver: null })}
                                                                    className="py-2 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest border border-danger/40 text-danger hover:bg-danger/10"
                                                                >
                                                                    Decline
                                                                </button>
                                                            </>
                                                        );
                                                    }
                                                    if ((s === 'en_route' || s === 'in_transit') && mine) {
                                                        return (
                                                            <button
                                                                type="button"
                                                                onClick={() => updateDelivery({ ...del, status: 'Delivered' })}
                                                                className="bg-success text-white py-2 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all"
                                                            >
                                                                Mark completed
                                                            </button>
                                                        );
                                                    }
                                                    return null;
                                                })()}
                                            </div>
                                        </div>
                                    );
                                })}
                                {myChauffeurMissions.length === 0 && (
                                    <p className="text-center py-6 text-secondary italic border border-dashed border-border rounded-2xl">No chauffeur missions assigned to you.</p>
                                )}
                            </div>
                        </div>

                        <div className="glass-card p-6">
                            <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6">Operational Assignment Queue</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {filteredPendingAssignments.map(asg => (
                                    <TaskCard key={asg.id} asg={asg} onAction={handleStatusChange} />
                                ))}
                                {filteredPendingAssignments.length === 0 && (
                                    <p className="col-span-2 text-center py-6 text-secondary italic border border-dashed border-border rounded-2xl">No matching pending assignments.</p>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}


                {activeTab === 'pay' && (
                    <motion.div
                        key="pay"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="max-w-4xl mx-auto space-y-6"
                    >
                        {(() => {
                            const heldDeliveries = myDeliveries.filter(d => d.payout_status === 'held');
                            const pendingTotal = heldDeliveries.reduce((acc, d) => acc + (parseFloat(d.delivery_fee) || 0), 0);
                            const releasedTotal = myDeliveries
                                .filter(d => d.payout_status === 'released')
                                .reduce((acc, d) => acc + (parseFloat(d.delivery_fee) || 0), 0);

                            return (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="glass-card p-8 text-center bg-gradient-to-br from-white/[0.05] to-transparent border-accent/20">
                                            <p className="text-[10px] font-black text-muted uppercase tracking-[0.3em] mb-2">Total Earnings YTD</p>
                                            <h2 className="text-4xl font-black text-white italic tracking-tighter">${(totalYTD + releasedTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
                                            <p className="text-[10px] font-black text-success uppercase mt-2 tracking-widest">Released & Paid</p>
                                        </div>
                                        <div className="glass-card p-8 text-center bg-gradient-to-br from-warning/[0.05] to-transparent border-warning/20">
                                            <p className="text-[10px] font-black text-muted uppercase tracking-[0.3em] mb-2">Earnings on Hold (48h)</p>
                                            <h2 className="text-4xl font-black text-warning italic tracking-tighter">${pendingTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
                                            <p className="text-[10px] font-black text-secondary uppercase mt-2 tracking-widest">Security Clearance Pending</p>
                                        </div>
                                    </div>

                                    <div className="glass-card p-6 border-accent/10">
                                        <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                                            <Clock size={20} className="text-warning" /> Pending Payout Queue
                                        </h3>
                                        <div className="space-y-3">
                                            {heldDeliveries.length > 0 ? heldDeliveries.map(del => {
                                                const readyAt = new Date(del.payout_ready_at);
                                                const now = new Date();
                                                const diff = readyAt - now;
                                                const hours = Math.max(0, Math.floor(diff / (1000 * 60 * 60)));
                                                const minutes = Math.max(0, Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)));
                                                
                                                return (
                                                    <div key={del.id} className="p-4 bg-white/[0.02] border border-border rounded-2xl flex justify-between items-center group">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center text-warning">
                                                                <Truck size={18} />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-bold text-white">Mission #{del.id}</p>
                                                                <p className="text-[9px] text-muted uppercase font-black">{del.dropLocation || 'Delivered'}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-6">
                                                            <div className="text-right">
                                                                <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-0.5">Countdown</p>
                                                                <p className="text-sm font-black text-accent tabular-nums">
                                                                    {hours}h {minutes}m
                                                                </p>
                                                            </div>
                                                            <div className="text-right border-l border-white/10 pl-6">
                                                                <p className="text-sm font-black text-white">${parseFloat(del.delivery_fee || 0).toFixed(2)}</p>
                                                                <span className="text-[8px] font-black text-warning uppercase tracking-widest">Held</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            }) : (
                                                <div className="p-8 text-center border-2 border-dashed border-border rounded-3xl opacity-50">
                                                    <CheckCircle2 size={32} className="mx-auto mb-2 text-success" />
                                                    <p className="text-xs font-bold text-secondary uppercase tracking-widest">No payments currently on hold</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            );
                        })()}

                        <div className="glass-card p-6 border-accent/10">
                            <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-accent">
                                <Shield size={20} /> Registered Settlement Protocol
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/[0.03] p-6 rounded-2xl border border-border">
                                <div>
                                    <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Financial Institution</p>
                                    <p className="text-lg font-bold text-white">{currentUser?.bankingInfo?.bank || 'Vaulted Bank'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Account Identifier</p>
                                    <p className="text-lg font-bold text-white tracking-widest">{currentUser?.bankingInfo?.account || '**** 0000'}</p>
                                </div>
                                <div className="md:col-span-2 pt-4 border-t border-white/5">
                                    <p className="text-xs text-secondary italic">Payments are processed automatically via bespoke institutional wire transfer every Friday after the 48-hour security hold period.</p>
                                </div>
                            </div>
                        </div>

                        <div className="glass-card p-6">
                            <h3 className="text-xl font-bold mb-6">Payment History</h3>
                            <div className="space-y-3">
                                {myPayHistory.map(pay => (
                                    <div key={pay.id} className="p-4 bg-white/[0.02] border border-border rounded-2xl flex justify-between items-center group hover:border-accent/30 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-secondary">
                                                <FileText size={18} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-white">{pay.period}</p>
                                                <p className="text-[10px] text-muted uppercase font-bold">{pay.date} • {pay.hours} Hours</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-black text-white">{pay.total}</p>
                                            <span className="text-[9px] font-black text-success uppercase tracking-widest">{pay.status}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}

                {activeTab === 'security' && (
                    <motion.div
                        key="security"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                    >
                        <div className="glass-card p-6">
                            <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                                <Shield className="text-accent" size={24} /> My Security Logs
                            </h3>
                            
                            <div className="space-y-4">
                                {securityEvents?.length === 0 ? (
                                    <div className="text-center py-12 bg-white/5 rounded-2xl border border-white/10 border-dashed">
                                        <Shield className="text-muted mx-auto mb-4" size={48} />
                                        <p className="text-muted font-black italic uppercase tracking-widest text-sm">No Security Events Logged</p>
                                        <p className="text-[10px] text-muted/70 mt-2 font-medium">No panic or breach events have been reported.</p>
                                    </div>
                                ) : (
                                    securityEvents?.map(event => (
                                        <div key={event.id} className="bg-background border border-white/10 rounded-2xl p-5 hover:border-accent/30 transition-all flex items-start justify-between gap-4 group">
                                            <div>
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                                        event.eventType === 'PANIC' ? 'bg-danger/20 text-danger' : 'bg-warning/20 text-warning'
                                                    }`}>
                                                        {event.eventType}
                                                    </span>
                                                    <p className="text-[10px] font-bold text-muted uppercase tracking-widest">{new Date(event.createdAt).toLocaleString()}</p>
                                                </div>
                                                <h4 className="text-white font-bold mb-1">{event.location || 'Unknown Location'}</h4>
                                                <p className="text-sm text-secondary">{event.details}</p>
                                            </div>
                                            <div className="flex items-center shrink-0">
                                                <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                                    event.status === 'Resolved' 
                                                        ? 'bg-success/10 text-success border-success/20' 
                                                        : 'bg-danger/10 text-danger border-danger/20 animate-pulse'
                                                }`}>
                                                    {event.status}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}

                {activeTab === 'map' && (
                    <motion.div
                        key="map"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                    >
                        <div className="glass-card p-6 border-accent/10">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
                                    <MapIcon className="text-accent" size={24} /> Tactical Field Map
                                </h3>
                                <div className="flex items-center gap-3 px-4 py-2 bg-success/5 border border-success/20 rounded-xl">
                                    <div className="w-2 h-2 rounded-full bg-success animate-pulse"></div>
                                    <span className="text-[10px] font-black text-success uppercase tracking-[0.2em]">GPS Active</span>
                                </div>
                            </div>
                            
                            <div className="relative w-full h-[500px] md:h-[600px] bg-[#050505] rounded-3xl overflow-hidden border border-white/10 flex items-center justify-center">
                                {/* Map Background Grid Simulation */}
                                <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px]"></div>
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#050505_100%)]"></div>

                                {/* Simulated Staff Location Marker */}
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center">
                                    <div className="px-3 py-1.5 bg-black/60 backdrop-blur-md border border-accent/30 rounded-xl mb-3 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                                        <p className="text-[10px] font-black text-accent uppercase tracking-[0.2em]">{currentUser?.name || 'My Unit'}</p>
                                    </div>
                                    <div className="relative flex items-center justify-center">
                                        <div className="absolute w-16 h-16 bg-accent/20 rounded-full animate-ping"></div>
                                        <div className="w-8 h-8 bg-accent border-2 border-[#050505] rounded-full flex items-center justify-center relative z-10 shadow-[0_0_20px_rgba(200,169,106,0.6)]">
                                            <Navigation size={14} className="text-[#050505] fill-current" />
                                        </div>
                                    </div>
                                </div>

                                {/* Simulated Route / Waypoint */}
                                {filteredMyAssignments.filter(a => a.status !== 'Completed').map((asg, idx) => {
                                    const positions = [
                                        { top: '25%', left: '30%' },
                                        { top: '70%', left: '60%' },
                                        { top: '30%', left: '70%' },
                                        { top: '65%', left: '25%' },
                                        { top: '40%', left: '80%' },
                                    ];
                                    const pos = positions[idx % positions.length];
                                    return (
                                        <div key={`asg-${asg.id}`} className="absolute z-10 group" style={pos}>
                                            <div className="absolute left-1/2 bottom-full mb-3 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap bg-black/80 backdrop-blur-md border border-white/10 px-4 py-3 rounded-2xl pointer-events-none z-30 shadow-2xl">
                                                <p className="text-[10px] font-black text-info uppercase tracking-widest mb-1">Task: {asg.id}</p>
                                                <p className="text-sm font-bold text-white italic">{asg.task}</p>
                                                <p className="text-xs text-secondary mt-1"><MapPin size={12} className="inline mr-1" />{asg.location}</p>
                                            </div>
                                            <div className="w-10 h-10 rounded-full bg-info/20 border border-info/50 flex items-center justify-center shadow-[0_0_15px_rgba(56,189,248,0.3)] cursor-pointer hover:scale-110 hover:bg-info/30 transition-all relative z-20">
                                                <ClipboardList size={18} className="text-info" />
                                            </div>
                                        </div>
                                    );
                                })}

                                {myDeliveries.filter(d => !['delivered', 'completed', 'cancelled'].includes(String(d.status || '').toLowerCase().replace(/\s+/g, '_'))).map((del, idx) => {
                                    const positions = [
                                        { top: '35%', left: '65%' },
                                        { top: '75%', left: '35%' },
                                        { top: '20%', left: '45%' },
                                        { top: '60%', left: '80%' },
                                        { top: '80%', left: '70%' },
                                    ];
                                    const pos = positions[idx % positions.length];
                                    return (
                                        <div key={`del-${del.id}`} className="absolute z-10 group" style={pos}>
                                            <div className="absolute left-1/2 bottom-full mb-3 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap bg-black/80 backdrop-blur-md border border-white/10 px-4 py-3 rounded-2xl pointer-events-none z-30 shadow-2xl">
                                                <p className="text-[10px] font-black text-warning uppercase tracking-widest mb-1">Dispatch: {del.orderId || del.id}</p>
                                                <p className="text-sm font-bold text-white italic">{del.dropLocation || del.location || 'Destination'}</p>
                                            </div>
                                            <div className="w-10 h-10 rounded-full bg-warning/20 border border-warning/50 flex items-center justify-center shadow-[0_0_15px_rgba(234,179,8,0.3)] cursor-pointer hover:scale-110 hover:bg-warning/30 transition-all relative z-20">
                                                <Truck size={18} className="text-warning" />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="mt-6">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-muted mb-4">Active Waypoints</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filteredMyAssignments.filter(a => a.status !== 'Completed').map(asg => (
                                        <div key={`list-asg-${asg.id}`} className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex items-start gap-4 hover:border-info/30 transition-all group cursor-pointer" onClick={() => handleStatusChange(asg, 'view_details')}>
                                            <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                                <ClipboardList size={18} className="text-info" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-black text-info uppercase tracking-widest truncate">{asg.id}</p>
                                                <p className="text-sm font-bold text-white truncate">{asg.task}</p>
                                                <p className="text-[10px] text-secondary mt-1 flex items-center gap-1 truncate"><MapPin size={10} className="inline" /> {asg.location}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {myDeliveries.filter(d => !['delivered', 'completed', 'cancelled'].includes(String(d.status || '').toLowerCase().replace(/\s+/g, '_'))).map(del => (
                                        <div key={`list-del-${del.id}`} className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex items-start gap-4 hover:border-warning/30 transition-all group cursor-pointer" onClick={() => { setSelectedMission(del); setIsMissionModalOpen(true); }}>
                                            <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                                <Truck size={18} className="text-warning" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-black text-warning uppercase tracking-widest truncate">{del.orderId || del.id}</p>
                                                <p className="text-sm font-bold text-white truncate">{del.dropLocation || del.location || 'Destination Point'}</p>
                                                <p className="text-[10px] text-secondary mt-1 truncate">{del.route_distance ? `${del.route_distance} km away` : 'Calculating ETA...'}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {filteredMyAssignments.filter(a => a.status !== 'Completed').length === 0 && myDeliveries.filter(d => !['delivered', 'completed', 'cancelled'].includes(String(d.status || '').toLowerCase().replace(/\s+/g, '_'))).length === 0 && (
                                        <p className="text-sm text-secondary italic col-span-full">No active waypoints on radar.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {activeTab === 'leave' && (
                    <motion.div
                        key="leave"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6 max-w-4xl mx-auto"
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-bold">Leave & Absence Records</h3>
                            {(hasMenuPermission('Leave & Absence', 'can_add') || ['operations', 'procurement', 'logistics', 'inventory', 'concierge', 'staff'].includes(userRole)) && (
                                <button
                                    onClick={() => {
                                        setEditingLeaveRequest(null);
                                        setLeaveFormData({ type: 'Vacation', duration: 'Full Day', hours: 8, start: '', end: '', reason: '' });
                                        setIsLeaveModalOpen(true);
                                    }}
                                    className="btn-primary flex items-center gap-2"
                                >
                                    <Plus size={16} /> Request Absence
                                </button>
                            )}
                        </div>

                        <div className="glass-card p-6">
                            <h4 className="text-sm font-black uppercase tracking-widest text-muted mb-6">My Request History</h4>
                            <div className="space-y-4">
                                {leaveRequests.filter(r => (r.userId && String(r.userId) === String(currentUser?.id)) || r.name === currentUser?.name).map(req => (
                                    <div key={req.id} className="p-4 bg-white/[0.02] border border-border rounded-2xl flex justify-between items-center group hover:border-accent/30 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${req.status === 'Approved' ? 'bg-success/10 text-success' :
                                                req.status === 'Rejected' ? 'bg-danger/10 text-danger' :
                                                    'bg-accent/10 text-accent'
                                                }`}>
                                                <Calendar size={18} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-bold text-white">{req.type} Protocol</p>
                                                    {req.hours && <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-accent">{req.hours}h Hourly</span>}
                                                </div>
                                                <p className="text-[10px] text-muted uppercase font-bold">{req.start} to {req.end}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <div className="text-right hidden sm:block">
                                                <p className="text-[10px] text-muted font-bold uppercase">Decision Status</p>
                                                <p className={`text-xs font-bold ${req.status === 'Approved' ? 'text-success' :
                                                    req.status === 'Rejected' ? 'text-danger' :
                                                        'text-accent'
                                                    }`}>
                                                    {req.status || 'Pending Review'}
                                                </p>
                                            </div>
                                            <StatusBadge status={req.status} />
                                            {(!req.status || req.status === 'Pending' || req.status === 'Pending Review' || req.status.toLowerCase() === 'pending') && (
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setEditingLeaveRequest(req);
                                                            setLeaveFormData({
                                                                type: req.type || 'Vacation',
                                                                duration: req.hours === 4 ? 'Half Day' : 'Full Day',
                                                                hours: req.hours || 8,
                                                                start: req.start || '',
                                                                end: req.end || '',
                                                                reason: req.reason || ''
                                                            });
                                                            setIsLeaveModalOpen(true);
                                                        }}
                                                        className="p-2 bg-white/5 border border-border rounded-xl text-accent hover:bg-accent/10 transition-all"
                                                        title="Edit Leave Request"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            swalConfirm(
                                                                'Delete Request',
                                                                'Are you sure you want to delete this leave request?'
                                                            ).then(async (result) => {
                                                                if (result.isConfirmed) {
                                                                    try {
                                                                        await deleteLeaveRequest(req.id);
                                                                        swalSuccess('Deleted', 'Leave request has been successfully deleted.');
                                                                    } catch (err) {
                                                                        swalError('Error', err.message || 'Could not delete request.');
                                                                    }
                                                                }
                                                            });
                                                        }}
                                                        className="p-2 bg-white/5 border border-danger/40 text-danger hover:bg-danger/10 rounded-xl transition-all"
                                                        title="Delete Leave Request"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {leaveRequests.filter(r => (r.userId && String(r.userId) === String(currentUser?.id)) || r.name === currentUser?.name).length === 0 && (
                                    <p className="text-center py-8 text-secondary italic">No absence records found in the portal.</p>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <Modal
                isOpen={isLeaveModalOpen}
                onClose={() => setIsLeaveModalOpen(false)}
                title={editingLeaveRequest ? "Edit Absence Request" : "Bespoke Absence Request"}
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted uppercase">Absence Category</label>
                            <select
                                className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
                                value={leaveFormData.type}
                                onChange={(e) => setLeaveFormData({ ...leaveFormData, type: e.target.value })}
                            >
                                <option>Sick Leave</option>
                                <option>Personal Leave</option>
                                <option>Vacation</option>
                                <option>Bereavement</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted uppercase">Duration Protocol</label>
                            <select
                                className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
                                value={leaveFormData.duration || 'Full Day'}
                                onChange={(e) => setLeaveFormData({ ...leaveFormData, duration: e.target.value, hours: e.target.value === 'Half Day' ? 4 : 8 })}
                            >
                                <option>Full Day</option>
                                <option>Half Day</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <CustomDatePicker
                                label="Commencement Date"
                                selectedDate={leaveFormData.start}
                                onChange={(date) => setLeaveFormData({ ...leaveFormData, start: date })}
                            />
                        </div>
                        <div className="space-y-1">
                            <CustomDatePicker
                                label="Conclusion Date"
                                selectedDate={leaveFormData.end}
                                onChange={(date) => setLeaveFormData({ ...leaveFormData, end: date })}
                            />
                        </div>
                        <div className="space-y-1 md:col-span-2">
                            <label className="text-[10px] font-bold text-muted uppercase">Reason</label>
                            <textarea
                                className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none resize-none"
                                rows={2}
                                value={leaveFormData.reason || ''}
                                onChange={(e) => setLeaveFormData({ ...leaveFormData, reason: e.target.value })}
                                placeholder="State reason for absence..."
                            />
                        </div>
                    </div>
                    <div className="flex gap-3 justify-end pt-4">
                        <button onClick={() => setIsLeaveModalOpen(false)} className="btn-secondary">Cancel</button>
                        <button
                            onClick={async () => {
                                if (editingLeaveRequest) {
                                    await updateLeaveRequest({
                                        id: editingLeaveRequest.id,
                                        ...leaveFormData
                                    });
                                    swalSuccess('Updated', 'Absence request has been successfully updated.');
                                } else {
                                    await addLeaveRequest({
                                        ...leaveFormData,
                                        name: currentUser.name,
                                        userId: currentUser.id
                                    });
                                    swalSuccess('Submitted', 'Absence request has been successfully submitted.');
                                }
                                setIsLeaveModalOpen(false);
                            }}
                            className="btn-primary"
                        >
                            {editingLeaveRequest ? "Save Changes" : "Submit Requisition"}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Security Protocol Modals */}
            <Modal
                isOpen={isSecurityModalOpen}
                onClose={() => setIsSecurityModalOpen(false)}
                title={securityModalType === 'panic' ? '🚨 EMERGENCY PANIC PROTOCOL' : '🛡️ SECURITY BREACH REPORT'}
            >
                {securityModalType === 'panic' ? (
                    <div className="space-y-6 text-center py-4">
                        <div className="w-24 h-24 bg-danger/10 border-4 border-danger rounded-full flex items-center justify-center mx-auto animate-pulse">
                            <AlertCircle size={48} className="text-danger" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Signal Sent to HQ</h3>
                            <p className="text-secondary text-sm font-medium leading-relaxed">
                                Your current GPS coordinates have been broadcast to all regional units and law enforcement. <br />
                                <span className="text-danger font-bold">Protocol: Maintain current position and await extraction.</span>
                            </p>
                        </div>
                        <div className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between text-left">
                            <div>
                                <p className="text-[10px] font-bold text-muted uppercase tracking-widest leading-tight">Response Time</p>
                                <p className="text-lg font-black text-white italic tracking-tighter"><Clock size={14} className="inline mr-1" /> ~4.2 Minutes</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-bold text-muted uppercase tracking-widest leading-tight">Extraction Unit</p>
                                <p className="text-lg font-black text-accent italic tracking-tighter">Alpha-6</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsSecurityModalOpen(false)}
                            className="w-full py-4 bg-white/5 border border-border rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                        >
                            Acknowledge & Close
                        </button>
                    </div>
                ) : (
                    <div className="space-y-5">
                        <div className="p-4 bg-warning/10 border border-warning/20 rounded-2xl flex items-center gap-4">
                            <Shield size={24} className="text-warning shrink-0" />
                            <p className="text-xs text-warning font-medium leading-tight">Reporting a breach initiates immediate internal audit. Please ensure accuracy in your statement.</p>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-muted uppercase">Incident Type</label>
                                <select
                                    className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-accent outline-none"
                                    value={breachFormData.type}
                                    onChange={(e) => setBreachFormData({ ...breachFormData, type: e.target.value })}
                                >
                                    <option>Unauthorized Person</option>
                                    <option>Asset Discrepancy</option>
                                    <option>Digital Intrusion</option>
                                    <option>Physical Breach</option>
                                    <option>Bespoke Incident</option>
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-muted uppercase">Location Coordinates</label>
                                <div className="relative">
                                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-accent" size={16} />
                                    <input
                                        type="text"
                                        className="w-full bg-background border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm focus:border-accent outline-none"
                                        value={breachFormData.location}
                                        onChange={(e) => setBreachFormData({ ...breachFormData, location: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-muted uppercase">Incident Intelligence</label>
                                <textarea
                                    rows={4}
                                    className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-accent outline-none resize-none"
                                    placeholder="Describe the breach pattern, involved parties, and current status..."
                                    value={breachFormData.detail}
                                    onChange={(e) => setBreachFormData({ ...breachFormData, detail: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => {
                                    setBreachFormData({ type: 'Unauthorized Person', location: '', detail: '' });
                                    setIsSecurityModalOpen(false);
                                }}
                                className="flex-1 py-4 bg-white/5 border border-white/10 text-secondary rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    await reportSecurityEvent({ eventType: 'BREACH', location: breachFormData.location, details: `Type: ${breachFormData.type} | Info: ${breachFormData.detail}` });
                                    setBreachFormData({ type: 'Unauthorized Person', location: '', detail: '' });
                                    setIsSecurityModalOpen(false);
                                    swalSuccess('Report Sent', 'Transmitted to Institutional Security. Audit tracking initialized.');
                                }}
                                className="flex-1 py-4 bg-accent text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-accent/20"
                            >
                                Submit Report
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Mission Details Modal */}
            <Modal
                isOpen={isMissionModalOpen}
                onClose={() => setIsMissionModalOpen(false)}
                title="MISSION INTELLIGENCE DEBRIEF"
            >
                {selectedMission && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl">
                                <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Mission Type</p>
                                <p className="text-sm font-black text-white italic">{selectedMission.mission_type || 'Standard Delivery'}</p>
                            </div>
                            <div className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl">
                                <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Operational ID</p>
                                <p className="text-sm font-black text-accent italic">{selectedMission.orderId || selectedMission.id}</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-start gap-3 p-4 bg-success/5 border border-success/20 rounded-2xl">
                                <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center shrink-0">
                                    <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-muted uppercase tracking-widest">Pickup Requisition</p>
                                    <p className="text-sm font-bold text-white italic">{selectedMission.pickup_location || selectedMission.pickupLocation || 'Central Hub'}</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3 p-4 bg-accent/5 border border-accent/20 rounded-2xl">
                                <MapPin size={18} className="text-accent shrink-0 mt-1" />
                                <div>
                                    <p className="text-[9px] font-black text-muted uppercase tracking-widest">Target Destination</p>
                                    <p className="text-sm font-bold text-white italic">{selectedMission.drop_location || selectedMission.dropLocation || selectedMission.location || 'Client Perimeter'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-3">
                            <p className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                                <ClipboardList size={14} className="text-accent" /> Asset Manifest
                            </p>
                            <div className="space-y-2">
                                {(() => {
                                    let itemsToRender = selectedMission.items;
                                    if (!itemsToRender && selectedMission.package_details) {
                                        if (typeof selectedMission.package_details === 'string' && selectedMission.package_details.startsWith('[')) {
                                            try {
                                                const parsed = JSON.parse(selectedMission.package_details);
                                                if (Array.isArray(parsed)) itemsToRender = parsed;
                                            } catch(e) {}
                                        } else if (Array.isArray(selectedMission.package_details)) {
                                            itemsToRender = selectedMission.package_details;
                                        }
                                    }
                                    if (Array.isArray(itemsToRender) && itemsToRender.length > 0) {
                                        return itemsToRender.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                                                <p className="text-xs font-bold text-white">{item.name || 'Item'}</p>
                                                <p className="text-[10px] font-black text-secondary">x{item.qty || 1}</p>
                                            </div>
                                        ));
                                    }
                                    return (
                                        <p className="text-xs text-secondary leading-relaxed italic">{selectedMission.package_details || selectedMission.item || 'Standard Logistic Unit'}</p>
                                    );
                                })()}
                            </div>
                        </div>

                        {(() => {
                            let rawNotes = selectedMission.delivery_instructions || selectedMission.order_instructions || selectedMission.order_notes || '';
                            let cleanNotes = String(rawNotes).replace(/\[request_meta\].*/g, '').trim();
                            if (!cleanNotes) return null;
                            return (
                                <div className="p-4 bg-warning/5 border border-warning/20 rounded-2xl">
                                    <p className="text-[10px] font-black text-warning uppercase tracking-widest mb-1 flex items-center gap-2">
                                        <AlertCircle size={14} /> Customer delivery instructions
                                    </p>
                                    <p className="text-xs text-secondary leading-relaxed italic whitespace-pre-wrap">
                                        "{cleanNotes}"
                                    </p>
                                </div>
                            );
                        })()}

                        <div className="p-4 bg-accent/5 border border-accent/20 rounded-2xl flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-black text-muted uppercase tracking-widest">Staff Payout (Distance-Based)</p>
                                <p className="text-lg font-black text-accent">
                                    {parseFloat(selectedMission.delivery_fee) > 0
                                        ? `$${parseFloat(selectedMission.delivery_fee).toFixed(2)}`
                                        : 'Pending Admin Setup'}
                                </p>
                                {selectedMission.route_distance && (
                                    <p className="text-[9px] text-muted italic mt-0.5">{selectedMission.route_distance} km route</p>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsMissionModalOpen(false)}
                                className="flex-1 py-4 bg-white/5 border border-white/10 text-secondary rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                            >
                                Close Debrief
                            </button>
                            {!selectedMission.driverId && (
                                <button
                                    onClick={() => {
                                        updateDelivery({
                                            ...selectedMission,
                                            status: 'assigned',
                                            driverId: currentUser?.id,
                                            driver: currentUser?.name
                                        });
                                        setIsMissionModalOpen(false);
                                    }}
                                    className="flex-1 py-4 bg-accent text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] transition-all"
                                >
                                    Accept Mission
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

const TaskCard = ({ asg, onAction }) => {
    const [showProof, setShowProof] = React.useState(false);
    const [proofPhoto, setProofPhoto] = React.useState(null);
    const [proofNotes, setProofNotes] = React.useState('');
    const [gpsStamp] = React.useState(() => {
        const now = new Date();
        return `${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    });

    const handlePhotoChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => setProofPhoto(reader.result);
        reader.readAsDataURL(file);
    };

    const handleSubmitProof = () => {
        if (!proofPhoto) return;
        onAction(asg, 'Completed', { photo: proofPhoto, notes: proofNotes, gps: gpsStamp });
        setShowProof(false);
        setProofPhoto(null);
        setProofNotes('');
    };

    return (
        <>
            <div className="p-5 bg-white/[0.02] border border-border rounded-2xl hover:border-accent/40 transition-all group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-accent/5 blur-3xl rounded-full -mr-12 -mt-12" />
                <div className="flex flex-col gap-4 relative z-10">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-accent/60 uppercase tracking-widest">{asg.id}</span>
                                {asg.type && (
                                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter ${asg.type === 'Pickup' ? 'bg-info/20 text-info' : 'bg-success/20 text-success'}`}>
                                        {asg.type}
                                    </span>
                                )}
                                <StatusBadge status={asg.status} />
                            </div>
                            <h4 className="font-bold text-white text-lg">{asg.task}</h4>
                        </div>
                        {asg.priority === 'Critical' && (
                            <div className="px-2 py-1 bg-danger/10 text-danger rounded text-[8px] font-black uppercase tracking-tighter animate-pulse">Critical</div>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-secondary">
                        <span className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                            <MapPin size={14} className="text-accent" /> {asg.location}
                        </span>
                        <span className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                            <TrendingUp size={14} className="text-info" /> {asg.distance || 'Loading...'}
                        </span>
                    </div>

                    <div className="flex gap-2 mt-2">
                        {(() => {
                            const s = String(asg.status).toLowerCase().replace(/_/g, ' ');
                            if (s === 'pending' || s === 'dispatched' || s === 'pending pickup' || s === 'assigned') {
                                const isAssignedToMe = !!(asg.assigneeId || asg.driverId || asg.assignee || asg.driver);
                                return (
                                    <>
                                        <button
                                            onClick={() => onAction(asg, 'in_progress')}
                                            className="flex-1 py-3 bg-accent text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] transition-all"
                                        >
                                            Accept & Start
                                        </button>
                                        {isAssignedToMe && (
                                            <button
                                                onClick={() => onAction(asg, 'pending', { assigneeId: null, assignee: null, driverId: null, driver: null })}
                                                className="py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest border border-danger/40 text-danger hover:bg-danger/10 transition-all"
                                            >
                                                Decline
                                            </button>
                                        )}
                                    </>
                                );
                            }
                            if (s === 'in progress') {
                                return (
                                    <button
                                        onClick={() => onAction(asg, 'en_route')}
                                        className="flex-1 py-3 bg-info text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] transition-all"
                                    >
                                        Set En Route
                                    </button>
                                );
                            }
                            if (s === 'en route') {
                                return (
                                    <button
                                        onClick={() => setShowProof(true)}
                                        className="flex-1 py-3 bg-success text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                                    >
                                        <Camera size={14} /> Complete Delivery
                                    </button>
                                );
                            }
                            if (s === 'completed') {
                                return (
                                    <div className="flex-1 py-3 bg-white/5 border border-success/20 text-success rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                                        <CheckCircle2 size={14} /> Proof Submitted
                                    </div>
                                );
                            }
                            return null;
                        })()}
                        <button
                            onClick={() => {
                                // We need access to setIsMissionModalOpen and setSelectedMission here.
                                // Since TaskCard is defined outside or doesn't have these props, 
                                // I will pass them or use a callback.
                                onAction(asg, 'view_details');
                            }}
                            className="p-3 bg-white/5 border border-border rounded-xl text-accent hover:bg-accent/10 transition-all"
                            title="View Mission Manifest"
                        >
                            <FileText size={18} />
                        </button>
                        <button
                            onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(asg.location)}`, '_blank')}
                            className="p-3 bg-white/5 border border-border rounded-xl text-white hover:bg-white/10 transition-all"
                        >
                            <Navigation size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Delivery Proof Modal */}
            <AnimatePresence>
                {showProof && (
                    <motion.div
                        className="fixed inset-0 z-[200] flex items-center justify-center p-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        {/* Backdrop */}
                        <motion.div
                            className="absolute inset-0 bg-black/80 backdrop-blur-md"
                            onClick={() => setShowProof(false)}
                        />

                        {/* Panel */}
                        <motion.div
                            className="relative w-full max-w-md bg-sidebar border border-border rounded-3xl shadow-2xl overflow-hidden"
                            initial={{ scale: 0.92, y: 30 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.92, y: 30 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                        >
                            {/* Header */}
                            <div className="px-6 pt-6 pb-4 border-b border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-success/15 border border-success/30 flex items-center justify-center">
                                        <Camera size={16} className="text-success" />
                                    </div>
                                    <div>
                                        <p className="font-black text-white text-sm">Delivery Proof</p>
                                        <p className="text-[10px] text-muted uppercase tracking-widest font-bold">{asg.id} · {asg.task}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowProof(false)}
                                    className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all"
                                >
                                    <X size={14} className="text-secondary" />
                                </button>
                            </div>

                            <div className="p-6 space-y-5">
                                {/* GPS Stamp */}
                                <div className="flex items-center gap-3 bg-accent/5 border border-accent/15 rounded-2xl px-4 py-3">
                                    <ScanLine size={16} className="text-accent flex-shrink-0" />
                                    <div>
                                        <p className="text-[9px] font-black text-accent/70 uppercase tracking-widest">GPS Timestamp</p>
                                        <p className="text-xs font-bold text-white">{gpsStamp} · {asg.location}</p>
                                    </div>
                                </div>

                                {/* Photo Upload */}
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-muted uppercase tracking-widest">Proof Photo <span className="text-danger">*</span></p>
                                    <label
                                        htmlFor={`proof-upload-${asg.id}`}
                                        className="group relative flex flex-col items-center justify-center w-full h-44 rounded-2xl border-2 border-dashed border-border hover:border-accent/50 transition-all cursor-pointer overflow-hidden bg-white/[0.02] hover:bg-white/[0.04]"
                                    >
                                        {proofPhoto ? (
                                            <>
                                                <img src={proofPhoto} alt="Delivery proof" className="absolute inset-0 w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <p className="text-[10px] font-black text-white uppercase tracking-widest">Change Photo</p>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center gap-3 text-secondary">
                                                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-accent/30 group-hover:text-accent transition-all">
                                                    <ImagePlus size={24} />
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-xs font-bold">Tap to upload photo</p>
                                                    <p className="text-[10px] text-muted">JPG, PNG — Max 10MB</p>
                                                </div>
                                            </div>
                                        )}
                                        <input
                                            id={`proof-upload-${asg.id}`}
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            className="hidden"
                                            onChange={handlePhotoChange}
                                        />
                                    </label>
                                </div>

                                {/* Notes */}
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-muted uppercase tracking-widest">Delivery Notes <span className="text-muted font-normal normal-case">(optional)</span></p>
                                    <textarea
                                        rows={3}
                                        placeholder="Left with concierge, signed by guest, package condition…"
                                        className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white placeholder:text-muted/40 focus:border-accent outline-none resize-none transition-all"
                                        value={proofNotes}
                                        onChange={(e) => setProofNotes(e.target.value)}
                                    />
                                </div>

                                {/* Actions */}
                                <div className="flex gap-3 pt-1">
                                    <button
                                        onClick={() => setShowProof(false)}
                                        className="flex-1 py-3 bg-white/5 border border-border text-secondary rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSubmitProof}
                                        disabled={!proofPhoto}
                                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${proofPhoto
                                            ? 'bg-success text-white hover:scale-[1.02] shadow-lg shadow-success/20'
                                            : 'bg-white/5 text-muted cursor-not-allowed'
                                            }`}
                                    >
                                        <CheckCircle2 size={14} /> Confirm Delivery
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default EmployeePortal;
