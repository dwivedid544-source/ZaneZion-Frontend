// Operations Analytics & Command Center
import React, { useState } from 'react';
import KpiCard from '../../components/KpiCard';
import StatusBadge from '../../components/StatusBadge';
import ProgressBar from '../../components/ProgressBar';
import ProjectModal from '../../components/ProjectModal';
import {
  BarChart3, Calendar, Clock, MapPin, Users,
  Package, Briefcase, Truck, CheckCircle2,
  RefreshCcw, Timer, MoreVertical, Eye, Edit2, Trash2, Plus,
  Terminal, Activity
} from 'lucide-react';
import { useData } from '../../context/GlobalDataContext';
import Modal from '../../components/Modal';
import { Link } from 'react-router-dom';
import CustomDatePicker from '../../components/CustomDatePicker';
import { motion, AnimatePresence } from 'framer-motion';

const OperationsDashboard = () => {

  const { 
    projects, addProject, deliveries, logs, teams, setTeams, users, 
    addStaffAssignment, staffAssignments, dashboardStats,
    fetchProjects, fetchDeliveries, fetchSupportingDocs, fetchStaff, fetchClients, fetchDashboardStats
  } = useData();

  React.useEffect(() => {
    // Targeted fetches for Operations Dashboard
    const loadOpsData = async () => {
        await Promise.all([
            fetchProjects(),
            fetchDeliveries(),
            fetchSupportingDocs(),
            fetchStaff(),
            fetchClients(),
            fetchDashboardStats()
        ]);
    };
    loadOpsData();
  }, [fetchProjects, fetchDeliveries, fetchSupportingDocs, fetchStaff, fetchClients, fetchDashboardStats]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskData, setTaskData] = useState({ task: '', location: '', assignee: '', assigneeId: '', priority: 'Normal', requestDate: new Date().toISOString().split('T')[0], dueDate: new Date().toISOString().split('T')[0] });
  const [activeTab, setActiveTab] = useState('command'); // 'command', 'coordination'

  // --- Rapid Deployment Action ---
  const handleAssignBackup = () => {
    const backupId = `TM-${Math.floor(50 + Math.random() * 50)}`;
    setTeams(prev => [...prev, {
      id: backupId,
      team: 'Special Ops Team',
      lead: 'Officer Bond',
      location: 'Mobile Support',
      members: 5,
      status: 'Active'
    }]);
  };

  const handleSaveProject = (formData) => {
    addProject({
      name: formData.projectName,
      client: formData.client,
      start: formData.startDate,
      location: formData.location || 'Pending',
      status: formData.status,
      deliveryType: formData.deliveryType || 'Road'
    });
    setIsModalOpen(false);
  };

  const activeProjectsCount = dashboardStats.activeProjects ?? projects.filter(p => p.status === 'Active').length;
  const activeDeliveriesCount = dashboardStats.pendingDeliveriesCount ?? deliveries.filter(d => d.status !== 'Delivered').length;
  const missionSuccessRate = dashboardStats.missionSuccessRate ?? (projects.length > 0
    ? ((projects.filter(p => p.status === 'Fulfilled' || p.status === 'Completed').length / projects.length) * 100).toFixed(1)
    : "100");

  const eventProgress = projects.filter(p => p.status === 'Active').slice(0, 3).map(p => ({
    task: p.name,
    progress: p.progress || 35, // Defaulting if not specified
    status: p.status
  }));

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-white italic uppercase mb-1">Operations Command Center</h1>
          <p className="text-secondary text-[10px] md:text-xs mt-1 font-black uppercase tracking-[0.2em] opacity-70">Real-time oversight of events, projects, and logistics.</p>
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full lg:w-auto">
          <div className="w-full sm:w-40 shrink-0">
            <CustomDatePicker
              selectedDate={new Date().toISOString().split('T')[0]}
              onChange={() => { }}
            />
          </div>
          <div className="flex gap-2 sm:gap-3 flex-1 sm:flex-none">
            <button
              className="btn-secondary flex-1 sm:flex-none flex items-center justify-center gap-2 h-11 text-[10px] sm:text-xs px-4"
              onClick={() => setIsTaskModalOpen(true)}
            >
              <Plus size={16} /> <span className="truncate">Assign Task</span>
            </button>
            <button
              className="btn-primary flex-1 sm:flex-none flex items-center justify-center gap-2 h-11 text-[10px] sm:text-xs px-4"
              onClick={() => setIsModalOpen(true)}
            >
              <Plus size={16} /> <span className="truncate">New Project</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sleek Tab Switcher */}
      <div className="flex items-center gap-4 border-b border-border mb-6">
        <button
          onClick={() => setActiveTab('command')}
          className={`pb-4 px-2 text-[10px] sm:text-sm font-black uppercase tracking-widest transition-all relative ${activeTab === 'command' ? 'text-accent' : 'text-muted hover:text-white'}`}
        >
          <div className="flex items-center gap-2">
            <Terminal size={16} /> Live Command
          </div>
          {activeTab === 'command' && <motion.div layoutId="tab-line" className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />}
        </button>
        <button
          onClick={() => setActiveTab('coordination')}
          className={`pb-4 px-2 text-[10px] sm:text-sm font-black uppercase tracking-widest transition-all relative ${activeTab === 'coordination' ? 'text-accent' : 'text-muted hover:text-white'}`}
        >
          <div className="flex items-center gap-2">
            <Activity size={16} /> Coordination Hub
          </div>
          {activeTab === 'coordination' && <motion.div layoutId="tab-line" className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'command' ? (
          <motion.div
            key="command"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Ongoing Projects" value={activeProjectsCount.toString()} change="+2%" type="increase" icon={Briefcase} />
              <KpiCard label="Active Teams" value={teams.length.toString()} change="0" type="stable" icon={Users} />
              <KpiCard label="Upcoming Deliveries" value={activeDeliveriesCount.toString()} change="-1%" type="decrease" icon={Truck} />
              <KpiCard label="Success Rate" value={`${missionSuccessRate}%`} change="+0.5%" type="increase" icon={CheckCircle2} />
            </div>

            {/* Live Mission Control - Responsive pass */}
            <div className="glass-card p-4 sm:p-6 border-accent/10">
              <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                <Terminal className="text-accent" size={20} /> Live Mission Monitor
              </h3>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="w-full min-w-[700px] sm:min-w-0">
                  <thead>
                    <tr className="text-left text-[10px] text-muted font-black uppercase border-b border-white/5">
                      <th className="pb-4 px-4">Mission ID</th>
                      <th className="pb-4 px-4">Task Detail</th>
                      <th className="pb-4 px-4">Assignee</th>
                      <th className="pb-4 px-4">Location</th>
                      <th className="pb-4 px-4">Priority</th>
                      <th className="pb-4 px-4">Live Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {staffAssignments.slice(0, 8).map((asg, idx) => (
                      <tr key={idx} className="text-xs group hover:bg-white/[0.02] transition-colors">
                        <td className="py-4 px-4 font-mono text-[9px] text-accent font-bold tracking-tight">{asg.id}</td>
                        <td className="py-4 px-4 font-bold text-white">{asg.task}</td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-[9px] font-bold text-secondary border border-white/5 uppercase shrink-0">
                              {asg.assignee?.split(' ').map(n => n[0]).join('') || '?'}
                            </div>
                            <span className="truncate max-w-[120px]">{asg.assignee}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-secondary/80 font-medium">{asg.location}</td>
                        <td className="py-4 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-tight shadow-sm ${asg.priority === 'Critical' ? 'bg-danger/20 text-danger border border-danger/10' :
                            asg.priority === 'High' ? 'bg-warning/20 text-warning border border-warning/10' : 'bg-info/10 text-info border border-info/10'
                            }`}>
                            {asg.priority}
                          </span>
                        </td>
                        <td className="py-4 px-4"><StatusBadge status={asg.status} /></td>
                      </tr>
                    ))}
                    {staffAssignments.length === 0 && (
                      <tr>
                        <td colSpan="6" className="py-12 text-center text-[10px] text-muted font-black uppercase tracking-widest italic opacity-40">No active missions in queue.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Active Projects Widget */}
            <div className="glass-card p-6 border-accent/5">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black text-white italic uppercase tracking-tighter">Strategic Projects</h3>
                <Link to="/dashboard/projects" className="text-xs text-accent font-black uppercase tracking-widest hover:underline">View All</Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projects.slice(0, 4).map((prj, idx) => (
                  <div key={idx} className="p-4 bg-white/[0.02] border border-border rounded-xl hover:bg-white/[0.04] transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${prj.status === 'Cancelled' ? 'bg-danger/20 text-danger' : 'bg-accent/20 text-accent'}`}>
                        <Briefcase size={20} />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-sm">{prj.name}</h4>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-[10px] text-secondary">{prj.client}</p>
                          <StatusBadge status={prj.status} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="coordination"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Upcoming Deliveries Widget */}
              <div className="glass-card p-6 border-accent/10">
                <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                  <Clock className="text-accent" size={20} /> Coordination Dispatch
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-xs text-muted font-bold uppercase border-b border-border/50">
                        <th className="pb-4">Item</th>
                        <th className="pb-4">Time</th>
                        <th className="pb-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {deliveries.slice(0, 5).map((del, idx) => (
                        <tr key={idx} className="text-sm group">
                          <td className="py-4 font-bold">{del.item}</td>
                          <td className="py-4 text-accent">{del.eta || del.time || 'TBD'}</td>
                          <td className="py-4"><StatusBadge status={del.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="glass-card p-6 text-white border-accent/5">
                <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                  <Users className="text-accent" size={20} /> Team Deployment
                </h3>
                <div className="space-y-3">
                  {teams.map((team, idx) => (
                    <div key={idx} className="p-4 bg-background border border-border rounded-xl group hover:border-accent/40 transition-all flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                          <Users size={16} />
                        </div>
                        <div>
                          <h5 className="font-bold text-sm">{team.lead}</h5>
                          <p className="text-[10px] text-muted uppercase">{team.team}</p>
                        </div>
                      </div>
                      <StatusBadge status={team.status} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Event Progress Widget */}
            <div className="glass-card p-6 border-accent/5">
              <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6">Mission Progress Tracker</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {eventProgress.map((step, idx) => (
                  <div key={idx} className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold">{step.task}</span>
                      <span className="text-xs font-bold text-muted">{step.progress}%</span>
                    </div>
                    <ProgressBar progress={step.progress} />
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveProject}
      />

      <Modal
        isOpen={isLogsOpen}
        onClose={() => setIsLogsOpen(false)}
        title="Command Center Live logs"
      >
        <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
          {logs.map((log) => (
            <div key={log.id} className="p-3 bg-white/[0.02] border border-border rounded-lg flex gap-4">
              <div className={`mt-1 p-1.5 rounded-md ${log.type === 'system' ? 'bg-primary/20 text-primary' :
                log.type === 'logistics' ? 'bg-accent/20 text-accent' :
                  'bg-success/20 text-success'
                }`}>
                {log.type === 'system' ? <Terminal size={14} /> : <Activity size={14} />}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted">{log.action}</span>
                  <span className="text-[10px] text-muted">{log.time}</span>
                </div>
                <p className="text-sm text-secondary leading-relaxed">{log.detail}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 pt-6 border-t border-border flex justify-end">
          <button onClick={() => setIsLogsOpen(false)} className="btn-secondary">Close Monitor</button>
        </div>
      </Modal>

      <Modal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        title="Institutional Task Delegation"
      >
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest">Task / Mission Name</label>
              <input
                type="text"
                placeholder="e.g. Deliver Vintage Wine to Suite 402"
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-accent outline-none"
                value={taskData.task}
                onChange={(e) => setTaskData({ ...taskData, task: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">Target Location</label>
                <input
                  type="text"
                  placeholder="e.g. Marina Port / Suite 101"
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-accent outline-none"
                  value={taskData.location}
                  onChange={(e) => setTaskData({ ...taskData, location: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">Request Date</label>
                <input
                  type="text"
                  value={taskData.requestDate}
                  disabled
                  className="w-full bg-background/50 border border-border rounded-xl px-4 py-3 text-sm text-muted focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <CustomDatePicker
                  label="Due Date"
                  selectedDate={taskData.dueDate}
                  onChange={(date) => setTaskData({ ...taskData, dueDate: date })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">Assign To (Active Staff)</label>
                <select
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-accent outline-none appearance-none"
                  onChange={(e) => {
                    const selectedUser = users.find(u => u.id.toString() === e.target.value);
                    setTaskData({
                      ...taskData,
                      assigneeId: e.target.value,
                      assignee: selectedUser ? selectedUser.name : 'Operational Queue'
                    });
                  }}
                  value={taskData.assigneeId}
                >
                  <option value="">Operational Queue (Unassigned)</option>
                  {users.filter(u => u.role !== 'Client').map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({String(u.role?.name || u.role || '')})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">Priority Tier</label>
                <select
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-accent outline-none appearance-none"
                  value={taskData.priority}
                  onChange={(e) => setTaskData({ ...taskData, priority: e.target.value })}
                >
                  <option>Normal</option>
                  <option>High</option>
                  <option>Critical</option>
                  <option>Immediate</option>
                </select>
              </div>

              <div className="flex flex-col gap-3 justify-center pt-2">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-border bg-background text-accent focus:ring-accent"
                    checked={taskData.isDelivery}
                    onChange={(e) => setTaskData({ ...taskData, isDelivery: e.target.checked })}
                  />
                  <span className="text-[10px] font-bold text-secondary uppercase group-hover:text-white transition-colors">Register as Logistics Delivery</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-border bg-background text-accent focus:ring-accent"
                    checked={taskData.isOrder}
                    onChange={(e) => setTaskData({ ...taskData, isOrder: e.target.checked })}
                  />
                  <span className="text-[10px] font-bold text-secondary uppercase group-hover:text-white transition-colors">Register as Bespoke Private Order</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-6 border-t border-border/50">
            <button
              onClick={() => {
                setIsTaskModalOpen(false);
                setTaskData({ task: '', location: '', assignee: '', assigneeId: '', priority: 'Normal', isDelivery: false, isOrder: false, requestDate: new Date().toISOString().split('T')[0], dueDate: new Date().toISOString().split('T')[0] });
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                addStaffAssignment(taskData);
                setIsTaskModalOpen(false);
                setTaskData({ task: '', location: '', assignee: '', assigneeId: '', priority: 'Normal', isDelivery: false, isOrder: false, requestDate: new Date().toISOString().split('T')[0], dueDate: new Date().toISOString().split('T')[0] });
              }}
              className="btn-primary px-10"
            >
              Delegate Mission
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default OperationsDashboard;
