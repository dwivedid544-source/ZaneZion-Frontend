import React, { useState, useEffect } from 'react';
import { swalSuccess, swalError, swalWarning, swalInfo, swalConfirm, swalCredentials, swalCopied } from '../../utils/swal';
import api from '../../services/api/setupAxios.js';
import { Users, Shield, Eye, Plus, Pencil, Trash2, Check, X, Zap, Save, RefreshCcw, Search, ShieldAlert, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ACTION_COLS = [
    { key: 'can_view', label: 'View', icon: Eye, color: 'text-info' },
    { key: 'can_add', label: 'Add', icon: Plus, color: 'text-success' },
    { key: 'can_edit', label: 'Edit', icon: Pencil, color: 'text-warning' },
    { key: 'can_delete', label: 'Delete', icon: Trash2, color: 'text-danger' },
];

const SaaSClients = () => {
    const [clients, setClients] = useState([]);
    const [selectedClient, setSelectedClient] = useState(null);
    const [menus, setMenus] = useState([]);
    const [permissionMatrix, setPermissionMatrix] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchClients();
    }, []);

    const fetchClients = async () => {
        setLoading(true);
        try {
            const res = await api.get('/clients');
            if (res.data?.success) {
                // Filter only SaaS clients (from landing page)
                const saasClients = res.data.data.filter(c =>
                    c.client_type === 'SaaS' || c.clientType === 'SaaS' || c.source === 'Subscriber'
                );
                setClients(saasClients);
                if (saasClients.length > 0) {
                    handleSelectClient(saasClients[0]);
                }
            }
        } catch (error) {
            console.error('Failed to fetch clients', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectClient = async (client) => {
        setSelectedClient(client);
        setSuccessMsg('');
        try {
            const res = await api.get(`/clients/${client.id}/permissions`);
            if (res.data?.success) {
                const matrix = {};
                res.data.data.forEach(p => {
                    matrix[p.id] = {
                        can_view: !!p.can_view,
                        can_add: !!p.can_add,
                        can_edit: !!p.can_edit,
                        can_delete: !!p.can_delete,
                    };
                });
                setMenus(res.data.data);
                setPermissionMatrix(matrix);
            }
        } catch (error) {
            console.error('Failed to fetch client permissions', error);
        }
    };

    const handleToggle = (menuId, actionKey) => {
        setPermissionMatrix(prev => ({
            ...prev,
            [menuId]: {
                ...prev[menuId],
                [actionKey]: !prev[menuId]?.[actionKey],
            }
        }));
    };

    const handleToggleAll = (menuId) => {
        const current = permissionMatrix[menuId] || {};
        const allEnabled = ACTION_COLS.every(a => current[a.key]);
        setPermissionMatrix(prev => ({
            ...prev,
            [menuId]: ACTION_COLS.reduce((acc, a) => ({ ...acc, [a.key]: !allEnabled }), {})
        }));
    };

    const handleSavePermissions = async () => {
        if (!selectedClient) return;
        setSaving(true);
        setSuccessMsg('');
        try {
            const validMenuIds = new Set(menus.map(m => m.id));
            const permissions = Object.entries(permissionMatrix)
                .filter(([menuId]) => validMenuIds.has(parseInt(menuId)))
                .map(([menuId, actions]) => ({
                    menu_id: parseInt(menuId),
                    ...actions
                }));

            const res = await api.post(`/clients/${selectedClient.id}/permissions`, { permissions });
            if (res.data?.success) {
                setSuccessMsg('Access protocols deployed!');
                setTimeout(() => setSuccessMsg(''), 3000);
            }
        } catch (error) {
            console.error('Failed to save permissions', error);
            swalError('Error', 'Failed to save permissions.');
        } finally {
            setSaving(false);
        }
    };

    const filteredClients = clients.filter(c =>
        (c.name || c.business_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.email || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <RefreshCcw className="animate-spin text-accent" size={48} />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tighter text-white italic uppercase mb-1 flex items-center gap-3">
                        <Users className="text-accent" /> SaaS Client Access
                    </h1>
                    <p className="text-secondary text-xs font-black uppercase tracking-[0.2em] opacity-70">
                        Manage menu visibility & permissions for landing page SaaS clients
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {successMsg && (
                        <span className="text-success text-xs font-bold uppercase tracking-widest animate-pulse">{successMsg}</span>
                    )}
                    <button
                        className="btn-primary flex items-center gap-2 h-12 px-8 disabled:opacity-50"
                        onClick={handleSavePermissions}
                        disabled={saving || !selectedClient}
                    >
                        {saving ? <RefreshCcw className="animate-spin" size={16} /> : <Save size={16} />}
                        {saving ? 'DEPLOYING...' : 'SAVE ACCESS'}
                    </button>
                </div>
            </div>

            {clients.length === 0 ? (
                <div className="glass-card p-12 text-center">
                    <Users className="mx-auto text-muted mb-4" size={48} />
                    <h3 className="text-lg font-bold text-white mb-2">No SaaS Clients Yet</h3>
                    <p className="text-secondary text-sm">SaaS clients who subscribe from the landing page will appear here.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Client List */}
                    <div className="lg:col-span-1 space-y-4">
                        <p className="text-xs font-black text-white uppercase tracking-widest border-l-2 border-accent pl-3">
                            SaaS Clients
                        </p>

                        <div className="relative mb-3">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
                            <input
                                type="text"
                                placeholder="Filter..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-background border border-border rounded-lg py-2 pl-9 pr-4 text-xs focus:outline-none focus:border-accent"
                            />
                        </div>

                        <div className="glass-card p-2 space-y-1 max-h-[65vh] overflow-y-auto custom-scrollbar">
                            {filteredClients.map(client => (
                                <button
                                    key={client.id}
                                    onClick={() => handleSelectClient(client)}
                                    className={`w-full text-left p-4 rounded-xl transition-all group ${
                                        selectedClient?.id === client.id
                                            ? 'bg-accent text-black font-bold'
                                            : 'hover:bg-white/5 text-secondary hover:text-white'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="min-w-0">
                                            <span className="uppercase text-xs tracking-widest font-bold block truncate">
                                                {client.business_name || client.name}
                                            </span>
                                            <span className={`text-[9px] tracking-wide block truncate ${
                                                selectedClient?.id === client.id ? 'text-black/60' : 'text-muted'
                                            }`}>
                                                {client.email}
                                            </span>
                                        </div>
                                        <ChevronRight size={14} className={`shrink-0 ${
                                            selectedClient?.id === client.id ? 'text-black' : 'text-accent opacity-0 group-hover:opacity-100'
                                        }`} />
                                    </div>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                                            selectedClient?.id === client.id
                                                ? 'bg-black/10 text-black'
                                                : 'bg-info/20 text-info'
                                        }`}>
                                            {client.plan || 'Starter'}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                                            (client.status || '').toLowerCase() === 'active'
                                                ? (selectedClient?.id === client.id ? 'bg-black/10 text-black' : 'bg-success/20 text-success')
                                                : (selectedClient?.id === client.id ? 'bg-black/10 text-black' : 'bg-warning/20 text-warning')
                                        }`}>
                                            {client.status || 'Active'}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Permissions Matrix */}
                    <div className="lg:col-span-3 space-y-4">
                        <p className="text-xs font-black text-white uppercase tracking-widest border-l-2 border-accent pl-3">
                            Access Matrix: {selectedClient?.business_name || selectedClient?.name || '—'}
                        </p>

                        {selectedClient && (
                            <div className="glass-card p-4 mb-2 flex items-center gap-6 flex-wrap">
                                <div>
                                    <span className="text-[9px] text-muted font-black uppercase tracking-widest">Client</span>
                                    <p className="text-sm font-bold text-white">{selectedClient.business_name || selectedClient.name}</p>
                                </div>
                                <div>
                                    <span className="text-[9px] text-muted font-black uppercase tracking-widest">Email</span>
                                    <p className="text-sm text-white">{selectedClient.email}</p>
                                </div>
                                <div>
                                    <span className="text-[9px] text-muted font-black uppercase tracking-widest">Plan</span>
                                    <p className="text-sm font-bold text-accent">{selectedClient.plan || 'Starter'}</p>
                                </div>
                                <div>
                                    <span className="text-[9px] text-muted font-black uppercase tracking-widest">Status</span>
                                    <p className={`text-sm font-bold ${(selectedClient.status || '').toLowerCase() === 'active' ? 'text-success' : 'text-warning'}`}>
                                        {selectedClient.status || 'Active'}
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="glass-card overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-white/10">
                                            <th className="text-left px-6 py-4 text-[10px] text-accent font-black uppercase tracking-widest">Menu</th>
                                            {ACTION_COLS.map(col => (
                                                <th key={col.key} className="px-4 py-4 text-center">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <col.icon size={14} className={col.color} />
                                                        <span className="text-[9px] font-black uppercase tracking-widest text-secondary">{col.label}</span>
                                                    </div>
                                                </th>
                                            ))}
                                            <th className="px-4 py-4 text-center">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-secondary">All</span>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {menus.map(menu => {
                                            const perms = permissionMatrix[menu.id] || {};
                                            const allEnabled = ACTION_COLS.every(a => perms[a.key]);
                                            return (
                                                <tr key={menu.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                                    <td className="px-6 py-3">
                                                        <span className="text-xs font-bold text-white uppercase tracking-wider">{menu.name}</span>
                                                        <span className="block text-[9px] text-muted">{menu.path}</span>
                                                    </td>
                                                    {ACTION_COLS.map(col => (
                                                        <td key={col.key} className="px-4 py-3 text-center">
                                                            <button
                                                                onClick={() => handleToggle(menu.id, col.key)}
                                                                className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-all mx-auto ${
                                                                    perms[col.key]
                                                                        ? 'bg-accent border-accent text-black shadow-lg shadow-accent/20'
                                                                        : 'border-white/10 text-muted hover:border-white/20 hover:bg-white/5'
                                                                }`}
                                                            >
                                                                {perms[col.key] ? <Check size={14} /> : <X size={10} className="opacity-30" />}
                                                            </button>
                                                        </td>
                                                    ))}
                                                    <td className="px-4 py-3 text-center">
                                                        <button
                                                            onClick={() => handleToggleAll(menu.id)}
                                                            className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-all mx-auto ${
                                                                allEnabled
                                                                    ? 'bg-success/20 border-success/40 text-success'
                                                                    : 'border-white/10 text-muted hover:border-white/20'
                                                            }`}
                                                        >
                                                            <Zap size={12} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="p-6 rounded-2xl bg-info/5 border border-info/20 flex gap-4">
                            <ShieldAlert className="text-info shrink-0" size={24} />
                            <div>
                                <p className="text-[10px] font-black text-info uppercase tracking-widest mb-1">Client Access Info</p>
                                <p className="text-[9px] text-info/70 leading-relaxed uppercase">
                                    These permissions control what the SaaS client can see when they log in. Changes take effect after the client re-logs in.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SaaSClients;

