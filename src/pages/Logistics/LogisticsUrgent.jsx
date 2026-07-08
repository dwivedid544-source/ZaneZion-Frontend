import React, { useState } from 'react';
import { swalSuccess, swalError, swalWarning, swalInfo, swalConfirm, swalCredentials, swalCopied } from '../../utils/swal';
import Table from '../../components/Table';
import Modal from '../../components/Modal';
import {
  Plus, Search, AlertCircle, Clock,
  ShieldAlert, Zap, User, MapPin,
  MessageSquare, Flame
} from 'lucide-react';

import { useData } from '../../context/GlobalDataContext';
import { normalizeRole } from '../../utils/authUtils';

const Urgent = () => {
  const { urgentTasks = [], fetchUrgentTasks, addUrgentTask, updateUrgentTask, deleteUrgentTask, hasMenuPermission, currentUser } = useData();
  React.useEffect(() => {
    if (fetchUrgentTasks) fetchUrgentTasks();
  }, [fetchUrgentTasks]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('view');
  const [selectedTask, setSelectedTask] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({ id: '', task: '', time: '', priority: 'Critical', location: '', assignee: 'Pending' });

  const filteredTasks = (urgentTasks || []).filter(t =>
    t.task?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(t.id).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAction = (type, task) => {
    setSelectedTask(task);
    setModalType(type);
    setFormData(task.id ? { ...task } : { id: '', task: '', time: '', priority: 'Critical', location: '', assignee: 'Pending' });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (modalType === 'add') {
      addUrgentTask(formData);
    } else if (modalType === 'edit') {
      updateUrgentTask({ ...selectedTask, ...formData });
    }
    setIsModalOpen(false);
  };

  const handleDelete = () => {
    deleteUrgentTask(selectedTask.id);
    setIsModalOpen(false);
  };

  const columns = [
    { header: "Alert ID", accessor: "id" },
    { header: "Urgent Mission", accessor: "task" },
    { header: "Time Left", accessor: "time" },
    { header: "Priority", accessor: "priority" },
    { header: "Target Area", accessor: "location" },
    { header: "Responder", accessor: "assignee" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-white italic uppercase flex items-center gap-3">
            <Flame size={32} className="text-danger animate-pulse" />
            Critical Operations
          </h1>
          <p className="text-secondary text-[10px] md:text-xs mt-1 font-black uppercase tracking-[0.2em] opacity-70 leading-relaxed">High-priority Logistics missions requiring immediate intervention.</p>
        </div>
        {hasMenuPermission('Urgent', 'can_add') && (
          <button
            className="bg-danger text-white py-4 px-8 rounded-2xl flex items-center justify-center gap-3 font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl shadow-danger/20 hover:scale-[1.02] transition-all border border-danger/30 active:scale-95 w-full lg:w-auto"
            onClick={() => handleAction('add', {})}
          >
            <Zap size={16} /> Force Dispatch Protocol
          </button>
        )}
      </div>

      <div className="glass-card p-4 sm:p-6 border-danger/10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
          <div className="relative w-full max-w-md group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-danger/50 transition-colors" size={18} />
            <input
              type="text"
              placeholder="Filter active emergencies..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/[0.02] border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:outline-none focus:border-danger/30 italic font-medium transition-all"
            />
          </div>
          <div className="flex items-center gap-3 px-5 py-3 bg-danger/5 border border-danger/20 rounded-2xl shrink-0 w-full lg:w-auto">
            <ShieldAlert size={16} className="text-danger animate-pulse" />
            <span className="text-[10px] font-black text-danger uppercase tracking-[0.2em]">3 Critical Incidents Detected</span>
          </div>
        </div>

        <Table
          columns={columns}
          data={filteredTasks}
          actions={true}
          onView={(item) => handleAction('view', item)}
          onEdit={(item) => handleAction('edit', item)}
          onDelete={(item) => handleAction('delete', item)}
          canEdit={hasMenuPermission('Urgent', 'can_edit')}
          canDelete={hasMenuPermission('Urgent', 'can_delete')}
        />
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          modalType === 'view' ? 'Incident Review' :
            modalType === 'edit' ? 'Modify Response' :
              modalType === 'delete' ? 'Dismiss Alert' : 'Log New Urgent Mission'
        }
      >
        {selectedTask && (
          <div className="space-y-6">
            {modalType === 'delete' ? (
              <div className="space-y-6">
                <p className="text-secondary text-sm italic font-medium leading-relaxed">Are you sure you want to dismiss alert <span className="text-white font-black italic">{selectedTask.id}</span>? Unresolved high-priority missions may compromise distribution integrity.</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-end pt-4">
                  <button onClick={() => setIsModalOpen(false)} className="py-3 px-8 text-[10px] font-black uppercase text-secondary hover:text-white transition-all">Keep Active</button>
                  <button onClick={handleDelete} className="py-3 px-8 bg-danger/10 border border-danger/20 text-danger rounded-xl text-[10px] font-black uppercase hover:bg-danger hover:text-white transition-all shadow-xl shadow-danger/5">Dismiss Alert</button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                  {[
                    { label: 'Mission ID', value: formData.id, field: 'id', disabled: modalType !== 'add' },
                    { label: 'High Priority Responder', value: formData.assignee, field: 'assignee' },
                    { label: 'Mission Title', value: formData.task, field: 'task', fullWidth: true },
                    { label: 'Target Coordinates', value: formData.location, field: 'location' },
                    { label: 'Priority Tier', type: 'select', options: ['Critical', 'High', 'Medium', 'Low'], field: 'priority', accent: true },
                    { label: 'Time To Expiration', value: formData.time, field: 'time' }
                  ].map((input, i) => (
                    <div key={i} className={`space-y-2 ${input.fullWidth ? 'sm:col-span-2' : ''}`}>
                      <label className={`text-[9px] font-black uppercase tracking-widest ml-1 ${input.accent ? 'text-accent' : 'text-muted'}`}>{input.label}</label>
                      {input.type === 'select' ? (
                        <select
                          className="w-full bg-white/[0.02] border border-white/10 rounded-2xl px-4 py-4 text-xs sm:text-sm focus:border-danger/40 outline-none font-black text-white"
                          value={formData[input.field]}
                          onChange={(e) => setFormData({ ...formData, [input.field]: e.target.value })}
                          disabled={modalType === 'view'}
                        >
                          {input.options.map(opt => <option key={opt} value={opt} className="bg-sidebar">{opt}</option>)}
                        </select>
                      ) : (
                        <input
                          type="text"
                          className="w-full bg-white/[0.02] border border-white/10 rounded-2xl px-4 py-4 text-xs sm:text-sm focus:border-danger/40 outline-none font-black text-white"
                          value={formData[input.field]}
                          onChange={(e) => setFormData({ ...formData, [input.field]: e.target.value })}
                          disabled={input.disabled || modalType === 'view'}
                        />
                      )}
                    </div>
                  ))}
                </div>

                {modalType === 'view' && (
                  <div className="space-y-6">
                    <div className="p-5 bg-danger/5 border border-danger/20 rounded-2xl flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-danger/10 flex items-center justify-center text-danger group-hover:scale-110 transition-transform">
                          <Clock size={20} />
                        </div>
                        <div>
                          <p className="text-[8px] font-black text-danger uppercase tracking-widest">Expiration Protocol</p>
                          <h4 className="text-sm font-black text-white italic">{selectedTask.time} Remaining</h4>
                        </div>
                      </div>
                      <span className="bg-danger text-black text-[9px] font-black px-3 py-1.5 rounded-xl animate-pulse uppercase tracking-widest">Urgent</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        onClick={() => swalInfo('Secure Comms', 'Initializing channel with responder and dispatch.')}
                        className="flex items-center justify-center gap-3 py-4 bg-white/[0.02] border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-muted hover:text-white hover:bg-white/[0.05] transition-all"
                      >
                        <MapPin size={16} className="text-danger" /> Deploy Unit Directions
                      </button>
                      <button
                        onClick={() => swalInfo('Chat', 'Opening operational chat for incident ' + selectedTask.id)}
                        className="flex items-center justify-center gap-3 py-4 bg-white/[0.02] border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-muted hover:text-info hover:bg-info/5 transition-all"
                      >
                        <MessageSquare size={16} className="text-info" /> Incident Comms
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 justify-end pt-8 border-t border-white/5">
                  <button onClick={() => setIsModalOpen(false)} className="order-2 sm:order-1 py-4 px-10 text-[10px] font-black uppercase tracking-[0.2em] text-muted hover:text-white transition-all">{modalType === 'view' ? 'Close Review' : 'Abort Entry'}</button>
                  {modalType !== 'view' && <button onClick={handleSave} className="order-1 sm:order-2 py-4 px-12 bg-danger text-white shadow-2xl shadow-danger/20 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:scale-[1.02] transition-all">Synchronize Alert</button>}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Urgent;
