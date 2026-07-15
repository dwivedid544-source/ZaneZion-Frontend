import React, { useState, useMemo, useEffect } from 'react';
import { swalSuccess, swalError, swalWarning, swalInfo, swalConfirm, swalCredentials, swalCopied } from '../../utils/swal';
import Table from '../../components/Table';
import Modal from '../../components/Modal';
import {
    FileText, Download, Search, CreditCard, Clock,
    CheckCircle2, MoreHorizontal, Zap, Landmark,
    QrCode, Banknote, CreditCard as CardIcon,
    Printer, Plus, Eye, ChevronRight, ShieldCheck,
    X, Wallet, Receipt
} from 'lucide-react';
import { useData } from '../../context/GlobalDataContext';

const ClientInvoices = () => {
    const { invoices, payments, settleInvoice, currentUser, clients, addInvoice, orders, fetchFinance, fetchClients, fetchOrders } = useData();

    const getOrderName = (orderId) => {
        const order = (orders || []).find(o => String(o.id) === String(orderId));
        if (!order) return '';
        let itms = order.items && order.items.length > 0 ? order.items : (order.customItems || []);
        if (typeof itms === 'string') {
            try { itms = JSON.parse(itms); } catch { itms = []; }
        }
        if (!itms || itms.length === 0) return order.product || 'General Item';
        const firstItemName = itms[0]?.item?.name || itms[0]?.name || "Unknown Item";
        if (itms.length === 1) return firstItemName;
        return `${firstItemName} (+${itms.length - 1} more)`;
    };

    const getOrderType = (orderId) => {
        const order = (orders || []).find(o => String(o.id) === String(orderId));
        if (!order) return '';
        return order.orderType || order.type || 'Custom Order';
    };

    useEffect(() => {
        fetchFinance();
        fetchClients();
        fetchOrders();
    }, [fetchFinance, fetchClients, fetchOrders]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
    const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [invoiceFormData, setInvoiceFormData] = useState({ clientId: '', totalAmount: '', status: 'Unpaid', date: new Date().toISOString().split('T')[0] });
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [selectedInvoiceIds, setSelectedInvoiceIds] = useState([]);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [settlementMethod, setSettlementMethod] = useState('Stripe');
    const [isProcessing, setIsProcessing] = useState(false);
    const [paymentSuccess, setPaymentSuccess] = useState(false);

    const userRole = localStorage.getItem('userRole');
    const isInternalAdmin = userRole === 'superadmin';

    // Identify client record for correct order attribution
    const tenantId = currentUser?.clientId || currentUser?.companyId || currentUser?.company_id;
    const isCustomerRole = (userRole || '').toLowerCase() === 'customer';
    const myClient = (clients || []).find(c => c.id === tenantId) ||
        (clients || []).find(c =>
            (currentUser?.email && c.email?.toLowerCase() === currentUser?.email?.toLowerCase()) ||
            (currentUser?.name && c.name?.toLowerCase() === currentUser?.name?.toLowerCase())
        );

    // Filter invoices to only this client's
    // For customer role: backend already filters by company_id, show all returned invoices
    const myInvoices = (isInternalAdmin || isCustomerRole)
        ? (invoices || [])
        : (invoices || []).filter(inv =>
            myClient && (inv.clientId === myClient.id || inv.company_id === myClient.id || inv.client === myClient.name)
        );

    // --- Institutional Financial Calculations ---
    const { paidYTD, outstanding } = useMemo(() => {
        const paid = myInvoices.reduce((acc, inv) => acc + parseFloat(inv.paidAmount || 0), 0);
        const total = myInvoices.reduce((acc, inv) => acc + parseFloat(inv.totalAmount || 0), 0);
        return {
            paidYTD: paid,
            outstanding: total - paid
        };
    }, [myInvoices]);

    const filteredInvoices = myInvoices.filter(inv =>
        String(inv.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.status?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const toggleSelectAll = () => {
        const payable = filteredInvoices.filter(i => i.status !== 'Paid');
        if (selectedInvoiceIds.length === payable.length) {
            setSelectedInvoiceIds([]);
        } else {
            setSelectedInvoiceIds(payable.map(i => i.id));
        }
    };

    const toggleSelectInvoice = (id) => {
        setSelectedInvoiceIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const getStatusClasses = (status) => {
        const s = String(status || '').toLowerCase();
        if (s === 'paid') return 'bg-success/20 text-success';
        if (s === 'partially_paid' || s === 'partially paid') return 'bg-info/20 text-info';
        if (s === 'unpaid' || s === 'pending' || s === 'generated' || s === 'draft' || s === 'approved' || s === 'sent') return 'bg-warning/20 text-warning';
        return 'bg-danger/20 text-danger';
    };

    const columns = [
        {
            header: <input type="checkbox" checked={selectedInvoiceIds.length > 0 && selectedInvoiceIds.length === filteredInvoices.filter(i => i.status !== 'Paid').length} onChange={toggleSelectAll} className="accent-accent cursor-pointer" />,
            accessor: "select",
            render: (row) => row.status !== 'Paid' ? (
                <input
                    type="checkbox"
                    checked={selectedInvoiceIds.includes(row.id)}
                    onChange={() => toggleSelectInvoice(row.id)}
                    className="accent-accent cursor-pointer"
                />
            ) : null
        },
        { header: "Invoice #", accessor: "id", render: (item) => <span className="font-black text-white italic tracking-tighter">{item.id}</span> },
        { header: "Issue Date", accessor: "date", render: (item) => <span className="text-secondary font-black italic">{item.date || item.createdAt?.split('T')[0]}</span> },
        { header: "Paid", accessor: "paidAmount", render: (item) => <span className="text-success font-black italic tracking-tighter">${parseFloat(item.paidAmount || 0).toLocaleString()}</span> },
        { header: "Total", accessor: "totalAmount", render: (item) => <span className="text-white font-black italic tracking-tighter">${parseFloat(item.totalAmount || 0).toLocaleString()}</span> },
        { header: "Terms / Due", accessor: "dueDate", render: (item) => <span className="text-muted font-black uppercase tracking-widest text-[9px]">{item.dueDate || 'NET-15'}</span> },
        {
            header: "Status",
            accessor: "status",
            render: (row) => (
                <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${getStatusClasses(row.status)}`}>
                    {String(row.status || '').replace(/_/g, ' ')}
                </span>
            )
        },
        {
            header: "Action",
            accessor: "id",
            render: (row) => (
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => { setSelectedInvoice(row); setIsViewModalOpen(true); }}
                        className="p-1.5 bg-white/5 text-secondary hover:text-white rounded-lg transition-all"
                        title="View Details"
                    >
                        <Eye size={14} />
                    </button>
                    {row.status !== 'Paid' ? (
                        <button
                            onClick={() => handleSettleNow(row)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/20 text-accent rounded-lg text-[10px] font-black uppercase hover:bg-accent hover:text-black transition-all"
                        >
                            <CreditCard size={12} /> Pay Now
                        </button>
                    ) : (
                        <span className="text-[10px] font-bold text-success uppercase flex items-center gap-1">
                            <CheckCircle2 size={12} /> Settled
                        </span>
                    )}
                    <button
                        onClick={() => handlePrint(row)}
                        className="p-1.5 bg-white/5 text-secondary hover:text-white rounded-lg transition-all"
                        title="Direct Print"
                    >
                        <Printer size={14} />
                    </button>
                </div>
            )
        }
    ];

    const handleSettleNow = (inv) => {
        if (inv.status === 'Paid') {
            swalWarning('Already Settled', 'This institutional asset is already settled.');
            return;
        }
        setSelectedInvoice(inv);
        setSelectedInvoiceIds([]); // Clear batch if single settle
        const remaining = inv.totalAmount - (inv.paidAmount || 0);
        setPaymentAmount(remaining.toString());
        setPaymentSuccess(false);
        setIsPaymentModalOpen(true);
    };

    const handlePrint = (inv) => {
        setSelectedInvoice(inv);
        setTimeout(() => {
            window.print();
        }, 300);
    };

    const confirmSettlement = () => {
        const amount = parseFloat(paymentAmount);
        if (!selectedInvoice && selectedInvoiceIds.length === 0) return;

        setIsProcessing(true);

        setTimeout(() => {
            if (selectedInvoiceIds.length > 0) {
                // Bulk settlement logic
                const toPay = invoices.filter(inv => selectedInvoiceIds.includes(inv.id));
                toPay.forEach(inv => {
                    const remaining = inv.totalAmount - (inv.paidAmount || 0);
                    settleInvoice(inv.id, { amount: remaining, method: settlementMethod });
                });
                setPaymentSuccess(true);
                setIsProcessing(false);
                setTimeout(() => {
                    setSelectedInvoiceIds([]);
                    setIsPaymentModalOpen(false);
                    setPaymentSuccess(false);
                }, 2000);
            } else {
                // Single settlement logic
                const remaining = selectedInvoice.totalAmount - (selectedInvoice.paidAmount || 0);
                if (isNaN(amount) || amount <= 0 || amount > remaining) {
                    swalWarning('Invalid Amount', 'Invalid settlement amount detected.');
                    setIsProcessing(false);
                    return;
                }
                settleInvoice(selectedInvoice.id, { amount, method: settlementMethod });
                setPaymentSuccess(true);
                setIsProcessing(false);
                setTimeout(() => {
                    setIsPaymentModalOpen(false);
                    setPaymentSuccess(false);
                }, 2000);
            }
        }, 1500);
    };

    const handlePaySelected = () => {
        const toPay = invoices.filter(inv => selectedInvoiceIds.includes(inv.id));
        if (toPay.length === 0) return;
        const totalOwed = toPay.reduce((acc, inv) => acc + (inv.totalAmount - (inv.paidAmount || 0)), 0);
        setSelectedInvoice(null);
        setPaymentAmount(totalOwed.toString());
        setPaymentSuccess(false);
        setIsPaymentModalOpen(true);
    };

    const handlePayAll = () => {
        const unpaid = invoices.filter(inv => inv.status !== 'Paid' && (!myClient || inv.clientId === myClient.id));
        if (unpaid.length === 0) {
            swalWarning('All Settled', 'All invoices are already settled.');
            return;
        }
        const totalOwed = unpaid.reduce((acc, inv) => acc + (inv.totalAmount - (inv.paidAmount || 0)), 0);
        setSelectedInvoiceIds(unpaid.map(i => i.id));
        setSelectedInvoice(null);
        setPaymentAmount(totalOwed.toString());
        setPaymentSuccess(false);
        setIsPaymentModalOpen(true);
    };

    const handleStatementDownload = () => {
        setIsStatementModalOpen(true);
    };

    return (
        <div className="space-y-8 pb-32">
            <style>
                {`
                    @keyframes slideUp {
                        from { transform: translateY(10px); opacity: 0; }
                        to { transform: translateY(0); opacity: 1; }
                    }
                    .animate-slide-up { animation: slideUp 0.3s ease-out forwards; }
                `}
            </style>

            <div className="no-print space-y-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <div className="bg-gradient-to-br from-accent to-accent-dark p-3.5 rounded-2xl shadow-xl shadow-accent/20">
                            <Banknote className="text-black" size={28} />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-4xl font-black tracking-tighter text-white italic uppercase">Financial Ledger</h1>
                            <p className="text-secondary text-[10px] md:text-xs mt-1 font-black uppercase tracking-[0.2em] opacity-70 flex items-center gap-2">
                                <ShieldCheck size={12} className="text-success" /> End-to-End Encrypted Fiscal records
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {myClient?.clientType === 'SaaS' && userRole !== 'customer' && (
                            <button
                                onClick={() => { setInvoiceFormData({ clientId: '', totalAmount: '', status: 'Unpaid', date: new Date().toISOString().split('T')[0] }); setIsInvoiceModalOpen(true); }}
                                className="px-6 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2"
                            >
                                <Plus size={16} /> Create Registry
                            </button>
                        )}
                        <button
                            onClick={handleStatementDownload}
                            className="px-6 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2"
                        >
                            <Download size={14} /> Export Report
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="glass-card p-6 border-accent/10 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                            <CheckCircle2 size={48} className="text-success" />
                        </div>
                        <p className="text-[10px] text-secondary font-black uppercase tracking-widest mb-1">Settled Assets (YTD)</p>
                        <p className="text-3xl font-black text-white italic tracking-tighter tabular-nums">${paidYTD.toLocaleString()}</p>
                        <div className="mt-4 flex items-center gap-2">
                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-success transition-all duration-1000" style={{ width: '100%' }}></div>
                            </div>
                        </div>
                    </div>

                    <div className="glass-card p-6 border-warning/20 bg-warning/[0.02] relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                            <Clock size={48} className="text-warning" />
                        </div>
                        <p className="text-[10px] text-secondary font-black uppercase tracking-widest mb-1">Sovereign Debt</p>
                        <p className="text-3xl font-black text-warning italic tracking-tighter tabular-nums">${outstanding.toLocaleString()}</p>
                        <button
                            onClick={handlePayAll}
                            disabled={outstanding <= 0}
                            className="mt-4 w-full py-2.5 bg-warning text-black font-black uppercase text-[10px] tracking-widest rounded-xl hover:bg-white transition-all disabled:opacity-30 flex items-center justify-center gap-2 group/btn"
                        >
                            <Zap size={14} className="group-hover:scale-110 transition-transform" /> Pay All Outstanding
                        </button>
                    </div>

                    <div className="glass-card p-6 border-accent/10 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                            <FileText size={48} className="text-accent" />
                        </div>
                        <p className="text-[10px] text-secondary font-black uppercase tracking-widest mb-1">Registry Density</p>
                        <p className="text-3xl font-black text-white italic tracking-tighter tabular-nums">{myInvoices.length} Records</p>
                        <p className="mt-4 text-[10px] font-black uppercase tracking-[0.1em] text-success italic flex items-center gap-2">
                            ✓ Active Operational Registry
                        </p>
                    </div>
                </div>

                {/* Main Table Section */}
                <div className="glass-card p-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                        <div>
                            <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Institutional Archive</h3>
                            <p className="text-[10px] text-muted font-black uppercase tracking-[0.2em] mt-1">Direct access to decentralized ledger assets.</p>
                        </div>
                        <div className="relative w-full md:w-72">
                            <input
                                type="text"
                                placeholder="Search Registry ID..."
                                className="w-full bg-background border border-border rounded-xl py-2.5 px-10 text-xs focus:outline-none focus:border-accent font-bold"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={14} />
                        </div>
                    </div>
                    <Table
                        columns={columns}
                        data={filteredInvoices}
                        actions={false}
                    />
                </div>
            </div>

            {/* Batch Action Bar */}
            <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] transition-all duration-500 ${selectedInvoiceIds.length > 0 ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0'}`}>
                <div className="bg-[#0A0A0A] border border-accent/30 rounded-2xl p-4 shadow-2xl flex items-center gap-6 backdrop-blur-xl">
                    <div className="flex items-center gap-3 px-4 border-r border-white/10">
                        <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center text-accent shadow-inner">
                            <FileText size={20} />
                        </div>
                        <div>
                            <p className="text-white font-black text-sm italic">{selectedInvoiceIds.length} Assets Selected</p>
                            <p className="text-[10px] text-muted font-black uppercase tracking-widest leading-none">Institutional Settle Batch</p>
                        </div>
                    </div>
                    <div className="px-4">
                        <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-0.5 leading-none">Net Output Value</p>
                        <p className="text-2xl font-black text-white italic tracking-tighter tabular-nums">
                            ${invoices.filter(inv => selectedInvoiceIds.includes(inv.id)).reduce((acc, inv) => acc + (inv.totalAmount - (inv.paidAmount || 0)), 0).toLocaleString()}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setSelectedInvoiceIds([])} className="px-6 py-3 bg-white/5 text-secondary font-black uppercase text-[10px] tracking-widest rounded-xl hover:text-white transition-all">Cancel</button>
                        <button onClick={handlePaySelected} className="px-8 py-3 bg-accent text-black font-black uppercase text-[10px] tracking-widest rounded-xl hover:bg-white transition-all shadow-lg shadow-accent/20 flex items-center gap-2">
                            Pay Selected Assets <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Settlement Modal (RE-REFINED) */}
            <Modal
                isOpen={isPaymentModalOpen}
                onClose={() => { if (!isProcessing) setIsPaymentModalOpen(false); }}
                title="Sovereign Payment Terminal"
                width="max-w-md"
            >
                <div className="space-y-6">
                    {paymentSuccess ? (
                        <div className="py-12 flex flex-col items-center text-center animate-slide-up">
                            <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center text-success mb-6 shadow-2xl shadow-success/20">
                                <CheckCircle2 size={48} className="animate-[scale_0.5s_ease-out]" />
                            </div>
                            <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-2">Settlement Success</h3>
                            <p className="text-secondary text-sm max-w-xs font-black uppercase tracking-widest opacity-60">
                                Institutional Ledger updated. Protocol verified & encrypted.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Summary Card */}
                            <div className="bg-white/[0.03] p-6 rounded-3xl border border-white/10 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                                    <Receipt size={64} className="text-accent" />
                                </div>
                                <div className="relative z-10">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-1">Settlement Mode</p>
                                            <p className="text-xs font-black text-white uppercase italic">
                                                {selectedInvoiceIds.length > 0 ? 'Batch Fulfillment' : `Single: ${selectedInvoice?.id}`}
                                            </p>
                                        </div>
                                        <div className="bg-accent/10 px-3 py-1.5 rounded-lg border border-accent/20">
                                            <p className="text-[10px] font-black text-accent uppercase italic">Security Secured</p>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">Total Output Payable</p>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-4xl font-black text-white italic tracking-tighter tabular-nums">${parseFloat(paymentAmount || 0).toLocaleString()}</span>
                                            <span className="text-xs text-muted font-bold uppercase">USD</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Payment Infrastructure */}
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest pl-1">Modify Allocation</label>
                                    <div className="relative group">
                                        <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-accent transition-colors" size={18} />
                                        <input
                                            type="number"
                                            value={paymentAmount}
                                            onChange={(e) => setPaymentAmount(e.target.value)}
                                            className="w-full bg-[#050505] border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white font-black text-lg focus:border-accent/50 outline-none transition-all"
                                            placeholder="0.00"
                                            disabled={isProcessing}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest pl-1">Fulfillment Protocol</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            { id: 'Stripe', label: 'Credit Protocol', icon: CardIcon },
                                            { id: 'Wire', label: 'Vault Transfer', icon: Landmark },
                                            { id: 'Crypto', label: 'Hash Ledger', icon: QrCode },
                                            { id: 'Vault', label: 'Institutional Balance', icon: Banknote }
                                        ].map(method => (
                                            <button
                                                key={method.id}
                                                onClick={() => setSettlementMethod(method.id)}
                                                disabled={isProcessing}
                                                className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${settlementMethod === method.id
                                                        ? 'bg-accent/10 border-accent text-accent shadow-lg shadow-accent/10'
                                                        : 'bg-white/5 border-white/5 text-secondary hover:border-white/20'
                                                    }`}
                                            >
                                                {method.icon && <method.icon size={18} />}
                                                <span className="text-[10px] font-black uppercase tracking-tighter">{method.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-6 border-t border-white/5">
                                <button
                                    onClick={() => setIsPaymentModalOpen(false)}
                                    disabled={isProcessing}
                                    className="flex-1 py-4 bg-white/5 text-secondary font-black rounded-xl hover:bg-white/10 hover:text-white transition-all uppercase text-[10px] tracking-widest disabled:opacity-30"
                                >
                                    Abort
                                </button>
                                <button
                                    onClick={confirmSettlement}
                                    disabled={isProcessing || !paymentAmount}
                                    className="flex-[2] py-4 bg-accent text-black font-black rounded-xl hover:bg-white transition-all uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-2 shadow-xl shadow-accent/20 disabled:opacity-30 relative overflow-hidden"
                                >
                                    {isProcessing ? (
                                        <div className="flex items-center gap-3">
                                            <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
                                            <span>Processing...</span>
                                        </div>
                                    ) : (
                                        <>Authorize Settlement <ChevronRight size={14} /></>
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </Modal>

            {/* View Invoice Modal */}
            <Modal
                isOpen={isViewModalOpen}
                onClose={() => setIsViewModalOpen(false)}
                title={`Institutional Record: ${selectedInvoice?.id}`}
            >
                {selectedInvoice && (
                    <div className="space-y-8">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center text-accent">
                                    <FileText size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white uppercase italic">{selectedInvoice.id}</h3>
                                    <p className="text-[10px] text-muted font-bold tracking-widest uppercase">Verified Asset ID</p>
                                </div>
                            </div>
                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${selectedInvoice.status === 'Paid' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}`}>
                                {selectedInvoice.status}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-6 bg-white/[0.02] p-6 rounded-2xl border border-white/5">
                            <div>
                                <p className="text-[10px] text-muted font-bold uppercase mb-1">Issue Date</p>
                                <p className="text-sm font-bold text-white">{selectedInvoice.date}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-muted font-bold uppercase mb-1">Due Date</p>
                                <p className="text-sm font-bold text-danger italic">{selectedInvoice.dueDate || 'Immediate'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-muted font-bold uppercase mb-1">Total Valuation</p>
                                <p className="text-xl font-black text-white italic underline decoration-accent/30 tracking-tighter tabular-nums">${parseFloat(selectedInvoice.totalAmount).toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-muted font-bold uppercase mb-1">Order Ref</p>
                                {(() => {
                                    const oName = getOrderName(selectedInvoice.orderId);
                                    const oType = getOrderType(selectedInvoice.orderId);
                                    return (
                                        <p className="text-sm font-bold text-accent">
                                            {selectedInvoice.orderId || 'GEN-ASY'}
                                            {oName ? ` (${oType}: ${oName})` : ''}
                                        </p>
                                    );
                                })()}
                            </div>
                        </div>

                        <div className="flex gap-4 pt-4">
                            {selectedInvoice.status !== 'Paid' && (
                                <button
                                    onClick={() => { setIsViewModalOpen(false); handleSettleNow(selectedInvoice); }}
                                    className="btn-primary flex-1 py-4 font-black uppercase tracking-widest"
                                >
                                    Proceed to Settlement
                                </button>
                            )}
                            <button
                                onClick={() => handlePrint(selectedInvoice)}
                                className="btn-secondary flex-1 flex items-center justify-center gap-2 py-4 font-black uppercase tracking-widest"
                            >
                                <Printer size={16} /> Print Protocol
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Manual Invoice Creation Modal */}
            <Modal
                isOpen={isInvoiceModalOpen}
                onClose={() => setIsInvoiceModalOpen(false)}
                title="Create Manual Institutional Invoice"
            >
                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted uppercase">Target Client</label>
                        <select
                            className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold"
                            value={invoiceFormData.clientId}
                            onChange={(e) => setInvoiceFormData({ ...invoiceFormData, clientId: e.target.value })}
                        >
                            <option value="">Select Client...</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted uppercase">Total Amount (USD)</label>
                        <input
                            type="number"
                            placeholder="0.00"
                            className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold"
                            value={invoiceFormData.totalAmount}
                            onChange={(e) => setInvoiceFormData({ ...invoiceFormData, totalAmount: e.target.value })}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted uppercase">Initial Status</label>
                        <select
                            className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold"
                            value={invoiceFormData.status}
                            onChange={(e) => setInvoiceFormData({ ...invoiceFormData, status: e.target.value })}
                        >
                            <option>Unpaid</option>
                            <option>Pending</option>
                            <option>Pro-Forma</option>
                        </select>
                    </div>
                    <div className="flex gap-3 justify-end pt-4">
                        <button onClick={() => setIsInvoiceModalOpen(false)} className="btn-secondary">Cancel</button>
                        <button
                            type="button"
                            onClick={async () => {
                                const res = await addInvoice({
                                    id: `INV-${Date.now()}`,
                                    ...invoiceFormData,
                                    dueDate: invoiceFormData.date,
                                    paidAmount: 0,
                                    createdAt: new Date().toISOString()
                                });
                                if (res?.ok) setIsInvoiceModalOpen(false);
                            }}
                            className="btn-primary px-8"
                        >
                            Generate Invoice
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Statement Generation Modal */}
            <Modal
                isOpen={isStatementModalOpen}
                onClose={() => setIsStatementModalOpen(false)}
                title="Bespoke Statement Generation"
            >
                <div className="py-8 flex flex-col items-center justify-center text-center space-y-6">
                    <div className="relative">
                        <div className="w-20 h-20 border-4 border-accent/20 border-t-accent rounded-full animate-spin"></div>
                        <Download className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-accent" size={32} />
                    </div>
                    <div className="space-y-2">
                        <h4 className="text-xl font-bold text-white tracking-tight">Compiling Fiscal Report</h4>
                        <p className="text-secondary text-sm max-w-xs mx-auto">
                            Sequencing 2024-2025 institutional records. Your encrypted PDF will be ready for download in a few seconds.
                        </p>
                    </div>
                    <div className="w-full max-w-xs bg-white/5 h-1 rounded-full overflow-hidden">
                        <div className="h-full bg-accent transition-all duration-3000" style={{ width: '100%' }}></div>
                    </div>
                    <button
                        onClick={() => setIsStatementModalOpen(false)}
                        className="btn-secondary px-8 text-xs font-bold font-black uppercase tracking-[0.2em]"
                    >
                        Close Registry
                    </button>
                </div>
            </Modal>

            {/* Premium Institutional Print Template */}
            <div className="hidden print-invoice-container bg-white text-black font-sans">
                {selectedInvoice && (
                    <div className="w-full flex-1 flex flex-col">
                        <div className="flex justify-between items-start border-b-[3px] border-black pb-4 mb-4 print-section">
                            <div className="flex items-center gap-5">
                                <img src="/logo.png" alt="ZaneZion HQ" className="w-16 h-16 object-contain" onError={(e) => e.target.style.display = 'none'} />
                                <div>
                                    <h1 className="text-xl font-black italic uppercase tracking-tighter leading-none">ZANEZION</h1>
                                    <p className="text-[8px] font-black uppercase tracking-[0.2em] mt-0.5 opacity-80">Sovereign Logistics & Intelligence Hub</p>
                                    <div className="mt-1.5 text-[7px] font-bold uppercase text-gray-400 tracking-widest leading-none">
                                        Nassau, Bahamas | Sovereign HQ | Zone 4 Financial Registry
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <h2 className="text-lg font-black text-black tracking-tighter italic border-b border-black inline-block mb-1">INVOICE</h2>
                                <p className="text-[9px] font-black text-gray-400 mt-0.5">ID: {selectedInvoice.id}</p>
                                <p className="text-[7px] font-black uppercase tracking-widest leading-none">ISSUED. {selectedInvoice.date}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-8 mb-6 px-1 print-section">
                            <div className="border-l-2 border-black pl-4">
                                <p className="text-[6px] font-black uppercase tracking-widest opacity-40 mb-0.5 underline">Stakeholder:</p>
                                <p className="text-base font-black italic tracking-tight leading-tight">{myClient?.name || 'Authorized Recipient'}</p>
                                <p className="text-[8px] text-gray-500 mt-0.5 font-medium leading-tight italic">{myClient?.address || 'Nassau Operational Hub, NP'}</p>
                            </div>
                            <div className="text-right">
                                <div className="inline-block bg-black text-white px-3 py-1 transform -skew-x-12">
                                    <p className="text-[8px] font-black uppercase tracking-widest skew-x-12 leading-none">Status: {selectedInvoice.status}</p>
                                </div>
                            </div>
                        </div>

                        <div className="mb-6 print-section">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-y border-black">
                                        <th className="text-left py-2 px-2 text-[8px] font-black uppercase tracking-widest">Protocol Description</th>
                                        <th className="text-right py-2 px-2 text-[8px] font-black uppercase tracking-widest w-32">Valuation (USD)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b border-gray-100">
                                        <td className="py-3 px-2">
                                            {(() => {
                                                const orderId = selectedInvoice.orderId;
                                                const oName = getOrderName(orderId);
                                                const oType = getOrderType(orderId);
                                                const description = oName ? `${oType} — ${oName}` : "Full Service Logistics Fulfillment";
                                                return (
                                                    <>
                                                        <p className="font-black text-sm italic tracking-tight uppercase">{description}</p>
                                                        <p className="text-[7px] text-gray-400 font-bold uppercase tracking-widest">Ref: {selectedInvoice.orderId || 'NON-COMM-DISPATCH'}</p>
                                                    </>
                                                );
                                            })()}
                                        </td>
                                        <td className="text-right py-3 px-2">
                                            <span className="text-sm font-black tracking-tighter tabular-nums">${parseFloat(selectedInvoice.totalAmount).toLocaleString()}</span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-end mb-6 pr-2 print-section">
                            <div className="w-64">
                                <div className="flex justify-between items-center p-3 bg-black text-white">
                                    <p className="text-[8px] font-black uppercase">Total Due</p>
                                    <h3 className="text-xl font-black italic tracking-tighter tabular-nums">${parseFloat(selectedInvoice.totalAmount).toLocaleString()} USD</h3>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 border-l-[6px] border-black italic print-section mb-6">
                            <h4 className="text-[8px] font-black uppercase tracking-[0.05em] mb-2 text-black underline leading-none">Legal Settlement & Arbitration Terms</h4>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="text-[6px] text-gray-400 leading-normal uppercase font-bold text-justify">
                                    1. <strong>Execution:</strong> Demand for payment for services rendered. Failure to remit by maturity triggers automatic protocol lien against asset registry.
                                    2. <strong>Jurisdiction:</strong> Governed by the laws of the Commonwealth of the Bahamas.
                                </div>
                                <div className="text-[6px] text-gray-400 leading-normal uppercase font-bold text-justify">
                                    3. <strong>Arbitration:</strong> Discrepancies must be filed within 48h. Late filings not recognized by sovereign audit committee.
                                    4. <strong>Confidentiality:</strong> Level 4 Fiscal Record. Unauthorized distribution is a breach of security.
                                </div>
                            </div>
                        </div>

                        <div className="mt-auto pt-4 border-t border-gray-100 flex justify-between items-end print-section">
                            <div>
                                <p className="text-[6px] font-black uppercase tracking-[0.2em] opacity-30 italic">Authenticated Signature</p>
                                <p className="text-[7px] font-black mt-1.5 uppercase tracking-widest leading-none">General Counsel | ZANEZION LOGISTICS</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[6px] font-black uppercase tracking-[0.3em] opacity-30">HASH: ZZ-INV-{Date.now().toString(16).slice(-6).toUpperCase()}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClientInvoices;
