import React, { useState } from 'react';
import Table from '../../components/Table';
import Modal from '../../components/Modal';
import { useData } from '../../context/GlobalDataContext';
import {
    Plus, Search, FileText, Download,
    CheckCircle2, AlertCircle, DollarSign,
    Printer, Send, Trash2, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import StatusBadge from '../../components/StatusBadge';
import { useInvoices, useCreateInvoice, useUpdateInvoiceStatus, useCreatePayment, useUpdateInvoice } from '../../hooks/api/useFinance';
import { swalSuccess, swalError, swalConfirm } from '../../utils/swal';
import { RefreshCcw } from 'lucide-react';
import Pagination from '../../components/Common/Pagination';
import { normalizeRole } from '../../utils/authUtils';

const Invoices = () => {
    const { orders, deliveries, clients, customerUsers, currentUser, fetchOrders, fetchDeliveries, fetchClients, fetchCustomerUsers, hasMenuPermission } = useData();

    const [page, setPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');

    const { data: invoicesData, isLoading, error } = useInvoices(page, 10, searchTerm);
    const invoices = invoicesData?.data?.invoices || [];
    const totalItems = invoicesData?.data?.total || 0;
    const totalPages = invoicesData?.data?.totalPages || 1;

    const createInvoiceMutation = useCreateInvoice();
    const updateInvoiceStatusMutation = useUpdateInvoiceStatus();
    const createPaymentMutation = useCreatePayment();
    const updateInvoiceMutation = useUpdateInvoice();
    React.useEffect(() => {
        fetchOrders();
        fetchDeliveries();
        fetchClients();
        fetchCustomerUsers({ include_all: true, include_client_role: true });
    }, [fetchOrders, fetchDeliveries, fetchClients, fetchCustomerUsers]);

    // Merge company clients + personal customers for the dropdown
    const allClientsForDropdown = React.useMemo(() => {
        const companyClients = clients.map(c => ({ id: c.id, name: c.name || c.companyName, type: 'company' }));
        const personal = (customerUsers || []).map(u => ({ id: `user_${u.id}`, name: u.name, type: 'customer' }));
        return [...companyClients, ...personal];
    }, [clients, customerUsers]);
    const isClient = normalizeRole(currentUser?.role) === 'client';
    const isSuperAdmin = normalizeRole(currentUser?.role) === 'superadmin';
    const procurementInvoiceReadOnly = normalizeRole(currentUser?.role) === 'procurement';

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [modalType, setModalType] = useState('view');
    const [actionStatus, setActionStatus] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [invoiceToDelete, setInvoiceToDelete] = useState(null);

    const [formData, setFormData] = useState({
        orderId: '',
        clientId: '',
        totalAmount: 0,
        paidAmount: 0,
        status: 'Unpaid',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    });

    // Lookup a client by id from both company clients and personal customers
    const findClientById = (id) => {
        if (!id) return null;
        const idStr = String(id);
        const fromCompany = clients.find(c => String(c.id) === idStr);
        if (fromCompany) return fromCompany;
        const numId = idStr.startsWith('user_') ? idStr.replace('user_', '') : idStr;
        const fromCustomers = (customerUsers || []).find(u => String(u.id) === numId);
        return fromCustomers ? { ...fromCustomers, name: fromCustomers.name } : null;
    };

    const filteredInvoices = invoices;
    const currentInvoices = invoices;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (procurementInvoiceReadOnly && (modalType === 'add' || modalType === 'edit')) return;
        if (modalType === 'add') {
            const matchedDelivery = (deliveries || []).find(d => {
                const rowOrderNum = Number(formData.orderId);
                const deliveryOrderNum = Number(d?.order_id_raw) || Number(String(d?.orderId ?? '').replace(/\D/g, '')) || null;
                return rowOrderNum != null && deliveryOrderNum != null && rowOrderNum === deliveryOrderNum;
            });
            const deliveryId = matchedDelivery ? Number(matchedDelivery.db_id) : Number(formData.orderId);

            const selectedOrder = orders.find(o => String(o.id) === String(formData.orderId));
            const items = (selectedOrder?.items && selectedOrder.items.length > 0)
                ? selectedOrder.items.map(item => ({
                    itemId: Number(item.itemId || item.id || 1),
                    quantity: Number(item.quantity || item.qty || 1),
                    unitPrice: Number(item.unitPrice || item.price || 0),
                    tax: 0,
                    discount: 0
                }))
                : [{
                    itemId: 1,
                    quantity: 1,
                    unitPrice: Number(formData.totalAmount) || 0,
                    tax: 0,
                    discount: 0
                }];

            const isoDueDate = formData.dueDate ? new Date(formData.dueDate).toISOString() : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

            const parsedClientId = String(formData.clientId).startsWith('user_')
                ? Number(String(formData.clientId).replace('user_', ''))
                : Number(formData.clientId);

            try {
                await createInvoiceMutation.mutateAsync({
                    deliveryId,
                    dueDate: isoDueDate,
                    items,
                    clientId: parsedClientId,
                    paidAmount: Number(formData.paidAmount) || 0
                });
            } catch (err) {
                const apiErrorMsg = err.response?.data?.message || err.message || '';
                alert(`Failed to generate invoice. ${apiErrorMsg || "Please ensure the order/delivery is completed with POD."}`);
            }
        } else if (modalType === 'edit') {
            try {
                await updateInvoiceMutation.mutateAsync({
                    // Always use the integer primary key (row.id) — never invoiceNumber
                    id: selectedInvoice.id,
                    invoiceData: {
                        clientId: String(formData.clientId).startsWith('user_') ? Number(String(formData.clientId).replace('user_', '')) : Number(formData.clientId),
                        orderId: Number(formData.orderId),
                        totalAmount: Number(formData.totalAmount),
                        paidAmount: Number(formData.paidAmount),
                        // Pass status only when Cancelled (backend derives all other statuses automatically)
                        ...(formData.status === 'Cancelled' ? { status: 'Cancelled' } : {}),
                        dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : undefined
                    }
                });
                swalSuccess(`Invoice ${selectedInvoice.invoiceNumber || selectedInvoice.id} updated successfully.`);
            } catch (err) {
                const apiErrorMsg = err.response?.data?.message || err.message || '';
                swalError(`Failed to update invoice. ${apiErrorMsg}`);
            }
        }
        setIsModalOpen(false);
        setFormData({ orderId: '', clientId: '', totalAmount: 0, paidAmount: 0, status: 'Unpaid', dueDate: '' });
    };

    const columns = [
        {
            // Show human-readable invoiceNumber; the integer id is used for API calls
            header: "Invoice #",
            accessor: "invoiceNumber",
            render: (row) => <span className="font-mono font-bold text-accent/80 text-xs">{row.invoiceNumber || row.id}</span>
        },
        { header: "Order Ref", accessor: "orderId" },
        {
            header: "Client",
            accessor: "clientId",
            render: (row) => {
                const client = findClientById(row.clientId);
                return (
                    <div className="flex flex-col">
                        <span className="font-bold">{client?.name || client?.companyName || row.client?.companyName || row.clientName || 'Institutional Asset'}</span>
                        <span className="text-[10px] text-muted">{row.clientId}</span>
                    </div>
                );
            }
        },
        {
            header: "Amount",
            accessor: "totalAmount",
            render: (row) => <span className="font-bold text-accent">${parseFloat(row.totalAmount).toLocaleString()}</span>
        },
        {
            header: "Balance",
            accessor: "paidAmount",
            render: (row) => {
                const balance = row.totalAmount - row.paidAmount;
                return (
                    <span className={`font-mono text-xs ${balance === 0 ? 'text-success' : 'text-danger'}`}>
                        ${balance.toLocaleString()}
                    </span>
                );
            }
        },
        {
            header: "Date",
            accessor: "date",
            render: (row) => {
                const d = row.date || row.invoiceDate || row.createdAt;
                return d ? new Date(d).toLocaleDateString() : '—';
            }
        },
        {
            header: "Status",
            accessor: "status",
            render: (row) => <StatusBadge status={row.status} />
        }
    ];


    const handleAction = (type, inv) => {
        if (procurementInvoiceReadOnly && (type === 'add' || type === 'edit')) return;
        setModalType(type);
        if (type === 'add') {
            setSelectedInvoice(null);
            setFormData({
                orderId: '',
                clientId: '',
                totalAmount: 0,
                paidAmount: 0,
                status: 'Unpaid',
                dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            });
        } else {
            setSelectedInvoice(inv);
            const mapStatusToUi = (status) => {
                if (!status) return 'Unpaid';
                const s = status.toLowerCase();
                if (s === 'generated' || s === 'unpaid' || s === 'draft' || s === 'approved' || s === 'sent') return 'Unpaid';
                if (s === 'partially_paid') return 'Partially Paid';
                if (s === 'paid') return 'Paid';
                if (s === 'overdue') return 'Overdue';
                if (s === 'cancelled') return 'Cancelled';
                return 'Unpaid';
            };
            setFormData({
                orderId: inv.orderId || '',
                clientId: inv.clientId || '',
                totalAmount: inv.totalAmount || 0,
                paidAmount: inv.paidAmount || 0,
                // Map backend status to UI label
                status: (() => {
                    const s = (inv.status || '').toLowerCase();
                    if (s === 'paid') return 'Paid';
                    if (s === 'partially_paid') return 'Partially Paid';
                    if (s === 'overdue') return 'Overdue';
                    if (s === 'cancelled') return 'Cancelled';
                    return 'Unpaid';
                })(),
                dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString().split('T')[0] : (inv.date ? new Date(new Date(inv.date).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : '')
            });
        }
        setIsModalOpen(true);
    };

    const handlePrint = (inv) => {
        setSelectedInvoice(inv);
        setActionStatus('printing');
        setTimeout(() => {
            window.print();
            setActionStatus(null);
        }, 300);
    };

    return (
        <div className="space-y-8">

            <div className="no-print-logic space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">Financial Invoicing</h1>
                        <p className="text-secondary mt-1">Generate and oversee institutional billing & payment status.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <AnimatePresence>
                            {actionStatus && (
                                <motion.div
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className="px-4 py-2 bg-accent/10 border border-accent/30 rounded-xl flex items-center gap-3"
                                >
                                    <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                                    <span className="text-[10px] font-black text-accent uppercase tracking-[0.2em]">
                                        {actionStatus === 'printing' ? 'Generating Secure Protocol...' :
                                            actionStatus === 'sending' ? 'Dispatching Secure Channel...' :
                                                'Settling Institutional Ledger...'}
                                    </span>
                                </motion.div>
                            )}
                        </AnimatePresence>
                        {!procurementInvoiceReadOnly && (!isClient || (clients.find(c => c.id === currentUser?.clientId)?.clientType === 'SaaS')) && hasMenuPermission('Invoices', 'can_add') && (
                            <button
                                onClick={() => handleAction('add', {})}
                                className="btn-primary flex items-center gap-2"
                            >
                                <Plus size={18} /> Create New Invoice
                            </button>
                        )}
                        {procurementInvoiceReadOnly && (
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted">Procurement: view / print / download only — invoice creation is restricted.</p>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {[
                        { label: 'Total Outstanding', value: filteredInvoices.filter(i => i.status !== 'Paid').reduce((acc, i) => acc + (i.totalAmount - i.paidAmount), 0), icon: AlertCircle, color: 'text-warning' },
                        { label: 'Revenue (MTD)', value: filteredInvoices.filter(i => i.status === 'Paid').reduce((acc, i) => acc + i.totalAmount, 0), icon: CheckCircle2, color: 'text-success' },
                        { label: 'Pending Approval', value: filteredInvoices.filter(i => i.status === 'Unpaid').length, icon: Clock, color: 'text-accent', isCount: true },
                        { label: 'Total Invoiced', value: filteredInvoices.reduce((acc, i) => acc + i.totalAmount, 0), icon: DollarSign, color: 'text-primary' }
                    ].map((stat, idx) => (
                        <div key={idx} className="glass-card p-6 border-white/5 relative overflow-hidden group">
                            <stat.icon className={`absolute -right-4 -bottom-4 w-24 h-24 opacity-5 ${stat.color} group-hover:scale-110 transition-transform`} />
                            <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2">{stat.label}</p>
                            <p className="text-3xl font-bold">
                                {stat.isCount ? stat.value : `$${stat.value.toLocaleString()}`}
                            </p>
                        </div>
                    ))}
                </div>

                <div className="glass-card p-6 border-white/5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <div className="relative max-w-sm w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
                            <input
                                type="text"
                                placeholder="Search by ID, Client or Order..."
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setPage(1);
                                }}
                                className="w-full bg-background border border-border rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-accent font-bold"
                            />
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex justify-center p-12"><RefreshCcw className="animate-spin text-accent" /></div>
                    ) : error ? (
                        <div className="text-danger p-4">Failed to load invoices.</div>
                    ) : (
                        <>
                            <Table
                                columns={columns}
                                data={currentInvoices}
                                actions={true}
                                customAction={(inv) => (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handlePrint(inv); }}
                                        className="p-2 rounded-lg text-secondary hover:text-white hover:bg-white/10 transition-all flex items-center justify-center"
                                        title="Print Protocol"
                                    >
                                        <Printer size={16} />
                                    </button>
                                )}
                                onView={(inv) => handleAction('view', inv)}
                                onEdit={(inv) => handleAction('edit', inv)}
                                canEdit={!procurementInvoiceReadOnly && hasMenuPermission('Invoices', 'can_edit')}
                            />
                            <div className="mt-6 border-t border-white/5 pt-6">
                                <Pagination
                                    currentPage={page}
                                    totalPages={totalPages}
                                    onPageChange={setPage}
                                    totalItems={totalItems}
                                />
                            </div>
                        </>
                    )}
                </div>

                <Modal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    title={modalType === 'add' ? 'Generate Institutional Invoice' : modalType === 'edit' ? 'Recalibrate Invoice Parameters' : 'Invoice Protocol Details'}
                >
                    {(modalType === 'add' || modalType === 'edit') ? (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest">Linked Order</label>
                                    <select
                                        className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:border-accent outline-none font-bold"
                                        value={formData.orderId}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            const order = orders.find(o => String(o.id) === String(val));
                                            if (order) {
                                                setFormData({
                                                    ...formData,
                                                    orderId: order.id,
                                                    clientId: order.clientId,
                                                    totalAmount: order.total || 0,
                                                    paidAmount: 0 // Default to 0 when selecting new order
                                                });
                                            } else {
                                                setFormData({ ...formData, orderId: val });
                                            }
                                        }}
                                        required
                                    >
                                        <option value="">Select Order...</option>
                                        {orders.filter(o => !invoices.some(i => String(i.orderId) === String(o.id)) || String(o.id) === String(formData.orderId)).map(o => (
                                            <option key={o.id} value={o.id}>{o.id} - {o.orderType || o.type || 'Institutional Order'} (${o.total})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest">Client Account</label>
                                    <select
                                        className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:border-accent outline-none font-bold"
                                        value={formData.clientId}
                                        onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                                        required
                                    >
                                        <option value="">Choose Client...</option>
                                        {clients.length > 0 && (
                                            <optgroup label="Company Clients">
                                                {clients.map(c => (
                                                    <option key={c.id} value={c.id}>{c.name || c.companyName}</option>
                                                ))}
                                            </optgroup>
                                        )}
                                        {customerUsers?.length > 0 && (
                                            <optgroup label="Personal Customers">
                                                {customerUsers.map(u => (
                                                    <option key={`user_${u.id}`} value={`user_${u.id}`}>{u.name}</option>
                                                ))}
                                            </optgroup>
                                        )}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest">Invoiced Amount</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
                                        <input
                                            type="number"
                                            className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:border-accent outline-none font-bold"
                                            value={formData.totalAmount === 0 ? '' : formData.totalAmount}
                                            onChange={(e) => setFormData({ ...formData, totalAmount: parseFloat(e.target.value) || 0 })}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest">Paid Amount</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
                                        <input
                                            type="number"
                                            className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:border-accent outline-none font-bold"
                                            value={formData.paidAmount === 0 ? '' : formData.paidAmount}
                                            onChange={(e) => setFormData({ ...formData, paidAmount: parseFloat(e.target.value) || 0 })}
                                            required
                                        />
                                    </div>
                                </div>
                                {/* Live Due Amount — auto-calculated, read-only */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest">Due Amount (Auto-Calculated)</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
                                        <input
                                            type="text"
                                            readOnly
                                            className={`w-full bg-background/50 border rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none font-black cursor-not-allowed ${
                                                (Number(formData.totalAmount) - Number(formData.paidAmount)) <= 0
                                                    ? 'border-success/40 text-success'
                                                    : 'border-danger/40 text-danger'
                                            }`}
                                            value={`${Math.max(0, Number(formData.totalAmount) - Number(formData.paidAmount)).toLocaleString()}`}
                                        />
                                    </div>
                                    <p className="text-[9px] text-muted/60 font-bold uppercase tracking-widest">
                                        Invoiced Amount − Paid Amount • Status auto-derived on save
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest">Payment Status</label>
                                    <select
                                        className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:border-accent outline-none font-bold"
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                        required
                                    >
                                        <option value="Unpaid">Unpaid</option>
                                        <option value="Partially Paid">Partially Paid</option>
                                        <option value="Paid">Paid</option>
                                        <option value="Overdue">Overdue</option>
                                        <option value="Cancelled">Cancelled</option>
                                    </select>
                                    <p className="text-[9px] text-muted/60 font-bold uppercase tracking-widest">
                                        Only "Cancelled" is applied — all other statuses are auto-derived by the system
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest">Date of Maturity (Due Date)</label>
                                    <input
                                        type="date"
                                        className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:border-accent outline-none font-bold"
                                        value={formData.dueDate}
                                        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">Cancel</button>
                                <button type="submit" className="btn-primary">{modalType === 'add' ? 'Generate & Authenticate Invoice' : 'Commit Changes'}</button>
                            </div>
                        </form>
                    ) : selectedInvoice && (
                        <div className="space-y-8">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-3xl font-bold text-white">{selectedInvoice.id}</h2>
                                    <p className="text-[10px] text-accent font-bold uppercase tracking-widest mt-1">Institutional Billing Record</p>
                                </div>
                                <StatusBadge status={selectedInvoice.status} size="lg" />
                            </div>

                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-1">Bill To</p>
                                        <p className="text-sm font-bold text-white">{clients.find(c => c.id === selectedInvoice.clientId)?.name || selectedInvoice.clientName}</p>
                                        <p className="text-xs text-secondary mt-1">{clients.find(c => c.id === selectedInvoice.clientId)?.address || 'Verified Institutional Address'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-1">Payment Method</p>
                                        <p className="text-xs text-white font-bold">{clients.find(c => c.id === selectedInvoice.clientId)?.paymentMethod || 'Corporate Wire Transfer'}</p>
                                    </div>
                                </div>
                                <div className="space-y-4 text-right">
                                    <div>
                                        <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-1">Issue Date</p>
                                        <p className="text-xs font-bold text-white">{selectedInvoice.date}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-1">Due Date</p>
                                        <p className="text-xs font-bold text-danger">{selectedInvoice.dueDate || 'Immediate'}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-[10px] font-black text-muted uppercase tracking-widest">Description & Order References</span>
                                    <span className="text-[10px] font-black text-muted uppercase tracking-widest">Valuation</span>
                                </div>
                                <div className="flex justify-between items-center py-3 border-t border-white/5">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-white">Full Service Procurement — Ref {selectedInvoice.orderId}</span>
                                        <span className="text-[10px] text-secondary">High-End Logistics & Supply Chain Management</span>
                                    </div>
                                    <span className="text-sm font-bold text-white">${parseFloat(selectedInvoice.totalAmount).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center py-6 border-t border-white/10 mt-6">
                                    <span className="text-sm font-bold text-accent uppercase tracking-widest">Total Due (USD)</span>
                                    <span className="text-3xl font-bold text-primary">${parseFloat(selectedInvoice.totalAmount).toLocaleString()}</span>
                                </div>
                            </div>

                            <div className="flex justify-between items-center pt-6 border-t border-white/5">
                                <div className="flex gap-2">
                                    <button className="btn-secondary" onClick={() => setIsModalOpen(false)}>Close Archive</button>
                                    {selectedInvoice.status !== 'Paid' && (
                                        <button
                                            className="btn-primary bg-success hover:bg-success/80 border-success/20 flex items-center gap-2"
                                            onClick={async () => {
                                                setActionStatus('settling');
                                                try {
                                                    await createPaymentMutation.mutateAsync({
                                                        invoiceId: selectedInvoice.id,
                                                        amount: selectedInvoice.totalAmount - (selectedInvoice.paidAmount || 0),
                                                        paymentMethod: 'bank_transfer',
                                                        referenceNumber: `TRX-${Date.now()}`
                                                    });
                                                    setIsModalOpen(false);
                                                } catch (err) {
                                                    alert("Payment failed.");
                                                } finally {
                                                    setActionStatus(null);
                                                }
                                            }}
                                        >
                                            <CheckCircle2 size={16} /> Mark as Paid
                                        </button>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        className="btn-secondary flex items-center gap-2"
                                        onClick={() => window.print()}
                                    >
                                        <Printer size={16} /> Print
                                    </button>
                                    <button
                                        className="btn-primary flex items-center gap-2"
                                        onClick={() => window.print()}
                                    >
                                        <Download size={16} /> Export PDF Manifest
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </Modal>

                {/* --- PREMIUM DELETE CONFIRMATION MODAL --- */}
                <Modal
                    isOpen={showDeleteConfirm}
                    onClose={() => setShowDeleteConfirm(false)}
                    title="Institutional Record Termination"
                >
                    <div className="space-y-6">
                        <div className="p-4 bg-danger/10 border border-danger/20 rounded-2xl flex items-start gap-4">
                            <div className="p-2 bg-danger/20 rounded-lg text-danger">
                                <AlertCircle size={24} />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-white uppercase tracking-tight">Security Protocol Alert</h4>
                                <p className="text-xs text-secondary mt-1">You are about to permanently purge <span className="text-danger font-bold">{invoiceToDelete?.id}</span> from the sovereign financial ledger. This action is irreversible.</p>
                            </div>
                        </div>

                        <div className="flex gap-3 justify-end pt-4 border-t border-white/5">
                            <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary">Abort Termination</button>
                            <button
                                onClick={() => {
                                    deleteInvoice(invoiceToDelete.id);
                                    setShowDeleteConfirm(false);
                                    setInvoiceToDelete(null);
                                }}
                                className="px-6 py-2 bg-danger hover:bg-danger/80 text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg shadow-danger/20"
                            >
                                Confirm Permanent Purge
                            </button>
                        </div>
                    </div>
                </Modal>
            </div>

            {/* Premium Institutional Invoice Print Template */}
            <div className="hidden invoice-print-container bg-white text-black font-sans">
                {selectedInvoice && (
                    <div className="w-full flex-1 flex flex-col">
                        {/* Sovereign Header */}
                        <div className="flex justify-between items-start border-b-[3px] border-black pb-4 mb-4 print-section">
                            <div className="flex items-center gap-5">
                                {/* Logo removed per user request - watermark used instead */}
                                <div>
                                    <h1 className="text-xl font-black italic uppercase tracking-tighter leading-none">ZANEZION</h1>
                                    <p className="text-[8px] font-black uppercase tracking-[0.2em] mt-0.5 opacity-80">Institutional Asset & Fiscal Management</p>
                                    <div className="mt-1.5 text-[7px] font-bold uppercase text-gray-400 tracking-widest leading-none">
                                        Nassau, Bahamas | Sovereign HQ | Financial Division
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <h2 className="text-lg font-black text-black tracking-tighter italic border-b border-black inline-block mb-1 uppercase">Official Invoice</h2>
                                <p className="text-[9px] font-black text-gray-400 mt-0.5">PROTOCOL ID: {selectedInvoice.id}</p>
                                <p className="text-[7px] font-black uppercase tracking-widest leading-none">ISSUED. {selectedInvoice.date}</p>
                            </div>
                        </div>

                        {/* Counterparty & Status Section */}
                        <div className="grid grid-cols-2 gap-8 mb-6 px-1 print-section">
                            <div className="border-l-2 border-black pl-4">
                                <p className="text-[6px] font-black uppercase tracking-widest opacity-40 mb-0.5 underline italic">Bill To Counterparty:</p>
                                <p className="text-base font-black italic tracking-tight uppercase leading-tight">
                                    {(() => {
                                        const cl = findClientById(selectedInvoice.clientId);
                                        return cl?.name || cl?.companyName || selectedInvoice.client?.companyName || selectedInvoice.clientName || 'Institutional Asset';
                                    })()}
                                </p>
                                <p className="text-[8px] text-gray-500 mt-0.5 font-medium leading-tight italic">Institutional Account Partner</p>
                                <p className="text-[7px] font-black mt-1 text-gray-400">REGISTRY: {selectedInvoice.clientId || 'ZN-ACC-EXT'}</p>
                            </div>
                            <div className="text-right">
                                <div className="inline-block bg-black text-white px-3 py-1 rounded-sm transform -skew-x-12">
                                    <p className="text-[8px] font-black uppercase tracking-widest skew-x-12 leading-none">Status: {selectedInvoice.status}</p>
                                </div>
                                <div className="flex gap-4 mt-2 justify-end text-right">
                                    <div>
                                        <p className="text-[6px] font-black uppercase tracking-widest opacity-40 mb-0.5 leading-none">Maturity Date:</p>
                                        <p className="text-xs font-black italic uppercase leading-none">{selectedInvoice.dueDate || 'Immediate'}</p>
                                    </div>
                                    <div className="border-l border-gray-300 pl-4">
                                        <p className="text-[6px] font-black uppercase tracking-widest opacity-40 mb-0.5 leading-none">Due Amount:</p>
                                        <p className="text-xs font-black italic uppercase leading-none text-red-600">${parseFloat(selectedInvoice.totalAmount - (selectedInvoice.paidAmount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* High-Resolution Itemized Ledger */}
                        <div className="mb-6 print-section">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-y border-black">
                                        <th className="text-left py-2 px-2 text-[8px] font-black uppercase tracking-widest">Description of Sourcing / Service Protocol</th>
                                        <th className="text-center py-2 px-2 text-[8px] font-black uppercase tracking-widest w-16">Qty</th>
                                        <th className="text-right py-2 px-2 text-[8px] font-black uppercase tracking-widest w-32">Valuation (USD)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(selectedInvoice.items || []).length > 0 ? (
                                        selectedInvoice.items.map((item, idx) => (
                                            <tr key={idx} className="border-b border-gray-100">
                                                <td className="py-3 px-2">
                                                    <div className="flex flex-col gap-0.5">
                                                        <p className="font-black text-sm italic tracking-tight uppercase leading-tight">{item.name}</p>
                                                        <p className="text-[7px] text-gray-400 font-bold uppercase tracking-widest italic leading-none">Institutional Asset Category</p>
                                                    </div>
                                                </td>
                                                <td className="text-center py-3 px-2 font-black italic text-xs opacity-40 leading-none">{item.qty || 1}</td>
                                                <td className="text-right py-3 px-2">
                                                    <span className="text-sm font-black tracking-tighter">
                                                        ${(parseFloat(item.price || 0) * parseInt(item.qty || 1)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr className="border-b border-gray-100">
                                            <td className="py-3 px-2">
                                                <div className="flex flex-col gap-0.5">
                                                    <p className="font-black text-sm italic tracking-tight uppercase leading-tight">Institutional Procurement — Ref {selectedInvoice.orderId}</p>
                                                    <p className="text-[7px] text-gray-400 font-bold uppercase tracking-widest italic leading-none">Full Service Supply Chain Management</p>
                                                </div>
                                            </td>
                                            <td className="text-center py-3 px-2 font-black italic text-xs opacity-40 leading-none">01</td>
                                            <td className="text-right py-3 px-2">
                                                <span className="text-sm font-black tracking-tighter">
                                                    ${parseFloat(selectedInvoice.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Financial Totals & Verification */}
                        <div className="flex justify-end mb-6 pr-2 print-section">
                            <div className="w-64 space-y-1">
                                <div className="flex justify-between items-center py-1 border-t border-black">
                                    <p className="text-[8px] font-black uppercase tracking-tighter opacity-100 italic">Total Invoiced Amount</p>
                                    <span className="text-sm font-bold italic">${parseFloat(selectedInvoice.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between items-center py-1 border-t border-gray-200">
                                    <p className="text-[8px] font-black uppercase tracking-tighter opacity-100 italic">Total Paid Amount</p>
                                    <span className="text-sm font-bold italic">${parseFloat(selectedInvoice.paidAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 border border-black bg-gray-50 text-black rounded-none">
                                    <div className="flex flex-col text-left">
                                        <p className="text-[6px] font-black uppercase tracking-widest text-black">Total Due Amount</p>
                                        <p className="text-[7px] font-bold leading-none mt-0.5 text-gray-500">Fixed Fiscal Registry</p>
                                    </div>
                                    <h3 className="text-xl font-black italic tracking-tighter text-black">${parseFloat(selectedInvoice.totalAmount - (selectedInvoice.paidAmount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })} USD</h3>
                                </div>
                                <p className="text-[6px] text-gray-400 font-bold italic mt-1 text-right uppercase tracking-widest">Auth Code: ZZ-{selectedInvoice.id}</p>
                            </div>
                        </div>

                        {/* Legal & Sovereign Terms */}
                        <div className="p-4 bg-gray-50 border-l-[6px] border-black italic print-section mb-6">
                            <h4 className="text-[8px] font-black uppercase tracking-[0.05em] mb-2 text-black underline leading-none">Financial Settlement Protocols</h4>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="text-[6px] text-gray-400 leading-normal uppercase font-bold text-justify">
                                    1. <strong>Settlement Maturity:</strong> Please remit institutional settlement by the specified due date to avoid protocol suspension or registry flagging.
                                    2. <strong>Verification:</strong> Wire transfers must include the unique Protocol ID as the primary reference identifier for ledger reconciliation.
                                </div>
                                <div className="text-[6px] text-gray-400 leading-normal uppercase font-bold text-justify">
                                    3. <strong>Jurisdiction:</strong> All financial interactions are governed by the sovereign laws of the Commonwealth of the Bahamas.
                                    4. <strong>Audit Trail:</strong> This document serves as a master fiscal record. Disputes must be filed within 72 hours of protocol issuance.
                                </div>
                            </div>
                        </div>

                        {/* Footer Authenticator */}
                        <div className="mt-auto pt-4 border-t border-gray-100 flex justify-between items-end print-section">
                            <div>
                                <p className="text-[6px] font-black uppercase tracking-[0.2em] opacity-30 mb-0.5 italic">Authorized Fiscal Signature</p>
                                <div className="relative">
                                    <div className="w-48 h-[1px] bg-black/20" />
                                    <p className="absolute -top-3 left-1 font-black italic text-gray-300 text-[10px] opacity-20 select-none uppercase tracking-tighter leading-none">Chief Financial Officer</p>
                                </div>
                                <p className="text-[7px] font-black mt-1.5 uppercase tracking-widest leading-none">Treasury Division | ZANEZION INTELLIGENCE</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[6px] font-black uppercase tracking-[0.3em] opacity-30 mb-0.5">HASH: ZZ-INV-{Date.now().toString(16).slice(-6).toUpperCase()}</p>
                                <p className="text-[8px] font-black tracking-tighter italic leading-none">VERIFIED FISCAL PROTOCOL v5.2 // NASSAU HQ</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Invoices;
