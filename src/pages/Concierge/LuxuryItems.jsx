import React, { useState } from 'react';
import Table from '../../components/Table';
import Modal from '../../components/Modal';
import { Shield, Plus, Search, DollarSign, User, Anchor, Lock, RefreshCw } from 'lucide-react';
import { useData } from '../../context/GlobalDataContext';

const LuxuryItems = () => {
    const { luxuryItems = [], addLuxuryItem, updateLuxuryItem, deleteLuxuryItem, fetchLuxuryItems, hasMenuPermission, currentUser } = useData();
    const userRole = String(currentUser?.role?.name || currentUser?.role || '').toLowerCase().replace(/\s+/g, '_');
    const canAddLuxury = hasMenuPermission('Luxury Items', 'can_add');
    
    React.useEffect(() => {
        fetchLuxuryItems();
    }, [fetchLuxuryItems]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState('view');
    const [selectedItem, setSelectedItem] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState({ item: '', owner: '', vault: 'Vault Alpha', status: 'Stored', value: '' });

    const filteredItems = luxuryItems.filter(itm =>
        itm.item?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        itm.owner?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(itm.id).toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleAction = (type, itm) => {
        setSelectedItem(itm);
        setModalType(type);
        setFormData(itm.id ? { ...itm } : { item: '', owner: '', vault: 'Vault Alpha', status: 'Stored', value: '' });
        setIsModalOpen(true);
    };

    const handleSave = () => {
        if (modalType === 'add') {
            addLuxuryItem(formData);
        } else if (modalType === 'edit') {
            updateLuxuryItem({ ...selectedItem, ...formData });
        }
        setIsModalOpen(false);
    };

    const handleDelete = () => {
        deleteLuxuryItem(selectedItem.id);
        setIsModalOpen(false);
    };

    const columns = [
        { header: "Asset ID", accessor: "id" },
        { header: "Description", accessor: "item" },
        { header: "Beneficiary", accessor: "owner" },
        { header: "Storage Unit", accessor: "vault" },
        { header: "Estimated Value", accessor: "value" },
        {
            header: "Status",
            accessor: "status",
            render: (row) => (
                <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${row.status === 'Stored' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'
                    }`}>
                    {row.status}
                </span>
            )
        },
    ];

    const totalValue = luxuryItems.reduce((sum, itm) => {
        const val = parseFloat(String(itm.value || 0).replace(/[^0-9.]/g, ''));
        return sum + (isNaN(val) ? 0 : val);
    }, 0);

    const activeTransfers = luxuryItems.filter(itm => itm.status === 'Transferred' || itm.status === 'In Use').length;

    const stats = [
        { 
            label: 'Total Assets Under Custody', 
            value: `$${(totalValue / 1000000).toFixed(1)}M`, 
            subValue: `$${totalValue.toLocaleString()}`,
            icon: Shield, 
            color: 'text-accent',
            status: 'Secured'
        },
        { 
            label: 'Active Transfers', 
            value: `${activeTransfers} Items`, 
            icon: Anchor, 
            color: 'text-secondary' 
        },
        { 
            label: 'Insurance Sync', 
            value: totalValue > 0 ? 'Active' : 'Idle', 
            icon: RefreshCw, 
            color: 'text-success' 
        }
    ];

    return (
        <div className="space-y-8">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 px-0 sm:px-2">
                <div className="min-w-0">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white font-heading italic">Luxury Asset Vault</h1>
                    <p className="text-secondary mt-1 text-xs sm:text-sm uppercase tracking-widest font-black opacity-70 italic">Institutional custody and secure storage for high-value client assets.</p>
                </div>
                <div className="flex flex-wrap sm:flex-row gap-3 w-full xl:w-auto">
                    <div className="relative flex-1 sm:flex-none sm:w-64">
                        <input
                            type="text"
                            placeholder="Search assets..."
                            className="bg-white/5 border border-white/10 rounded-xl h-11 pl-11 pr-4 text-sm leading-none focus:outline-none focus:border-accent w-full font-bold"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            <Search className="text-muted block" size={16} strokeWidth={2} />
                        </div>
                    </div>
                    {canAddLuxury && (
                        <button className="btn-primary flex items-center gap-2 px-6" onClick={() => handleAction('add', {})}>
                            <Lock size={16} /> New Entry
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.map((s, i) => (
                    <div key={i} className={`glass-card p-6 border-white/5 relative overflow-hidden group ${i === 0 ? 'bg-accent/[0.03] border-accent/20' : ''}`}>
                        <div className="flex justify-between items-start mb-4 relative z-10">
                            <div className={`p-3 rounded-2xl ${i === 0 ? 'bg-accent/20 text-accent' : 'bg-white/5 text-secondary'}`}>
                                <s.icon size={24} />
                            </div>
                            {s.status && <span className="text-[10px] font-black text-success uppercase bg-success/10 px-2 py-1 rounded tracking-widest">{s.status}</span>}
                        </div>
                        <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-1 relative z-10">{s.label}</p>
                        <p className="text-3xl font-black italic font-heading relative z-10">{s.value}</p>
                        {s.subValue && <p className="text-[10px] font-bold text-secondary mt-1 opacity-60">{s.subValue}</p>}
                        <s.icon className={`absolute -right-4 -bottom-4 w-24 h-24 opacity-[0.03] ${s.color} group-hover:scale-110 transition-transform`} />
                    </div>
                ))}
            </div>

            <div className="glass-card p-6">
                <Table
                    columns={columns}
                    data={filteredItems}
                    actions={true}
                    onView={(item) => handleAction('view', item)}
                    onEdit={(item) => handleAction('edit', item)}
                    onDelete={(item) => handleAction('delete', item)}
                    canEdit={hasMenuPermission('Luxury Items', 'can_edit')}
                    canDelete={hasMenuPermission('Luxury Items', 'can_delete')}
                />
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={
                    modalType === 'view' ? 'Asset Appraisal' :
                        modalType === 'edit' ? 'Modify Registry' :
                            modalType === 'delete' ? 'De-register Asset' : 'New Custody Entry'
                }
            >
                <div className="space-y-6">
                    {modalType === 'delete' ? (
                        <div className="space-y-4">
                            <p className="text-secondary">Are you sure you want to remove <span className="text-primary font-bold">{selectedItem?.item}</span> from the vault registry?</p>
                            <div className="flex gap-3 justify-end pt-4">
                                <button onClick={() => setIsModalOpen(false)} className="btn-secondary">Keep in Vault</button>
                                <button onClick={handleDelete} className="px-6 py-2 bg-danger text-white rounded-lg font-bold">De-register</button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 space-y-1">
                                    <label className="text-[10px] font-bold text-muted uppercase">Asset Description</label>
                                    <input
                                        type="text"
                                        value={formData.item}
                                        onChange={(e) => setFormData({ ...formData, item: e.target.value })}
                                        className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
                                        disabled={modalType === 'view'}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-muted uppercase">Beneficiary Name</label>
                                    <input
                                        type="text"
                                        value={formData.owner}
                                        onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                                        className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
                                        disabled={modalType === 'view'}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-muted uppercase">Value Estimate</label>
                                    <input
                                        type="text"
                                        value={formData.value}
                                        onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                                        className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
                                        disabled={modalType === 'view'}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-muted uppercase">Storage Vault</label>
                                    <select
                                        value={formData.vault}
                                        onChange={(e) => setFormData({ ...formData, vault: e.target.value })}
                                        className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
                                        disabled={modalType === 'view'}
                                    >
                                        <option>Vault Alpha</option>
                                        <option>Vault Bravo (Cold)</option>
                                        <option>External Safe</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-muted uppercase">Custody Status</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                        className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
                                        disabled={modalType === 'view'}
                                    >
                                        <option>Stored</option>
                                        <option>In Use</option>
                                        <option>Transferred</option>
                                        <option>Returned</option>
                                    </select>
                                </div>
                            </div>

                            {modalType === 'view' && (
                                <div className="p-4 border border-dashed border-border rounded-xl space-y-4">
                                    <div className="flex items-center gap-3">
                                        <User size={16} className="text-secondary" />
                                        <span className="text-xs text-secondary">Verified Owner:</span>
                                        <span className="text-xs font-bold text-primary">{formData.owner}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <DollarSign size={16} className="text-success" />
                                        <span className="text-xs text-secondary">Insured Value:</span>
                                        <span className="text-xs font-bold text-success">{formData.value || '$0'}</span>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3 justify-end pt-2">
                                <button onClick={() => setIsModalOpen(false)} className="btn-secondary">{modalType === 'view' ? 'Close' : 'Cancel'}</button>
                                {modalType !== 'view' && <button onClick={handleSave} className="btn-primary">Finalize Protocol</button>}
                            </div>
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default LuxuryItems;
