import React, { useState } from 'react';
import Table from '../../components/Table';
import Modal from '../../components/Modal';
import { useData } from '../../context/GlobalDataContext';
import {
    MessageSquare, Send, CheckCircle2, Clock,
    AlertCircle, Search, Filter, User, LifeBuoy, ShieldCheck
} from 'lucide-react';

const SupportDashboard = () => {
    const { supportTickets, updateSupportTicket, fetchTickets, currentUser, hasMenuPermission } = useData();

    React.useEffect(() => {
        if (fetchTickets) fetchTickets();
    }, [fetchTickets]);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('All');
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [refundAmount, setRefundAmount] = useState(0);

    const filteredTickets = supportTickets.filter(t => {
        const matchesSearch = t.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            String(t.id || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'All' || t.status === filterStatus;
        return matchesSearch && matchesStatus;
    });

    const handleOpenTicket = (ticket) => {
        setSelectedTicket(ticket);
        setRefundAmount(ticket.refund_amount || 0);
        setIsModalOpen(true);
    };

    const handleSendReply = () => {
        if (!replyText.trim()) return;

        const newMessage = {
            sender: 'admin',
            text: replyText,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        const updatedTicket = {
            ...selectedTicket,
            messages: [...selectedTicket.messages, newMessage],
            status: 'In Progress'
        };

        updateSupportTicket(updatedTicket);
        setSelectedTicket(updatedTicket);
        setReplyText('');
    };

    const handleResolve = (ticket) => {
        updateSupportTicket({ ...ticket, status: 'Resolved' });
        if (selectedTicket?.id === ticket.id) {
            setSelectedTicket({ ...selectedTicket, status: 'Resolved' });
        }
    };

    const handleDisputeAction = (action, amount = 0) => {
        const updated = {
            ...selectedTicket,
            dispute_status: action,
            refund_amount: amount,
            status: action === 'accepted' ? 'Resolved' : selectedTicket.status
        };
        updateSupportTicket(updated);
        setSelectedTicket(updated);
    };

    const columns = [
        { header: "Ticket ID", accessor: "id" },
        { header: "Client", accessor: "clientName" },
        { header: "Subject", accessor: "subject" },
        { header: "Category", accessor: "category" },
        {
            header: "Priority",
            accessor: "priority",
            render: (row) => (
                <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${row.priority === 'High' ? 'bg-danger/20 text-danger' :
                    row.priority === 'Medium' ? 'bg-warning/20 text-warning' : 'bg-success/20 text-success'
                    }`}>
                    {row.priority}
                </span>
            )
        },
        {
            header: "Status",
            accessor: "status",
            render: (row) => (
                <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${row.status === 'Open' ? 'bg-accent/20 text-accent' :
                    row.status === 'In Progress' ? 'bg-warning/20 text-warning' : 'bg-success/20 text-success'
                    }`}>
                    {row.status}
                </span>
            )
        },
        { 
            header: "Dispute", 
            accessor: "dispute_status",
            render: (row) => (
                <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
                    row.dispute_status === 'accepted' ? 'bg-success/20 text-success' :
                    row.dispute_status === 'rejected' ? 'bg-danger/20 text-danger' :
                    row.dispute_status === 'pending' ? 'bg-warning/20 text-warning' : 'hidden'
                }`}>
                    {row.dispute_status}
                </span>
            )
        },
        { header: "Date", accessor: "date" }
    ];

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white font-heading italic">Support Command Centre</h1>
                    <p className="text-secondary mt-1 text-sm uppercase tracking-widest font-bold">Monitor and resolve institutional client requests.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { label: 'Active Tickets', value: supportTickets.filter(t => t.status !== 'Resolved').length, icon: MessageSquare, color: 'text-accent' },
                    { label: 'Urgent Priority', value: supportTickets.filter(t => t.priority === 'High' && t.status !== 'Resolved').length, icon: AlertCircle, color: 'text-danger' },
                    { label: 'Pending Response', value: supportTickets.filter(t => t.status === 'Open').length, icon: Clock, color: 'text-warning' },
                    { label: 'Resolution Rate', value: '98.4%', icon: CheckCircle2, color: 'text-success' }
                ].map((stat, idx) => (
                    <div key={idx} className="glass-card p-6 border-white/5 relative overflow-hidden group">
                        <stat.icon className={`absolute -right-4 -bottom-4 w-24 h-24 opacity-5 ${stat.color} group-hover:scale-110 transition-transform`} />
                        <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-2">{stat.label}</p>
                        <p className="text-3xl font-black italic font-heading">{stat.value}</p>
                    </div>
                ))}
            </div>

            <div className="glass-card p-6 border-white/5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-4 flex-1">
                        <div className="relative max-w-sm w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
                            <input
                                type="text"
                                placeholder="Search tickets..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-background border border-border rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-accent font-bold"
                            />
                        </div>
                        <div className="flex items-center gap-2 bg-white/5 border border-border rounded-xl px-3 py-1.5">
                            <Filter size={14} className="text-muted" />
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="bg-transparent text-xs font-bold outline-none border-none text-secondary focus:text-white"
                            >
                                <option value="All" className="bg-sidebar">All Status</option>
                                <option value="Open" className="bg-sidebar">Open</option>
                                <option value="In Progress" className="bg-sidebar">In Progress</option>
                                <option value="Resolved" className="bg-sidebar">Resolved</option>
                            </select>
                        </div>
                    </div>
                </div>

                <Table
                    columns={columns}
                    data={filteredTickets}
                    actions={true}
                    onView={handleOpenTicket}
                    canEdit={hasMenuPermission('Support', 'can_edit')}
                    canDelete={hasMenuPermission('Support', 'can_delete')}
                    customAction={(row) => (
                        <button
                            onClick={(e) => { e.stopPropagation(); handleResolve(row); }}
                            className={`p-2 rounded-lg transition-all ${row.status === 'Resolved' ? 'text-success cursor-default' : 'text-muted hover:text-success hover:bg-success/10'}`}
                            title="Mark as Resolved"
                        >
                            <CheckCircle2 size={16} />
                        </button>
                    )}
                />
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={`Ticket Details — ${selectedTicket?.id}`}
                size="lg"
            >
                {selectedTicket && (
                    <div className="flex flex-col h-[600px]">
                        <div className="grid grid-cols-3 gap-6 mb-6 p-4 bg-white/5 rounded-2xl border border-border">
                            <div>
                                <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Client Account</p>
                                <p className="text-sm font-bold">{selectedTicket.clientName}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Priority Level</p>
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded ${selectedTicket.priority === 'High' ? 'bg-danger/20 text-danger' : 'bg-warning/20 text-warning'
                                    }`}>{selectedTicket.priority}</span>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Current Protocol</p>
                                <p className="text-sm font-bold text-accent italic">{selectedTicket.status}</p>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-4 pr-4 custom-scrollbar mb-6">
                            {selectedTicket.messages.map((msg, i) => (
                                <div key={i} className={`flex ${msg.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] p-4 rounded-2xl ${msg.sender === 'admin'
                                        ? 'bg-accent/10 border border-accent/20 rounded-tr-none'
                                        : 'bg-white/5 border border-border rounded-tl-none'
                                        }`}>
                                        <div className="flex items-center gap-2 mb-2">
                                            {msg.sender === 'admin' ? <ShieldCheck size={12} className="text-accent" /> : <User size={12} className="text-secondary" />}
                                            <span className="text-[9px] font-black uppercase tracking-widest opacity-60">
                                                {msg.sender === 'admin' ? 'Executive Support' : selectedTicket.clientName}
                                            </span>
                                        </div>
                                        <p className="text-sm leading-relaxed">{msg.text}</p>
                                        {msg.attachments && Object.values(msg.attachments).some(a => a) && (
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {Object.entries(msg.attachments).map(([type, url]) => url && (
                                                    <div key={type} className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl flex items-center gap-2">
                                                        <span className="text-[8px] font-black uppercase tracking-widest text-accent">{type}</span>
                                                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-[10px] hover:underline text-secondary">View File</a>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <p className="text-[8px] text-muted text-right mt-2">{msg.time}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {selectedTicket.status !== 'Resolved' && (
                            <div className="mt-auto space-y-4">
                                {/* Dispute Management Area */}
                                <div className="p-4 bg-accent/[0.03] border border-accent/20 rounded-2xl space-y-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-black text-accent uppercase tracking-widest">Dispute Investigation</p>
                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${
                                            selectedTicket.dispute_status === 'pending' ? 'bg-warning text-black' :
                                            selectedTicket.dispute_status === 'accepted' ? 'bg-success text-white' :
                                            selectedTicket.dispute_status === 'rejected' ? 'bg-danger text-white' : 'bg-white/10 text-muted'
                                        }`}>
                                            Status: {selectedTicket.dispute_status || 'none'}
                                        </span>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-muted uppercase">Refund Amount ($)</label>
                                            <input 
                                                type="number"
                                                value={refundAmount}
                                                onChange={(e) => setRefundAmount(parseFloat(e.target.value))}
                                                className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm focus:border-accent outline-none font-bold"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => handleDisputeAction('accepted', refundAmount)}
                                                className="flex-1 py-2 bg-success text-white rounded-xl text-[9px] font-black uppercase hover:bg-success/80 transition-all"
                                            >
                                                Accept & Refund
                                            </button>
                                            <button 
                                                onClick={() => handleDisputeAction('rejected', 0)}
                                                className="flex-1 py-2 bg-danger/20 text-danger border border-danger/30 rounded-xl text-[9px] font-black uppercase hover:bg-danger hover:text-white transition-all"
                                            >
                                                Reject Dispute
                                            </button>
                                        </div>
                                    </div>
                                    {selectedTicket.dispute_status === 'none' && (
                                        <button 
                                            onClick={() => handleDisputeAction('pending', 0)}
                                            className="w-full py-2 bg-white/5 border border-white/10 text-white rounded-xl text-[9px] font-black uppercase hover:border-accent/40 transition-all"
                                        >
                                            Mark as Active Dispute
                                        </button>
                                    )}
                                </div>

                                <div className="relative">
                                    <textarea
                                        placeholder="Type your official response..."
                                        className="w-full bg-background border border-border rounded-2xl p-4 pr-16 text-sm focus:border-accent outline-none min-h-[80px] resize-none"
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                    />
                                    <button
                                        onClick={handleSendReply}
                                        className="absolute bottom-4 right-4 p-3 bg-accent text-primary rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-accent/20"
                                    >
                                        <Send size={18} />
                                    </button>
                                </div>
                                <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-divider">
                                    <div className="flex items-center gap-2 text-secondary">
                                        <LifeBuoy size={14} />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">SLA: 15-Min Response Required</span>
                                    </div>
                                    <button
                                        onClick={() => handleResolve(selectedTicket)}
                                        className="btn-primary bg-success hover:bg-success/80 border-success/20 flex items-center gap-2 text-[10px]"
                                    >
                                        <CheckCircle2 size={14} /> Mark Case Resolved
                                    </button>
                                </div>
                            </div>
                        )}
                        {selectedTicket.status === 'Resolved' && (
                            <div className="p-4 bg-success/10 border border-success/20 rounded-2xl text-center">
                                <p className="text-success font-bold text-sm">Protocol Completed: This case has been officially resolved.</p>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default SupportDashboard;
