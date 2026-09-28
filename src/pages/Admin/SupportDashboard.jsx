import React, { useState } from 'react';
import Table from '../../components/Table';
import Modal from '../../components/Modal';
import { useData } from '../../context/GlobalDataContext';
import { swalSuccess, swalError, swalConfirm } from '../../utils/swal';
import {
    MessageSquare, Send, CheckCircle2, Clock,
    AlertCircle, Search, Filter, User, LifeBuoy, ShieldCheck,
    ExternalLink, Eye, Paperclip, Trash2, Copy, Check, Download,
    Image as ImageIcon, FileText, RefreshCw, ChevronDown, Lock, XCircle
} from 'lucide-react';
import { isCloudinaryUrl } from '../../services/cloudinaryService';

const inferAttachmentType = (url) => {
    if (!url || typeof url !== 'string') return 'file';
    if (
        isCloudinaryUrl(url) ||
        url.includes('/image/upload') ||
        url.startsWith('data:image/') ||
        url.match(/\.(jpeg|jpg|gif|png|webp|avif)($|\?)/i) ||
        url.startsWith('blob:')
    ) {
        return 'image';
    }
    if (url.toLowerCase().includes('.pdf') || url.startsWith('data:application/pdf')) {
        return 'pdf';
    }
    return 'file';
};

const formatAttachmentLabel = (key) => {
    if (!key) return 'Attachment';
    const clean = String(key).replace(/[_\-\.]+/g, ' ').trim();
    if (clean.toLowerCase().includes('screenshot')) return '📸 Screenshot';
    if (clean.toLowerCase().includes('evidence')) return '📄 Evidence';
    if (clean.toLowerCase().includes('delivery')) return '🚚 Delivery Proof';
    if (clean.toLowerCase().includes('proof')) return '🧾 Proof of Delivery';
    return clean.charAt(0).toUpperCase() + clean.slice(1);
};

const extractAttachmentsFromObject = (raw) => {
    if (!raw) return [];
    let data = raw;
    if (typeof data === 'string') {
        try {
            data = JSON.parse(data);
        } catch (_) {
            if (data.startsWith('http') || data.startsWith('data:') || data.startsWith('blob:')) {
                return [{
                    key: 'file',
                    label: 'Attachment',
                    url: data,
                    type: inferAttachmentType(data),
                    isCloudinary: isCloudinaryUrl(data)
                }];
            }
            return [];
        }
    }

    const items = [];
    if (Array.isArray(data)) {
        data.forEach((entry, idx) => {
            if (!entry) return;
            if (typeof entry === 'string') {
                items.push({
                    key: `att_${idx}`,
                    label: `Attachment ${idx + 1}`,
                    url: entry,
                    type: inferAttachmentType(entry),
                    isCloudinary: isCloudinaryUrl(entry)
                });
            } else if (typeof entry === 'object' && entry.url) {
                items.push({
                    key: entry.key || `att_${idx}`,
                    label: entry.name || entry.label || `Attachment ${idx + 1}`,
                    url: entry.url,
                    type: entry.type || inferAttachmentType(entry.url),
                    isCloudinary: isCloudinaryUrl(entry.url)
                });
            }
        });
    } else if (data && typeof data === 'object') {
        Object.entries(data).forEach(([key, val]) => {
            if (!val) return;
            if (typeof val === 'string') {
                items.push({
                    key,
                    label: formatAttachmentLabel(key),
                    url: val,
                    type: inferAttachmentType(val),
                    isCloudinary: isCloudinaryUrl(val)
                });
            } else if (typeof val === 'object' && val.url) {
                items.push({
                    key,
                    label: val.name || formatAttachmentLabel(key),
                    url: val.url,
                    type: val.type || inferAttachmentType(val.url),
                    isCloudinary: isCloudinaryUrl(val.url)
                });
            }
        });
    }
    return items;
};

