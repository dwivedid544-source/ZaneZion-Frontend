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
                    <p className="text-secondary text-xs font-black uppercase tracking-[0.2em] opacity-70">Institutional access protocols are view-only.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Roles Column */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="flex items-center justify-between border-l-2 border-accent pl-3">
                        <p className="text-xs font-black text-white uppercase tracking-widest">Institutional Roles</p>
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
                                    </tr>
                                </thead>
                                <tbody>
                                    {menus.filter(menu => {
                                        // Only show rows where the role has AT LEAST ONE permission
                                        const perms = permissionMatrix[menu.id] || {};
                                        return perms.can_view || perms.can_add || perms.can_edit || perms.can_delete;
                                    }).map(menu => {
                                        const perms = permissionMatrix[menu.id] || {};
                                        return (
                                            <tr key={menu.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                                <td className="px-6 py-3">
                                                    <span className="text-xs font-bold text-white uppercase tracking-wider">{menu.name}</span>
                                                    <span className="block text-[9px] text-muted">{menu.path}</span>
                                                </td>
                                                {ACTION_COLS.map(col => (
                                                    <td key={col.key} className="px-4 py-3 text-center">
                                                        <div
                                                            className={`w-7 h-7 rounded-lg flex items-center justify-center mx-auto ${
                                                                perms[col.key]
                                                                    ? 'bg-accent/20 text-accent'
                                                                    : 'text-white/10'
                                                            }`}
                                                        >
                                                            {perms[col.key] ? <Check size={14} /> : <X size={10} />}
                                                        </div>
                                                    </td>
                                                ))}
                                            </tr>
                                        );
                                    })}
                                    
                                    {/* Empty state if no permissions */}
                                    {menus.filter(menu => {
                                        const perms = permissionMatrix[menu.id] || {};
                                        return perms.can_view || perms.can_add || perms.can_edit || perms.can_delete;
                                    }).length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-8 text-center text-secondary text-xs uppercase tracking-widest">
                                                No specific access protocols defined for this role.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="p-6 rounded-2xl bg-black/40 border border-white/5 flex gap-4">
                        <Lock className="text-secondary shrink-0" size={24} />
                        <div>
                            <p className="text-[10px] font-black text-secondary uppercase tracking-widest mb-1">View Only Protocol</p>
                            <p className="text-[9px] text-muted leading-relaxed uppercase">Role permissions are globally enforced by the system. Any modifications require a core system update.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RolesPermissions;
