import React, { useState } from 'react';
import Table from '../../components/Table';
import Modal from '../../components/Modal';
import { DollarSign, Plus, Download, Filter, User, Calendar, CreditCard, History, AlertTriangle, Trash2, Clock } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';
import { useData } from '../../context/GlobalDataContext';
import api from '../../services/api/setupAxios.js';
import { normalizeRole } from '../../utils/authUtils';
import { swalSuccess, swalError, swalWarning } from '../../utils/swal';

const Payroll = () => {
    const { users, fetchStaff, addLog, hasMenuPermission, currentUser } = useData();
    const [payHistory, setPayHistory] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState('add');
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [showHistory, setShowHistory] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        empId: '',
        amount: '',
        method: 'Direct Deposit',
        date: new Date().toISOString().split('T')[0],
        status: 'Pending'
    });

    const fetchPayroll = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/finance/payroll?t=${Date.now()}`);
            if(res.data && res.data.success) {
                setPayHistory(res.data.data);
            }
        } catch (err) {
            console.error("Failed to fetch payroll", err);
            setError('Failed to load payroll records.');
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => {
        fetchPayroll();
        fetchStaff();
    }, [fetchStaff]);

    const allItems = payHistory.map(p => ({
        ...p,
        empId: p.user_id || 'N/A',
        name: p.user_name || 'Unknown',
        amount: `$${(parseFloat(p.amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        method: p.method || 'Direct Deposit',
        date: p.payment_date ? new Date(p.payment_date).toISOString().split('T')[0] : new Date(p.created_at).toISOString().split('T')[0],
        status: p.status || 'Pending'
    }));

    const items = allItems.filter(p => !['paid', 'completed'].includes(p.status?.toLowerCase()));
    const historyItems = allItems.filter(p => ['paid', 'completed'].includes(p.status?.toLowerCase()));

    const columns = [
        { header: "Employee ID", accessor: "empId" },
        { header: "Employee Name", accessor: "name" },
        { header: "Amount", accessor: "amount" },
        { header: "Method", accessor: "method" },
        { header: "Date", accessor: "date" },
        {
            header: "Status",
            accessor: "status",
            render: (row) => <StatusBadge status={row.status} />
        },
    ];

    const handleAction = (type, row) => {
        if (type === 'delete') {
            setItemToDelete(row);
            setIsDeleteModalOpen(true);
            return;
        }
        setModalType(type);
        if (row) {
            // Map backend snake_case to frontend camelCase for the form
            setFormData({ 
                ...row, 
                baseSalary: row.base_salary || row.baseSalary || 0,
                bonus: row.bonus || 0,
                nibDeduction: row.nib_deduction || row.nibDeduction || 0,
                medicalDeduction: row.medical_deduction || row.medicalDeduction || 0,
                pensionDeduction: row.pension_deduction || row.pensionDeduction || 0,
                savingsDeduction: row.savings_deduction || row.savingsDeduction || 0,
                birthdayClub: row.birthday_club || row.birthdayClub || 0,
                method: row.method || 'Direct Deposit',
                date: row.date || (row.payment_date ? new Date(row.payment_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
                status: row.status || 'Pending'
            });
        }
        else setFormData({ name: '', empId: '', amount: '', baseSalary: 0, bonus: 0, nibDeduction: 0, medicalDeduction: 0, pensionDeduction: 0, savingsDeduction: 0, birthdayClub: 0, method: 'Direct Deposit', date: new Date().toISOString().split('T')[0], status: 'Pending' });
        setIsModalOpen(true);
    };

    const handleExport = () => {
        const data = showHistory ? historyItems : items;
        const headers = ["ID", "Employee ID", "Employee Name", "Amount", "Method", "Date", "Status"];
        const rows = data.map(r => [
            r.id,
            r.empId,
            r.name,
            typeof r.amount === 'string' ? r.amount.replace(',', '') : r.amount,
            r.method,
            r.date,
            r.status
        ]);

        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `payroll_${showHistory ? 'history' : 'active'}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSubmit = async () => {
        if (!formData.empId) {
            swalWarning("Validation Error", "Please select a staff member.");
            return;
        }

        const netSettlement = (parseFloat(formData.baseSalary) || 0) + (parseFloat(formData.bonus) || 0) - (parseFloat(formData.nibDeduction) || 0) - (parseFloat(formData.medicalDeduction) || 0) - (parseFloat(formData.pensionDeduction) || 0) - (parseFloat(formData.savingsDeduction) || 0) - (parseFloat(formData.birthdayClub) || 0);
        
        const reqData = {
            user_id: formData.empId,
            base_salary: formData.baseSalary || 0,
            bonus: formData.bonus || 0,
            nib_deduction: formData.nibDeduction || 0,
            medical_deduction: formData.medicalDeduction || 0,
            pension_deduction: formData.pensionDeduction || 0,
            savings_deduction: formData.savingsDeduction || 0,
            birthday_club: formData.birthdayClub || 0,
            net_amount: netSettlement,
            amount: netSettlement,
            method: formData.method,
            payment_date: formData.date,
            status: formData.status
        };

        try {
             if (modalType === 'add') {
                 await api.post('/finance/payroll', reqData);
                 swalSuccess('Success', 'Payout created successfully.');
                 if(addLog) addLog({ action: 'Payroll Disbursed', detail: `Settlement generated for ${formData.name}`, type: 'system' });
             } else if (modalType === 'edit' && formData.id) {
                 await api.put(`/finance/payroll/${formData.id}`, reqData);
                 swalSuccess('Success', 'Payout updated successfully.');
                 if(addLog) addLog({ action: 'Payroll Record Modified', detail: `Updated settlement for ${formData.name}`, type: 'system' });
             }
             
             await fetchPayroll();
             setIsModalOpen(false);
        } catch (err) {
            console.error("Failed to submit payroll:", err);
            swalError("Error", err?.response?.data?.message || err?.message || "Failed to process payroll record.");
            setError("Failed to process payroll record.");
        }
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        try {
             await api.delete(`/finance/payroll/${itemToDelete.id}`);
             await fetchPayroll();
             if(addLog) addLog({ action: 'Payroll Record Deleted', detail: `Settlement record removed.`, type: 'alert' });
        } catch (error) {
             console.error("Failed to delete payroll record", error);
        } finally {
             setIsDeleteModalOpen(false);
             setItemToDelete(null);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                        <DollarSign className="text-accent" /> Institutional Payroll
                    </h1>
                    <p className="text-secondary mt-1">Manage executive compensation and staff settlement protocols.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        className="btn-secondary flex items-center gap-2"
                        onClick={() => setShowHistory(!showHistory)}
                    >
                        <History size={16} /> {showHistory ? 'View Pending' : 'View History'}
                    </button>
                    {(hasMenuPermission('Payroll', 'can_add') || 
                      hasMenuPermission('Pay & Records', 'can_add')) && (
                        <button className="btn-primary flex items-center gap-2" onClick={() => handleAction('add')}>
                            <Plus size={16} /> New Payout
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="glass-card p-6 border-accent/10 bg-accent/[0.01]">
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Total Pending Payout</p>
                    <h3 className="text-3xl font-black text-white">
                        ${items.reduce((acc, item) => acc + (parseFloat(item.amount.replace(/[^0-9.]/g, '')) || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </h3>
                    <div className="flex items-center gap-2 mt-4 text-xs font-bold text-success">
                        <Filter size={14} /> {items.length} staff members remaining
                    </div>
                </div>
                <div className="glass-card p-6">
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Last Settlement Cycle</p>
                    <h3 className="text-3xl font-black text-white">
                        {historyItems.length > 0 ? new Date(historyItems[0].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No History'}
                    </h3>
                    <p className="text-xs text-secondary mt-4">Total Disbursement: ${historyItems.reduce((acc, item) => acc + (parseFloat(item.amount.replace(/[^0-9.]/g, '')) || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="glass-card p-6 border-info/20">
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Liquidity Status</p>
                    <h3 className="text-3xl font-black text-success uppercase tracking-widest">
                        {items.length === 0 ? 'Optimized' : 'Action Req.'}
                    </h3>
                    <p className="text-xs text-secondary mt-4 italic">Next automatic run in 2 days</p>
                </div>
            </div>

            <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold">{showHistory ? 'Payout Settlement History' : 'Active Payout Queue'}</h3>
                    <button onClick={handleExport} className="p-2 border border-border rounded-lg hover:bg-white/5 transition-all">
                        <Download size={16} className="text-muted" />
                    </button>
                </div>
                <Table
                    columns={columns}
                    data={showHistory ? historyItems : items}
                    actions={true}
                    onView={(item) => handleAction('view', item)}
                    onEdit={(item) => handleAction('edit', item)}
                    onDelete={(item) => handleAction('delete', item)}
                    canEdit={hasMenuPermission('Payroll', 'can_edit')}
                    canDelete={hasMenuPermission('Payroll', 'can_delete')}
                />
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={modalType === 'add' ? 'Initiate Institutional Payout' : 'Payout Details'}
            >
                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-6">
                        <div className="space-y-1 sm:col-span-2">
                            <label className="text-[10px] font-bold text-muted uppercase">Select Staff Member</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
                                <select
                                    className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2 text-sm focus:border-accent outline-none font-bold"
                                    value={formData.empId}
                                    onChange={(e) => {
                                        const user = users.find(u => String(u.id) === String(e.target.value));
                                        if (user) {
                                            setFormData({ 
                                                ...formData, 
                                                empId: user.id, 
                                                name: user.name 
                                            });
                                        }
                                    }}
                                    disabled={modalType === 'view' || modalType === 'edit'}
                                    required
                                >
                                    <option value="">Choose Staff...</option>
                                    {users.filter(u => {
                                        // Non-superadmins cannot manage super_admin payroll
                                        const currentRole = normalizeRole(currentUser?.role);
                                        if (currentRole !== 'superadmin' && u.role === 'super_admin') return false;
                                        return true;
                                    }).map(u => (
                                        <option key={u.id} value={u.id}>{u.name} ({String(u.role?.name || u.role || '')})</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        {formData.hours && (
                            <div className="space-y-1 sm:col-span-2 p-3 bg-white/5 border border-white/10 rounded-xl mb-2">
                                <p className="text-[10px] font-black text-accent uppercase tracking-widest flex items-center gap-2">
                                    <Clock size={12} /> Timesheet Shift Record
                                </p>
                                <p className="text-sm font-bold text-white">{formData.hours} hours <span className="text-muted text-xs font-normal italic">logged for this period</span></p>
                            </div>
                        )}
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted uppercase">{formData.hours ? 'Computed Baseline' : 'Base Salary'}</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
                                <input
                                    type="number"
                                    value={formData.baseSalary || ''}
                                    onChange={(e) => setFormData({ ...formData, baseSalary: parseFloat(e.target.value) || 0 })}
                                    className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2 text-sm focus:border-accent outline-none font-bold"
                                    placeholder="0.00"
                                    disabled={modalType === 'view'}
                                />
                            </div>
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                            <label className="text-[10px] font-bold text-muted uppercase">Performance Bonus</label>
                            <div className="relative">
                                <Plus className="absolute left-3 top-1/2 -translate-y-1/2 text-success" size={14} />
                                <input
                                    type="number"
                                    value={formData.bonus || ''}
                                    onChange={(e) => setFormData({ ...formData, bonus: parseFloat(e.target.value) || 0 })}
                                    className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2 text-sm focus:border-accent outline-none font-bold text-success"
                                    placeholder="0.00"
                                    disabled={modalType === 'view'}
                                />
                            </div>
                        </div>

                        <div className="sm:col-span-2 py-4 border-t border-white/5 mt-2">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                                <p className="text-[10px] font-black text-danger uppercase tracking-[0.2em]">Institutional Deductions</p>
                                <div className="flex flex-wrap gap-x-4 gap-y-2">
                                    {['NIB', 'Med', 'Pen', 'BDay'].map(d => (
                                        <label key={d} className="flex items-center gap-1.5 cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                checked={formData[`optIn${d}`] !== false}
                                                onChange={(e) => setFormData({ ...formData, [`optIn${d}`]: e.target.checked })}
                                                className="w-3.5 h-3.5 accent-accent"
                                            />
                                            <span className="text-[10px] font-black text-muted group-hover:text-white uppercase tracking-tighter transition-colors">{d === 'BDay' ? 'B-Day Club' : d}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-muted uppercase text-danger/70">NIB Contribution</label>
                                    <input
                                        type="number"
                                        value={formData.nibDeduction || ''}
                                        onChange={(e) => setFormData({ ...formData, nibDeduction: parseFloat(e.target.value) || 0 })}
                                        className={`w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none ${formData.optInNIB === false ? 'opacity-30' : ''}`}
                                        placeholder="0.00"
                                        disabled={modalType === 'view' || formData.optInNIB === false}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-muted uppercase text-danger/70">Medical Deduction</label>
                                    <input
                                        type="number"
                                        value={formData.medicalDeduction || ''}
                                        onChange={(e) => setFormData({ ...formData, medicalDeduction: parseFloat(e.target.value) || 0 })}
                                        className={`w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none ${formData.optInMed === false ? 'opacity-30' : ''}`}
                                        placeholder="0.00"
                                        disabled={modalType === 'view' || formData.optInMed === false}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-muted uppercase text-danger/70">Pension Contribution</label>
                                    <input
                                        type="number"
                                        value={formData.pensionDeduction || ''}
                                        onChange={(e) => setFormData({ ...formData, pensionDeduction: parseFloat(e.target.value) || 0 })}
                                        className={`w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none ${formData.optInPen === false ? 'opacity-30' : ''}`}
                                        placeholder="0.00"
                                        disabled={modalType === 'view' || formData.optInPen === false}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-muted uppercase text-danger/70">Savings / Loan</label>
                                    <input
                                        type="number"
                                        value={formData.savingsDeduction || ''}
                                        onChange={(e) => setFormData({ ...formData, savingsDeduction: parseFloat(e.target.value) || 0 })}
                                        className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
                                        placeholder="0.00"
                                        disabled={modalType === 'view'}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-muted uppercase text-accent">Birthday Club</label>
                                    <input
                                        type="number"
                                        value={formData.birthdayClub || ''}
                                        onChange={(e) => setFormData({ ...formData, birthdayClub: parseFloat(e.target.value) || 0 })}
                                        className={`w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none ${formData.optInBDay === false ? 'opacity-30' : ''}`}
                                        placeholder="0.00"
                                        disabled={modalType === 'view' || formData.optInBDay === false}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="sm:col-span-2 p-4 sm:p-5 bg-white/5 rounded-2xl border border-white/10 mt-2">
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                                <div>
                                    <p className="text-[10px] font-black text-accent uppercase tracking-widest">Final Net Settlement</p>
                                    <p className="text-[9px] text-secondary italic">Auto-calculated: (Base + Bonus) - Deductions</p>
                                </div>
                                <div className="text-left sm:text-right">
                                    <p className="text-2xl sm:text-3xl font-black text-primary italic font-heading">
                                        ${((parseFloat(formData.baseSalary) || 0) + (parseFloat(formData.bonus) || 0) - (parseFloat(formData.nibDeduction) || 0) - (parseFloat(formData.medicalDeduction) || 0) - (parseFloat(formData.pensionDeduction) || 0) - (parseFloat(formData.savingsDeduction) || 0) - (parseFloat(formData.birthdayClub) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted uppercase">Payment Channel</label>
                            <div className="relative">
                                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
                                <select
                                    value={formData.method}
                                    onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                                    className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2 text-sm focus:border-accent outline-none font-bold"
                                    disabled={modalType === 'view'}
                                >
                                    <option>Direct Deposit</option>
                                    <option>Wire Transfer</option>
                                    <option>Corporate Check</option>
                                    <option>Stripe</option>
                                </select>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted uppercase">Payout Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
                                <input
                                    type="date"
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2 text-sm focus:border-accent outline-none"
                                    disabled={modalType === 'view'}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 justify-end pt-4">
                        <button onClick={() => setIsModalOpen(false)} className="btn-secondary">{modalType === 'view' ? 'Close' : 'Cancel'}</button>
                        {modalType !== 'view' && <button onClick={handleSubmit} className="btn-primary">Confirm Settlement</button>}
                    </div>
                </div>
            </Modal>

            {/* Specialized Purge/Delete Confirmation */}
            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title="Institutional Purge Protocol"
            >
                <div className="flex flex-col items-center text-center py-4">
                    <div className="w-20 h-20 bg-danger/10 rounded-full flex items-center justify-center mb-6 animate-pulse">
                        <AlertTriangle size={40} className="text-danger" />
                    </div>
                    <h4 className="text-xl font-bold text-white mb-2">Authorize Data Purge?</h4>
                    <p className="text-sm text-secondary max-w-xs mx-auto mb-8">
                        You are about to permanently delete the payroll record for <span className="text-white font-bold">{itemToDelete?.name}</span>. This action cannot be reversed within the current cycle.
                    </p>
                    <div className="flex gap-3 w-full">
                        <button
                            onClick={() => setIsDeleteModalOpen(false)}
                            className="flex-1 btn-secondary"
                        >
                            Abort Protocol
                        </button>
                        <button
                            onClick={confirmDelete}
                            className="flex-1 bg-danger text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 hover:bg-danger/80 hover:shadow-lg hover:shadow-danger/30 active:scale-95 flex items-center justify-center gap-2"
                        >
                            <Trash2 size={16} /> Confirm Purge
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Payroll;

