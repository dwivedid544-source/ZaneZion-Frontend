import React, { useState } from 'react';
import {
    MessageSquare, Phone, Mail, ChevronRight, User, LifeBuoy,
    Clock, ShieldCheck, Plus, Send, X, AlertCircle, CheckCircle2,
    Paperclip, ArrowLeft, Smartphone, FileText, Truck, Download, ExternalLink, Image as ImageIcon,
    Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useData } from '../../context/GlobalDataContext';
import { normalizeRole } from '../../utils/authUtils';
import { uploadSupportAttachment, isCloudinaryUrl } from '../../services/cloudinaryService';
import { swalConfirm, swalSuccess, swalError } from '../../utils/swal';

const priorityColors = {
    High: 'bg-danger/20 text-danger border-danger/30',
    Medium: 'bg-warning/20 text-warning border-warning/30',
    Low: 'bg-success/20 text-success border-success/30',
};

const statusColors = {
    Open: 'bg-accent/20 text-accent',
    'In Progress': 'bg-warning/20 text-warning',
    Resolved: 'bg-success/20 text-success',
    Rejected: 'bg-danger/20 text-danger',
    Closed: 'bg-muted/20 text-muted',
};

// Client-side image processor: compresses high-res images to permanent Base64 Data URLs
const processImageFile = (file) => {
    return new Promise((resolve, reject) => {
        if (!file) return resolve(null);
        if (!file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const MAX_WIDTH = 1200;
                const MAX_HEIGHT = 1200;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height = Math.round((height * MAX_WIDTH) / width);
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width = Math.round((width * MAX_HEIGHT) / height);
                        height = MAX_HEIGHT;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const dataUrl = canvas.toDataURL(file.type || 'image/jpeg', 0.85);
                resolve(dataUrl);
            };
            img.onerror = () => {
                resolve(e.target.result);
            };
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

const ClientSupport = () => {
    const { 
        supportTickets, 
        updateSupportTicket, 
        addSupportTicket, 
        deleteSupportTicket,
        currentUser, 
        fetchTickets, 
        fetchTicketById 
    } = useData();

    // Global ticket polling & state listener
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

    const [activeView, setActiveView] = useState('list'); // 'list' | 'chat' | 'new'
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [replyText, setReplyText] = useState('');
    const [replyAttachment, setReplyAttachment] = useState(null);
    const [previewMedia, setPreviewMedia] = useState(null);
    const [imgError, setImgError] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isSubmittingRef = React.useRef(false);
    const [uploadingSlots, setUploadingSlots] = useState({
        screenshot: false,
        evidence: false,
        deliveryProof: false,
        reply: false
    });

    const handleAttachmentUpload = async (key, file) => {
        if (!file) return;
        setUploadingSlots(prev => ({ ...prev, [key]: true }));
        try {
            const result = await uploadSupportAttachment(file, 'cases');
            if (result.url) {
                setNewTicket(prev => ({
                    ...prev,
                    attachments: {
                        ...prev.attachments,
                        [key]: result.url
                    }
                }));
            }
        } catch (err) {
            console.error(`Failed to upload ${key}:`, err);
        } finally {
            setUploadingSlots(prev => ({ ...prev, [key]: false }));
        }
    };

    const handleReplyAttachmentUpload = async (file) => {
        if (!file) return;
        setUploadingSlots(prev => ({ ...prev, reply: true }));
        try {
            const result = await uploadSupportAttachment(file, 'replies');
            if (result.url) {
                setReplyAttachment(result.url);
            }
        } catch (err) {
            console.error('Failed to upload reply attachment:', err);
        } finally {
            setUploadingSlots(prev => ({ ...prev, reply: false }));
        }
    };

    const handleDeleteTicket = async (e, ticket) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (!ticket) return;

        const tId = ticket.ticketId || ticket.id;
        const confirmRes = await swalConfirm(
            'Delete Support Case?',
            `Are you sure you want to permanently delete case "${ticket.subject || tId}"? This action cannot be undone.`,
            'Yes, Delete Case',
            'Cancel'
        );

        if (!confirmRes.isConfirmed) return;

        try {
            if (deleteSupportTicket) {
                await deleteSupportTicket(ticket);
            }
            swalSuccess('Case Deleted', `Case ${tId} has been successfully deleted.`);
            const currentSelectedId = selectedTicket?.ticketId || selectedTicket?.id;
            if (currentSelectedId && String(currentSelectedId) === String(tId)) {
                backToList();
            }
            if (fetchTickets) await fetchTickets();
        } catch (err) {
            console.error('Failed to delete ticket:', err);
            swalError('Delete Failed', err?.response?.data?.message || 'Could not delete support case. Please try again.');
        }
    };

    const [newTicket, setNewTicket] = useState({
        subject: '',
        category: 'General',
        priority: 'Medium',
        message: '',
        attachments: {
            screenshot: null,
            evidence: null,
            deliveryProof: null
        }
    });

    const roleKey = normalizeRole(currentUser?.role);
    const isEndCustomerRole = ['customer', 'client', 'saas_client', 'admin'].includes(roleKey);

    // Filter tickets belonging to the current user
    const myTickets = (supportTickets || []).filter((t) => {
        const sameOwnerId =
            String(t.createdById ?? '') !== '' &&
            String(currentUser?.id ?? '') !== '' &&
            String(t.createdById) === String(currentUser?.id);
        const sameOwnerEmail =
            String(t.createdByEmail || '').toLowerCase() !== '' &&
            String(t.createdByEmail || '').toLowerCase() === String(currentUser?.email || '').toLowerCase();
        const sameOwnerName =
            String(t.createdByName || '').toLowerCase() !== '' &&
            String(t.createdByName || '').toLowerCase() === String(currentUser?.name || '').toLowerCase();
        const sameClientId =
            String(t.clientId ?? '') !== '' &&
            String(currentUser?.clientId ?? currentUser?.company_id ?? '') !== '' &&
            String(t.clientId) === String(currentUser?.clientId ?? currentUser?.company_id ?? '');

        if (isEndCustomerRole) {
            return sameOwnerId || sameOwnerEmail || sameOwnerName || sameClientId;
        }
        return true;
    });

    // Open a specific ticket strictly by its unique ID
    const openTicket = async (ticket) => {
        if (!ticket) return;
        const ticketId = ticket.ticketId || ticket.id;
        setSelectedTicket(ticket);
        setActiveView('chat');

        // Persist ticket ID in URL so page refresh preserves exactly this ticket
        try {
            const params = new URLSearchParams(window.location.search);
            params.set('ticket', ticketId);
            window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
        } catch (_) {}

        // Fetch fresh details for this specific ticket ID
        if (fetchTicketById && ticketId) {
            try {
                const fresh = await fetchTicketById(ticketId);
                if (fresh) {
                    setSelectedTicket((current) => {
                        const currentId = current?.ticketId || current?.id;
                        if (currentId && String(currentId) === String(ticketId)) {
                            return fresh;
                        }
                        return current;
                    });
                }
            } catch (err) {
                console.error('Failed to fetch ticket details:', err);
            }
        }
    };

    // Return to ticket list
    const backToList = () => {
        setActiveView('list');
        setSelectedTicket(null);
        try {
            const params = new URLSearchParams(window.location.search);
            params.delete('ticket');
            const query = params.toString();
            window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
        } catch (_) {}
    };

    // Restore selected ticket from URL upon refresh or direct navigation
    React.useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const urlTicketId = params.get('ticket');
        if (urlTicketId && !selectedTicket) {
            const found = myTickets.find((t) => {
                const tId = t.ticketId || t.id;
                return tId && String(tId).toLowerCase() === String(urlTicketId).toLowerCase();
            });
            if (found) {
                setSelectedTicket(found);
                setActiveView('chat');
                if (fetchTicketById) {
                    fetchTicketById(urlTicketId).then((fresh) => {
                        if (fresh) setSelectedTicket(fresh);
                    });
                }
            } else if (fetchTicketById) {
                fetchTicketById(urlTicketId).then((fresh) => {
                    if (fresh) {
                        setSelectedTicket(fresh);
                        setActiveView('chat');
                    }
                });
            }
        }
    }, [myTickets]);

    // Keep active chat in sync with background polls, STRICTLY matching by unique ticket ID
    React.useEffect(() => {
        if (selectedTicket) {
            const currentSelectedId = selectedTicket.ticketId || selectedTicket.id;
            if (!currentSelectedId) return;

            const found = (supportTickets || []).find((t) => {
                const tId = t.ticketId || t.id;
                return tId && String(tId) === String(currentSelectedId);
            });

            if (found) {
                const hasStatusChange = found.status !== selectedTicket.status;
                const hasMsgChange = (found.messages?.length || 0) !== (selectedTicket.messages?.length || 0);
                const hasDisputeChange = found.dispute_status !== selectedTicket.dispute_status;
                if (hasStatusChange || hasMsgChange || hasDisputeChange) {
                    setSelectedTicket(found);
                }
            }
        }
    }, [supportTickets]);

    const sendReply = async () => {
        if ((!replyText.trim() && !replyAttachment) || !selectedTicket || uploadingSlots.reply) return;
        const currentTicketId = selectedTicket.ticketId || selectedTicket.id;
        const newMessage = {
            sender: 'client',
            text: replyText.trim() || (replyAttachment ? 'Sent an attachment' : ''),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            createdAt: new Date().toISOString(),
            attachments: replyAttachment ? { screenshot: replyAttachment } : null
        };
        const existingMsgs = Array.isArray(selectedTicket.messages) ? selectedTicket.messages : [];
        const updated = {
            ...selectedTicket,
            id: currentTicketId,
            ticketId: currentTicketId,
            messages: [...existingMsgs, newMessage],
            status: selectedTicket.status === 'Resolved' ? 'Resolved' : 'In Progress'
        };
        try {
            await updateSupportTicket(updated);
            setSelectedTicket(updated);
            setReplyText('');
            setReplyAttachment(null);
        } catch (err) {
            console.error('Failed to send reply:', err);
        }
    };

    const submitNewTicket = async (e) => {
        e.preventDefault();
        if (isSubmittingRef.current || isSubmitting) return;

        const isUploadingAny = Object.values(uploadingSlots).some(Boolean);
        if (isUploadingAny) {
            alert('Please wait for your attachments to finish uploading to Cloudinary.');
            return;
        }

        isSubmittingRef.current = true;
        setIsSubmitting(true);

        try {
            // Generate a unique ticket ID
            const randId = Math.floor(1000 + Math.random() * 8999);
            const uniqueTicketId = `TKT-${randId}`;

            // Ensure attachments are deeply copied to prevent shared reference leaks
            const ticketAttachments = {
                screenshot: newTicket.attachments.screenshot || null,
                evidence: newTicket.attachments.evidence || null,
                deliveryProof: newTicket.attachments.deliveryProof || null
            };

            const ticket = {
                id: uniqueTicketId,
                ticketId: uniqueTicketId,
                clientId: currentUser?.clientId || currentUser?.company_id || 'CLT-GUEST',
                clientName: currentUser?.name || 'Client',
                createdById: currentUser?.id || null,
                createdByEmail: currentUser?.email || null,
                createdByName: currentUser?.name || null,
                subject: newTicket.subject.trim(),
                category: newTicket.category,
                priority: newTicket.priority,
                status: 'Open',
                date: new Date().toISOString().split('T')[0],
                messages: [{ 
                    sender: 'client', 
                    text: newTicket.message.trim(), 
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    createdAt: new Date().toISOString(),
                    attachments: ticketAttachments 
                }]
            };

            if (addSupportTicket) {
                await addSupportTicket(ticket);
            } else if (updateSupportTicket) {
                await updateSupportTicket(ticket);
            }

            // Cleanly reset new ticket form
            setNewTicket({ 
                subject: '', 
                category: 'General', 
                priority: 'Medium', 
                message: '', 
                attachments: { screenshot: null, evidence: null, deliveryProof: null } 
            });
            setActiveView('list');
            if (fetchTickets) await fetchTickets();
        } catch (err) {
            console.error('Failed to create ticket:', err);
        } finally {
            isSubmittingRef.current = false;
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 pb-24">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    {activeView !== 'list' && (
                        <button
                            onClick={backToList}
                            className="flex items-center gap-2 text-muted hover:text-white text-xs font-black uppercase tracking-widest mb-2 transition-colors cursor-pointer"
                        >
                            <ArrowLeft size={14} /> Back to Cases
                        </button>
                    )}
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tighter text-white italic uppercase">
                        {activeView === 'new' ? 'New Support Case' : activeView === 'chat' ? (selectedTicket?.subject || 'Support Ticket') : 'Support Command'}
                    </h1>
                    <p className="text-secondary text-[10px] mt-1 font-black uppercase tracking-[0.15em] opacity-70 italic">
                        {activeView === 'list' 
                            ? '24/7 dedicated institutional assistance' 
                            : activeView === 'new' 
                            ? 'Submit your request to our support team' 
                            : `Case ${selectedTicket?.ticketId || selectedTicket?.id}`}
                    </p>
                </div>
                {activeView === 'list' && (
                    <button
                        onClick={() => setActiveView('new')}
                        className="btn-primary flex items-center gap-2 px-6 text-[11px] cursor-pointer"
                    >
                        <Plus size={16} /> Open New Case
                    </button>
                )}
            </div>

            {/* Stats row — only on list view */}
            {activeView === 'list' && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { label: 'Total Cases', value: myTickets.length, color: 'text-accent', icon: MessageSquare },
                        { label: 'Open', value: myTickets.filter(t => t.status === 'Open').length, color: 'text-warning', icon: AlertCircle },
                        { label: 'In Progress', value: myTickets.filter(t => t.status === 'In Progress').length, color: 'text-blue-400', icon: Clock },
                        { label: 'Resolved', value: myTickets.filter(t => t.status === 'Resolved').length, color: 'text-success', icon: CheckCircle2 },
                    ].map((s, i) => (
                        <div key={i} className="glass-card p-4 border-l-4 border-l-accent">
                            <s.icon size={18} className={`${s.color} mb-2`} />
                            <p className="text-2xl font-black tracking-tighter text-white italic">{s.value}</p>
                            <p className="text-[9px] font-black text-secondary uppercase tracking-widest mt-1 opacity-70">{s.label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* ── LIST VIEW ── */}
            <AnimatePresence mode="wait">
                {activeView === 'list' && (
                    <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                        {myTickets.length === 0 ? (
                            <div className="glass-card p-14 text-center">
                                <MessageSquare size={40} className="text-muted/30 mx-auto mb-3" />
                                <p className="text-muted font-bold text-sm">No support cases yet.</p>
                                <p className="text-muted/60 text-xs mt-1">Click "Open New Case" to get started.</p>
                            </div>
                        ) : (
                            myTickets.map((ticket, i) => (
                                <motion.div
                                    key={ticket.ticketId || ticket.id || i}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    onClick={() => openTicket(ticket)}
                                    className="glass-card p-4 border border-border hover:border-accent/30 cursor-pointer transition-all group"
                                >
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <div className="min-w-0">
                                            <span className="text-[9px] font-black text-muted uppercase tracking-widest">{ticket.ticketId || ticket.id}</span>
                                            <h3 className="text-sm font-black text-white mt-0.5 truncate">{ticket.subject}</h3>
                                        </div>
                                        <div className="flex flex-col items-end gap-1 shrink-0">
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${statusColors[ticket.status] || 'bg-white/10 text-muted'}`}>
                                                {ticket.status}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${priorityColors[ticket.priority] || 'bg-white/10 text-muted border-white/10'}`}>
                                                {ticket.priority}
                                            </span>
                                            {ticket.dispute_status && ticket.dispute_status !== 'none' && (
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                                    ticket.dispute_status === 'accepted' ? 'bg-success/20 text-success' :
                                                    ticket.dispute_status === 'rejected' ? 'bg-danger/20 text-danger' : 'bg-warning/20 text-warning'
                                                }`}>
                                                    Dispute: {ticket.dispute_status}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[9px] font-black uppercase text-muted">{ticket.category}</span>
                                            <span className="text-[9px] text-muted">{ticket.date}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button
                                                type="button"
                                                onClick={(e) => handleDeleteTicket(e, ticket)}
                                                className="p-1.5 text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-all cursor-pointer z-10"
                                                title="Delete Support Ticket"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                            <div className="flex items-center gap-1 text-muted group-hover:text-accent transition-colors">
                                                <span className="text-[9px] font-black uppercase">{ticket.messages?.length || 0} messages</span>
                                                <ChevronRight size={12} />
                                            </div>
                                        </div>
                                    </div>
                                    {ticket.messages?.length > 0 && (
                                        <p className="text-[10px] text-secondary mt-2 line-clamp-1 italic">
                                            {ticket.messages[ticket.messages.length - 1].text}
                                        </p>
                                    )}
                                </motion.div>
                            ))
                        )}

                        {/* SLA & Contact Info */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                            <div className="glass-card p-4 flex items-center gap-4">
                                <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center shrink-0">
                                    <Clock size={18} className="text-accent" />
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-muted uppercase tracking-widest">Response SLA</p>
                                    <p className="text-sm font-black text-white">&lt; 15 Minutes</p>
                                    <p className="text-[9px] text-success font-black uppercase">99.8% On-Time</p>
                                </div>
                            </div>
                            <div className="glass-card p-4 flex items-center gap-4">
                                <div className="w-10 h-10 bg-success/20 rounded-xl flex items-center justify-center shrink-0">
                                    <ShieldCheck size={18} className="text-success" />
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-muted uppercase tracking-widest">Account Lead</p>
                                    <p className="text-sm font-black text-white">Jonathan Sterling</p>
                                    <p className="text-[9px] text-accent font-black uppercase">Executive Concierge</p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* ── CHAT VIEW ── */}
                {activeView === 'chat' && selectedTicket && (
                    <motion.div key="chat" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="glass-card overflow-hidden flex flex-col" style={{ minHeight: '60vh' }}>
                        {/* Ticket Header */}
                        <div className="p-4 sm:p-5 border-b border-white/5 bg-white/[0.02]">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-3 flex-wrap">
                                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase border ${priorityColors[selectedTicket.priority] || ''}`}>
                                        {selectedTicket.priority} Priority
                                    </span>
                                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase ${statusColors[selectedTicket.status] || ''}`}>
                                        {selectedTicket.status}
                                    </span>
                                    <span className="text-[9px] font-black text-muted uppercase tracking-widest">{selectedTicket.category}</span>
                                    {selectedTicket.dispute_status && selectedTicket.dispute_status !== 'none' && (
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase ${
                                                selectedTicket.dispute_status === 'accepted' ? 'bg-success/20 text-success' :
                                                selectedTicket.dispute_status === 'rejected' ? 'bg-danger/20 text-danger' : 'bg-warning/20 text-warning'
                                            }`}>
                                                Dispute: {selectedTicket.dispute_status}
                                            </span>
                                            {selectedTicket.dispute_status === 'accepted' && (
                                                <span className="px-2.5 py-1 bg-accent/20 text-accent rounded-full text-[9px] font-black uppercase">
                                                    Refunded: ${selectedTicket.refund_amount}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-[9px] text-muted">{selectedTicket.date}</span>
                                    <button
                                        type="button"
                                        onClick={(e) => handleDeleteTicket(e, selectedTicket)}
                                        className="px-2.5 py-1 bg-danger/10 hover:bg-danger text-danger hover:text-white border border-danger/30 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                                        title="Delete this ticket"
                                    >
                                        <Trash2 size={11} /> Delete Case
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4" style={{ maxHeight: '50vh' }}>
                            {selectedTicket.messages?.map((msg, i) => (
                                <div key={i} className={`flex ${msg.sender === 'client' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] sm:max-w-[70%] p-3 sm:p-4 rounded-2xl ${msg.sender === 'client'
                                        ? 'bg-accent/10 border border-accent/20 rounded-tr-none'
                                        : 'bg-white/5 border border-border rounded-tl-none'
                                        }`}>
                                        <div className="flex items-center gap-2 mb-2">
                                            {msg.sender === 'client'
                                                ? <User size={10} className="text-accent" />
                                                : <ShieldCheck size={10} className="text-success" />}
                                            <span className="text-[8px] font-black uppercase tracking-widest opacity-60">
                                                {msg.sender === 'client' ? currentUser?.name || 'You' : 'Support Officer'}
                                            </span>
                                        </div>
                                        {msg.text && <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>}
                                        
                                        {/* Attachments strictly bound to this ticket message */}
                                        {msg.attachments && Object.values(msg.attachments).some(a => a) && (
                                            <div className="mt-3 space-y-2">
                                                <div className="flex flex-wrap gap-2.5">
                                                    {Object.entries(msg.attachments).map(([type, url]) => {
                                                        if (!url) return null;
                                                        const isCloudinary = isCloudinaryUrl(url);
                                                        const isImage = typeof url === 'string' && (
                                                            isCloudinary ||
                                                            url.includes('/image/upload') ||
                                                            url.startsWith('data:image/') || 
                                                            url.match(/\.(jpeg|jpg|gif|png|webp|avif)($|\?)/i) || 
                                                            url.startsWith('blob:')
                                                        );
                                                        return (
                                                            <div key={type} className="group/att relative">
                                                                {isImage ? (
                                                                    <div 
                                                                        onClick={() => { setImgError(false); setPreviewMedia({ type, url, isCloudinary }); }}
                                                                        className="relative w-36 h-28 sm:w-48 sm:h-36 rounded-xl overflow-hidden border border-white/10 hover:border-accent/60 transition-all cursor-pointer bg-black/50 group shadow-md"
                                                                    >
                                                                        <img 
                                                                            src={url} 
                                                                            alt={type} 
                                                                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                                                            onError={(e) => {
                                                                                e.target.style.display = 'none';
                                                                                if (e.target.nextSibling) {
                                                                                    e.target.nextSibling.style.display = 'flex';
                                                                                }
                                                                            }}
                                                                        />
                                                                        <div style={{ display: 'none' }} className="absolute inset-0 bg-white/5 flex-col items-center justify-center p-2 text-center">
                                                                            <AlertCircle size={20} className="text-warning mb-1" />
                                                                            <span className="text-[9px] font-bold text-muted uppercase">Image Expired</span>
                                                                            <span className="text-[8px] text-muted/60">Legacy session blob</span>
                                                                        </div>
                                                                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[8px] font-black uppercase tracking-wider text-accent border border-accent/20">
                                                                            {type}
                                                                        </div>
                                                                        {isCloudinary && (
                                                                            <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[7px] font-black tracking-wider text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                                                                <span>☁️ Cloudinary</span>
                                                                            </div>
                                                                        )}
                                                                        <div className="absolute inset-0 bg-accent/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                                                            <span className="px-2.5 py-1 rounded-lg bg-black/80 text-[9px] font-black uppercase tracking-widest text-white shadow backdrop-blur-sm">
                                                                                View Full
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => { setImgError(false); setPreviewMedia({ type, url, isCloudinary }); }}
                                                                        className="px-3 py-2 bg-white/5 border border-white/10 hover:border-accent/50 rounded-xl flex items-center gap-2 transition-all cursor-pointer"
                                                                    >
                                                                        <Paperclip size={12} className="text-accent" />
                                                                        <span className="text-[9px] font-black uppercase tracking-widest text-white/90">{type}</span>
                                                                        {isCloudinary && <span className="text-[8px] text-emerald-400 font-bold">☁️</span>}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                        <p className="text-[8px] text-muted text-right mt-2">{msg.time}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Reply Box */}
                        {selectedTicket.status !== 'Resolved' && selectedTicket.status !== 'Rejected' && selectedTicket.status !== 'Closed' ? (
                            <div className="p-4 border-t border-white/5 bg-white/[0.01]">
                                {replyAttachment && (
                                    <div className="mb-2 inline-flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl">
                                        <Paperclip size={12} className="text-accent" />
                                        <span className="text-[10px] text-white/80 font-bold uppercase tracking-wider">
                                            {isCloudinaryUrl(replyAttachment) ? '☁️ Cloudinary Attached' : 'Attachment Added'}
                                        </span>
                                        <button 
                                            onClick={() => setReplyAttachment(null)}
                                            className="text-muted hover:text-danger p-0.5 ml-1 transition-colors cursor-pointer"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                )}
                                {uploadingSlots.reply && (
                                    <div className="mb-2 inline-flex items-center gap-2 bg-accent/10 border border-accent/20 px-3 py-1.5 rounded-xl">
                                        <div className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                                        <span className="text-[10px] text-accent font-bold uppercase tracking-wider">Uploading to Cloudinary...</span>
                                    </div>
                                )}
                                <div className="flex gap-2 sm:gap-3 items-end">
                                    <label className={`p-3 rounded-xl border transition-all cursor-pointer shrink-0 ${uploadingSlots.reply ? 'opacity-50 pointer-events-none bg-white/5 border-white/10' : 'bg-white/5 hover:bg-white/10 text-muted hover:text-white border-white/10'}`}>
                                        <Paperclip size={18} />
                                        <input 
                                            type="file" 
                                            accept="image/*,.pdf" 
                                            className="hidden" 
                                            disabled={uploadingSlots.reply}
                                            onChange={(e) => {
                                                const file = e.target.files[0];
                                                if (file) {
                                                    handleReplyAttachmentUpload(file);
                                                    e.target.value = '';
                                                }
                                            }}
                                        />
                                    </label>
                                    <textarea
                                        placeholder="Type your message..."
                                        className="flex-1 bg-background border border-border rounded-2xl p-3 text-sm focus:border-accent outline-none resize-none min-h-[60px] max-h-[120px]"
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                                    />
                                    <button
                                        onClick={sendReply}
                                        disabled={uploadingSlots.reply}
                                        className={`p-3 bg-accent text-black rounded-xl hover:bg-accent/80 transition-all shadow-lg shadow-accent/20 shrink-0 cursor-pointer ${uploadingSlots.reply ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <Send size={18} />
                                    </button>
                                </div>
                                <p className="text-[9px] text-muted mt-2 italic">Press Enter to send. Our team typically replies within 15 minutes.</p>
                            </div>
                        ) : (
                            <div className={`p-4 border-t border-white/5 ${selectedTicket.status === 'Rejected' ? 'bg-danger/5' : 'bg-success/5'}`}>
                                <div className={`flex items-center gap-2 justify-center ${selectedTicket.status === 'Rejected' ? 'text-danger' : 'text-success'}`}>
                                    {selectedTicket.status === 'Rejected' ? (
                                        <>
                                            <AlertCircle size={16} className="text-danger" />
                                            <span className="text-xs font-black uppercase tracking-widest text-danger">This case has been rejected & closed</span>
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 size={16} />
                                            <span className="text-xs font-black uppercase tracking-widest">This case has been resolved</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* ── NEW TICKET VIEW ── */}
                {activeView === 'new' && (
                    <motion.div key="new" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                        <form onSubmit={submitNewTicket} className="glass-card p-5 sm:p-8 space-y-5">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-muted uppercase tracking-widest">Subject</label>
                                <input
                                    type="text"
                                    required
                                    value={newTicket.subject}
                                    onChange={e => setNewTicket({ ...newTicket, subject: e.target.value })}
                                    placeholder="Brief description of your issue"
                                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-accent outline-none font-medium"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest">Category</label>
                                    <select
                                        value={newTicket.category}
                                        onChange={e => setNewTicket({ ...newTicket, category: e.target.value })}
                                        className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-accent outline-none"
                                    >
                                        <option>General</option>
                                        <option>Logistics</option>
                                        <option>Finance</option>
                                        <option>Chauffeur</option>
                                        <option>Inventory</option>
                                        <option>Technical</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest">Priority</label>
                                    <select
                                        value={newTicket.priority}
                                        onChange={e => setNewTicket({ ...newTicket, priority: e.target.value })}
                                        className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-accent outline-none"
                                    >
                                        <option>Low</option>
                                        <option>Medium</option>
                                        <option>High</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-muted uppercase tracking-widest">Describe Your Issue</label>
                                <textarea
                                    required
                                    value={newTicket.message}
                                    onChange={e => setNewTicket({ ...newTicket, message: e.target.value })}
                                    placeholder="Please provide as much detail as possible..."
                                    rows={5}
                                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-accent outline-none resize-none"
                                />
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest block">Attachments & Evidence</label>
                                    <span className="text-[9px] font-bold text-emerald-400 flex items-center gap-1">
                                        <span>☁️</span> Saved permanently to Cloudinary & DB
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    {[
                                        { key: 'screenshot', label: 'Screenshot', icon: Smartphone },
                                        { key: 'evidence', label: 'Evidence', icon: FileText },
                                        { key: 'deliveryProof', label: 'Delivery Proof', icon: Truck },
                                    ].map((type) => {
                                        const isSlotUploading = uploadingSlots[type.key];
                                        const currentUrl = newTicket.attachments[type.key];
                                        const isCloudinary = isCloudinaryUrl(currentUrl);

                                        return (
                                            <div key={type.key} className="relative group">
                                                <input
                                                    type="file"
                                                    accept="image/*,.pdf"
                                                    disabled={isSlotUploading}
                                                    onChange={(e) => {
                                                        const file = e.target.files[0];
                                                        if (file) {
                                                            handleAttachmentUpload(type.key, file);
                                                            e.target.value = '';
                                                        }
                                                    }}
                                                    className={`absolute inset-0 opacity-0 z-10 ${isSlotUploading ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                                />
                                                <div className={`p-3 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-1.5 min-h-[110px] ${
                                                    currentUrl ? 'border-success/60 bg-success/5' : 
                                                    isSlotUploading ? 'border-accent/60 bg-accent/5' : 
                                                    'border-white/10 bg-white/5 hover:border-accent/40'
                                                }`}>
                                                    {isSlotUploading ? (
                                                        <div className="flex flex-col items-center gap-2 p-3 text-center">
                                                            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                                                            <span className="text-[9px] font-black uppercase tracking-widest text-accent">Uploading to Cloudinary...</span>
                                                        </div>
                                                    ) : currentUrl ? (
                                                        <div className="relative w-full h-24 flex items-center justify-center overflow-hidden rounded-xl bg-black/40">
                                                            {typeof currentUrl === 'string' && (currentUrl.startsWith('http') || currentUrl.startsWith('data:image/')) ? (
                                                                <img 
                                                                    src={currentUrl} 
                                                                    alt={type.label} 
                                                                    className="w-full h-full object-cover rounded-xl"
                                                                />
                                                            ) : (
                                                                <div className="flex flex-col items-center gap-1 text-success">
                                                                    <CheckCircle2 size={24} />
                                                                    <span className="text-[10px] font-black uppercase tracking-widest">Attached</span>
                                                                </div>
                                                            )}
                                                            <div className="absolute top-1 left-1 px-2 py-0.5 bg-black/70 backdrop-blur-sm rounded text-[8px] font-black uppercase tracking-widest text-success border border-success/30 flex items-center gap-1">
                                                                <span>{type.label}</span>
                                                                {isCloudinary && <span className="text-emerald-400">☁️</span>}
                                                            </div>
                                                            <button 
                                                                type="button" 
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    setNewTicket(prev => ({
                                                                        ...prev, 
                                                                        attachments: { ...prev.attachments, [type.key]: null }
                                                                    }));
                                                                }}
                                                                className="absolute top-1 right-1 p-1.5 bg-black/70 hover:bg-danger text-white rounded-lg transition-all z-20 cursor-pointer shadow"
                                                            >
                                                                <X size={12} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <type.icon size={22} className="text-muted group-hover:text-accent transition-colors mb-1" />
                                                            <span className="text-[9px] font-black uppercase tracking-widest text-muted group-hover:text-white transition-colors">{type.label}</span>
                                                            <span className="text-[8px] text-muted/60">Upload to Cloudinary</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2 flex-col sm:flex-row">
                                <button
                                    type="button"
                                    onClick={() => setActiveView('list')}
                                    className="flex-1 py-3 bg-white/5 border border-border text-secondary rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-white/10 transition-all cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || Object.values(uploadingSlots).some(Boolean)}
                                    className={`flex-1 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                                        isSubmitting || Object.values(uploadingSlots).some(Boolean)
                                            ? 'bg-accent/40 text-black/50 cursor-not-allowed'
                                            : 'bg-accent text-black hover:bg-accent/80 cursor-pointer shadow-lg shadow-accent/20'
                                    }`}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                            <span>Submitting Case...</span>
                                        </>
                                    ) : Object.values(uploadingSlots).some(Boolean) ? (
                                        <>
                                            <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                            <span>Uploading Attachments...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Send size={14} /> Submit Case
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Attachment Preview Modal */}
            <AnimatePresence>
                {previewMedia && (
                    <div 
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
                        onClick={() => { setPreviewMedia(null); setImgError(false); }}
                    >
                        <div 
                            className="relative max-w-3xl w-full max-h-[85vh] bg-[#121212] border border-white/10 rounded-2xl p-5 overflow-hidden flex flex-col shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between pb-3 border-b border-white/10">
                                <div className="flex items-center gap-2">
                                    <Paperclip size={14} className="text-accent" />
                                    <span className="text-xs font-black uppercase tracking-widest text-white">Attachment — {previewMedia.type}</span>
                                </div>
                                <button 
                                    onClick={() => { setPreviewMedia(null); setImgError(false); }} 
                                    className="p-1 rounded-lg text-muted hover:text-white bg-white/5 transition-colors cursor-pointer"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="flex-1 overflow-auto py-4 flex items-center justify-center min-h-[300px]">
                                {imgError ? (
                                    <div className="max-w-md p-6 bg-white/[0.03] border border-warning/30 rounded-2xl text-center space-y-3">
                                        <div className="w-12 h-12 rounded-full bg-warning/10 text-warning mx-auto flex items-center justify-center">
                                            <AlertCircle size={24} />
                                        </div>
                                        <h4 className="text-white font-bold text-sm">Attachment Unavailable (Legacy Ticket)</h4>
                                        <p className="text-muted text-xs leading-relaxed">
                                            This ticket was created earlier with a temporary browser session URL (<code className="text-accent text-[10px] break-all">{String(previewMedia.url).slice(0, 40)}...</code>) that was revoked by the browser upon reloading.
                                        </p>
                                        <p className="text-[11px] text-emerald-400 font-medium">
                                            All newly submitted cases and replies are saved permanently on Cloudinary CDN and in the database so they remain visible forever.
                                        </p>
                                    </div>
                                ) : (
                                    typeof previewMedia.url === 'string' && (previewMedia.url.startsWith('data:image/') || previewMedia.url.startsWith('blob:') || previewMedia.url.startsWith('http')) ? (
                                        <img 
                                            src={previewMedia.url} 
                                            alt={previewMedia.type} 
                                            onError={() => setImgError(true)}
                                            className="max-h-[60vh] max-w-full rounded-xl object-contain shadow-md" 
                                        />
                                    ) : (
                                        <iframe 
                                            src={previewMedia.url} 
                                            title={previewMedia.type} 
                                            className="w-full h-[55vh] rounded-xl border border-white/10" 
                                        />
                                    )
                                )}
                            </div>
                            <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    {previewMedia && isCloudinaryUrl(previewMedia.url) && (
                                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5">
                                            <span>☁️</span> Cloudinary Hosted (Permanent)
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    {!imgError && previewMedia?.url && (
                                        <>
                                            <a 
                                                href={previewMedia.url} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                className="text-xs px-3.5 py-2 flex items-center gap-2 cursor-pointer bg-white/5 border border-white/10 text-white hover:bg-white/10 rounded-xl transition-all"
                                            >
                                                <ExternalLink size={13} /> Open Original
                                            </a>
                                            <a 
                                                href={previewMedia.url} 
                                                download={`${selectedTicket?.ticketId || selectedTicket?.id || 'ticket'}_${previewMedia.type}`}
                                                className="btn-primary text-xs px-5 py-2 flex items-center gap-2 cursor-pointer rounded-xl bg-accent text-black font-bold"
                                            >
                                                <Download size={14} /> Download File
                                            </a>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ClientSupport;