// Aggregate all unique attachments across ticket root fields and its messages
const extractAllCaseAttachments = (ticket) => {
    if (!ticket) return [];
    const map = new Map();

    const addItems = (items, source = '') => {
        items.forEach((item) => {
            if (item && item.url && !map.has(item.url)) {
                map.set(item.url, { ...item, source });
            }
        });
    };

    // 1. Direct ticket attachments
    addItems(extractAttachmentsFromObject(ticket.attachments), 'Ticket Root');
    ['screenshot', 'evidence', 'deliveryProof'].forEach(key => {
        if (ticket[key] && typeof ticket[key] === 'string') {
            addItems([{
                key,
                label: formatAttachmentLabel(key),
                url: ticket[key],
                type: inferAttachmentType(ticket[key]),
                isCloudinary: isCloudinaryUrl(ticket[key])
            }], 'Ticket Root');
        }
    });

    // 2. Attachments inside messages
    if (Array.isArray(ticket.messages)) {
        ticket.messages.forEach((msg, idx) => {
            if (!msg) return;
            const source = msg.sender === 'admin' ? 'Support Reply' : `Client Message #${idx + 1}`;
            addItems(extractAttachmentsFromObject(msg.attachments), source);
            if (msg.attachment) {
                addItems(extractAttachmentsFromObject(msg.attachment), source);
            }
            ['screenshot', 'evidence', 'deliveryProof'].forEach(key => {
                if (msg[key] && typeof msg[key] === 'string') {
                    addItems([{
                        key,
                        label: formatAttachmentLabel(key),
                        url: msg[key],
                        type: inferAttachmentType(msg[key]),
                        isCloudinary: isCloudinaryUrl(msg[key])
                    }], source);
                }
            });
        });
    }

    return Array.from(map.values());
};

