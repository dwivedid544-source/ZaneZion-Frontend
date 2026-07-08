import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Wallet, ArrowUpRight, ArrowDownLeft, RefreshCw,
    Download, Shield, TrendingUp, CreditCard,
    Plus, Send, History, DollarSign, Smartphone
} from 'lucide-react';
import KpiCard from '../../components/KpiCard';
import StatusBadge from '../../components/StatusBadge';
import { useData } from '../../context/GlobalDataContext';

const ClientBalance = () => {
    const { currentUser } = useData();
    const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

    // Mock balance data for demo purposes
    const [balanceData, setBalanceData] = useState({
        total: 24500.00,
        allocated: 12000.00,
        available: 12500.00,
        transactions: [
            { id: 'TX-9901', type: 'Credit', amount: 5000, date: '2025-03-01', status: 'Completed', detail: 'Wallet Top-up (Wire Transfer)' },
            { id: 'TX-9902', type: 'Debit', amount: 1200, date: '2025-03-02', status: 'Completed', detail: 'Provisioning for SY Azure' },
            { id: 'TX-9903', type: 'Debit', amount: 450, date: '2025-03-03', status: 'Completed', detail: 'Staff Expense Allocation' },
            { id: 'TX-9904', type: 'Credit', amount: 2500, date: '2025-03-04', status: 'Pending', detail: 'External Sales Settlement' },
        ]
    });

    return (
        <div className="space-y-8 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white uppercase tracking-tighter italic">
                        Financial <span className="text-accent underline decoration-accent/20 underline-offset-8">Vault</span>
                    </h1>
                    <p className="text-secondary mt-1 font-medium italic">Institutional liquidity management and balance allocation protocol.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setIsTransferModalOpen(true)}
                        className="btn-secondary flex items-center gap-2 group border-accent/20 text-accent hover:border-accent"
                    >
                        <Send size={16} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Sell / Transfer Balance</span>
                    </button>
                    <button
                        onClick={() => setIsRechargeModalOpen(true)}
                        className="btn-primary flex items-center gap-2 shadow-xl shadow-accent/10"
                    >
                        <Plus size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Purchase Credits</span>
                    </button>
                </div>
            </div>

            {/* Balance Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 glass-card p-8 border-accent/20 bg-gradient-to-br from-accent/[0.05] via-transparent to-transparent relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl -mr-32 -mt-32"></div>

                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                        <div className="space-y-2">
                            <p className="text-[10px] font-black text-accent uppercase tracking-[0.4em]">Available Capital</p>
                            <h2 className="text-6xl font-black tracking-tighter text-white">
                                <span className="text-accent opacity-50 mr-2">$</span>
                                {balanceData.total.toLocaleString()}
                                <span className="text-xl opacity-40 ml-1">.00</span>
                            </h2>
                            <div className="flex items-center gap-3 pt-4">
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-success/10 text-success rounded-full text-[9px] font-black uppercase">
                                    <TrendingUp size={10} /> +12.5% vs Prev Month
                                </div>
                                <span className="text-[9px] text-muted font-bold uppercase tracking-widest">Institutional Reserve Active</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
                            <div className="p-4 bg-white/5 border border-white/5 rounded-2xl">
                                <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">Allocated</p>
                                <p className="text-xl font-bold text-white">${balanceData.allocated.toLocaleString()}</p>
                            </div>
                            <div className="p-4 bg-white/5 border border-white/5 rounded-2xl">
                                <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">In Dispute</p>
                                <p className="text-xl font-bold text-white">$0</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="glass-card p-8 border-white/10 flex flex-col justify-between">
                    <div>
                        <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center text-accent mb-6 border border-accent/20">
                            <Shield size={24} />
                        </div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-white mb-2">Vault Protection</h3>
                        <p className="text-xs text-secondary leading-relaxed font-medium">
                            Your balance is secured by ZaneZion encryption protocols and offshore banking standards. All transfers require two-factor institutional verification.
                        </p>
                    </div>
                    <button className="text-[10px] font-black text-accent uppercase tracking-widest mt-6 flex items-center gap-2 hover:gap-3 transition-all">
                        Security Logs <ArrowUpRight size={14} />
                    </button>
                </div>
            </div>

            {/* Transaction Protocol */}
            <div className="glass-card border-accent/10">
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <h3 className="text-lg font-black text-white flex items-center gap-3 uppercase tracking-tighter">
                        <History size={20} className="text-accent" /> Ledger Archive
                    </h3>
                    <div className="flex gap-2">
                        <button className="p-2 bg-white/5 rounded-lg hover:text-accent transition-colors">
                            <RefreshCw size={14} />
                        </button>
                        <button className="p-2 bg-white/5 rounded-lg hover:text-accent transition-colors">
                            <Download size={14} />
                        </button>
                    </div>
                </div>

                <div className="p-0 overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="border-b border-white/5">
                                <th className="text-left py-4 px-8 text-[10px] font-black text-muted uppercase tracking-widest">TX ID</th>
                                <th className="text-left py-4 px-8 text-[10px] font-black text-muted uppercase tracking-widest">Classification</th>
                                <th className="text-left py-4 px-8 text-[10px] font-black text-muted uppercase tracking-widest">Description</th>
                                <th className="text-left py-4 px-8 text-[10px] font-black text-muted uppercase tracking-widest">Date / Stamp</th>
                                <th className="text-left py-4 px-8 text-[10px] font-black text-muted uppercase tracking-widest">Status</th>
                                <th className="text-right py-4 px-8 text-[10px] font-black text-muted uppercase tracking-widest">Quantitave Value</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.03]">
                            {balanceData.transactions.map((tx, idx) => (
                                <tr key={idx} className="hover:bg-white/[0.02] transition-colors group">
                                    <td className="py-5 px-8 font-mono text-[10px] text-accent tracking-widest">{tx.id}</td>
                                    <td className="py-5 px-8">
                                        <div className="flex items-center gap-3">
                                            {tx.type === 'Credit' ? (
                                                <div className="w-8 h-8 rounded-full bg-success/10 text-success flex items-center justify-center">
                                                    <ArrowUpRight size={14} />
                                                </div>
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-danger/10 text-danger flex items-center justify-center">
                                                    <ArrowDownLeft size={14} />
                                                </div>
                                            )}
                                            <span className="text-xs font-bold uppercase tracking-widest text-white">{tx.type} Protocol</span>
                                        </div>
                                    </td>
                                    <td className="py-5 px-8 text-xs font-medium text-secondary">{tx.detail}</td>
                                    <td className="py-5 px-8 text-[10px] font-black text-muted uppercase">{tx.date}</td>
                                    <td className="py-5 px-8">
                                        <StatusBadge status={tx.status} />
                                    </td>
                                    <td className={`py-5 px-8 text-right font-black text-sm ${tx.type === 'Credit' ? 'text-success' : 'text-white'}`}>
                                        {tx.type === 'Credit' ? '+' : '-'}${tx.amount.toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { icon: Send, label: 'Resell Balance', desc: 'Transfer credits to sub-accounts' },
                    { icon: DollarSign, label: 'Withdrawal', desc: 'Liquidity exit to bank' },
                    { icon: Smartphone, label: 'Card Control', desc: 'Manage institutional cards' },
                    { icon: Shield, label: 'Audit Trail', desc: 'View full financial history' }
                ].map((action, i) => (
                    <button
                        key={i}
                        className="glass-card p-6 border-white/5 hover:border-accent/40 transition-all text-left group"
                    >
                        <div className="w-10 h-10 bg-white/5 group-hover:bg-accent group-hover:text-black rounded-xl flex items-center justify-center text-accent mb-4 transition-all">
                            <action.icon size={20} />
                        </div>
                        <h4 className="text-xs font-black uppercase tracking-widest text-white mb-1">{action.label}</h4>
                        <p className="text-[10px] text-muted font-medium italic">{action.desc}</p>
                    </button>
                ))}
            </div>

            {/* Institutional Help */}
            <div className="p-8 rounded-3xl bg-black/40 border border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-6 text-center md:text-left">
                    <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center text-accent shrink-0">
                        <CreditCard size={32} />
                    </div>
                    <div>
                        <h4 className="text-xl font-black text-white uppercase tracking-tighter">Need a specialized credit line?</h4>
                        <p className="text-sm text-secondary italic">Consolidate your global logistics budget into a single corporate protocol.</p>
                    </div>
                </div>
                <button className="px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-accent hover:text-accent transition-all whitespace-nowrap">
                    Request VIP Credit Line
                </button>
            </div>
        </div>
    );
};

export default ClientBalance;
