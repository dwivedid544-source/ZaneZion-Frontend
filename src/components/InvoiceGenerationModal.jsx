import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { FileText, DollarSign, Calendar, Landmark, ShieldCheck, CheckCircle2, X } from 'lucide-react';

const InvoiceGenerationModal = ({ isOpen, onClose, order, onGenerate }) => {
    const [dueDate, setDueDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [editableItems, setEditableItems] = useState([]);

    useEffect(() => {
        if (order?.items) {
            setEditableItems(JSON.parse(JSON.stringify(order.items)));
        }
    }, [order]);

    if (!order) return null;

    const handleItemChange = (index, field, value) => {
        const newItems = [...editableItems];
        newItems[index] = { ...newItems[index], [field]: value };
        setEditableItems(newItems);
    };

    const total = editableItems.reduce((acc, item) => acc + (parseFloat(item.price || 0) * parseInt(item.qty || 0)), 0);

    const handleGenerate = () => {
        setIsGenerating(true);
        setTimeout(() => {
            onGenerate({ ...order, items: editableItems, dueDate, totalAmount: total });
            setIsGenerating(false);
            onClose();
        }, 1500);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Institutional Ledger Commitment"
            maxWidth="max-w-3xl"
        >
            <div className="flex flex-col max-h-[85vh]">
                {/* Protocol Header - Compact */}
                <div className="px-4 py-4 border-b border-white/5 flex flex-wrap justify-between items-center gap-4 bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center text-accent border border-accent/20">
                            <FileText size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black italic text-white uppercase tracking-tighter leading-none">Draft Ledger</h2>
                            <p className="text-[8px] text-accent font-black uppercase tracking-[0.2em] mt-1">Ref: {order.id}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                            <p className="text-[9px] text-muted font-black uppercase tracking-[0.1em]">Target Entity</p>
                            <p className="text-sm font-black text-white leading-none">{typeof order.client === 'object' && order.client !== null ? (order.client.companyName || order.client.name) : (order.client || 'Institutional Account')}</p>
                        </div>
                        <div className="px-3 py-1.5 bg-warning/10 border border-warning/20 text-warning rounded-lg text-[9px] font-black uppercase tracking-widest animate-pulse">
                            In Calibration
                        </div>
                    </div>
                </div>

                {/* Terms & Valuation Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-white/[0.01]">
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 group transition-colors hover:border-accent/20">
                        <div className="flex items-center gap-3">
                            <Calendar size={14} className="text-accent" />
                            <div>
                                <p className="text-[8px] text-muted font-black uppercase tracking-widest leading-none mb-1">Due Protocol</p>
                                <input
                                    type="date"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                    className="bg-transparent text-xs font-black text-white focus:outline-none cursor-pointer"
                                />
                            </div>
                        </div>
                        <span className="text-[10px] font-black text-accent/50 hidden md:block italic">NET-07</span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-accent/10 rounded-xl border border-accent/20 shadow-lg shadow-accent/5">
                        <div className="flex items-center gap-3">
                            <Landmark size={14} className="text-accent" />
                            <div>
                                <p className="text-[10px] text-accent font-black uppercase tracking-widest leading-none">Fiscal Total</p>
                                <p className="text-lg font-black italic text-white leading-none mt-1">${total.toLocaleString()}</p>
                            </div>
                        </div>
                        <span className="text-[10px] font-black text-white/40 uppercase">USD</span>
                    </div>
                </div>

                {/* Scrollable Item Manifest */}
                <div className="flex-1 overflow-y-auto px-4 py-2 custom-scrollbar min-h-[200px] border-b border-white/5 font-sans">
                    <div className="space-y-3">
                        {editableItems.map((item, idx) => (
                            <div key={idx} className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex flex-wrap items-center justify-between gap-4 group hover:bg-white/5 transition-all">
                                <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                                    <div className="text-[10px] font-black text-muted/50 font-mono">{String(idx + 1).padStart(2, '0')}</div>
                                    <div className="flex-1">
                                        <p className="text-sm font-black text-white leading-snug">{item.name}</p>
                                        <div className="flex items-center gap-4 mt-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] font-black text-muted uppercase">Qty</span>
                                                <input
                                                    type="number"
                                                    value={item.qty}
                                                    onChange={(e) => handleItemChange(idx, 'qty', parseInt(e.target.value) || 0)}
                                                    className="w-12 bg-black/40 border border-white/10 rounded px-1.5 py-1 text-xs text-white focus:border-accent outline-none font-black text-center"
                                                />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] font-black text-muted uppercase">Rate</span>
                                                <div className="flex items-center bg-black/40 border border-white/10 rounded px-2 py-1 focus-within:border-accent transition-all">
                                                    <span className="text-secondary text-[10px]">$</span>
                                                    <input
                                                        type="number"
                                                        value={item.price}
                                                        onChange={(e) => handleItemChange(idx, 'price', parseFloat(e.target.value) || 0)}
                                                        className="w-16 bg-transparent border-none p-0 text-xs text-white focus:outline-none ml-1 font-black"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right pl-4 border-l border-white/5">
                                    <p className="text-sm font-black text-white font-mono leading-none">${(item.price * item.qty).toLocaleString()}</p>
                                    <p className="text-[8px] text-muted font-black uppercase tracking-widest mt-1">Institutional</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer Actions - Highly Responsive */}
                <div className="p-4 sm:p-6 bg-white/[0.02] flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="w-10 h-10 bg-success/10 rounded-xl flex items-center justify-center text-success border border-success/20">
                            <ShieldCheck size={18} />
                        </div>
                        <div className="leading-tight">
                            <p className="text-[10px] font-black text-white uppercase tracking-widest">Protocol Clear</p>
                            <p className="text-[8px] text-success font-black uppercase tracking-tighter italic">Validated for Commitment</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <button
                            onClick={onClose}
                            className="flex-1 md:flex-none h-11 px-6 text-[10px] font-black text-secondary uppercase tracking-[0.2em] hover:text-danger transition-colors"
                        >
                            Abort
                        </button>
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className="flex-1 md:flex-none h-11 px-8 bg-accent text-black rounded-xl text-[11px] font-black uppercase tracking-[0.2em] shadow-lg shadow-accent/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
                        >
                            {isGenerating ? (
                                <>
                                    <div className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                    <span>Syncing...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 size={16} />
                                    <span>Commit Ledger</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default InvoiceGenerationModal;
