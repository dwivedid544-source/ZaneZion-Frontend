import React, { useState, useEffect } from 'react';
import { swalSuccess, swalError, swalWarning, swalInfo, swalConfirm, swalCredentials, swalCopied } from '../../utils/swal';
import { useData } from '../../context/GlobalDataContext';
import api from '../../services/api/setupAxios.js';
import { Shield, Lock, Check, X, ShieldAlert, Zap, Save, RefreshCcw, Eye, Plus, Pencil, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ACTION_COLS = [
    { key: 'can_view', label: 'View', icon: Eye, color: 'text-info' },
    { key: 'can_add', label: 'Add', icon: Plus, color: 'text-success' },
    { key: 'can_edit', label: 'Edit', icon: Pencil, color: 'text-warning' },
    { key: 'can_delete', label: 'Delete', icon: Trash2, color: 'text-danger' },
];

const RolesPermissions = () => {
    const { roles: defaultRoles } = useData();
    const [roles, setRoles] = useState([]);
    const [menus, setMenus] = useState([]);
    const [selectedRole, setSelectedRole] = useState(null);
    const [permissionMatrix, setPermissionMatrix] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newRoleName, setNewRoleName] = useState('');
    const [newRoleDesc, setNewRoleDesc] = useState('');

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const [rolesRes, menusRes] = await Promise.all([
                api.get('/roles'),
                api.get('/roles/menus')
            ]);

            const rolesData = rolesRes.data?.data;
            const rolesArray = Array.isArray(rolesData) ? rolesData : (rolesData?.roles || []);

            const filteredRoles = rolesArray.filter(role => 
                !['superadmin', 'super_admin'].includes(String(role.name).toLowerCase().trim())
            );

            if (rolesRes.data?.success) setRoles(filteredRoles);
            const MENU_SEQUENCE = [
                'Dashboard', 'Marketplace', 'Customers', 'Staff & Users', 'Orders',
                'Deliveries', 'Invoices', 'Purchase Requests', 'Quotes', 'Purchase Orders',
                'Inventory', 'Audit Protocol', 'Warehouses', 'Vendors', 'Events',
                'Guest Requests', 'Luxury Items', 'Chauffeur', 'Support', 'Plans', 'Settings'
            ];
            if (menusRes.data?.success) {
                const fetchedMenus = menusRes.data.data;
                fetchedMenus.sort((a, b) => {
                    const idxA = MENU_SEQUENCE.indexOf(a.name);
                    const idxB = MENU_SEQUENCE.indexOf(b.name);
                    if (idxA === -1 && idxB === -1) return a.name.localeCompare(b.name);
                    if (idxA === -1) return 1;
                    if (idxB === -1) return -1;
                    return idxA - idxB;
                });
                setMenus(fetchedMenus);
            }

            if (filteredRoles.length > 0) {
                handleSelectRole(filteredRoles[0]);
            }
        } catch (error) {
            console.error("Failed to fetch RBAC data", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectRole = async (role) => {
        setSelectedRole(role);
        setSuccessMsg('');
        try {
            const res = await api.get(`/roles/${role.id}/permissions`);
            if (res.data?.success) {
                // Build matrix: { [menu_id]: { can_view, can_add, can_edit, can_delete } }
                const matrix = {};
                res.data.data.forEach(p => {
                    matrix[p.menuId || p.menu?.id] = {
                        can_view: !!p.can_view,
                        can_add: !!p.can_add,
                        can_edit: !!p.can_edit,
                        can_delete: !!p.can_delete,
                    };
                });
                setPermissionMatrix(matrix);
            }
        } catch (error) {
            console.error("Failed to fetch role permissions", error);
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
        if (!selectedRole) return;
        setSaving(true);
        setSuccessMsg('');
        try {
            // Get current menu IDs for filtering
            const validMenuIds = new Set(menus.map(m => m.id));

            const permissions = Object.entries(permissionMatrix)
                .filter(([menuId]) => validMenuIds.has(parseInt(menuId)))
                .map(([menuId, actions]) => ({
                    menu_id: parseInt(menuId),
                    ...actions
                }));

            const res = await api.post(`/roles/${selectedRole.id}/permissions`, { permissions });
            if (res.data?.success) {
                setSuccessMsg('Permissions saved successfully!');
                setTimeout(() => setSuccessMsg(''), 3000);
            }
        } catch (error) {
            console.error("Failed to save permissions", error);
            swalError('Access Denied', 'Security override failed.');
        } finally {
            setSaving(false);
        }
    };

    const handleCreateRole = async () => {
        if (!newRoleName) return;
        try {
            const res = await api.post('/roles', { name: newRoleName, description: newRoleDesc });
            if (res.data?.success) {
                swalSuccess('Success', 'Role created successfully');
                setIsCreateModalOpen(false);
                setNewRoleName('');
                setNewRoleDesc('');
                fetchInitialData();
            }
        } catch (error) {
            swalError('Error', 'Failed to create role. ' + (error.response?.data?.message || ''));
        }
    };

    const handleDeleteRole = async (roleId) => {
        if (!window.confirm('Are you sure you want to delete this role?')) return;
        try {
            const res = await api.delete(`/roles/${roleId}`);
            if (res.data?.success) {
                swalSuccess('Deleted', 'Role deleted successfully');
                fetchInitialData();
            }
        } catch (error) {
            swalError('Error', 'Failed to delete role.');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <RefreshCcw className="animate-spin text-accent" size={48} />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tighter text-white italic uppercase mb-1 flex items-center gap-3">
                        <Shield className="text-accent" /> Security Hub & RBAC
                    </h1>
                    <p className="text-secondary text-xs font-black uppercase tracking-[0.2em] opacity-70">Define access protocols · Menu & Action level controls.</p>
                </div>
                <div className="flex items-center gap-3">
                    {successMsg && (
                        <span className="text-success text-xs font-bold uppercase tracking-widest animate-pulse">{successMsg}</span>
                    )}
                    <button
                        className="btn-primary flex items-center gap-2 h-12 px-8 disabled:opacity-50"
                        onClick={handleSavePermissions}
                        disabled={saving}
                    >
                        {saving ? <RefreshCcw className="animate-spin" size={16} /> : <Save size={16} />}
                        {saving ? 'DEPLOYING...' : 'SAVE PROTOCOLS'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Roles Column */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="flex items-center justify-between border-l-2 border-accent pl-3">
                        <p className="text-xs font-black text-white uppercase tracking-widest">Institutional Roles</p>
                        <button 
                            onClick={() => setIsCreateModalOpen(true)}
                            className="bg-accent/10 text-accent hover:bg-accent hover:text-black p-1 rounded transition-all"
                        >
                            <Plus size={16} />
                        </button>
                    </div>
                    <div className="glass-card p-2 space-y-1">
                        {roles.map(role => (
                            <div key={role.id} className="relative group">
                                <button
                                    onClick={() => handleSelectRole(role)}
                                    className={`w-full text-left p-4 rounded-xl transition-all flex items-center justify-between ${
                                        selectedRole?.id === role.id
                                            ? 'bg-accent text-black font-bold'
                                            : 'hover:bg-white/5 text-secondary hover:text-white'
                                    }`}
                                >
                                    <span className="uppercase text-xs tracking-widest">{role.name.replace(/_/g, ' ')}</span>
                                    {selectedRole?.id === role.id ? <Lock size={14} className="text-black" /> : null}
                                </button>
                                {role.name !== 'superadmin' && role.name !== 'admin' && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleDeleteRole(role.id); }}
                                        className="absolute right-10 top-1/2 -translate-y-1/2 text-danger opacity-0 group-hover:opacity-100 p-2 hover:bg-danger/20 rounded"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Permissions Matrix */}
                <div className="lg:col-span-3 space-y-4">
                    <p className="text-xs font-black text-white uppercase tracking-widest border-l-2 border-accent pl-3">
                        Access Matrix: {selectedRole?.name?.toUpperCase().replace(/_/g, ' ')}
                    </p>
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

                    <div className="p-6 rounded-2xl bg-danger/5 border border-danger/20 flex gap-4">
                        <ShieldAlert className="text-danger shrink-0" size={24} />
                        <div>
                            <p className="text-[10px] font-black text-danger uppercase tracking-widest mb-1">Critical Security Alert</p>
                            <p className="text-[9px] text-danger/70 leading-relaxed uppercase">Modifying these matrices immediately alters the access protocols for all assigned personnel. Users must re-login to see updated menus.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Create Role Modal */}
            <AnimatePresence>
                {isCreateModalOpen && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="glass-card w-full max-w-md p-6 relative"
                        >
                            <button 
                                onClick={() => setIsCreateModalOpen(false)}
                                className="absolute top-4 right-4 text-secondary hover:text-white"
                            >
                                <X size={20} />
                            </button>
                            <h2 className="text-xl font-black text-white uppercase tracking-widest mb-6 border-l-4 border-accent pl-3">Create Role</h2>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1 block">Role Name</label>
                                    <input 
                                        type="text" 
                                        value={newRoleName}
                                        onChange={(e) => setNewRoleName(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm focus:border-accent focus:outline-none transition-colors"
                                        placeholder="e.g. Receptionist"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1 block">Description</label>
                                    <input 
                                        type="text" 
                                        value={newRoleDesc}
                                        onChange={(e) => setNewRoleDesc(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm focus:border-accent focus:outline-none transition-colors"
                                        placeholder="Brief description"
                                    />
                                </div>
                            </div>
                            
                            <div className="flex gap-3 mt-8">
                                <button 
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold uppercase tracking-widest text-white transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleCreateRole}
                                    disabled={!newRoleName}
                                    className="flex-1 py-3 bg-accent hover:bg-accent-hover rounded-xl text-xs font-bold uppercase tracking-widest text-black transition-colors disabled:opacity-50"
                                >
                                    Create
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default RolesPermissions;
