import React, { useState, useEffect } from 'react';
import { useData } from '../../context/GlobalDataContext';
import { Calendar, Check, X as CloseIcon, Search, Clock, User, Plus, Edit2, Trash2 } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';
import { normalizeRole } from '../../utils/authUtils';
import Modal from '../../components/Modal';
import CustomDatePicker from '../../components/CustomDatePicker';
import { swalSuccess, swalError, swalConfirm } from '../../utils/swal';

const LeaveManagement = () => {
  const {
    leaveRequests,
    fetchLeaveRequests,
    addLeaveRequest,
    updateLeaveRequest,
    deleteLeaveRequest,
    fetchStaff,
    users,
    currentUser
  } = useData();

  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveFormData, setLeaveFormData] = useState({ type: 'Vacation', duration: 'Full Day', hours: 8, start: '', end: '', reason: '' });
  const [editingLeaveRequest, setEditingLeaveRequest] = useState(null);

  const userRole = normalizeRole(currentUser?.role);
  const isClientAdmin = ['client', 'saas_client'].includes(userRole);

  useEffect(() => {
    fetchStaff();
    fetchLeaveRequests();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchLeaveRequests();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const isStaffOnly = userRole === 'staff';
  const myRequests = leaveRequests.filter(r => !isStaffOnly || r.userId === currentUser?.id);

  const filtered = myRequests.filter(r => {
    const matchesFilter = filter === 'all' || r.status?.toLowerCase() === filter;
    const matchesSearch = !searchTerm ||
      r.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.type?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const stats = {
    total: myRequests.length,
    pending: myRequests.filter(r => r.status?.toLowerCase() === 'pending').length,
    approved: myRequests.filter(r => r.status?.toLowerCase() === 'approved').length,
    rejected: myRequests.filter(r => r.status?.toLowerCase() === 'rejected').length,
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leave & Absence</h1>
          <p className="text-secondary mt-1">
            {isClientAdmin ? 'Submit and track your absence requests.' : 'Review and manage staff leave requests.'}
          </p>
        </div>
        {(isClientAdmin || ['superadmin', 'admin', 'operations', 'procurement', 'logistics', 'inventory', 'concierge', 'staff'].includes(userRole)) && (
          <button
            onClick={() => {
              setEditingLeaveRequest(null);
              setLeaveFormData({ type: 'Vacation', duration: 'Full Day', hours: 8, start: '', end: '', reason: '', userId: '', name: '' });
              setIsLeaveModalOpen(true);
            }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={16} /> {isClientAdmin ? 'Request Absence' : 'Request Leave'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Requests', val: stats.total, color: 'text-white', bg: 'bg-white/5 border-white/10' },
          { label: 'Pending Review', val: stats.pending, color: 'text-warning', bg: 'bg-warning/5 border-warning/20' },
          { label: 'Approved', val: stats.approved, color: 'text-success', bg: 'bg-success/5 border-success/20' },
          { label: 'Rejected', val: stats.rejected, color: 'text-danger', bg: 'bg-danger/5 border-danger/20' },
        ].map((s, i) => (
          <div key={i} className={`p-4 rounded-2xl border ${s.bg}`}>
            <p className="text-[10px] font-bold text-muted uppercase tracking-widest">{s.label}</p>
            <p className={`text-2xl font-black mt-1 ${s.color}`}>{s.val}</p>
          </div>
        ))}
      </div>

      <div className="glass-card p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
            <input
              type="text"
              placeholder="Search by name or leave type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-background border border-border rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-accent"
            />
          </div>
          <div className="flex bg-black/40 rounded-xl p-1 border border-white/5 overflow-x-auto">
            {['all', 'pending', 'approved', 'rejected'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${filter === f
                  ? 'bg-accent text-black shadow-lg'
                  : 'text-muted hover:text-white hover:bg-white/5'
                  }`}
              >
                {f === 'all' ? 'All' : f} {f === 'pending' && stats.pending > 0 ? `(${stats.pending})` : ''}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Calendar size={40} className="mx-auto text-muted mb-3 opacity-20" />
              <p className="text-sm text-secondary italic">No leave requests found.</p>
            </div>
          ) : (
            filtered.map(req => (
              <div key={req.id} className="p-4 bg-white/[0.02] border border-border rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-white/10 transition-all">
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center text-accent shrink-0">
                    <User size={20} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm text-white">{req.name}</h4>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="px-2 py-0.5 rounded-md bg-white/5 text-[10px] font-bold text-accent uppercase">{req.type || req.leave_type}</span>
                      <span className="text-[10px] text-secondary flex items-center gap-1">
                        <Clock size={10} /> {req.start || req.start_date} → {req.end || req.end_date}
                      </span>
                    </div>
                    {req.reason && <p className="text-[10px] text-muted italic mt-1 line-clamp-1">"{req.reason}"</p>}
                  </div>
                </div>
                <div className="flex items-center justify-between w-full md:w-auto gap-3">
                  <StatusBadge status={req.status} />
                  {!isStaffOnly && req.userId !== currentUser?.id && (req.status === 'Pending' || req.status === 'pending') && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateLeaveRequest({ ...req, status: 'approved' })}
                        className="p-2.5 bg-success/20 text-success rounded-lg hover:bg-success/40 transition-all border border-success/10"
                        title="Approve"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={() => updateLeaveRequest({ ...req, status: 'rejected' })}
                        className="p-2.5 bg-danger/20 text-danger rounded-lg hover:bg-danger/40 transition-all border border-danger/10"
                        title="Reject"
                      >
                        <CloseIcon size={16} />
                      </button>
                    </div>
                  )}
                  {(isClientAdmin || ['superadmin', 'admin', 'operations', 'staff'].includes(userRole)) && (req.status === 'Pending' || req.status === 'pending') && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingLeaveRequest(req);
                          setLeaveFormData({
                            type: req.type || 'Vacation',
                            duration: req.hours === 4 ? 'Half Day' : 'Full Day',
                            hours: req.hours || 8,
                            start: req.start || '',
                            end: req.end || '',
                            reason: req.reason || '',
                            userId: req.userId || '',
                            name: req.name || ''
                          });
                          setIsLeaveModalOpen(true);
                        }}
                        className="p-2.5 bg-white/5 border border-border rounded-lg text-accent hover:bg-accent/10 transition-all"
                        title="Edit Leave Request"
                      >
                        <Edit2 size={16} />
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
                        className="p-2.5 bg-white/5 border border-danger/40 text-danger hover:bg-danger/10 rounded-lg transition-all"
                        title="Delete Leave Request"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      {(isClientAdmin || ['superadmin', 'admin', 'operations', 'procurement', 'logistics', 'inventory', 'concierge', 'staff'].includes(userRole)) && (
        <Modal
          isOpen={isLeaveModalOpen}
          onClose={() => setIsLeaveModalOpen(false)}
          title={editingLeaveRequest ? (isClientAdmin ? "Edit Absence Request" : "Edit Leave Request") : (isClientAdmin ? "Bespoke Absence Request" : "Submit Leave Request")}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-bold text-muted uppercase">Request For (Employee)</label>
                <select
                  className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
                  value={leaveFormData.userId || currentUser?.id || ''}
                  onChange={(e) => {
                    const uId = Number(e.target.value);
                    const selected = (users || []).find(u => u.id === uId);
                    setLeaveFormData({
                      ...leaveFormData,
                      userId: uId,
                      name: selected?.name || selected?.fullName || '',
                      tenantId: selected?.tenantId || currentUser?.tenantId || currentUser?.company_id
                    });
                  }}
                >
                  <option value={currentUser?.id}>{currentUser?.name} (Me)</option>
                  {(users || []).filter(u => u.id !== currentUser?.id).map(u => (
                    <option key={u.id} value={u.id}>{u.name || u.fullName} ({u.role?.name || u.role || 'User'})</option>
                  ))}
                </select>
              </div>
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
                  try {
                    if (editingLeaveRequest) {
                      await updateLeaveRequest({
                        id: editingLeaveRequest.id,
                        ...leaveFormData
                      });
                      swalSuccess('Updated', 'Absence request has been successfully updated.');
                    } else {
                      await addLeaveRequest({
                        ...leaveFormData,
                        name: currentUser?.name,
                        userId: currentUser?.id
                      });
                      swalSuccess('Submitted', 'Absence request has been successfully submitted.');
                    }
                  } catch (err) {
                    swalError('Error', err.message || 'Submission failed.');
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
      )}
    </div>
  );
};

export default LeaveManagement;
