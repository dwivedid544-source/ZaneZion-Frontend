

import React, { useState } from 'react';
import { swalSuccess, swalError, swalWarning, swalInfo, swalConfirm, swalCredentials, swalCopied } from '../../utils/swal';
import { useData } from '../../context/GlobalDataContext';
import {
    ShieldCheck, Layout, Users, CreditCard,
    ArrowRight, Search, Filter, ExternalLink,
    Shield, CheckCircle2, Building, Plus, Edit2, Trash2, X, Check,
    Copy, Key, Mail, ShieldCheck as ShieldIcon, Fingerprint
} from 'lucide-react';
import Table from '../../components/Table';
import Modal from '../../components/Modal';
import Pagination from '../../components/Common/Pagination';

const SaaSManagement = () => {
    const {
        clients, users, accessPlans, fetchAccessPlans, addPlan, updatePlan, deletePlan,
        addClient, updateClient, deleteClient, fetchClients,
        subscriptionRequests, updateSubscriptionRequest, deleteSubscriptionRequest, fetchSubscriptionRequests,
        generateSaaSInvoice
    } = useData();

    // Pagination & Search for Requests
    const [requestPage, setRequestPage] = useState(1);
    const [requestSearch, setRequestSearch] = useState('');
    const [requestPagination, setRequestPagination] = useState(null);

    // Pagination & Search for Companies
    const [companyPage, setCompanyPage] = useState(1);
    const [companySearch, setCompanySearch] = useState('');
    const [companyPagination, setCompanyPagination] = useState(null);
    const [activeTab, setActiveTab] = useState('plans');
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState('plan'); // 'plan' or 'entity'
    const [editingPlan, setEditingPlan] = useState(null);
    const [editingEntity, setEditingEntity] = useState(null);
    const [provisioningResult, setProvisioningResult] = useState(null);
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        tier: '',
        price: '',
        yearlyPrice: '',
        description: '',
        features: '',
        commitment: 'Monthly or Yearly subscription.',
        // Entity fields
        location: '',
        contact: '',
        email: '',
        status: 'Active',
    });

    React.useEffect(() => {
        fetchAccessPlans();
    }, [fetchAccessPlans]);

    React.useEffect(() => {
        if (activeTab === 'requests') {
            fetchSubscriptionRequests({ page: requestPage, limit: 10, search: requestSearch })
                .then(pag => setRequestPagination(pag));
        } else if (activeTab === 'companies') {
            fetchClients({ page: companyPage, limit: 10, search: companySearch })
                .then(pag => setCompanyPagination(pag));
        }
    }, [activeTab, requestPage, requestSearch, companyPage, companySearch, fetchSubscriptionRequests, fetchClients]);

    const handleOpenModal = (plan = null) => {
        setModalType('plan');
        if (plan) {
            setEditingPlan(plan);
            setFormData({
                ...plan,
                features: plan.features.join('\n')
            });
        } else {
            setEditingPlan(null);
            setFormData({
                name: '',
                tier: '',
                price: '',
                yearlyPrice: '',
                description: '',
                features: '',
                commitment: 'Monthly or Yearly subscription.'
            });
        }
        setIsModalOpen(true);
    };

    const handleOpenEntityModal = (entity = null) => {
        setModalType('entity');
        if (entity) {
            setEditingEntity(entity);
            setFormData({
                ...entity,
                plan: entity.plan || 'Standard',
                clientType: entity.clientType || 'SaaS'
            });
        } else {
            setEditingEntity(null);
            setFormData({
                name: '',
                location: '',
                contact: '',
                email: '',
                status: 'Active',
                plan: 'Standard',
                clientType: 'SaaS'
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();

        if (modalType === 'plan') {
            const planData = {
                ...formData,
                features: formData.features.split('\n').filter(f => f.trim() !== '')
            };

            if (editingPlan) {
                updatePlan(planData);
            } else {
                addPlan(planData);
            }
        } else {
            // Entity Save
            if (editingEntity) {
                await updateClient({ ...editingEntity, ...formData });
            } else {
                await addClient({ ...formData, companyName: formData.name, source: 'Manual' });
            }
            // Re-fetch clients list to show the new/updated client
            fetchClients({ page: companyPage, limit: 10, search: companySearch })
                .then(pag => setCompanyPagination(pag));
        }
        setIsModalOpen(false);
    };

    const handleDelete = async (id) => {
        if ((await swalConfirm('Decommission', 'Are you sure?')).isConfirmed) {
            deletePlan(id);
        }
    };

    const handleDeleteEntity = async (id) => {
        if ((await swalConfirm('Decommission', 'Remove entity workspace?')).isConfirmed) {
            deleteClient(id);
        }
    };

    const [searchTerm, setSearchTerm] = useState('');

    const activeCompanies = clients.map(c => ({
        ...c,
        owner: users.find(u => u.id === (c.id % 5) + 1)?.name || 'Lead Representative',
        plan: c.plan || 'Standard',
        workspace_id: `WS-${1000 + c.id}`
    }));

    const planColumns = [
        { header: "Protocol Name", accessor: "name" },
        { header: "Tier", accessor: "tier" },
        { header: "Monthly Rate", accessor: "price" },
        { header: "Yearly Rate", accessor: "yearlyPrice" },
        {
            header: "Status",
            accessor: "id",
            render: (row) => (
                <span className="px-2 py-1 bg-success/20 text-success rounded-lg text-[10px] font-bold uppercase">
                    Production
                </span>
            )
        }
    ];

    const companyColumns = [
        { header: "Workspace ID", accessor: "workspace_id" },
        { header: "Company Name", accessor: "name" },
        {
            header: "Source",
            accessor: "source",
            render: (row) => (
                <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${row.source === 'Subscriber' ? 'bg-accent/20 text-accent' : 'bg-white/10 text-white'}`}>
                    {row.source || 'Manual'}
                </span>
            )
        },
        { header: "Lead Representative", accessor: "owner" },
        {
            header: "Active Protocol",
            accessor: "plan",
            render: (row) => (
                <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${row.plan === 'Platinum' ? 'bg-accent/20 text-accent' :
                    row.plan === 'Executive' ? 'bg-white/10 text-white' :
                        'bg-secondary/20 text-secondary'
                    }`}>
                    {row.plan}
                </span>
            )
        },
        { header: "Operational Status", accessor: "status" },
        {
            header: "Quick Actions",
            accessor: "id",
            render: (row) => (
                <button
                    onClick={() => {
                        generateSaaSInvoice(row);
                        swalSuccess('Invoice Generated', `Invoice for ${row.name}. View in Ledger.`);
                    }}
                    className="px-2 py-1 bg-accent text-black rounded text-[9px] font-black uppercase tracking-widest hover:bg-white transition-all flex items-center gap-1"
                >
                    <CreditCard size={10} /> Billing
                </button>
            )
        }
    ];

    const requestColumns = [
        { header: 'REQUEST ID', accessor: 'id', render: (row) => <span className="font-mono text-[10px] text-accent tracking-widest">{row.id}</span> },
        { header: 'INSTITUTIONAL NAME', accessor: 'clientName', render: (row) => <span className="font-bold">{row.clientName}</span> },
        { header: 'CATEGORY', accessor: 'propertyType', render: (row) => <span className="text-[10px] uppercase tracking-widest bg-white/5 px-2 py-1 rounded inline-block">{row.propertyType || 'Bespoke'}</span> },
        { header: 'CONTACT PERSON', accessor: 'contact' },
        { header: 'REQUESTED PROTOCOL', accessor: 'plan', render: (row) => <span className="text-accent font-bold italic">{row.plan}</span> },
        { header: 'THROUGHPUT', accessor: 'throughput', render: (row) => <span className={`text-[10px] font-black ${row.throughput === 'High' ? 'text-danger' : row.throughput === 'Medium' ? 'text-accent' : 'text-success'}`}>{row.throughput || 'N/A'}</span> },
        { header: 'DATE', accessor: 'date' },
        {
            header: 'STATUS',
            accessor: 'status',
            render: (row) => {
                const status = row.status || 'Pending';
                const isProvisioned = status === 'Provisioned' || status === 'Approved';
                return (
                    <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest ${status === 'Pending' ? 'bg-warning/20 text-warning border border-warning/20' :
                        isProvisioned ? 'bg-success/20 text-success border border-success/20' :
                            'bg-danger/20 text-danger border border-danger/20'
                        }`}>
                        {status === 'Pending' ? 'Verification Needed' : (status === 'Provisioned' || status === 'Approved') ? 'Provisioned ✓' : status || 'N/A'}
                    </span>
                );
            }
        },
    ];


    return (
        <div className="space-y-8 pb-12 px-4 md:px-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-white italic uppercase">SaaS Management</h1>
            <p className="text-secondary text-[10px] mt-1 font-black uppercase tracking-[0.2em] opacity-70 leading-relaxed">Manage Platform Infrastructure & Subscriptions</p>
          </div>
          <div className="bg-white/5 p-1 rounded-2xl border border-white/10 overflow-x-auto no-scrollbar">
            <div className="flex shrink-0">
              {[
                { id: 'plans', label: 'Subscription Tiers' },
                { id: 'requests', label: 'Activation Queue', count: subscriptionRequests.length },
                { id: 'companies', label: 'Workspace Portfolio' },
                { id: 'workspace', label: 'Handshake Terminal' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-6 py-2.5 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap relative ${activeTab === tab.id ? 'bg-accent text-black shadow-lg shadow-accent/20' : 'text-secondary hover:text-white hover:bg-white/5'}`}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 bg-danger text-white text-[8px] rounded-full border border-black shadow-lg animate-pulse">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>



            {activeTab === 'plans' && (
                <div className="space-y-8">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <h2 className="text-xl font-bold text-white italic">Protocol Matrix</h2>
                        <button
                            onClick={() => handleOpenModal()}
                            className="w-full sm:w-auto btn-primary py-3 px-6 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
                        >
                            <Plus size={14} /> Design New Protocol
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {accessPlans.map(plan => (
                            <div key={plan.id} className="glass-card p-6 border-accent/10 relative overflow-hidden group hover:border-accent/40 transition-all">
                                <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                                    <Shield size={64} className="text-accent" />
                                </div>
                                <div className="absolute top-4 right-4 flex gap-2 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => handleOpenModal(plan)}
                                        className="p-2 bg-white/5 hover:bg-accent hover:text-black rounded-xl transition-all border border-white/5"
                                    >
                                        <Edit2 size={12} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(plan.id)}
                                        className="p-2 bg-white/5 hover:bg-danger hover:text-white rounded-xl transition-all border border-white/5"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                                <p className="text-[10px] font-black text-accent uppercase tracking-[0.2em] mb-1">{plan.tier}</p>
                                <h3 className="text-xl font-black text-white italic mb-4">{plan.name}</h3>
                                <div className="flex items-baseline gap-2 mb-6">
                                    <span className="text-3xl font-black text-white italic font-heading tracking-tighter">{plan.price}</span>
                                    <span className="text-[10px] text-muted uppercase font-black tracking-widest">/ Month</span>
                                </div>
                                <div className="space-y-3 mb-8">
                                    {(Array.isArray(plan.features) ? plan.features : (() => { try { return JSON.parse(plan.features || '[]'); } catch { return []; } })()).slice(0, 4).map((f, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <CheckCircle2 size={14} className="text-accent shrink-0" />
                                            <span className="text-xs text-secondary font-medium italic">{f}</span>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={() => handleOpenModal(plan)}
                                    className="w-full py-3 bg-accent/5 border border-accent/20 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-accent hover:bg-accent hover:text-black transition-all"
                                >
                                    Modify Protocol
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="glass-card p-4 sm:p-6 border-white/5">
                        <h3 className="text-lg font-bold mb-6 text-white flex items-center gap-3 italic">
                            <CreditCard className="text-accent" size={20} /> Advanced Registry
                        </h3>
                        <div className="overflow-x-auto -mx-4 sm:mx-0">
                            <Table columns={planColumns} data={accessPlans} />
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'requests' && (
                <div className="space-y-6">
                    <div className="glass-card p-4 sm:p-6 border-accent/10">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                            <div>
                                <h3 className="text-lg font-bold text-white italic uppercase">Protocol Queue</h3>
                                <p className="text-[10px] text-secondary mt-1 uppercase font-black tracking-widest opacity-60">Handshakes awaiting audit.</p>
                            </div>
                            <div className="bg-accent/10 text-accent px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-accent/20 w-full sm:w-auto text-center">
                                {subscriptionRequests.length} Handshakes Pending
                            </div>
                        </div>
                        <div className="overflow-x-auto -mx-4 sm:mx-0">
                            <Table
                                columns={requestColumns}
                                data={subscriptionRequests}
                                actions={true}
                                onView={(item) => swalInfo('Registry Audit', item.clientName)}
                                onDelete={async (item) => {
                                    if ((await swalConfirm('Reject', `Reject registry for ${item.clientName}?`)).isConfirmed) {
                                        deleteSubscriptionRequest(item.id);
                                    }
                                }}
                                customAction={(row) => (
                                    <div className="flex bg-white/5 p-1 rounded-full border border-white/10 mr-3 items-center shadow-inner shrink-0">
                                        <button
                                            onClick={async () => {
                                                const result = await updateSubscriptionRequest(row.id, 'Approved');
                                                if (result) {
                                                    setProvisioningResult(result);
                                                    setIsSuccessModalOpen(true);
                                                }
                                            }}
                                            className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-tighter transition-all flex items-center gap-1.5 ${row.status === 'Approved' || row.status === 'Provisioned' ? 'bg-success text-black' : 'text-secondary hover:text-success hover:bg-success/10'}`}
                                        >
                                            <CheckCircle2 size={10} strokeWidth={4} /> {row.status === 'Provisioned' ? 'Provisioned' : 'Approve'}
                                        </button>
                                        <div className="w-[1px] h-3 bg-white/10 mx-1"></div>
                                        <button
                                            onClick={() => updateSubscriptionRequest(row.id, 'Rejected')}
                                            className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-tighter transition-all flex items-center gap-1.5 ${row.status === 'Rejected' ? 'bg-danger text-white' : 'text-secondary hover:text-danger hover:bg-danger/10'}`}
                                        >
                                            <X size={10} strokeWidth={4} /> Reject
                                        </button>
                                    </div>
                                )}
                            />
                        </div>
                        {requestPagination && (
                            <div className="mt-6 border-t border-white/5 pt-6">
                                <Pagination
                                    currentPage={requestPage}
                                    totalPages={requestPagination.totalPages}
                                    onPageChange={setRequestPage}
                                    totalItems={requestPagination.totalItems}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'companies' && (
                <div className="space-y-8">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                        {[
                            { label: 'Total Companies', value: activeCompanies.length, color: 'text-white' },
                            { label: 'Active Trials', value: clients.filter(c => c.status === 'Trial').length, color: 'text-white' },
                            { label: 'Paused (Arrears)', value: clients.filter(c => c.status === 'Paused').length, color: 'text-danger' },
                            { 
                                label: 'Monthly Recurring', 
                                value: `$${clients.reduce((acc, c) => {
                                    const plan = accessPlans.find(p => p.name === c.plan || p.tier === c.plan);
                                    const price = plan ? parseFloat(plan.price.replace(/[^0-9.]/g, '')) : 0;
                                    return acc + price;
                                }, 0).toLocaleString()}`, 
                                color: 'text-accent' 
                            }
                        ].map((stat, i) => (
                            <div key={i} className="glass-card p-5 border-white/5 bg-white/[0.02]">
                                <p className="text-[10px] text-muted font-black uppercase tracking-[0.2em] mb-2">{stat.label}</p>
                                <p className={`text-2xl font-black italic ${stat.color}`}>{stat.value}</p>
                            </div>
                        ))}
                    </div>

                    <div className="glass-card p-4 sm:p-6 border-white/5">
                        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-8">
                            <h3 className="text-lg font-bold text-white italic uppercase">Workspace Portfolio</h3>
                            <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto">
                                <div className="relative flex-1 sm:flex-none">
                                    <input
                                        type="text"
                                        placeholder="Search Company..."
                                        value={companySearch}
                                        onChange={(e) => {
                                            setCompanySearch(e.target.value);
                                            setCompanyPage(1);
                                        }}
                                        className="bg-white/5 border border-white/10 rounded-xl py-3 px-10 text-xs focus:border-accent outline-none w-full sm:w-64"
                                    />
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={14} />
                                </div>
                                <button
                                    onClick={() => handleOpenEntityModal()}
                                    className="btn-primary py-3 px-6 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
                                >
                                    <Building size={14} /> Provision Entity
                                </button>
                            </div>
                        </div>
                        <div className="overflow-x-auto -mx-4 sm:mx-0">
                            <Table
                                columns={companyColumns}
                                data={activeCompanies}
                                actions={true}
                                onView={(item) => { setSelectedCompany(item); setActiveTab('workspace'); }}
                                onEdit={(item) => handleOpenEntityModal(item)}
                                onDelete={(item) => handleDeleteEntity(item.id)}
                            />
                        </div>
                        {companyPagination && (
                            <div className="mt-6 border-t border-white/5 pt-6">
                                <Pagination
                                    currentPage={companyPage}
                                    totalPages={companyPagination.totalPages}
                                    onPageChange={setCompanyPage}
                                    totalItems={companyPagination.totalItems}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'workspace' && (
                <div className="space-y-6">
                    {selectedCompany ? (
                        <div className="glass-card p-4 sm:p-8 border-accent/20 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>
                            <div className="relative z-10">
                                <div className="flex flex-col md:flex-row items-start md:items-center gap-6 mb-10">
                                    <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center text-accent border border-accent/30 overflow-hidden shrink-0 ring-4 ring-accent/10 ring-offset-4 ring-offset-sidebar shadow-2xl">
                                        {selectedCompany.logo ? (
                                            <img src={selectedCompany.logo} alt="Logo" className="w-full h-full object-contain" />
                                        ) : (
                                            <Building size={40} />
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <h2 className="text-2xl md:text-3xl font-black text-white italic truncate max-w-[200px] sm:max-w-none">{selectedCompany.companyName || selectedCompany.name}</h2>
                                            <span className="px-3 py-1 bg-success/10 text-success rounded-full text-[8px] md:text-[10px] font-black uppercase tracking-widest border border-success/20">Environment Live</span>
                                        </div>
                                        <p className="text-secondary font-mono text-xs md:text-sm uppercase tracking-wider opacity-60">
                                            {selectedCompany.workspace_id} <span className="mx-2 text-white/10">|</span> <span className="text-accent">{selectedCompany.plan} Protocol</span>
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                                    <div className="xl:col-span-2 space-y-6">
                                        <div className="bg-black/60 rounded-3xl border border-white/5 p-6 sm:p-10 min-h-[300px] sm:min-h-[450px] flex flex-col items-center justify-center text-center space-y-6 relative overflow-hidden backdrop-blur-xl">
                                            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-accent/[0.02] pointer-events-none"></div>
                                            <Layout className="text-accent/20 animate-pulse relative z-10" size={80} strokeWidth={1} />
                                            <div className="relative z-10">
                                                <p className="text-white font-black text-xl italic uppercase tracking-tighter">Virtual Workspace Terminal</p>
                                                <p className="text-secondary text-xs max-w-sm mx-auto mt-3 font-medium italic leading-relaxed">Initializing secure bridge to institutional sub-entity environment. Satellite encryption handshake in progress.</p>
                                            </div>
                                            <button
                                                onClick={() => window.open(`https://${selectedCompany.name.toLowerCase().replace(/\s+/g, '-')}.zanezion.com/admin`, '_blank')}
                                                className="btn-primary py-3.5 px-10 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-3 relative z-10 shadow-2xl ring-4 ring-accent/5"
                                            >
                                                <ExternalLink size={14} /> Remote Access
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-6">
                                        <div className="glass-card p-6 bg-white/[0.01] border-white/5">
                                            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-accent mb-6 flex items-center gap-2">
                                                <Shield className="shrink-0" size={14} /> Instance Security
                                            </h4>
                                            <div className="space-y-5">
                                                {[
                                                    { label: 'DB Region', value: 'US-EAST-1 (Nassau)', mono: true },
                                                    { label: 'Encryption', value: 'AES-256 (VALID)', status: 'success' },
                                                    { label: 'Access Logs', value: 'Syncing...', italic: true }
                                                ].map((item, i) => (
                                                    <div key={i} className="flex justify-between items-center bg-white/[0.02] p-3 rounded-xl border border-white/5">
                                                        <span className="text-[10px] text-muted font-bold uppercase tracking-wider">{item.label}</span>
                                                        <span className={`text-[10px] font-black uppercase ${item.mono ? 'font-mono' : ''} ${item.status === 'success' ? 'text-success' : 'text-white'}`}>
                                                            {item.value}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="glass-card p-6 bg-accent/[0.01] border-accent/10">
                                            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-white mb-6">Subscription Alpha</h4>
                                            <div className="p-4 bg-accent/5 rounded-2xl border border-accent/20 mb-6 group hover:bg-accent/10 transition-colors">
                                                <p className="text-[8px] font-black text-accent uppercase tracking-[0.2em] mb-1">Active Tier</p>
                                                <p className="text-lg font-black text-white italic">{selectedCompany.plan} Protocol</p>
                                            </div>
                                            <button
                                                onClick={() => swalInfo('Portal', `Redirecting to Portal for ${selectedCompany.name}...`)}
                                                className="w-full py-3.5 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-secondary hover:text-white hover:bg-white/10 transition-all"
                                            >
                                                Manage Billings
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="glass-card p-12 sm:p-20 text-center border-white/5 bg-white/[0.02]">
                            <Layout className="text-muted/20 mx-auto mb-6" size={80} strokeWidth={1} />
                            <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">No Workspace Selected</h3>
                            <p className="text-secondary max-w-md mx-auto mt-4 text-xs font-medium italic opacity-60 leading-relaxed">Please select an active company from the Portfolio registry to initiate a real-time gateway handshake.</p>
                            <button
                                onClick={() => setActiveTab('companies')}
                                className="btn-primary mt-10 py-4 px-10 text-[10px] uppercase font-black tracking-[0.3em] inline-flex items-center gap-3 shadow-2xl"
                            >
                                View Portfolio <ArrowRight size={14} />
                            </button>
                        </div>
                    )}
                </div>
            )}

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={
                    modalType === 'plan'
                        ? (editingPlan ? 'Modify Plan Protocol' : 'Design New Plan Protocol')
                        : (editingEntity ? 'Modify Entity Workspace' : 'Provision New Entity Workspace')
                }
            >
                <form onSubmit={handleSave} className="space-y-4">
                    {modalType === 'plan' ? (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-secondary">Plan Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-accent outline-none"
                                        placeholder="e.g. Platinum Protocol"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-secondary">Tier / Label</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.tier}
                                        onChange={(e) => setFormData({ ...formData, tier: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-accent outline-none"
                                        placeholder="e.g. Enterprise"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-secondary">Monthly Price</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.price}
                                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-accent outline-none"
                                        placeholder="$499"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-secondary">Yearly Price</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.yearlyPrice}
                                        onChange={(e) => setFormData({ ...formData, yearlyPrice: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-accent outline-none"
                                        placeholder="$4999"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-secondary">Description</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-accent outline-none"
                                    placeholder="Brief protocol summary..."
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-secondary flex justify-between">
                                    <span>Features List</span>
                                    <span>(One per line)</span>
                                </label>
                                <textarea
                                    required
                                    rows={5}
                                    value={formData.features}
                                    onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-accent outline-none resize-none"
                                    placeholder="Feature 1&#10;Feature 2&#10;Feature 3"
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-secondary">Company Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-accent outline-none"
                                        placeholder="e.g. Stark Industries"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-secondary">Location</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.location}
                                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-accent outline-none"
                                        placeholder="e.g. New York, USA"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-secondary">Primary Contact</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.contact}
                                        onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-accent outline-none"
                                        placeholder="Full Name"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-secondary">Email Address</label>
                                    <input
                                        type="email"
                                        required
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-accent outline-none"
                                        placeholder="contact@company.com"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-secondary">Subscription Protocol</label>
                                    <select
                                        value={formData.plan}
                                        onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-accent outline-none appearance-none"
                                    >
                                        <option value="Standard">Standard Protocol</option>
                                        <option value="Executive">Executive Protocol</option>
                                        <option value="Platinum">Platinum Protocol</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-secondary">Operational Status</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-accent outline-none appearance-none"
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Trial">Trial</option>
                                        <option value="Paused">Paused (Arrears)</option>
                                    </select>
                                </div>
                            </div>
                        </>
                    )}

                    <button
                        type="submit"
                        className="w-full py-4 bg-accent text-black rounded-xl text-xs font-black uppercase tracking-widest hover:bg-white transition-all shadow-lg"
                    >
                        {modalType === 'plan'
                            ? (editingPlan ? 'Commit Protocol Changes' : 'Initialize Protocol')
                            : (editingEntity ? 'Update Workspace' : 'Provision Environment')}
                    </button>
                </form>
            </Modal>

            <Modal
                isOpen={isSuccessModalOpen}
                onClose={() => setIsSuccessModalOpen(false)}
                title="Provisioning Complete"
            >
                {provisioningResult && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 bg-success/10 p-4 rounded-2xl border border-success/20">
                            <div className="w-12 h-12 bg-success text-black rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-success/20">
                                <ShieldIcon size={24} />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-white uppercase tracking-widest">{provisioningResult.clientName}</h3>
                                <p className="text-[10px] text-success font-bold uppercase tracking-widest">Protocol Active: {provisioningResult.plan}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            <div className="bg-white/[0.03] border border-white/10 p-3 rounded-xl flex items-center justify-between group">
                                <div className="space-y-0.5">
                                    <p className="text-[8px] font-black text-accent uppercase tracking-[0.2em]">Institutional ID</p>
                                    <p className="text-xs font-mono text-white">{provisioningResult.email}</p>
                                </div>
                                <button
                                    onClick={() => { navigator.clipboard.writeText(provisioningResult.email); swalCopied('ID Copied'); }}
                                    className="p-2 bg-white/5 hover:bg-accent hover:text-black rounded-lg transition-all"
                                >
                                    <Copy size={12} />
                                </button>
                            </div>

                            <div className="bg-white/[0.03] border border-white/10 p-3 rounded-xl flex items-center justify-between group">
                                <div className="space-y-0.5">
                                    <p className="text-[8px] font-black text-accent uppercase tracking-[0.2em]">Encryption Key</p>
                                    <p className="text-xs font-mono text-white font-bold">{provisioningResult.password}</p>
                                </div>
                                <button
                                    onClick={() => { navigator.clipboard.writeText(provisioningResult.password); swalCopied('Key Copied'); }}
                                    className="p-2 bg-white/5 hover:bg-accent hover:text-black rounded-lg transition-all"
                                >
                                    <Copy size={12} />
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={() => setIsSuccessModalOpen(false)}
                            className="w-full py-3 bg-white text-black rounded-xl text-[10px] font-black uppercase tracking-[0.3em] hover:bg-accent transition-all shadow-xl"
                        >
                            Finalize Provisioning
                        </button>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default SaaSManagement;
