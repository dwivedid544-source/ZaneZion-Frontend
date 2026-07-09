import React, { useState } from 'react';
import Table from '../../components/Table';
import Modal from '../../components/Modal';
import { Coffee, Plus, Search, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { useData } from '../../context/GlobalDataContext';

const GuestRequests = () => {
    const { guestRequests = [], addGuestRequest, updateGuestRequest, deleteGuestRequest, hasMenuPermission, currentUser } = useData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState('view');
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState({ guest: '', request: '', time: '', date: new Date().toISOString().split('T')[0], priority: 'Medium', status: 'Pending' });

    const userRole = String(currentUser?.role?.name || currentUser?.role || '').toLowerCase().replace(/\s+/g, '_');
    const isCustomer = ['customer', 'saas_client', 'client'].includes(userRole);
    const isConciergeOrAdmin = ['concierge', 'admin', 'super_admin', 'superadmin'].includes(userRole);

    // Customer: backend already filters by company_id, show all. Admin/concierge: show all too.
    const filteredRequests = guestRequests.filter(req =>
        req.guest?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.request?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(req.id).toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleAction = (type, req) => {
        setSelectedRequest(req);
        setModalType(type);
        setFormData((req && (req.id !== undefined && req.id !== null)) ? { ...req } : {
            guest: isCustomer ? (currentUser?.name || '') : '',
            requestedBy: isCustomer ? (currentUser?.name || '') : '',
            request: '', time: '', date: new Date().toISOString().split('T')[0], priority: 'Medium', status: 'Pending'
        });
        setIsModalOpen(true);
    };

    const handleSave = () => {
        if (modalType === 'add') {
            addGuestRequest(formData);
        } else if (modalType === 'edit') {
            updateGuestRequest({ ...selectedRequest, ...formData });
        }
        setIsModalOpen(false);
    };

    const handleDelete = () => {
        deleteGuestRequest(selectedRequest.id);
        setIsModalOpen(false);
    };

    const columns = [
        { header: "Request ID", accessor: "id" },
        { header: "Guest / Suite", accessor: "guest" },
        { header: "Requested By", accessor: "requestedBy" },
        {
            header: "Requirement",
            accessor: "request",
            render: (row) => (
                <span
                    className="text-sm text-white/90 leading-snug block"
                    style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        maxWidth: '320px',
                        whiteSpace: 'normal',
                        wordBreak: 'break-word',
                    }}
                    title={row.request}
                >
                    {row.request}
                </span>
            )
        },
        { header: "Target Time", accessor: "time" },
        {
            header: "Priority",
            accessor: "priority",
            render: (row) => {
                const p = (row.priority || '').toLowerCase();
                return (
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${p === 'high' || p === 'immediate' ? 'bg-danger/20 text-danger' : p === 'medium' ? 'bg-warning/20 text-warning' : 'bg-white/10 text-muted'}`}>
                        {row.priority}
                    </span>
                );
            }
        },
        {
            header: "Status",
            accessor: "status",
            render: (row) => {
                const s = (row.status || '').toLowerCase();
                return (
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${s === 'completed' ? 'bg-success/20 text-success' : s === 'in progress' || s === 'in_progress' ? 'bg-accent/20 text-accent' : 'bg-warning/20 text-warning'}`}>
                        {row.status}
                    </span>
                );
            }
        },
    ];

    return (
        <div className="space-y-8">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 px-0 sm:px-2">
                <div className="min-w-0">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">Concierge Requests</h1>
                    <p className="text-secondary mt-1 text-sm">Managing high-priority guest requirements and lifestyle services.</p>
                </div>
                <div className="flex flex-wrap sm:flex-row gap-3 w-full xl:w-auto">
                    <div className="relative flex-1 sm:flex-none sm:w-64">
                        <input
                            type="text"
                            placeholder="Search requests..."
                            className="bg-white/5 border border-border rounded-xl py-2 px-10 text-sm focus:outline-none focus:border-accent w-full"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
                    </div>
                    {(isCustomer || hasMenuPermission('Guest Requests', 'can_add')) && (
                        <button className="btn-primary flex items-center gap-2" onClick={() => handleAction('add', {})}>
                            <Plus size={16} /> Log Request
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="glass-card p-6 border-accent/10">
                    <p className="text-xs text-secondary uppercase font-bold mb-1">Total Requests</p>
                    <div className="flex items-center gap-2">
                        <span className="text-3xl font-bold">{filteredRequests.length}</span>
                        <span className="text-xs text-secondary">Logged</span>
                    </div>
                </div>
                <div className="glass-card p-6 border-accent/10">
                    <p className="text-xs text-secondary uppercase font-bold mb-1">Pending</p>
                    <div className="flex items-center gap-2">
                        <span className="text-3xl font-bold text-warning">{filteredRequests.filter(r => (r.status || '').toLowerCase() === 'pending').length}</span>
                        <span className="text-xs text-warning">Awaiting</span>
                    </div>
                </div>
                <div className="glass-card p-6 border-accent/10">
                    <p className="text-xs text-secondary uppercase font-bold mb-1">High Priority</p>
                    <div className="flex items-center gap-2">
                        <span className="text-3xl font-bold text-danger">{filteredRequests.filter(r => (r.priority || '').toLowerCase() === 'high' || (r.priority || '').toLowerCase() === 'immediate').length}</span>
                        <span className="text-xs text-danger">Urgent</span>
                    </div>
                </div>
                <div className="glass-card p-6 border-accent/10">
                    <p className="text-xs text-secondary uppercase font-bold mb-1">Completed</p>
                    <div className="flex items-center gap-2">
                        <span className="text-3xl font-bold text-success">{filteredRequests.filter(r => (r.status || '').toLowerCase() === 'completed').length}</span>
                        <span className="text-xs text-success">Done</span>
                    </div>
                </div>
            </div>

            <div className="glass-card p-6">
                <Table
                    columns={columns}
                    data={filteredRequests}
                    actions={true}
                    onView={(item) => handleAction('view', item)}
                    onEdit={(item) => handleAction('edit', item)}
                    onDelete={(item) => handleAction('delete', item)}
                    canEdit={!isCustomer && hasMenuPermission('Guest Requests', 'can_edit')}
                    canDelete={!isCustomer && hasMenuPermission('Guest Requests', 'can_delete')}
                />
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={
                    modalType === 'view' ? 'Request Protocol' :
                        modalType === 'edit' ? 'Update Task' :
                            modalType === 'delete' ? 'Archive Request' : 'New Guest Requirement'
                }
            >
                <div className="space-y-6">
                    {modalType === 'delete' ? (
                        <div className="space-y-4">
                            <p className="text-secondary">Are you sure you want to archive this request from <span className="text-primary font-bold">{selectedRequest?.guest}</span>?</p>
                            <div className="flex gap-3 justify-end pt-4">
                                <button onClick={() => setIsModalOpen(false)} className="btn-secondary">Cancel</button>
                                <button onClick={handleDelete} className="px-6 py-2 bg-danger text-white rounded-lg font-bold">Confirm Archive</button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-muted uppercase">Guest / Suite</label>
                                    <input
                                        type="text"
                                        value={formData.guest}
                                        onChange={(e) => setFormData({ ...formData, guest: e.target.value })}
                                        className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold"
                                        disabled={modalType === 'view'}
                                        placeholder="Suite No / Guest Name"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-muted uppercase">Requested By</label>
                                    <input
                                        type="text"
                                        value={formData.requestedBy || ''}
                                        onChange={(e) => setFormData({ ...formData, requestedBy: e.target.value })}
                                        className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
                                        disabled={modalType === 'view'}
                                        placeholder="Staff / Relative Name"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-muted uppercase">Priority</label>
                                    <select
                                        value={String(formData.priority || '').toLowerCase().trim()}
                                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                        className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
                                        disabled={modalType === 'view'}
                                    >
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                        <option value="immediate">Immediate</option>
                                    </select>
                                </div>
                                <div className="col-span-2 space-y-1">
                                    <label className="text-[10px] font-bold text-muted uppercase">Request Details</label>
                                    <textarea
                                        value={formData.request}
                                        onChange={(e) => setFormData({ ...formData, request: e.target.value })}
                                        className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none h-24 resize-none"
                                        disabled={modalType === 'view'}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-muted uppercase">Delivery Time</label>
                                    <input
                                        type="text"
                                        value={formData.time}
                                        placeholder="e.g. 11:30 PM"
                                        onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                                        className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
                                        disabled={modalType === 'view'}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-muted uppercase">Request Date</label>
                                    <input
                                        type="date"
                                        value={formData.date || new Date().toISOString().split('T')[0]}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                        className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
                                        disabled={modalType === 'view'}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-muted uppercase">Current Status</label>
                                    {isCustomer ? (
                                        <div className="w-full bg-background/50 border border-border rounded-lg px-4 py-2.5 text-sm font-bold text-white flex items-center">
                                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-black tracking-widest ${
                                                String(formData.status).toLowerCase() === 'completed' 
                                                ? 'bg-success/20 text-success' 
                                                : ['in progress', 'in_progress'].includes(String(formData.status).toLowerCase()) 
                                                ? 'bg-accent/20 text-accent' 
                                                : 'bg-warning/20 text-warning'
                                            }`}>
                                                {formData.status || 'Pending'}
                                            </span>
                                        </div>
                                    ) : (
                                        <select
                                            value={String(formData.status || 'pending').toLowerCase().trim()}
                                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                            className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
                                            disabled={modalType === 'view'}
                                        >
                                            <option value="pending">Pending</option>
                                            <option value="in progress">In Progress</option>
                                            <option value="completed">Completed</option>
                                            <option value="deferred">Deferred</option>
                                        </select>
                                    )}
                                </div>
                            </div>

                            {modalType === 'view' && (
                                <div className="p-4 bg-white/5 border border-border rounded-xl space-y-3">
                                    <div className="flex items-center gap-3 text-sm">
                                        <Clock size={16} className="text-secondary" />
                                        <span className="text-secondary">Logged By:</span>
                                        <span className="font-bold">Concierge Duty Desk</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm font-bold text-success">
                                        <CheckCircle2 size={16} />
                                        <span>L3 Compliance Verified</span>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3 justify-end pt-2">
                                <button onClick={() => setIsModalOpen(false)} className="btn-secondary">{modalType === 'view' ? 'Close' : 'Cancel'}</button>
                                {modalType !== 'view' && <button onClick={handleSave} className="btn-primary">Execute Request</button>}
                            </div>
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default GuestRequests;
