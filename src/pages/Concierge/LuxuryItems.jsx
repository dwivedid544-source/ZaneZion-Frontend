import React, { useState, useMemo, useEffect } from 'react';
import Table from '../../components/Table';
import Modal from '../../components/Modal';
import { Shield, Plus, Search, DollarSign, User, Anchor, Lock, RefreshCw, Filter, CheckCircle2 } from 'lucide-react';
import { useData } from '../../context/GlobalDataContext';
import { normalizeRole } from '../../utils/authUtils';
import { swalWarning } from '../../utils/swal';

const LuxuryItems = () => {
    const {
        luxuryItems = [],
        addLuxuryItem,
        updateLuxuryItem,
        deleteLuxuryItem,
        fetchLuxuryItems,
        hasMenuPermission,
        currentUser,
        clients = [],
        fetchClients,
        customerUsers = [],
        fetchCustomerUsers,
    } = useData();

    useEffect(() => {
        if (fetchLuxuryItems) fetchLuxuryItems();
        if (fetchClients) fetchClients();
        if (fetchCustomerUsers) fetchCustomerUsers({ include_all: 1 });

        const handleStateChange = () => {
            if (fetchLuxuryItems) fetchLuxuryItems();
        };
        window.addEventListener('app:state-changed', handleStateChange);
        return () => window.removeEventListener('app:state-changed', handleStateChange);
    }, [fetchLuxuryItems, fetchClients, fetchCustomerUsers]);

    const role = normalizeRole(currentUser?.role);
    const isAdmin = ['superadmin', 'admin', 'concierge', 'operations'].includes(role);
    const isClient = !isAdmin;
    const canAddLuxury = isAdmin && hasMenuPermission('Luxury Items', 'can_add');
    const canEditLuxury = isAdmin && hasMenuPermission('Luxury Items', 'can_edit');
    const canDeleteLuxury = isAdmin && hasMenuPermission('Luxury Items', 'can_delete');

    // Resolve client ID and name for the logged-in client user
    const myClientId = currentUser?.clientId || currentUser?.companyId || currentUser?.company_id || currentUser?.id;
    const myClientName = currentUser?.clientName || currentUser?.companyName || currentUser?.name || '';
    
    const currentClient = useMemo(() => {
        if (!clients || !clients.length) return null;
        return clients.find(c =>
            (myClientId != null && String(c.id) === String(myClientId)) ||
            (currentUser?.email && c.email && c.email.toLowerCase() === currentUser.email.toLowerCase()) ||
            (myClientName && (
                (c.name && c.name.toLowerCase() === myClientName.toLowerCase()) ||
                (c.companyName && c.companyName.toLowerCase() === myClientName.toLowerCase()) ||
                (c.business_name && c.business_name.toLowerCase() === myClientName.toLowerCase())
            ))
        );
    }, [clients, myClientId, myClientName, currentUser?.email]);

    const myClientIds = useMemo(() => {
        const ids = new Set();
        if (currentUser?.id != null) ids.add(String(currentUser.id));
        if (currentUser?.clientId != null) ids.add(String(currentUser.clientId));
        if (currentUser?.client_id != null) ids.add(String(currentUser.client_id));
        if (currentUser?.companyId != null) ids.add(String(currentUser.companyId));
        if (currentUser?.company_id != null) ids.add(String(currentUser.company_id));
        if (currentClient?.id != null) ids.add(String(currentClient.id));
        
        const userEmail = String(currentUser?.email || '').toLowerCase().trim();
        if (userEmail && Array.isArray(clients)) {
            clients.forEach(c => {
                if (c && String(c.email || '').toLowerCase().trim() === userEmail) {
                    if (c.id != null) ids.add(String(c.id));
                }
            });
        }
        return ids;
    }, [currentUser, currentClient, clients]);

    const effectiveClientId = currentClient?.id != null ? String(currentClient.id) : (myClientId != null ? String(myClientId) : null);

    // Build unified list of available clients for Admin dropdown
    const availableClients = useMemo(() => {
        const list = [];
        const seenIds = new Set();

        (clients || []).forEach(c => {
            if (!c || !c.id) return;
            const idStr = String(c.id);
            if (seenIds.has(idStr)) return;
            seenIds.add(idStr);
            const name = c.companyName || c.name || c.business_name || c.contactPerson || c.contact_person || `Client #${c.id}`;
            const type = c.clientType || c.client_type || 'Client';
            list.push({
                id: idStr,
                name: name,
                email: c.email || '',
                type: type,
                contactPerson: c.contactPerson || c.contact_person || name,
            });
        });

        (customerUsers || []).forEach(u => {
            if (!u || !u.id) return;
            const idStr = String(u.id);
            if (seenIds.has(idStr)) return;
            seenIds.add(idStr);
            const name = u.name || u.fullName || u.username || `Customer #${u.id}`;
            list.push({
                id: idStr,
                name: name,
                email: u.email || '',
                type: 'Personal Customer',
                contactPerson: name,
            });
        });

        return list.sort((a, b) => a.name.localeCompare(b.name));
    }, [clients, customerUsers]);

    const [adminClientFilter, setAdminClientFilter] = useState('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState('view');
    const [selectedItem, setSelectedItem] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState({
        item: '',
        clientId: '',
        clientName: '',
        owner: '',
        vault: 'Vault Alpha',
        status: 'Stored',
        value: '',
        notes: '',
    });

    // Client-specific isolation
    const clientScopedItems = useMemo(() => {
        if (isAdmin) {
            if (adminClientFilter && adminClientFilter !== 'all') {
                return luxuryItems.filter(itm =>
                    String(itm.clientId) === String(adminClientFilter) ||
                    String(itm.client_id) === String(adminClientFilter)
                );
            }
            return luxuryItems;
        }

        // Client User: STRICT ISOLATION by client's unique database ID
        return luxuryItems.filter(itm => {
            const itmCid = itm.clientId ?? itm.client_id;
            if (itmCid != null && myClientIds.has(String(itmCid))) {
                return true;
            }
            if (myClientName) {
                const itmCname = itm.clientName || itm.client_name || itm.owner;
                return itmCname && itmCname.toLowerCase() === myClientName.toLowerCase();
            }
            return false;
        });
    }, [isAdmin, adminClientFilter, luxuryItems, myClientIds, myClientName]);

    const filteredItems = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return clientScopedItems;
        return clientScopedItems.filter(itm =>
            itm.item?.toLowerCase().includes(q) ||
            itm.owner?.toLowerCase().includes(q) ||
            itm.clientName?.toLowerCase().includes(q) ||
            String(itm.id).toLowerCase().includes(q)
        );
    }, [clientScopedItems, searchTerm]);

    const handleAction = (type, itm) => {
        setSelectedItem(itm);
        setModalType(type);
        if (type === 'add') {
            const preselectedClient = adminClientFilter !== 'all'
                ? availableClients.find(c => c.id === adminClientFilter)
                : null;
            setFormData({
                item: '',
                clientId: preselectedClient ? preselectedClient.id : '',
                clientName: preselectedClient ? preselectedClient.name : '',
                owner: preselectedClient ? preselectedClient.contactPerson : '',
                vault: 'Vault Alpha',
                status: 'Stored',
                value: '',
                notes: '',
            });
        } else {
            setFormData({
                ...itm,
                item: itm.item || itm.name || '',
                clientId: itm.clientId || itm.client_id || '',
                clientName: itm.clientName || itm.client_name || itm.owner || '',
                owner: itm.owner || itm.owner_name || '',
                vault: itm.vault || itm.vault_location || 'Vault Alpha',
                status: itm.status || 'Stored',
                value: itm.value || itm.estimated_value || itm.price || '',
                notes: itm.notes || '',
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (isAdmin && modalType !== 'view') {
            if (!formData.clientId) {
                swalWarning('Client Required', 'Please select a client from the dropdown to assign this luxury item to.');
                return;
            }
        }
        if (!formData.item || !formData.item.trim()) {
            swalWarning('Description Required', 'Please provide an asset description.');
            return;
        }

        const clientObj = availableClients.find(c => String(c.id) === String(formData.clientId));
        const resolvedClientName = formData.clientName || (clientObj ? clientObj.name : '');
        const resolvedOwner = formData.owner || (clientObj ? clientObj.contactPerson : '') || 'Beneficiary';

        const payload = {
            ...formData,
            clientId: formData.clientId ? String(formData.clientId) : (clientObj ? clientObj.id : null),
            client_id: formData.clientId ? String(formData.clientId) : (clientObj ? clientObj.id : null),
            clientName: resolvedClientName,
            client_name: resolvedClientName,
            owner: resolvedOwner,
            owner_name: resolvedOwner,
        };

        setIsModalOpen(false);

        if (modalType === 'add') {
            await addLuxuryItem(payload);
        } else if (modalType === 'edit') {
            await updateLuxuryItem({ ...selectedItem, ...payload });
        }
    };

    const handleDelete = async () => {
        setIsModalOpen(false);
        if (selectedItem?.itemId || selectedItem?.id) {
            await deleteLuxuryItem(selectedItem.itemId || selectedItem.id);
        }
    };

    const columns = useMemo(() => {
        const base = [
            { header: "Asset ID", accessor: "id" },
            { header: "Description", accessor: "item" },
        ];

        if (isAdmin) {
            base.push({
                header: "Assigned Client",
                accessor: "clientName",
                render: (row) => (
                    <div className="flex flex-col">
                        <span className="font-bold text-white text-xs">{row.clientName || row.owner || 'General Client'}</span>
                        {row.clientId && (
                            <span className="text-[9px] font-mono text-accent font-semibold">ID: #{row.clientId}</span>
                        )}
                    </div>
                )
            });
            base.push({ header: "Beneficiary", accessor: "owner" });
        } else {
            base.push({ header: "Beneficiary", accessor: "owner" });
        }

        base.push({ header: "Storage Unit", accessor: "vault" });
        base.push({ header: "Estimated Value", accessor: "value" });
        base.push({
            header: "Status",
            accessor: "status",
            render: (row) => (
                <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
                    row.status === 'Stored' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'
                }`}>
                    {row.status}
                </span>
            )
        });

        return base;
    }, [isAdmin]);

    const totalValue = clientScopedItems.reduce((sum, itm) => {
        const val = parseFloat(String(itm.value || 0).replace(/[^0-9.]/g, ''));
        return sum + (isNaN(val) ? 0 : val);
    }, 0);

    const activeTransfers = clientScopedItems.filter(itm => itm.status === 'Transferred' || itm.status === 'In Use').length;

    const stats = [
        {
            label: isClient ? 'Private Assets Secured' : 'Total Assets Under Custody',
            value: totalValue >= 1000000 ? `$${(totalValue / 1000000).toFixed(1)}M` : `$${totalValue.toLocaleString()}`,
            subValue: totalValue >= 1000000 ? `$${totalValue.toLocaleString()}` : null,
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
            label: 'Custody Insurance',
            value: totalValue > 0 ? 'Active' : 'Idle',
            icon: RefreshCw,
            color: 'text-success'
        }
    ];

    return (
        <div className="space-y-8 animate-fade-in pb-12">
            {/* Header */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 px-0 sm:px-2">
                <div className="min-w-0">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white font-heading italic">
                        {isClient ? 'Private Luxury Asset Vault' : 'Luxury Asset Vault'}
                    </h1>
                    <p className="text-secondary mt-1 text-xs sm:text-sm uppercase tracking-widest font-black opacity-70 italic">
                        {isClient
                            ? `Exclusive custody and bespoke asset storage for ${currentClient?.name || currentUser?.name || 'You'}.`
                            : 'Institutional custody, secure storage, and individual client mapping for high-value assets.'}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                    {/* Admin Client Dropdown Filter */}
                    {isAdmin && (
                        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 h-11 w-full sm:w-auto">
                            <Filter size={15} className="text-accent shrink-0" />
                            <select
                                value={adminClientFilter}
                                onChange={(e) => setAdminClientFilter(e.target.value)}
                                className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer w-full sm:w-56"
                            >
                                <option value="all" className="bg-[#1a1a2e] text-white">All Clients (Show All)</option>
                                {availableClients.map(c => (
                                    <option key={c.id} value={c.id} className="bg-[#1a1a2e] text-white">
                                        {c.name} ({c.type})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Search Field */}
                    <div className="relative flex-1 sm:flex-none sm:w-64">
                        <input
                            type="text"
                            placeholder="Search assets..."
                            className="bg-white/5 border border-white/10 rounded-xl h-11 pl-11 pr-4 text-sm leading-none focus:outline-none focus:border-accent w-full font-bold text-white placeholder-muted/50"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            <Search className="text-muted block" size={16} strokeWidth={2} />
                        </div>
                    </div>

                    {/* Admin New Entry Button */}
                    {canAddLuxury && (
                        <button
                            type="button"
                            className="btn-primary flex items-center gap-2 px-6 h-11 cursor-pointer"
                            onClick={() => handleAction('add', {})}
                        >
                            <Lock size={16} /> New Entry
                        </button>
                    )}
                </div>
            </div>

            {/* Stats Cards */}
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
                        <p className="text-3xl font-black italic font-heading relative z-10 text-white">{s.value}</p>
                        {s.subValue && <p className="text-[10px] font-bold text-secondary mt-1 opacity-60">{s.subValue}</p>}
                        <s.icon className={`absolute -right-4 -bottom-4 w-24 h-24 opacity-[0.03] ${s.color} group-hover:scale-110 transition-transform`} />
                    </div>
                ))}
            </div>

            {/* Table or Empty State */}
            {filteredItems.length > 0 ? (
                <div className="glass-card p-6">
                    <Table
                        columns={columns}
                        data={filteredItems}
                        actions={true}
                        onView={(item) => handleAction('view', item)}
                        onEdit={canEditLuxury ? (item) => handleAction('edit', item) : null}
                        onDelete={canDeleteLuxury ? (item) => handleAction('delete', item) : null}
                        canEdit={canEditLuxury}
                        canDelete={canDeleteLuxury}
                    />
                </div>
            ) : (
                <div className="glass-card p-12 text-center flex flex-col items-center justify-center space-y-4 border border-white/5">
                    <div className="w-20 h-20 bg-white/[0.02] border border-white/10 rounded-full flex items-center justify-center text-accent/40 shadow-inner">
                        <Shield size={36} strokeWidth={1.5} />
                    </div>
                    <div className="space-y-1 max-w-md">
                        <h3 className="text-lg font-bold text-white uppercase tracking-wider font-heading italic">
                            {isClient ? 'No Luxury Assets Under Custody' : 'No Luxury Items Found'}
                        </h3>
                        <p className="text-xs text-secondary leading-relaxed font-medium">
                            {isClient
                                ? 'Your personal vault currently contains no registered luxury items or custody assets. Reach out to your concierge to initiate secure deposit.'
                                : adminClientFilter !== 'all'
                                    ? `No luxury items are currently assigned to ${availableClients.find(c => c.id === adminClientFilter)?.name || 'the selected client'}.`
                                    : 'No luxury custody entries match the current filters.'}
                        </p>
                    </div>
                    {canAddLuxury && (
                        <button
                            type="button"
                            onClick={() => handleAction('add', {})}
                            className="btn-primary mt-4 flex items-center gap-2 px-6 cursor-pointer"
                        >
                            <Lock size={16} /> Register Luxury Item
                        </button>
                    )}
                </div>
            )}

            {/* Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={
                    modalType === 'view' ? 'Asset Appraisal & Registry' :
                        modalType === 'edit' ? 'Modify Registry Protocol' :
                            modalType === 'delete' ? 'De-register Asset' : 'New Custody Entry'
                }
            >
                <div className="space-y-6">
                    {modalType === 'delete' ? (
                        <div className="space-y-4">
                            <p className="text-secondary">Are you sure you want to remove <span className="text-primary font-bold text-white">{selectedItem?.item}</span> from the vault registry?</p>
                            <div className="flex gap-3 justify-end pt-4">
                                <button onClick={() => setIsModalOpen(false)} className="btn-secondary">Keep in Vault</button>
                                <button onClick={handleDelete} className="px-6 py-2 bg-danger text-white rounded-lg font-bold">De-register</button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                {/* Admin Client Dropdown field */}
                                {isAdmin && (
                                    <div className="col-span-2 space-y-1">
                                        <label className="text-[10px] font-bold text-muted uppercase tracking-wider flex items-center justify-between">
                                            <span>Assigned Client <span className="text-danger">*</span></span>
                                            {formData.clientId && (
                                                <span className="text-accent font-mono text-[9px] flex items-center gap-1">
                                                    <CheckCircle2 size={10} /> Client ID: #{formData.clientId}
                                                </span>
                                            )}
                                        </label>
                                        <select
                                            value={formData.clientId || ''}
                                            onChange={(e) => {
                                                const chosenId = e.target.value;
                                                const chosen = availableClients.find(c => String(c.id) === String(chosenId));
                                                setFormData({
                                                    ...formData,
                                                    clientId: chosenId,
                                                    clientName: chosen ? chosen.name : '',
                                                    owner: formData.owner || (chosen ? chosen.contactPerson : ''),
                                                });
                                            }}
                                            disabled={modalType === 'view'}
                                            className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm font-bold text-white focus:border-accent outline-none"
                                            required
                                        >
                                            <option value="">-- Select Client --</option>
                                            {availableClients.map((c) => (
                                                <option key={c.id} value={c.id}>
                                                    {c.name} ({c.type}) {c.email ? `• ${c.email}` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div className="col-span-2 space-y-1">
                                    <label className="text-[10px] font-bold text-muted uppercase">Asset Description *</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Rolex Submariner Date, Patek Philippe, Diamond Ring"
                                        value={formData.item}
                                        onChange={(e) => setFormData({ ...formData, item: e.target.value })}
                                        className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold text-white"
                                        disabled={modalType === 'view'}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-muted uppercase">Beneficiary Name</label>
                                    <input
                                        type="text"
                                        placeholder="Client / owner name"
                                        value={formData.owner}
                                        onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                                        className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none text-white"
                                        disabled={modalType === 'view'}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-muted uppercase">Value Estimate ($)</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 25000"
                                        value={formData.value}
                                        onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                                        className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none text-white"
                                        disabled={modalType === 'view'}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-muted uppercase">Storage Vault</label>
                                    <select
                                        value={formData.vault}
                                        onChange={(e) => setFormData({ ...formData, vault: e.target.value })}
                                        className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none text-white font-medium"
                                        disabled={modalType === 'view'}
                                    >
                                        <option>Vault Alpha</option>
                                        <option>Vault Bravo (Cold)</option>
                                        <option>External Safe</option>
                                        <option>Private Facility</option>
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-muted uppercase">Custody Status</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                        className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none text-white font-medium"
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
                                <div className="p-4 border border-dashed border-border rounded-xl space-y-3 bg-white/[0.01]">
                                    {formData.clientName && (
                                        <div className="flex items-center gap-3">
                                            <User size={16} className="text-secondary" />
                                            <span className="text-xs text-secondary">Assigned Client:</span>
                                            <span className="text-xs font-bold text-accent">
                                                {formData.clientName} {formData.clientId ? `(ID: #${formData.clientId})` : ''}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-3">
                                        <Shield size={16} className="text-secondary" />
                                        <span className="text-xs text-secondary">Beneficiary:</span>
                                        <span className="text-xs font-bold text-white">{formData.owner}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <DollarSign size={16} className="text-success" />
                                        <span className="text-xs text-secondary">Insured Value:</span>
                                        <span className="text-xs font-bold text-success font-mono">
                                            {String(formData.value).startsWith('$') ? formData.value : `$${Number(formData.value || 0).toLocaleString()}`}
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3 justify-end pt-2">
                                <button onClick={() => setIsModalOpen(false)} className="btn-secondary">
                                    {modalType === 'view' ? 'Close' : 'Cancel'}
                                </button>
                                {modalType !== 'view' && (
                                    <button onClick={handleSave} className="btn-primary">
                                        {modalType === 'add' ? 'Finalize Registration' : 'Save Changes'}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default LuxuryItems;