const SupportDashboard = () => {
    const { supportTickets, updateSupportTicket, deleteSupportTicket, fetchTickets, currentUser, hasMenuPermission } = useData();

    React.useEffect(() => {
        if (fetchTickets) fetchTickets();

        const handleStateChanged = () => {
            if (fetchTickets) fetchTickets();
        };
        window.addEventListener('app:state-changed', handleStateChanged);

        const interval = setInterval(() => {
            if (fetchTickets) fetchTickets();
        }, 3000);

        return () => {
            window.removeEventListener('app:state-changed', handleStateChanged);
            clearInterval(interval);
        };
    }, [fetchTickets]);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('All');
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [previewAttachment, setPreviewAttachment] = useState(null);
    const [replyText, setReplyText] = useState('');
    const [refundAmount, setRefundAmount] = useState(0);
    const [isSending, setIsSending] = useState(false);
    const [copiedId, setCopiedId] = useState(false);
    const [copiedUrl, setCopiedUrl] = useState(false);

    React.useEffect(() => {
        if (selectedTicket) {
            const currentSelectedId = selectedTicket.ticketId || selectedTicket.id;
            if (!currentSelectedId) return;

            const found = (supportTickets || []).find((t) => {
                const tId = t.ticketId || t.id;
                return tId && String(tId) === String(currentSelectedId);
            });
            if (found && (found.status !== selectedTicket.status || (found.messages?.length || 0) !== (selectedTicket.messages?.length || 0))) {
                setSelectedTicket(found);
            }
        }
    }, [supportTickets]);

    const normalizeStatusKey = (s) => {
        const k = String(s || '').toLowerCase().replace(/[\s_]+/g, '');
        if (['open', 'pending', 'new'].includes(k)) return 'Open';
        if (['inprogress', 'assigned', 'investigating', 'in_progress'].includes(k)) return 'In Progress';
        if (['resolved', 'closed', 'completed', 'done'].includes(k)) return 'Resolved';
        if (['rejected', 'reject'].includes(k)) return 'Rejected';
        return 'Open';
    };

    const filteredTickets = supportTickets.filter(t => {
        const matchesSearch = t.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            String(t.id || '').toLowerCase().includes(searchTerm.toLowerCase());
        const normStatus = normalizeStatusKey(t.status);
        const matchesStatus = filterStatus === 'All' || normStatus === filterStatus;
        return matchesSearch && matchesStatus;
    });

    const isResolved = selectedTicket 
        ? ['Resolved', 'Rejected'].includes(normalizeStatusKey(selectedTicket.status)) 
        : false;

    const handleOpenTicket = (ticket) => {
        setSelectedTicket(ticket);
        setRefundAmount(ticket.refund_amount || 0);
        setIsModalOpen(true);
    };

    const handleCopyId = (id) => {
        if (!id) return;
        navigator.clipboard?.writeText(id);
        setCopiedId(true);
        setTimeout(() => setCopiedId(false), 2000);
    };

    const handleCopyUrl = (url) => {
        if (!url) return;
        navigator.clipboard?.writeText(url);
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2000);
    };

    const handleDownloadAttachment = async (att) => {
        if (!att?.url) return;
        try {
            const res = await fetch(att.url);
            const blob = await res.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = att.label ? `${att.label.replace(/[^\w\d]/g, '_')}.jpg` : 'attachment.jpg';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(blobUrl);
        } catch (e) {
            window.open(att.url, '_blank');
        }
    };

    const handleStatusChange = async (newStatus) => {
        if (!selectedTicket || selectedTicket.status === newStatus || isResolved) return;
        const updated = {
            ...selectedTicket,
            status: newStatus
        };
        try {
            await updateSupportTicket(updated);
            setSelectedTicket(updated);
            swalSuccess('Status Updated', `Case protocol updated to ${newStatus}.`);
        } catch (err) {
            console.error('Failed to update status:', err);
            swalError('Update Failed', 'Could not update ticket status.');
        }
    };

    const handleSendReply = async () => {
        if (!replyText.trim() || isSending || isResolved) return;

        setIsSending(true);
        const newMessage = {
            sender: 'admin',
            text: replyText.trim(),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            createdAt: new Date().toISOString()
        };

        const existingMsgs = Array.isArray(selectedTicket.messages) ? selectedTicket.messages : [];
        const updatedTicket = {
            ...selectedTicket,
            messages: [...existingMsgs, newMessage],
            status: 'In Progress'
        };

        try {
            await updateSupportTicket(updatedTicket);
            setSelectedTicket(updatedTicket);
            setReplyText('');
            swalSuccess('Response Sent', 'Admin response synchronized to Client Portal.');
        } catch (err) {
            console.error('Failed to send admin response:', err);
            swalError('Save Failed', 'Could not save response to database.');
        } finally {
            setIsSending(false);
        }
    };

    const handleResolve = async (ticket) => {
        if (!ticket || normalizeStatusKey(ticket.status) === 'Resolved') return;
        const updated = { ...ticket, status: 'Resolved' };
        try {
            await updateSupportTicket(updated);
            if (selectedTicket?.id === ticket.id) {
                setSelectedTicket(updated);
            }
            swalSuccess('Case Resolved', `Ticket ${ticket.id} marked as Resolved.`);
        } catch (e) {
            swalError('Error', 'Could not mark case as resolved.');
        }
    };

    const handleReopen = async (ticket) => {
        if (!ticket) return;
        const updated = { 
            ...ticket, 
            status: 'In Progress',
            dispute_status: ticket.dispute_status === 'rejected' ? 'pending' : (ticket.dispute_status || 'none')
        };
        try {
            await updateSupportTicket(updated);
            if (selectedTicket?.id === ticket.id) {
                setSelectedTicket(updated);
                setRefundAmount(updated.refund_amount || 0);
            }
            swalSuccess('Case Reopened', `Ticket ${ticket.id} reopened. All editing and dispute controls are now active.`);
        } catch (e) {
            swalError('Error', 'Could not reopen case.');
        }
    };

    const handleDisputeAction = async (action, amount = 0) => {
        if (isResolved) return;
        const newStatus = action === 'accepted' ? 'Resolved' : (action === 'rejected' ? 'Rejected' : selectedTicket.status);
        const updated = {
            ...selectedTicket,
            dispute_status: action,
            refund_amount: action === 'rejected' ? 0 : amount,
            status: newStatus
        };
        try {
            await updateSupportTicket(updated);
            setSelectedTicket(updated);
            if (action === 'rejected') {
                setRefundAmount(0);
            }
            swalSuccess(
                action === 'accepted' ? 'Dispute Accepted' : action === 'rejected' ? 'Dispute Rejected' : 'Dispute Marked Active',
                action === 'accepted' 
                    ? `Refund of $${amount} recorded and case marked as Resolved.` 
                    : action === 'rejected'
                    ? `Dispute rejected and case marked as Rejected (Locked).`
                    : `Dispute updated to ${action}.`
            );
        } catch (err) {
            console.error('Failed to update dispute action:', err);
            swalError('Update Failed', 'Could not update dispute action.');
        }
    };

    const handleDeleteTicket = async (ticket) => {
        if (!ticket) return;
        const tId = ticket.ticketId || ticket.id;
        const confirmRes = await swalConfirm(
            'Delete Support Ticket?',
            `Are you sure you want to permanently delete ticket ${tId}? This action cannot be undone.`,
            'Yes, Delete Ticket',
            'Cancel'
        );
        if (!confirmRes.isConfirmed) return;

        try {
            if (deleteSupportTicket) {
                await deleteSupportTicket(ticket);
            }
            if (selectedTicket?.id === ticket.id || selectedTicket?.ticketId === tId) {
                setIsModalOpen(false);
                setSelectedTicket(null);
            }
            swalSuccess('Ticket Deleted', `Ticket ${tId} was permanently deleted.`);
            if (fetchTickets) await fetchTickets();
        } catch (err) {
            console.error('Failed to delete ticket:', err);
            swalError('Delete Failed', err?.response?.data?.message || 'Could not delete ticket.');
        }
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
            render: (row) => {
                const norm = normalizeStatusKey(row.status);
                return (
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
                        norm === 'Open' ? 'bg-accent/20 text-accent' :
                        norm === 'In Progress' ? 'bg-warning/20 text-warning' :
                        norm === 'Rejected' ? 'bg-danger/20 text-danger' :
                        'bg-success/20 text-success'
                    }`}>
                        {row.status}
                    </span>
                );
            }
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
        { header: "Date", accessor: "date" },
        {
            header: "Actions",
            accessor: "actions",
            render: (row) => (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTicket(row);
                    }}
                    className="p-1.5 text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-all cursor-pointer"
                    title="Delete Ticket"
                >
                    <Trash2 size={14} />
                </button>
            )
        }
    ];

    const allCaseAttachments = selectedTicket ? extractAllCaseAttachments(selectedTicket) : [];

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
                    { label: 'Active Tickets', value: supportTickets.filter(t => !['Resolved', 'Rejected'].includes(normalizeStatusKey(t.status))).length, icon: MessageSquare, color: 'text-accent' },
                    { label: 'Urgent Priority', value: supportTickets.filter(t => String(t.priority).toLowerCase() === 'high' && !['Resolved', 'Rejected'].includes(normalizeStatusKey(t.status))).length, icon: AlertCircle, color: 'text-danger' },
                    { label: 'Pending Response', value: supportTickets.filter(t => normalizeStatusKey(t.status) === 'Open').length, icon: Clock, color: 'text-warning' },
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
                                className="bg-transparent text-xs font-bold outline-none border-none text-secondary focus:text-white cursor-pointer"
                            >
                                <option value="All" className="bg-sidebar">All Status</option>
                                <option value="Open" className="bg-sidebar">Open</option>
                                <option value="In Progress" className="bg-sidebar">In Progress</option>
                                <option value="Resolved" className="bg-sidebar">Resolved</option>
                                <option value="Rejected" className="bg-sidebar">Rejected</option>
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
                    customAction={(row) => {
                        const isClosed = ['Resolved', 'Rejected'].includes(normalizeStatusKey(row.status));
                        return (
                            <button
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    if (isClosed) {
                                        handleReopen(row);
                                    } else {
                                        handleResolve(row); 
                                    }
                                }}
                                className={`p-2 rounded-lg transition-all ${
                                    normalizeStatusKey(row.status) === 'Resolved' ? 'text-success hover:bg-white/5 cursor-pointer' : 
                                    normalizeStatusKey(row.status) === 'Rejected' ? 'text-danger hover:bg-white/5 cursor-pointer' :
                                    'text-muted hover:text-success hover:bg-success/10 cursor-pointer'
                                }`}
                                title={isClosed ? 'Reopen Case' : 'Mark as Resolved'}
                            >
                                {normalizeStatusKey(row.status) === 'Rejected' ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
                            </button>
                        );
                    }}
                />
            </div>

            {/* ── EXPANDED TICKET DETAILS MODAL ── */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={`Ticket Details — ${selectedTicket?.id || ''}`}
                subtitle={selectedTicket?.subject || 'Support Case Details'}
                size="4xl"
                maxWidth="max-w-6xl"
                bodyClassName="p-4 sm:p-6"
            >
                {selectedTicket && (
                    <div className="flex flex-col space-y-5">
                        {/* Top Overview & Action Strip */}
                        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 sm:p-4 bg-white/[0.03] rounded-2xl border border-white/5">
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-accent/10 border border-accent/25 rounded-xl text-accent font-mono text-xs font-black">
                                    <span>{selectedTicket.id}</span>
                                    <button
                                        onClick={() => handleCopyId(selectedTicket.id)}
                                        className="hover:text-white transition-colors cursor-pointer p-0.5"
                                        title="Copy Ticket ID"
                                    >
                                        {copiedId ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                    </button>
                                </div>

                                <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border ${
                                    selectedTicket.priority === 'High' ? 'bg-danger/15 text-danger border-danger/30' :
                                    selectedTicket.priority === 'Medium' ? 'bg-warning/15 text-warning border-warning/30' : 'bg-success/15 text-success border-success/30'
                                }`}>
                                    {selectedTicket.priority} Priority
                                </span>

                                <span className="px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-wider text-muted">
                                    {selectedTicket.category || 'General'}
                                </span>

                                {isResolved ? (
                                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl font-black text-[10px] uppercase border ${
                                        normalizeStatusKey(selectedTicket.status) === 'Rejected'
                                            ? 'bg-danger/15 border-danger/30 text-danger'
                                            : 'bg-success/15 border-success/30 text-success'
                                    }`}>
                                        {normalizeStatusKey(selectedTicket.status) === 'Rejected' ? <XCircle size={12} /> : <CheckCircle2 size={12} />}
                                        <span>{selectedTicket.status} (Locked)</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 border border-white/10 rounded-xl">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-muted">Protocol:</span>
                                        <select
                                            value={selectedTicket.status}
                                            onChange={(e) => handleStatusChange(e.target.value)}
                                            className="bg-transparent text-[10px] font-black uppercase text-accent outline-none cursor-pointer"
                                        >
                                            <option value="Open" className="bg-sidebar text-white">Open</option>
                                            <option value="In Progress" className="bg-sidebar text-white">In Progress</option>
                                            <option value="Resolved" className="bg-sidebar text-white">Resolved</option>
                                            <option value="Rejected" className="bg-sidebar text-white">Rejected</option>
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-2 text-secondary text-xs font-bold">
                                <LifeBuoy size={14} className="text-accent" />
                                <span className="text-[10px] uppercase tracking-widest text-muted font-black">SLA: 15-Min Response Required</span>
                            </div>
                        </div>

                        {/* Full Ticket Subject Header */}
                        <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                            <span className="text-[9px] font-black text-muted uppercase tracking-widest">Case Subject / Problem Statement</span>
                            <h2 className="text-lg sm:text-xl font-black text-white mt-1 leading-snug font-heading">
                                {selectedTicket.subject || 'No subject provided'}
                            </h2>
                        </div>

                        {/* Two-Column Responsive Workspace */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                            {/* ── LEFT COLUMN: Conversation & Message Attachments (Col span 7/12) ── */}
                            <div className="lg:col-span-7 flex flex-col space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <MessageSquare size={16} className="text-accent" />
                                        <h4 className="text-xs font-black uppercase tracking-widest text-white">Case History & Conversation</h4>
                                    </div>
                                    <span className="px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[9px] font-black uppercase text-muted">
                                        {selectedTicket.messages?.length || 0} messages
                                    </span>
                                </div>

                                {/* Messages Scrollable Box with ample height */}
                                <div className="h-[380px] sm:h-[430px] overflow-y-auto space-y-4 p-4 sm:p-5 bg-black/30 rounded-2xl border border-white/5 custom-scrollbar">
                                    {(!selectedTicket.messages || selectedTicket.messages.length === 0) ? (
                                        <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted">
                                            <MessageSquare size={32} className="opacity-30 mb-2" />
                                            <p className="text-xs font-bold">No messages in this case yet.</p>
                                        </div>
                                    ) : (
                                        selectedTicket.messages.map((msg, i) => {
                                            const msgAttachments = extractAttachmentsFromObject(msg.attachments);
                                            return (
                                                <div key={i} className={`flex ${msg.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                                                    <div className={`max-w-[85%] sm:max-w-[80%] p-4 rounded-2xl ${msg.sender === 'admin'
                                                        ? 'bg-accent/10 border border-accent/25 rounded-tr-none'
                                                        : 'bg-white/5 border border-border rounded-tl-none'
                                                        }`}>
                                                        <div className="flex items-center gap-2 mb-2">
                                                            {msg.sender === 'admin' 
                                                                ? <ShieldCheck size={12} className="text-accent" /> 
                                                                : <User size={12} className="text-secondary" />}
                                                            <span className="text-[9px] font-black uppercase tracking-widest opacity-70">
                                                                {msg.sender === 'admin' ? 'Executive Support (You)' : (selectedTicket.clientName || 'Client')}
                                                            </span>
                                                        </div>

                                                        {msg.text && (
                                                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                                        )}

                                                        {/* Attached Images & Files for this Message */}
                                                        {msgAttachments.length > 0 && (
                                                            <div className="mt-3.5 space-y-2 pt-2 border-t border-white/10">
                                                                <span className="text-[8px] font-black uppercase tracking-widest text-muted">
                                                                    Attachments ({msgAttachments.length})
                                                                </span>
                                                                <div className="flex flex-wrap gap-2.5">
                                                                    {msgAttachments.map((att, idx) => (
                                                                        att.type === 'image' ? (
                                                                            <div
                                                                                key={idx}
                                                                                onClick={() => setPreviewAttachment(att)}
                                                                                className="group/att relative w-36 h-28 sm:w-44 sm:h-32 rounded-xl overflow-hidden border border-white/15 hover:border-accent/70 transition-all cursor-pointer bg-black/60 shadow-md shrink-0"
                                                                            >
                                                                                <img
                                                                                    src={att.url}
                                                                                    alt={att.label}
                                                                                    className="w-full h-full object-cover transition-transform duration-300 group-hover/att:scale-105"
                                                                                    onError={(e) => {
                                                                                        e.target.style.display = 'none';
                                                                                        if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                                                                                    }}
                                                                                />
                                                                                <div style={{ display: 'none' }} className="absolute inset-0 bg-white/5 flex-col items-center justify-center p-2 text-center">
                                                                                    <AlertCircle size={20} className="text-warning mb-1" />
                                                                                    <span className="text-[8px] font-bold text-muted uppercase">Image Expired</span>
                                                                                    <span className="text-[7px] text-muted/60">Legacy session blob</span>
                                                                                </div>
                                                                                <div className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded bg-black/80 backdrop-blur-sm text-[8px] font-black uppercase tracking-wider text-accent border border-accent/20">
                                                                                    {att.label}
                                                                                </div>
                                                                                {att.isCloudinary && (
                                                                                    <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-sm text-[7px] font-black tracking-wider text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                                                                        <span>☁️ CDN</span>
                                                                                    </div>
                                                                                )}
                                                                                <div className="absolute inset-0 bg-accent/15 opacity-0 group-hover/att:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                                                                    <span className="px-2.5 py-1 rounded-lg bg-black/85 text-[9px] font-black uppercase tracking-widest text-white shadow backdrop-blur-sm flex items-center gap-1">
                                                                                        <Eye size={10} /> View Full
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <div key={idx} className="flex items-center gap-2 p-2.5 bg-white/5 border border-white/10 hover:border-accent/40 rounded-xl transition-all">
                                                                                <FileText size={16} className="text-accent" />
                                                                                <div className="min-w-0 pr-2">
                                                                                    <p className="text-[10px] font-bold text-white truncate max-w-[120px]">{att.label}</p>
                                                                                    <span className="text-[8px] text-muted uppercase font-mono">{att.type}</span>
                                                                                </div>
                                                                                <a
                                                                                    href={att.url}
                                                                                    target="_blank"
                                                                                    rel="noopener noreferrer"
                                                                                    className="p-1 hover:text-accent text-secondary transition-colors"
                                                                                    title="Open File"
                                                                                >
                                                                                    <ExternalLink size={12} />
                                                                                </a>
                                                                            </div>
                                                                        )
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        <p className="text-[8px] text-muted text-right mt-2">{msg.time}</p>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                {/* Response Box */}
                                {!isResolved ? (
                                    <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black text-muted uppercase tracking-widest">
                                                Compose Official Response
                                            </span>
                                            <span className="text-[9px] text-muted italic">Press Enter to send</span>
                                        </div>

                                        <div className="relative">
                                            <textarea
                                                placeholder="Type your official response to the client..."
                                                className="w-full bg-background border border-border rounded-xl p-3.5 pr-14 text-sm focus:border-accent outline-none min-h-[75px] max-h-[140px] resize-none"
                                                value={replyText}
                                                onChange={(e) => setReplyText(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                        e.preventDefault();
                                                        handleSendReply();
                                                    }
                                                }}
                                            />
                                            <button
                                                onClick={handleSendReply}
                                                disabled={isSending || !replyText.trim()}
                                                className={`absolute bottom-3 right-3 p-2.5 bg-accent text-primary rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-accent/20 cursor-pointer ${
                                                    isSending || !replyText.trim() ? 'opacity-40 cursor-not-allowed' : ''
                                                }`}
                                                title="Send Reply"
                                            >
                                                <Send size={16} />
                                            </button>
                                        </div>

                                        {/* Quick response suggestions */}
                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                            {[
                                                "We are investigating this issue with our logistics department.",
                                                "Your case has been reviewed and a refund has been initiated.",
                                                "Could you please confirm if the package seal was intact?"
                                            ].map((quick, qIdx) => (
                                                <button
                                                    key={qIdx}
                                                    type="button"
                                                    onClick={() => setReplyText(quick)}
                                                    className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-accent/30 rounded-lg text-[9px] font-medium text-secondary hover:text-white transition-all text-left truncate max-w-[280px] cursor-pointer"
                                                >
                                                    {quick}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className={`p-4 rounded-2xl flex items-center justify-between border ${
                                        normalizeStatusKey(selectedTicket.status) === 'Rejected'
                                            ? 'bg-danger/10 border-danger/20'
                                            : 'bg-success/10 border-success/20'
                                    }`}>
                                        <div className={`flex items-center gap-2 ${
                                            normalizeStatusKey(selectedTicket.status) === 'Rejected' ? 'text-danger' : 'text-success'
                                        }`}>
                                            {normalizeStatusKey(selectedTicket.status) === 'Rejected' ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
                                            <span className="text-xs font-bold">
                                                {normalizeStatusKey(selectedTicket.status) === 'Rejected' 
                                                    ? 'This dispute was rejected and the case is locked.' 
                                                    : 'This support ticket has been officially resolved.'}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => handleReopen(selectedTicket)}
                                            className="px-3 py-1.5 bg-accent hover:bg-accent/80 text-primary font-black uppercase rounded-xl text-[10px] transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-accent/20"
                                        >
                                            <RefreshCw size={12} /> Reopen Case
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* ── RIGHT COLUMN: Client Profile, Evidence Gallery, Dispute & Protocol (Col span 5/12) ── */}
                            <div className="lg:col-span-5 flex flex-col space-y-4">
                                {/* Card 1: Client Account Summary */}
                                <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-3">
                                    <p className="text-[10px] font-black text-muted uppercase tracking-widest">Client Profile</p>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center font-bold font-heading text-accent text-sm shrink-0">
                                            {(selectedTicket.clientName || 'C').charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-black text-white truncate">{selectedTicket.clientName}</p>
                                            <p className="text-[10px] text-muted font-mono truncate">ID: {selectedTicket.clientId || 'Client Account'}</p>
                                        </div>
                                    </div>
                                    {selectedTicket.createdByEmail && (
                                        <div className="text-xs text-secondary truncate flex items-center gap-1.5">
                                            <span className="text-[10px] font-black text-muted uppercase">Email:</span>
                                            <span className="font-mono">{selectedTicket.createdByEmail}</span>
                                        </div>
                                    )}
                                    <div className="text-xs text-secondary truncate flex items-center gap-1.5">
                                        <span className="text-[10px] font-black text-muted uppercase">Submitted:</span>
                                        <span>{selectedTicket.date}</span>
                                    </div>
                                </div>


                                {/* Card 3: Dispute Investigation */}
                                <div className="p-4 bg-accent/[0.03] border border-accent/20 rounded-2xl space-y-3.5">
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
                                    
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[9px] font-black text-muted uppercase">Refund Amount ($)</label>
                                            {isResolved && (
                                                <span className="text-[8px] font-black text-warning uppercase flex items-center gap-1">
                                                    <Lock size={10} /> Locked
                                                </span>
                                            )}
                                        </div>
                                        <input 
                                            type="number"
                                            value={refundAmount}
                                            disabled={isResolved}
                                            onChange={(e) => setRefundAmount(parseFloat(e.target.value) || 0)}
                                            className={`w-full bg-background border border-border rounded-xl px-3.5 py-2 text-sm outline-none font-bold ${
                                                isResolved 
                                                    ? 'opacity-60 cursor-not-allowed bg-black/40 text-muted border-white/5' 
                                                    : 'focus:border-accent'
                                            }`}
                                            placeholder="0.00"
                                        />
                                    </div>

                                    {isResolved ? (
                                        <div className="p-3 bg-black/30 border border-white/5 rounded-xl text-center space-y-1">
                                            <p className="text-[10px] text-muted font-bold flex items-center justify-center gap-1.5">
                                                <Lock size={12} className="text-warning" /> Dispute editing locked while {normalizeStatusKey(selectedTicket.status).toLowerCase()}
                                            </p>
                                            <p className="text-[8px] text-muted/60">
                                                Click <strong className="text-accent">Reopen Case</strong> below to modify dispute or issue refunds.
                                            </p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => handleDisputeAction('accepted', refundAmount)}
                                                    className="flex-1 py-2 bg-success text-white rounded-xl text-[9px] font-black uppercase hover:bg-success/80 transition-all cursor-pointer shadow-sm"
                                                >
                                                    Accept & Refund
                                                </button>
                                                <button 
                                                    onClick={() => handleDisputeAction('rejected', 0)}
                                                    className="flex-1 py-2 bg-danger/20 text-danger border border-danger/30 rounded-xl text-[9px] font-black uppercase hover:bg-danger hover:text-white transition-all cursor-pointer"
                                                >
                                                    Reject Dispute
                                                </button>
                                            </div>

                                            {(!selectedTicket.dispute_status || selectedTicket.dispute_status === 'none') && (
                                                <button 
                                                    onClick={() => handleDisputeAction('pending', 0)}
                                                    className="w-full py-2 bg-white/5 border border-white/10 text-white rounded-xl text-[9px] font-black uppercase hover:border-accent/40 transition-all cursor-pointer"
                                                >
                                                    Mark as Active Dispute
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>

                                {/* Card 4: Protocol & Lifecycle Actions */}
                                <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-2.5">
                                    <p className="text-[10px] font-black text-muted uppercase tracking-widest">Case Actions</p>
                                    <div className="flex gap-2">
                                        {isResolved ? (
                                            <button
                                                onClick={() => handleReopen(selectedTicket)}
                                                className="flex-1 py-2.5 bg-accent hover:bg-accent/80 text-primary font-black uppercase rounded-xl text-[10px] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-accent/20"
                                            >
                                                <RefreshCw size={14} /> Reopen Case
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleResolve(selectedTicket)}
                                                className="flex-1 py-2.5 bg-success hover:bg-success/80 text-white rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                                            >
                                                <CheckCircle2 size={14} /> Mark Resolved
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDeleteTicket(selectedTicket)}
                                            className="px-3.5 py-2.5 bg-danger/10 hover:bg-danger text-danger hover:text-white border border-danger/30 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                            title="Delete Ticket"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* ── HIGH DEFINITION ATTACHMENT PREVIEW MODAL ── */}
            <Modal
                isOpen={!!previewAttachment}
                onClose={() => setPreviewAttachment(null)}
                title={previewAttachment?.label || previewAttachment?.name || `Case Attachment — ${previewAttachment?.type || 'File'}`}
                subtitle={`Associated with Ticket ${selectedTicket?.id || ''}`}
                size="4xl"
                maxWidth="max-w-5xl"
                bodyClassName="p-4 sm:p-6"
            >
                {previewAttachment && (
                    <div className="flex flex-col items-center justify-center space-y-4">
                        <div className="max-h-[68vh] w-full flex items-center justify-center overflow-hidden rounded-2xl bg-black/70 border border-white/10 p-3 shadow-2xl">
                            {previewAttachment.type === 'image' ? (
                                <img 
                                    src={previewAttachment.url} 
                                    alt={previewAttachment.label || previewAttachment.type} 
                                    className="max-h-[62vh] max-w-full rounded-xl object-contain shadow-lg"
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                        if (e.target.nextSibling) e.target.nextSibling.style.display = 'block';
                                    }}
                                />
                            ) : (
                                <div className="p-12 text-center">
                                    <FileText size={48} className="text-accent mx-auto mb-3" />
                                    <p className="text-base font-bold text-white">{previewAttachment.label || 'Document File'}</p>
                                    <p className="text-xs text-muted mt-1">This file can be viewed in a new browser tab or downloaded.</p>
                                </div>
                            )}

                            <div style={{ display: 'none' }} className="p-8 text-center text-muted">
                                <AlertCircle size={36} className="text-warning mx-auto mb-2" />
                                <p className="text-sm font-bold text-white">Attachment Unavailable</p>
                                <p className="text-xs text-muted mt-1 max-w-sm">
                                    This image was referenced from a temporary session blob URL created before permanent Cloudinary storage was configured.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center justify-between w-full pt-3 border-t border-white/10 gap-3">
                            <div className="flex items-center gap-2">
                                {previewAttachment.isCloudinary ? (
                                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                                        <span>☁️</span> Permanent Cloudinary CDN
                                    </span>
                                ) : (
                                    <span className="px-2.5 py-1 rounded-lg bg-white/5 text-muted border border-white/10 text-[10px] font-black uppercase tracking-wider">
                                        Direct Resource
                                    </span>
                                )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    onClick={() => handleCopyUrl(previewAttachment.url)}
                                    className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-secondary hover:text-white flex items-center gap-1.5 transition-all cursor-pointer"
                                    title="Copy Attachment Link"
                                >
                                    {copiedUrl ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                    <span>{copiedUrl ? 'Copied Link' : 'Copy Link'}</span>
                                </button>

                                <button
                                    onClick={() => handleDownloadAttachment(previewAttachment)}
                                    className="px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition-all cursor-pointer"
                                >
                                    <Download size={14} /> Download File
                                </button>

                                <a 
                                    href={previewAttachment.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="px-4 py-2 bg-accent hover:bg-accent/80 text-primary font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-accent/20"
                                >
                                    <ExternalLink size={14} /> Open in New Tab
                                </a>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default SupportDashboard;
