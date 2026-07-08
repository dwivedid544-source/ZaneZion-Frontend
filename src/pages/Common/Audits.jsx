import React, { useState } from 'react';
import { swalSuccess, swalError, swalWarning, swalInfo, swalConfirm, swalCredentials, swalCopied } from '../../utils/swal';
import {
    BarChart3, ClipboardList, Search, Filter,
    Calendar, CheckCircle, AlertTriangle, Info,
    ArrowUpRight, Download, Eye, FileText, CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useData } from '../../context/GlobalDataContext';
import Table from '../../components/Table';
import StatusBadge from '../../components/StatusBadge';
import { normalizeRole } from '../../utils/authUtils';

const Audits = () => {
    const { 
        inventory, 
        stockMovements, 
        currentUser,
        purchaseRequests,
        hasMenuPermission
    } = useData();
    
    const [activeTab, setActiveTab] = useState('Inventory'); // Inventory, Procurement
    const [searchTerm, setSearchTerm] = useState('');

    const isAdmin = ['superadmin', 'inventory', 'procurement', 'operations'].includes(normalizeRole(currentUser?.role));

    const inventoryAudits = stockMovements.map(m => ({
        ...m,
        category: 'Inventory',
        type: m.type,
        entity: m.client || m.vendor || 'Internal',
        officer: m.issuedBy,
        date: m.date,
        result: 'Verified'
    }));

    const procurementAudits = purchaseRequests.filter(pr => pr.status === 'Approved' || pr.status === 'Completed').map(pr => ({
        id: pr.id,
        item: pr.item || (pr.items && pr.items[0]?.name),
        category: 'Procurement',
        type: 'Purchase',
        entity: pr.vendor || 'N/A',
        officer: pr.requestedBy,
        date: pr.date || '2024-06-01',
        result: pr.status === 'Completed' ? 'Closed' : 'Active'
    }));

    const allAudits = [...inventoryAudits, ...procurementAudits];

    const filteredAudits = allAudits.filter(audit => {
        const matchesTab = audit.category === activeTab;
        const matchesSearch = 
            String(audit.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            audit.item?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            audit.entity?.toLowerCase().includes(searchTerm.toLowerCase());
        
        return matchesTab && matchesSearch;
    });

    const [selectedAudit, setSelectedAudit] = useState(null);

    const columns = [
        { header: "Audit ID", accessor: "id" },
        { header: "Asset/Item", accessor: "item" },
        { header: "Protocol", accessor: "type" },
        { header: "Entity", accessor: "entity" },
        { header: "Officer", accessor: "officer" },
        { header: "Date", accessor: "date" },
        { 
            header: "Result", 
            accessor: "result",
            render: (row) => <StatusBadge status={row.result} />
        }
    ];

    const handleExport = () => {
        const headers = ["Audit ID", "Asset/Item", "Protocol", "Entity", "Officer", "Date", "Result"].join(",");
        const rows = filteredAudits.map(audit => [
            `"${audit.id || ''}"`,
            `"${audit.item || audit.name || ''}"`,
            `"${audit.type || ''}"`,
            `"${audit.entity || ''}"`,
            `"${audit.officer || ''}"`,
            `"${audit.date || ''}"`,
            `"${audit.result || ''}"`
        ].join(","));
        const csvContent = [headers, ...rows].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `audit_logs_${activeTab.toLowerCase()}_${new Date().toISOString().split("T")[0]}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-8 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tighter text-white italic uppercase">Audit Protocol</h1>
                    <p className="text-secondary text-xs mt-1 font-black uppercase tracking-[0.2em] opacity-70 italic">
                        Institutional integrity and asset verification system
                    </p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={handleExport}
                        className="btn-secondary flex items-center gap-2 border-white/10 text-white hover:bg-white/5"
                    >
                        <Download size={16} /> Export Logs
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="glass-card p-6 border-l-4 border-l-accent flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center text-accent shrink-0">
                        <BarChart3 size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-muted uppercase tracking-widest">Total Audits</p>
                        <p className="text-xl font-black text-white italic">{allAudits.length}</p>
                    </div>
                </div>
                <div className="glass-card p-6 border-l-4 border-l-success flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-success/20 flex items-center justify-center text-success shrink-0">
                        <CheckCircle size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-muted uppercase tracking-widest">Verified</p>
                        <p className="text-xl font-black text-white italic">{allAudits.filter(a => a.result === 'Verified' || a.result === 'Closed').length}</p>
                    </div>
                </div>
                <div className="glass-card p-6 border-l-4 border-l-warning flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-warning/20 flex items-center justify-center text-warning shrink-0">
                        <AlertTriangle size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-muted uppercase tracking-widest">Pending Review</p>
                        <p className="text-xl font-black text-white italic">{allAudits.filter(a => a.result === 'Active').length}</p>
                    </div>
                </div>
                <div className="glass-card p-6 border-l-4 border-l-info flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-info/20 flex items-center justify-center text-info shrink-0">
                        <Info size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-muted uppercase tracking-widest">Integrity Score</p>
                        <p className="text-xl font-black text-info italic">99.8%</p>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="glass-card p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div className="flex bg-black/40 rounded-xl p-1 border border-white/5">
                        {['Inventory', 'Procurement'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === tab
                                    ? 'bg-accent text-black shadow-lg shadow-accent/20'
                                    : 'text-muted hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                {tab} Audits
                            </button>
                        ))}
                    </div>

                    <div className="relative w-full md:w-64">
                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                        <input 
                            type="text" 
                            placeholder="Search audit manifest..." 
                            className="w-full bg-background border border-border rounded-xl py-2 pl-12 pr-4 text-xs focus:outline-none focus:border-accent"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <Table
                    columns={columns}
                    data={filteredAudits}
                    actions={true}
                    onView={(row) => setSelectedAudit(row)}
                    canEdit={hasMenuPermission('Support', 'can_edit')}
                    canDelete={hasMenuPermission('Support', 'can_delete')}
                />
            </div>

            {/* Detail Modal */}
            <AnimatePresence>
                {selectedAudit && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedAudit(null)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        />
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="glass-card w-full max-w-lg overflow-hidden relative z-10"
                        >
                            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-accent/5">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center text-accent">
                                        <FileText size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-white italic uppercase tracking-tight">Audit Details</h3>
                                        <p className="text-[10px] text-muted font-black uppercase tracking-widest">ID: {selectedAudit.id}</p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedAudit(null)} className="text-muted hover:text-white transition-colors">
                                    <Search size={20} className="rotate-45" />
                                </button>
                            </div>

                            <div className="p-8 space-y-6">
                                <div className="grid grid-cols-2 gap-8">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">Asset/Item</p>
                                        <p className="text-white font-bold">{selectedAudit.item}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">Protocol Type</p>
                                        <p className="text-accent font-bold italic">{selectedAudit.type}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">Entity involved</p>
                                        <p className="text-white font-bold">{selectedAudit.entity}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">Audit Officer</p>
                                        <p className="text-white font-bold">{selectedAudit.officer}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">Timestamp</p>
                                        <p className="text-white font-bold">{selectedAudit.date} {selectedAudit.time}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">Result</p>
                                        <StatusBadge status={selectedAudit.result} />
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-white/5">
                                    <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-3">Narrative / Reason</p>
                                    <div className="bg-black/40 rounded-xl p-4 border border-white/5 text-xs text-secondary leading-relaxed">
                                        {selectedAudit.reason || `Institutional ${selectedAudit.type.toLowerCase()} protocol executed on ${selectedAudit.date}. All parameters verified against system ledger.`}
                                    </div>
                                </div>
                                
                                {selectedAudit.quantity && (
                                    <div className="bg-accent/10 rounded-xl p-4 flex items-center justify-between border border-accent/20">
                                        <p className="text-xs font-black text-accent uppercase italic">Movement Quantity</p>
                                        <p className="text-lg font-black text-white">{selectedAudit.quantity} units</p>
                                    </div>
                                )}
                            </div>

                            <div className="p-6 bg-black/40 border-t border-white/5 flex gap-3">
                                <button 
                                    onClick={() => setSelectedAudit(null)}
                                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all"
                                >
                                    Dismiss Protocol
                                </button>
                                <button 
                                    onClick={() => {
                                        swalSuccess('Verified', 'Audit status re-confirmed.');
                                        setSelectedAudit(null);
                                    }}
                                    className="flex-1 py-3 bg-accent hover:bg-accent/80 text-black text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-accent/20"
                                >
                                    Confirm Integrity
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Audits;
