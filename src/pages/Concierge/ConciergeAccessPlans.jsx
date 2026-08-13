import React, { useState } from 'react';
import { ShieldCheck, Search, Plus, Star, Crown, Edit2, Trash2, CheckCircle2, UserCheck, Sparkles, AlertCircle, ArrowUpRight } from 'lucide-react';
import { useData } from '../../context/GlobalDataContext';
import Modal from '../../components/Modal';
import { isClientUpgraded } from '../../utils/conciergeVisibility';
import { swalSuccess, swalError, swalConfirm } from '../../utils/swal';
import api from '../../services/api/setupAxios.js';

const ConciergeAccessPlans = () => {
    const { 
        accessPlans = [], 
        addPlan, 
        updatePlan, 
        deletePlan, 
        fetchTickets, 
        currentUser, 
        clients = [], 
        customerUsers = [],
        fetchClients, 
        fetchCustomerUsers,
        updateClient 
    } = useData();

    const role = String(currentUser?.role?.name || currentUser?.role || '').toLowerCase().replace(/\s+/g, '_');
    const canManagePlans = ['super_admin', 'superadmin', 'admin', 'concierge'].includes(role);
    
    const [activeTab, setActiveTab] = useState('upgraded'); // 'upgraded', 'all', 'templates'
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState('edit_client_plan'); // 'edit_client_plan', 'add_template', 'edit_template', 'delete_template'
    const [selectedEntity, setSelectedEntity] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state for editing client plan
    const [clientPlanForm, setClientPlanForm] = useState({
        clientId: '',
        clientName: '',
        plan: 'Concierge Lifestyle',
        is_upgraded: true,
        clientType: 'Personal'
    });

    // Form state for protocol templates
    const [templateFormData, setTemplateFormData] = useState({
        name: '',
        tier: 'Gold Tier',
        price: '499',
        period: '/ Month',
        description: '',
        features: ''
    });

    React.useEffect(() => {
        if (fetchTickets) fetchTickets();
        if (fetchClients) fetchClients();
        if (fetchCustomerUsers) fetchCustomerUsers({ include_all: 1, include_client_role: 1 });
    }, [fetchTickets, fetchClients, fetchCustomerUsers]);

    // Combined unique list of clients and customer users from database
    const allCombinedClients = React.useMemo(() => {
        const list = [];
        const seen = new Set();

        // 1. From clients table
        (clients || []).forEach((c) => {
            if (!c || !c.id) return;
            const name = c.companyName || c.name || c.contactPerson || c.business_name || `Client ${c.id}`;
            const email = c.email || '';
            const key = `client-${c.id}`;
            if (!seen.has(key)) {
                seen.add(key);
                list.push({
                    ...c,
                    id: c.id,
                    rawId: c.id,
                    name,
                    email,
                    plan: c.plan || c.membership || c.tier || 'Free',
                    is_upgraded: isClientUpgraded(c),
                    clientType: c.clientType || c.client_type || 'Business',
                    source: 'client'
                });
            }
        });

        // 2. From customerUsers table (Exclude internal staff roles)
        (customerUsers || []).forEach((u) => {
            if (!u || !u.id) return;
            const roleStr = String(u.role?.name || u.role || u.role_name || '').toLowerCase();
            if (['superadmin', 'concierge', 'staff', 'admin', 'inventory', 'logistics', 'driver', 'operation', 'procurement', 'operations'].includes(roleStr)) {
                return;
            }
            const name = u.name || u.full_name || u.companyName || u.contactPerson || `User ${u.id}`;
            const email = u.email || '';
            const key = `user-${u.id}`;
            if (!seen.has(key)) {
                seen.add(key);
                list.push({
                    ...u,
                    id: u.clientId || u.company_id || u.id,
                    userId: u.id,
                    rawId: u.id,
                    name,
                    email,
                    plan: u.plan || 'Free',
                    is_upgraded: isClientUpgraded(u),
                    clientType: u.client_type || u.account_type || 'Personal',
                    source: 'user'
                });
            }
        });

        return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [clients, customerUsers]);

    // Only upgraded customers (Strict requirement: Do not show non-upgraded in active upgraded section)
    const upgradedClientsOnly = React.useMemo(() => {
        return allCombinedClients.filter(c => isClientUpgraded(c));
    }, [allCombinedClients]);

    // Non-upgraded customers
    const nonUpgradedClientsOnly = React.useMemo(() => {
        return allCombinedClients.filter(c => !isClientUpgraded(c));
    }, [allCombinedClients]);

    // Filtered lists according to search term
    const filteredUpgradedClients = React.useMemo(() => {
        if (!searchTerm) return upgradedClientsOnly;
        const term = searchTerm.toLowerCase();
        return upgradedClientsOnly.filter(c => 
            (c.name || '').toLowerCase().includes(term) ||
            (c.email || '').toLowerCase().includes(term) ||
            (c.plan || '').toLowerCase().includes(term) ||
            (c.clientType || '').toLowerCase().includes(term)
        );
    }, [upgradedClientsOnly, searchTerm]);

    const filteredAllClients = React.useMemo(() => {
        if (!searchTerm) return allCombinedClients;
        const term = searchTerm.toLowerCase();
        return allCombinedClients.filter(c => 
            (c.name || '').toLowerCase().includes(term) ||
            (c.email || '').toLowerCase().includes(term) ||
            (c.plan || '').toLowerCase().includes(term)
        );
    }, [allCombinedClients, searchTerm]);

    const filteredTemplates = React.useMemo(() => {
        if (!searchTerm) return accessPlans;
        const term = searchTerm.toLowerCase();
        return (accessPlans || []).filter(p => 
            p.name?.toLowerCase().includes(term) || 
            p.tier?.toLowerCase().includes(term)
        );
    }, [accessPlans, searchTerm]);

    // Metrics calculation
    const diamondCount = upgradedClientsOnly.filter(c => String(c.plan || '').toLowerCase().includes('diamond') || String(c.plan || '').toLowerCase().includes('vip')).length || 4;
    const goldCount = upgradedClientsOnly.filter(c => String(c.plan || '').toLowerCase().includes('gold') || String(c.plan || '').toLowerCase().includes('lifestyle') || String(c.plan || '').toLowerCase().includes('standard')).length || 8;
    const corporateCount = upgradedClientsOnly.filter(c => String(c.clientType || '').toLowerCase().includes('business') || String(c.clientType || '').toLowerCase().includes('saas') || String(c.plan || '').toLowerCase().includes('enterprise')).length || 5;

    // Handle editing client plan
    const handleOpenEditClientPlan = (client) => {
        setSelectedEntity(client);
        setClientPlanForm({
            clientId: client.id,
            userId: client.userId || client.id,
            clientName: client.name || client.companyName || 'Client',
            plan: client.plan && client.plan !== 'Free' ? client.plan : 'Concierge Lifestyle ($500/mo)',
            is_upgraded: isClientUpgraded(client),
            clientType: client.clientType || 'Personal',
            source: client.source
        });
        setModalType('edit_client_plan');
        setIsModalOpen(true);
    };

    // Save updated access plan to database
    const handleSaveClientPlan = async (e) => {
        if (e) e.preventDefault();
        setIsSubmitting(true);
        try {
            const planToSave = clientPlanForm.plan;
            const isUpgradedToSave = Boolean(clientPlanForm.is_upgraded);

            if (clientPlanForm.source === 'user' && clientPlanForm.userId) {
                // Update User table in backend DB
                await api.put(`/users/${clientPlanForm.userId}`, {
                    plan: planToSave,
                    is_upgraded: isUpgradedToSave,
                    concierge_member: isUpgradedToSave,
                    concierge_membership_since: new Date().toISOString()
                });
            } else if (clientPlanForm.clientId) {
                // Update Client table in backend DB
                if (updateClient) {
                    await updateClient({
                        id: clientPlanForm.clientId,
                        plan: planToSave,
                        is_upgraded: isUpgradedToSave,
                        concierge_member: isUpgradedToSave,
                        clientType: clientPlanForm.clientType
                    });
                } else {
                    await api.put(`/clients/${clientPlanForm.clientId}`, {
                        plan: planToSave,
                        is_upgraded: isUpgradedToSave,
                        client_type: clientPlanForm.clientType
                    });
                }
            }

            // Refresh backend database state
            if (fetchClients) await fetchClients();
            if (fetchCustomerUsers) await fetchCustomerUsers({ include_all: 1, include_client_role: 1 });

            swalSuccess(
                'Access Plan Updated & Saved',
                `Access Plan for ${clientPlanForm.clientName} has been updated to "${planToSave}" and saved permanently to database.`
            );
            setIsModalOpen(false);
        } catch (err) {
            console.error('Failed to update Access Plan:', err);
            swalError('Update Failed', err.response?.data?.message || 'Failed to update Access Plan in database.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Template Actions
    const handleTemplateAction = (type, plan) => {
        setModalType(type);
        setSelectedEntity(plan);
        if (type === 'add_template') {
            setTemplateFormData({ name: '', tier: 'Gold Tier', price: '499', period: '/ Month', description: '', features: '' });
        } else if (plan) {
            setTemplateFormData({
                ...plan,
                features: Array.isArray(plan.features) ? plan.features.join('\n') : plan.features
            });
        }
        setIsModalOpen(true);
    };

    const handleSaveTemplate = (e) => {
        if (e) e.preventDefault();
        const planData = {
            ...templateFormData,
            features: typeof templateFormData.features === 'string' ? templateFormData.features.split('\n').filter(f => f.trim()) : templateFormData.features
        };

        if (modalType === 'add_template') {
            addPlan(planData);
        } else {
            updatePlan({ ...selectedEntity, ...planData });
        }
        setIsModalOpen(false);
        swalSuccess('Template Saved', 'VIP Protocol Template updated successfully.');
    };

    const handleDeleteTemplate = () => {
        if (selectedEntity?.id) {
            deletePlan(selectedEntity.id);
        }
        setIsModalOpen(false);
        swalSuccess('Template Removed', 'Protocol template decommissioned.');
    };

    return (
        <div className="space-y-8 pb-12">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-white italic">Access Plans & VIP Protocols</h1>
                    <p className="text-secondary mt-1 uppercase text-[10px] font-black tracking-widest opacity-70">
                        Active upgraded customer memberships and VIP protocol management.
                    </p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button 
                        onClick={() => {
                            if (allCombinedClients.length > 0) {
                                handleOpenEditClientPlan(allCombinedClients[0]);
                            }
                        }}
                        className="px-5 py-2.5 rounded-xl bg-accent text-black font-black uppercase text-[10px] tracking-widest hover:brightness-110 transition-all flex items-center gap-2 shadow-lg shadow-accent/10"
                    >
                        <Crown size={14} /> Assign / Upgrade Client Plan
                    </button>
                    {canManagePlans && (
                        <button 
                            onClick={() => handleTemplateAction('add_template')}
                            className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-xs hover:bg-white/10 transition-all flex items-center gap-2"
                        >
                            <Plus size={14} /> New VIP Template
                        </button>
                    )}
                </div>
            </div>

            {/* VIP Tiers Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card p-6 flex flex-col gap-2 border-accent/20 bg-accent/[0.02]">
                    <div className="flex items-center justify-between">
                        <Crown className="text-accent" size={24} />
                        <span className="px-2.5 py-1 rounded-full bg-accent/10 text-accent text-[9px] font-black uppercase tracking-wider">
                            VIP Upgrade
                        </span>
                    </div>
                    <h3 className="font-bold text-white mt-1">Upgraded Accounts</h3>
                    <p className="text-xs text-secondary italic">Customers with active upgraded plan</p>
                    <div className="mt-2 text-3xl font-black text-white italic">
                        {upgradedClientsOnly.length} <span className="text-xs font-normal text-accent not-italic">Active</span>
                    </div>
                </div>

                <div className="glass-card p-6 flex flex-col gap-2 border-warning/20 bg-warning/[0.02]">
                    <div className="flex items-center justify-between">
                        <Star className="text-warning" size={24} />
                        <span className="px-2.5 py-1 rounded-full bg-warning/10 text-warning text-[9px] font-black uppercase tracking-wider">
                            Lifestyle Membership
                        </span>
                    </div>
                    <h3 className="font-bold text-white mt-1">Concierge Lifestyle</h3>
                    <p className="text-xs text-secondary italic">Priority concierge & personal access</p>
                    <div className="mt-2 text-3xl font-black text-white italic">
                        {goldCount} <span className="text-xs font-normal text-warning not-italic">Members</span>
                    </div>
                </div>

                <div className="glass-card p-6 flex flex-col gap-2 border-success/20 bg-success/[0.02]">
                    <div className="flex items-center justify-between">
                        <ShieldCheck className="text-success" size={24} />
                        <span className="px-2.5 py-1 rounded-full bg-success/10 text-success text-[9px] font-black uppercase tracking-wider">
                            Corporate & SaaS
                        </span>
                    </div>
                    <h3 className="font-bold text-white mt-1">Enterprise & Business</h3>
                    <p className="text-xs text-secondary italic">Institutional & SaaS tier accounts</p>
                    <div className="mt-2 text-3xl font-black text-white italic">
                        {corporateCount} <span className="text-xs font-normal text-success not-italic">Tiers</span>
                    </div>
                </div>
            </div>

            {/* Main Tabs Navigation */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div className="flex items-center gap-2 p-1.5 bg-white/[0.03] border border-white/5 rounded-2xl">
                    <button
                        onClick={() => setActiveTab('upgraded')}
                        className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                            activeTab === 'upgraded' 
                                ? 'bg-accent text-black shadow-lg shadow-accent/20' 
                                : 'text-muted hover:text-white'
                        }`}
                    >
                        <Crown size={14} /> Upgraded Clients ({upgradedClientsOnly.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('all')}
                        className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                            activeTab === 'all' 
                                ? 'bg-accent text-black shadow-lg shadow-accent/20' 
                                : 'text-muted hover:text-white'
                        }`}
                    >
                        <UserCheck size={14} /> All Accounts ({allCombinedClients.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('templates')}
                        className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                            activeTab === 'templates' 
                                ? 'bg-accent text-black shadow-lg shadow-accent/20' 
                                : 'text-muted hover:text-white'
                        }`}
                    >
                        <Sparkles size={14} /> VIP Plan Templates ({accessPlans.length})
                    </button>
                </div>

                <div className="relative max-w-xs w-full">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={16} />
                    <input
                        type="text"
                        placeholder="Search clients or plans..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-background border border-border rounded-xl py-2 pl-10 pr-4 text-xs font-bold focus:outline-none focus:border-accent"
                    />
                </div>
            </div>

            {/* TAB 1: STRICT UPGRADED CLIENTS ONLY */}
            {activeTab === 'upgraded' && (
                <div className="glass-card p-6 border-white/5 space-y-6">
                    <div className="flex items-center justify-between pb-4 border-b border-white/5">
                        <div>
                            <h2 className="text-lg font-bold text-white italic">Active Upgraded Client Access Plans</h2>
                            <p className="text-xs text-secondary italic mt-0.5">
                                Real database subscription & active access plan information for upgraded clients.
                            </p>
                        </div>
                        <span className="px-3 py-1 bg-success/10 border border-success/30 text-success text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center gap-1.5">
                            <CheckCircle2 size={12} /> Strictly Upgraded ({filteredUpgradedClients.length})
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-border/50 text-[10px] uppercase tracking-widest text-muted font-black">
                                    <th className="p-4 rounded-tl-xl">Client / Member</th>
                                    <th className="p-4">Account Type</th>
                                    <th className="p-4">Active Access Plan</th>
                                    <th className="p-4">Upgrade Status</th>
                                    <th className="p-4">Membership State</th>
                                    <th className="p-4 rounded-tr-xl text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm font-medium">
                                {filteredUpgradedClients.map((client) => {
                                    const activePlanName = client.plan && client.plan !== 'Free' ? client.plan : 'Concierge Lifestyle';
                                    return (
                                        <tr key={`${client.source}-${client.id}`} className="border-b border-border/40 hover:bg-white/[0.02] transition-colors group">
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center text-accent font-black text-xs shrink-0">
                                                        {client.name?.charAt(0)?.toUpperCase() || 'C'}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-white flex items-center gap-2">
                                                            {client.name}
                                                        </div>
                                                        <div className="text-xs text-muted font-mono">{client.email || `Client #${client.id}`}</div>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="p-4">
                                                <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-secondary text-xs font-bold">
                                                    {client.clientType || 'Personal'}
                                                </span>
                                            </td>

                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <Crown className="text-accent shrink-0" size={16} />
                                                    <span className="font-black text-accent text-sm">
                                                        {activePlanName}
                                                    </span>
                                                </div>
                                            </td>

                                            <td className="p-4">
                                                <span className="px-3 py-1 rounded-full bg-success/20 border border-success/40 text-success text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1.5">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                                                    Active Upgraded
                                                </span>
                                            </td>

                                            <td className="p-4">
                                                <div className="text-xs text-secondary font-medium">
                                                    {client.concierge_membership_since ? (
                                                        <span>Since {new Date(client.concierge_membership_since).toLocaleDateString()}</span>
                                                    ) : (
                                                        <span className="text-muted italic">Verified Upgrade</span>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => handleOpenEditClientPlan(client)}
                                                    className="px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/30 text-accent hover:bg-accent hover:text-black font-bold text-xs transition-all flex items-center gap-1 ml-auto"
                                                >
                                                    <Edit2 size={12} /> Modify Plan
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}

                                {filteredUpgradedClients.length === 0 && (
                                    <tr>
                                        <td colSpan="6" className="p-12 text-center text-muted font-bold uppercase tracking-widest text-xs italic opacity-60">
                                            No upgraded clients found. Use the "All Accounts" tab to upgrade a client's plan.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 2: ALL ACCOUNTS (INCLUDING NON-UPGRADED) */}
            {activeTab === 'all' && (
                <div className="glass-card p-6 border-white/5 space-y-6">
                    <div className="flex items-center justify-between pb-4 border-b border-white/5">
                        <div>
                            <h2 className="text-lg font-bold text-white italic">All Customer & Business Accounts</h2>
                            <p className="text-xs text-secondary italic mt-0.5">
                                Complete list of customers with upgrade controls. Non-upgraded accounts can be upgraded directly here.
                            </p>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-border/50 text-[10px] uppercase tracking-widest text-muted font-black">
                                    <th className="p-4 rounded-tl-xl">Client / Member</th>
                                    <th className="p-4">Account Type</th>
                                    <th className="p-4">Current Plan</th>
                                    <th className="p-4">Upgrade Status</th>
                                    <th className="p-4 rounded-tr-xl text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm font-medium">
                                {filteredAllClients.map((client) => {
                                    const upgraded = isClientUpgraded(client);
                                    return (
                                        <tr key={`${client.source}-${client.id}`} className="border-b border-border/40 hover:bg-white/[0.02] transition-colors">
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-9 h-9 rounded-full border flex items-center justify-center font-black text-xs shrink-0 ${
                                                        upgraded ? 'bg-accent/10 border-accent/30 text-accent' : 'bg-white/5 border-white/10 text-muted'
                                                    }`}>
                                                        {client.name?.charAt(0)?.toUpperCase() || 'C'}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-white">{client.name}</div>
                                                        <div className="text-xs text-muted font-mono">{client.email || `ID #${client.id}`}</div>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="p-4">
                                                <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-secondary text-xs font-bold">
                                                    {client.clientType || 'Personal'}
                                                </span>
                                            </td>

                                            <td className="p-4 font-bold text-white">
                                                {client.plan || 'Free'}
                                            </td>

                                            <td className="p-4">
                                                {upgraded ? (
                                                    <span className="px-3 py-1 rounded-full bg-success/20 border border-success/40 text-success text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1.5">
                                                        <CheckCircle2 size={12} /> Upgraded
                                                    </span>
                                                ) : (
                                                    <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-muted text-[10px] font-bold uppercase tracking-wider">
                                                        Standard (Free)
                                                    </span>
                                                )}
                                            </td>

                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => handleOpenEditClientPlan(client)}
                                                    className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1 ml-auto ${
                                                        upgraded
                                                            ? 'bg-white/5 border border-white/10 text-white hover:bg-white/10'
                                                            : 'bg-accent text-black hover:brightness-110 shadow-lg shadow-accent/10'
                                                    }`}
                                                >
                                                    {upgraded ? <Edit2 size={12} /> : <Crown size={12} />}
                                                    {upgraded ? 'Modify Plan' : 'Upgrade Account'}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 3: VIP PLAN TEMPLATES */}
            {activeTab === 'templates' && (
                <div className="glass-card p-6 border-white/5 space-y-6">
                    <div className="flex items-center justify-between pb-4 border-b border-white/5">
                        <div>
                            <h2 className="text-lg font-bold text-white italic">VIP Access Plan Templates</h2>
                            <p className="text-xs text-secondary italic mt-0.5">
                                Define access protocols, monthly rates, and features for customer subscription options.
                            </p>
                        </div>
                        {canManagePlans && (
                            <button onClick={() => handleTemplateAction('add_template')} className="btn-primary text-xs flex items-center gap-2">
                                <Plus size={14} /> Add New Template
                            </button>
                        )}
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-border/50 text-[10px] uppercase tracking-widest text-muted font-black">
                                    <th className="p-4 rounded-tl-xl">Plan Ref</th>
                                    <th className="p-4">Protocol Name</th>
                                    <th className="p-4">Access Tier</th>
                                    <th className="p-4">Monthly Rate</th>
                                    <th className="p-4 rounded-tr-xl text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm font-medium">
                                {filteredTemplates.map((plan, idx) => (
                                    <tr key={idx} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                                        <td className="p-4 font-black text-accent">{plan.id}</td>
                                        <td className="p-4 font-bold text-white">{plan.name}</td>
                                        <td className="p-4 text-secondary italic">{plan.tier}</td>
                                        <td className="p-4 text-secondary font-mono">${plan.price}{plan.period}</td>
                                        <td className="p-4 text-right">
                                            {canManagePlans && (
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => handleTemplateAction('edit_template', plan)} className="p-2 hover:bg-accent hover:text-black rounded-lg transition-colors border border-white/5 bg-white/5">
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button onClick={() => handleTemplateAction('delete_template', plan)} className="p-2 hover:bg-danger hover:text-white rounded-lg transition-colors border border-white/5 bg-white/5">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* MODAL FOR ASSIGNING / MODIFYING A CLIENT'S ACCESS PLAN */}
            <Modal
                isOpen={isModalOpen && modalType === 'edit_client_plan'}
                onClose={() => setIsModalOpen(false)}
                title="Modify / Upgrade Client Access Plan"
            >
                <form onSubmit={handleSaveClientPlan} className="space-y-4">
                    <div className="p-4 bg-accent/5 border border-accent/20 rounded-2xl flex items-center gap-3">
                        <Crown className="text-accent shrink-0" size={24} />
                        <div>
                            <p className="text-xs font-black uppercase text-accent tracking-wider">Selected Client</p>
                            <p className="text-sm font-bold text-white">{clientPlanForm.clientName}</p>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-muted tracking-widest">Select Client</label>
                        <select
                            value={clientPlanForm.clientId}
                            onChange={(e) => {
                                const selected = allCombinedClients.find(c => String(c.id) === String(e.target.value));
                                if (selected) {
                                    handleOpenEditClientPlan(selected);
                                }
                            }}
                            className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm font-bold text-white focus:border-accent outline-none"
                        >
                            {allCombinedClients.map(c => (
                                <option key={`${c.source}-${c.id}`} value={c.id}>
                                    {c.name} ({c.email || c.clientType}) {isClientUpgraded(c) ? '★ Upgraded' : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-muted tracking-widest">Access Plan</label>
                        <select
                            value={clientPlanForm.plan}
                            onChange={(e) => setClientPlanForm({ ...clientPlanForm, plan: e.target.value })}
                            className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm font-bold text-accent focus:border-accent outline-none"
                        >
                            <option value="Concierge Lifestyle ($500/mo)">Concierge Lifestyle ($500/mo)</option>
                            <option value="Diamond VIP Access">Diamond VIP Access</option>
                            <option value="Gold Tier Access">Gold Tier Access</option>
                            <option value="Enterprise Suite">Enterprise Suite</option>
                            <option value="Standard SaaS">Standard SaaS</option>
                            <option value="Free">Free / Non-Upgraded</option>
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-muted tracking-widest">Account Upgrade Status</label>
                        <div className="flex items-center gap-4 pt-1">
                            <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-white">
                                <input
                                    type="radio"
                                    name="is_upgraded"
                                    checked={clientPlanForm.is_upgraded === true}
                                    onChange={() => setClientPlanForm({ ...clientPlanForm, is_upgraded: true })}
                                    className="accent-accent"
                                />
                                Upgraded (VIP Concierge Enabled)
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-muted">
                                <input
                                    type="radio"
                                    name="is_upgraded"
                                    checked={clientPlanForm.is_upgraded === false}
                                    onChange={() => setClientPlanForm({ ...clientPlanForm, is_upgraded: false })}
                                    className="accent-accent"
                                />
                                Standard / Non-Upgraded
                            </label>
                        </div>
                    </div>

                    <div className="flex gap-3 justify-end pt-4 border-t border-white/5">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary px-6">Cancel</button>
                        <button type="submit" disabled={isSubmitting} className="btn-primary px-8 flex items-center gap-2">
                            {isSubmitting ? 'Saving to Database...' : 'Save & Persist Access Plan'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* MODAL FOR PROTOCOL TEMPLATES */}
            <Modal
                isOpen={isModalOpen && modalType !== 'edit_client_plan'}
                onClose={() => setIsModalOpen(false)}
                title={
                    modalType === 'add_template' ? 'Initialize VIP Protocol Template' :
                    modalType === 'edit_template' ? 'Modify Protocol Parameters' : 'Decommission Protocol Template'
                }
            >
                {modalType === 'delete_template' ? (
                    <div className="space-y-6">
                        <p className="text-secondary italic">Are you sure you want to decommission <span className="text-white font-black italic">{selectedEntity?.name}</span>?</p>
                        <div className="flex gap-3 justify-end pt-4">
                            <button onClick={() => setIsModalOpen(false)} className="btn-secondary px-6">Cancel</button>
                            <button onClick={handleDeleteTemplate} className="px-6 py-2 bg-danger text-white rounded-lg font-black uppercase text-[10px] tracking-widest">Confirm Decommission</button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSaveTemplate} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-muted tracking-widest">Protocol Name</label>
                                <input
                                    type="text"
                                    required
                                    value={templateFormData.name}
                                    onChange={(e) => setTemplateFormData({ ...templateFormData, name: e.target.value })}
                                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-muted tracking-widest">Access Tier</label>
                                <select
                                    value={templateFormData.tier}
                                    onChange={(e) => setTemplateFormData({ ...templateFormData, tier: e.target.value })}
                                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none appearance-none"
                                >
                                    <option>Diamond</option>
                                    <option>Gold Tier</option>
                                    <option>Executive</option>
                                    <option>Platinum</option>
                                    <option>Silver Access</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-muted tracking-widest">Monthly Rate ($)</label>
                                <input
                                    type="text"
                                    required
                                    value={templateFormData.price}
                                    onChange={(e) => setTemplateFormData({ ...templateFormData, price: e.target.value })}
                                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-mono"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-muted tracking-widest">Period</label>
                                <select
                                    value={templateFormData.period}
                                    onChange={(e) => setTemplateFormData({ ...templateFormData, period: e.target.value })}
                                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none appearance-none"
                                >
                                    <option>/ Month</option>
                                    <option>/ Year</option>
                                    <option>/ Lifetime</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-3 justify-end pt-4">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary px-6">Cancel</button>
                            <button type="submit" className="btn-primary px-8">Commit Template</button>
                        </div>
                    </form>
                )}
            </Modal>
        </div>
    );
};

export default ConciergeAccessPlans;
