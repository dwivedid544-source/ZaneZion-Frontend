import React, { useState } from 'react';
import { ShieldCheck, Search, Plus, Star, Crown, Edit2, Trash2 } from 'lucide-react';
import { useData } from '../../context/GlobalDataContext';
import Modal from '../../components/Modal';

const ConciergeAccessPlans = () => {
    const { accessPlans, addPlan, updatePlan, deletePlan, fetchTickets, currentUser } = useData();
    const role = String(currentUser?.role?.name || currentUser?.role || '').toLowerCase().replace(/\s+/g, '_');
    const canManagePlans = ['super_admin', 'superadmin', 'admin'].includes(role);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState('add'); // 'add', 'edit', 'delete'
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        tier: '',
        price: '',
        period: '/ Month',
        description: '',
        features: ''
    });

    React.useEffect(() => {
        fetchTickets();
    }, []);

    const filteredPlans = (accessPlans || []).filter(p => 
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.tier?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleAction = (type, plan) => {
        setModalType(type);
        setSelectedPlan(plan);
        if (type === 'add') {
            setFormData({ name: '', tier: 'Gold', price: '', period: '/ Month', description: '', features: '' });
        } else if (plan) {
            setFormData({
                ...plan,
                features: Array.isArray(plan.features) ? plan.features.join('\n') : plan.features
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = (e) => {
        if (e) e.preventDefault();
        const planData = {
            ...formData,
            features: typeof formData.features === 'string' ? formData.features.split('\n').filter(f => f.trim()) : formData.features
        };

        if (modalType === 'add') {
            addPlan(planData);
        } else {
            updatePlan({ ...selectedPlan, ...planData });
        }
        setIsModalOpen(false);
    };

    const handleDelete = () => {
        if (selectedPlan?.id) {
            deletePlan(selectedPlan.id);
        }
        setIsModalOpen(false);
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white italic">VIP Access Setup</h1>
                    <p className="text-secondary mt-1 uppercase text-[10px] font-black tracking-widest opacity-60">Manage luxury venue access and VIP tier allocations for clients.</p>
                </div>
                {canManagePlans && (
                    <div className="flex gap-3">
                        <button className="btn-primary flex items-center gap-2" onClick={() => handleAction('add')}>
                            <Plus size={16} /> New VIP Access
                        </button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card p-6 flex flex-col gap-2 border-accent/10">
                    <Crown className="text-accent" size={24} />
                    <h3 className="font-bold">Diamond Tier</h3>
                    <p className="text-xs text-secondary italic">Unlimited event & yacht access</p>
                    <div className="mt-4 text-2xl font-black text-white italic">12 Active</div>
                </div>
                <div className="glass-card p-6 flex flex-col gap-2 border-accent/10">
                    <Star className="text-warning" size={24} />
                    <h3 className="font-bold">Gold Tier</h3>
                    <p className="text-xs text-secondary italic">Priority bookings & dining</p>
                    <div className="mt-4 text-2xl font-black text-white italic">45 Active</div>
                </div>
                <div className="glass-card p-6 flex flex-col gap-2 border-accent/10">
                    <ShieldCheck className="text-success" size={24} />
                    <h3 className="font-bold">Corporate Elite</h3>
                    <p className="text-xs text-secondary italic">Team access & bulk reservations</p>
                    <div className="mt-4 text-2xl font-black text-white italic">8 Active</div>
                </div>
            </div>

            <div className="glass-card p-6 border-white/5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div className="relative max-w-sm w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
                        <input
                            type="text"
                            placeholder="Search VIP Plans..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-background border border-border rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-accent"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-border/50 text-xs uppercase tracking-wider text-muted font-bold">
                                <th className="p-4 rounded-tl-xl">Plan Ref</th>
                                <th className="p-4">Protocol Name</th>
                                <th className="p-4">Access Type</th>
                                <th className="p-4">Requested Rate</th>
                                <th className="p-4 rounded-tr-xl text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm font-medium">
                            {filteredPlans.map((plan, idx) => (
                                <tr key={idx} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors group">
                                    <td className="p-4 font-black text-accent">{plan.id}</td>
                                    <td className="p-4 font-bold text-white">{plan.name}</td>
                                    <td className="p-4 text-secondary italic">{plan.tier}</td>
                                    <td className="p-4 text-secondary font-mono">${plan.price}{plan.period}</td>
                                    <td className="p-4 text-right">
                                        {canManagePlans && (
                                            <div className="flex justify-end gap-2 transition-opacity">
                                                <button onClick={() => handleAction('edit', plan)} className="p-2 hover:bg-accent hover:text-black rounded-lg transition-colors border border-white/5 bg-white/5">
                                                    <Edit2 size={14} />
                                                </button>
                                                <button onClick={() => handleAction('delete', plan)} className="p-2 hover:bg-danger hover:text-white rounded-lg transition-colors border border-white/5 bg-white/5">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {filteredPlans.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="p-12 text-center text-muted font-bold uppercase tracking-widest text-xs italic opacity-50">No access protocols found in secure registry.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={
                    modalType === 'add' ? 'Initialize VIP Protocol' :
                    modalType === 'edit' ? 'Modify Protocol Parameters' : 'Decommission Protocol'
                }
            >
                {modalType === 'delete' ? (
                    <div className="space-y-6">
                        <p className="text-secondary italic">Are you sure you want to decommission the <span className="text-white font-black italic">{selectedPlan?.name}</span>? This action is logged in audit.</p>
                        <div className="flex gap-3 justify-end pt-4">
                            <button onClick={() => setIsModalOpen(false)} className="btn-secondary px-6">Cancel</button>
                            <button onClick={handleDelete} className="px-6 py-2 bg-danger text-white rounded-lg font-black uppercase text-[10px] tracking-widest">Confirm Decommission</button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-muted tracking-widest">Protocol Name</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-muted tracking-widest">Access Tier</label>
                                <select
                                    value={formData.tier}
                                    onChange={(e) => setFormData({ ...formData, tier: e.target.value })}
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
                                <label className="text-[10px] font-black uppercase text-muted tracking-widest">Monthly Rate</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.price}
                                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-mono"
                                    placeholder="499"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-muted tracking-widest">Period</label>
                                <select
                                    value={formData.period}
                                    onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none appearance-none"
                                >
                                    <option>/ Month</option>
                                    <option>/ Year</option>
                                    <option>/ Lifetime</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-muted tracking-widest">Registry Description</label>
                            <input
                                type="text"
                                required
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none italic"
                                placeholder="Elite access for high-net-worth institutional partners..."
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-muted tracking-widest flex justify-between">
                                <span>Core Protocol Features</span>
                                <span>(One per line)</span>
                            </label>
                            <textarea
                                required
                                rows={5}
                                value={formData.features}
                                onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                                className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none resize-none min-h-[120px]"
                                placeholder="Feature 1&#10;Feature 2&#10;Feature 3"
                            />
                        </div>

                        <div className="flex gap-3 justify-end pt-4">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary px-6">Cancel</button>
                            <button type="submit" className="btn-primary px-8">Commit Protocol</button>
                        </div>
                    </form>
                )}
            </Modal>
        </div>
    );
};

export default ConciergeAccessPlans;
