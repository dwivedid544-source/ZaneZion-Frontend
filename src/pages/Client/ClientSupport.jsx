import React, { useState } from 'react';
import {
    MessageSquare, Phone, Mail, ChevronRight, User, LifeBuoy,
    Clock, ShieldCheck, Plus, Send, X, AlertCircle, CheckCircle2,
    Paperclip, ArrowLeft, Smartphone, FileText, Truck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useData } from '../../context/GlobalDataContext';
import { normalizeRole } from '../../utils/authUtils';

const priorityColors = {
    High: 'bg-danger/20 text-danger border-danger/30',
    Medium: 'bg-warning/20 text-warning border-warning/30',
    Low: 'bg-success/20 text-success border-success/30',
};

const statusColors = {
    Open: 'bg-accent/20 text-accent',
    'In Progress': 'bg-warning/20 text-warning',
    Resolved: 'bg-success/20 text-success',
};

const ClientSupport = () => {
    const { supportTickets, updateSupportTicket, addSupportTicket, currentUser } = useData();

    const [activeView, setActiveView] = useState('list'); // 'list' | 'chat' | 'new'
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [replyText, setReplyText] = useState('');
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
    // Privacy guard: end-customer roles only see tickets they personally created.
    const myTickets = supportTickets?.filter((t) => {
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
        const sameClientAndOwnerName =
            String(t.clientId ?? '') !== '' &&
            String(currentUser?.clientId ?? '') !== '' &&
            String(t.clientId) === String(currentUser?.clientId) &&
            String(t.clientName || '').toLowerCase() === String(currentUser?.name || '').toLowerCase();

        if (isEndCustomerRole) {
            return sameOwnerId || sameOwnerEmail || sameOwnerName || sameClientAndOwnerName;
        }
        return true;
    }) || [];

    const openTicket = (ticket) => {
        setSelectedTicket(ticket);
        setActiveView('chat');
    };

    const sendReply = () => {
        if (!replyText.trim()) return;
        const newMessage = {
            sender: 'client',
            text: replyText,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        const updated = {
            ...selectedTicket,
            messages: [...selectedTicket.messages, newMessage],
            status: selectedTicket.status === 'Resolved' ? 'Resolved' : 'In Progress'
        };
        updateSupportTicket(updated);
        setSelectedTicket(updated);
        setReplyText('');
    };

    const submitNewTicket = (e) => {
        e.preventDefault();
        const ticket = {
            id: `TKT-${Math.floor(200 + Math.random() * 799)}`,
            clientId: currentUser?.clientId || 'CLT-GUEST',
            clientName: currentUser?.name || 'Client',
            createdById: currentUser?.id || null,
            createdByEmail: currentUser?.email || null,
            createdByName: currentUser?.name || null,
            subject: newTicket.subject,
            category: newTicket.category,
            priority: newTicket.priority,
            status: 'Open',
            date: new Date().toISOString().split('T')[0],
            messages: [{ 
                sender: 'client', 
                text: newTicket.message, 
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                attachments: newTicket.attachments 
            }]
        };
        if (addSupportTicket) addSupportTicket(ticket);
        else updateSupportTicket && updateSupportTicket(ticket);
        setNewTicket({ 
            subject: '', 
            category: 'General', 
            priority: 'Medium', 
            message: '', 
            attachments: { screenshot: null, evidence: null, deliveryProof: null } 
        });
        setActiveView('list');
    };

    return (
        <div className="space-y-6 pb-24">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    {activeView !== 'list' && (
                        <button
                            onClick={() => { setActiveView('list'); setSelectedTicket(null); }}
                            className="flex items-center gap-2 text-muted hover:text-white text-xs font-black uppercase tracking-widest mb-2 transition-colors"
                        >
                            <ArrowLeft size={14} /> Back to Cases
                        </button>
                    )}
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tighter text-white italic uppercase">
                        {activeView === 'new' ? 'New Support Case' : activeView === 'chat' ? selectedTicket?.subject : 'Support Command'}
                    </h1>
                    <p className="text-secondary text-[10px] mt-1 font-black uppercase tracking-[0.15em] opacity-70 italic">
                        {activeView === 'list' ? '24/7 dedicated institutional assistance' : activeView === 'new' ? 'Submit your request to our support team' : `Case ${selectedTicket?.id}`}
                    </p>
                </div>
                {activeView === 'list' && (
                    <button
                        onClick={() => setActiveView('new')}
                        className="btn-primary flex items-center gap-2 px-6 text-[11px]"
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
                                    key={ticket.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    onClick={() => openTicket(ticket)}
                                    className="glass-card p-4 border border-border hover:border-accent/30 cursor-pointer transition-all group"
                                >
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <div className="min-w-0">
                                            <span className="text-[9px] font-black text-muted uppercase tracking-widest">{ticket.id}</span>
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
                                        <div className="flex items-center gap-1 text-muted group-hover:text-accent transition-colors">
                                            <span className="text-[9px] font-black uppercase">{ticket.messages?.length || 0} messages</span>
                                            <ChevronRight size={12} />
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
                                <span className="text-[9px] text-muted">{selectedTicket.date}</span>
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
                                        <p className="text-sm leading-relaxed">{msg.text}</p>
                                        {msg.attachments && Object.values(msg.attachments).some(a => a) && (
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {Object.entries(msg.attachments).map(([type, url]) => url && (
                                                    <div key={type} className="group/file relative">
                                                        <div className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl flex items-center gap-2">
                                                            <Paperclip size={10} className="text-accent" />
                                                            <span className="text-[8px] font-black uppercase tracking-widest">{type}</span>
                                                        </div>
                                                        <a href={url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 opacity-0 cursor-pointer" />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <p className="text-[8px] text-muted text-right mt-2">{msg.time}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Reply Box */}
                        {selectedTicket.status !== 'Resolved' ? (
                            <div className="p-4 border-t border-white/5 bg-white/[0.01]">
                                <div className="flex gap-3 items-end">
                                    <textarea
                                        placeholder="Type your message..."
                                        className="flex-1 bg-background border border-border rounded-2xl p-3 text-sm focus:border-accent outline-none resize-none min-h-[60px] max-h-[120px]"
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                                    />
                                    <button
                                        onClick={sendReply}
                                        className="p-3 bg-accent text-black rounded-xl hover:bg-accent/80 transition-all shadow-lg shadow-accent/20 shrink-0"
                                    >
                                        <Send size={18} />
                                    </button>
                                </div>
                                <p className="text-[9px] text-muted mt-2 italic">Press Enter to send. Our team typically replies within 15 minutes.</p>
                            </div>
                        ) : (
                            <div className="p-4 border-t border-white/5 bg-success/5">
                                <div className="flex items-center gap-2 justify-center text-success">
                                    <CheckCircle2 size={16} />
                                    <span className="text-xs font-black uppercase tracking-widest">This case has been resolved</span>
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
                                <label className="text-[10px] font-black text-muted uppercase tracking-widest block">Attachments & Evidence</label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    {[
                                        { key: 'screenshot', label: 'Screenshot', icon: Smartphone },
                                        { key: 'evidence', label: 'Evidence', icon: FileText },
                                        { key: 'deliveryProof', label: 'Delivery Proof', icon: Truck },
                                    ].map((type) => (
                                        <div key={type.key} className="relative group">
                                            <input
                                                type="file"
                                                accept="image/*,.pdf"
                                                onChange={(e) => {
                                                    const file = e.target.files[0];
                                                    if (file) {
                                                        const url = URL.createObjectURL(file);
                                                        setNewTicket({
                                                            ...newTicket,
                                                            attachments: { ...newTicket.attachments, [type.key]: url }
                                                        });
                                                    }
                                                }}
                                                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                            />
                                            <div className={`p-4 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2 ${newTicket.attachments[type.key] ? 'border-success bg-success/5' : 'border-white/10 bg-white/5 hover:border-accent/40'}`}>
                                                {newTicket.attachments[type.key] ? <CheckCircle2 size={20} className="text-success" /> : <type.icon size={20} className="text-muted" />}
                                                <span className={`text-[9px] font-black uppercase tracking-widest ${newTicket.attachments[type.key] ? 'text-success' : 'text-muted'}`}>{type.label}</span>
                                                {newTicket.attachments[type.key] && (
                                                    <button 
                                                        type="button" 
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            setNewTicket({...newTicket, attachments: {...newTicket.attachments, [type.key]: null}});
                                                        }}
                                                        className="absolute top-1 right-1 p-1 bg-danger/20 text-danger rounded-lg hover:bg-danger hover:text-white transition-all z-20"
                                                    >
                                                        <X size={10} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2 flex-col sm:flex-row">
                                <button
                                    type="button"
                                    onClick={() => setActiveView('list')}
                                    className="flex-1 py-3 bg-white/5 border border-border text-secondary rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 bg-accent text-black rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-accent/80 transition-all flex items-center justify-center gap-2"
                                >
                                    <Send size={14} /> Submit Case
                                </button>
                            </div>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ClientSupport;
